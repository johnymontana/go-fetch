import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Neo4jService } from '../../lib/neo4j.js';
import type { Neo4jConfig, Entity, Memory, EntityRelationship } from '../../types/index.js';

// Mock neo4j-driver module
const mockSession = {
  run: jest.fn(),
  close: jest.fn(),
} as any;

const mockDriver = {
  session: jest.fn(),
  verifyConnectivity: jest.fn(),
  close: jest.fn(),
} as any;

jest.mock('neo4j-driver', () => ({
  __esModule: true,
  default: {
    driver: jest.fn(),
    auth: {
      basic: jest.fn().mockReturnValue('mock-auth'),
    },
  },
}));

// Get the mocked neo4j instance
const mockNeo4j = jest.mocked(require('neo4j-driver').default);

describe('Neo4jService', () => {
  let neo4jService: Neo4jService;
  let mockConfig: Neo4jConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'password',
    };

    // Reset mock implementations
    mockDriver.session.mockReturnValue(mockSession);
    mockDriver.verifyConnectivity.mockResolvedValue(undefined);
    mockSession.run.mockResolvedValue({ records: [] });
    mockNeo4j.driver.mockReturnValue(mockDriver);

    neo4jService = new Neo4jService(mockConfig);
  });

  describe('constructor', () => {
    it('should create Neo4jService instance', () => {
      expect(neo4jService).toBeInstanceOf(Neo4jService);
    });

    it('should not initialize driver in constructor', () => {
      expect(mockNeo4j.driver).not.toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should create driver with auth and verify connectivity', async () => {
      await neo4jService.initialize();

      expect(mockNeo4j.auth.basic).toHaveBeenCalledWith('neo4j', 'password');
      expect(mockNeo4j.driver).toHaveBeenCalledWith('bolt://localhost:7687', 'mock-auth');
      expect(mockDriver.verifyConnectivity).toHaveBeenCalled();
    });

    it('should create driver without auth when credentials not provided', async () => {
      const configWithoutAuth = { uri: 'bolt://localhost:7687' };
      const serviceWithoutAuth = new Neo4jService(configWithoutAuth);

      await serviceWithoutAuth.initialize();

      expect(mockNeo4j.auth.basic).not.toHaveBeenCalled();
      expect(mockNeo4j.driver).toHaveBeenCalledWith('bolt://localhost:7687', undefined);
    });

    it('should initialize Neo4j schema with constraints and indexes', async () => {
      const expectedSchemaQueries = [
        'CREATE CONSTRAINT entity_name_type_unique IF NOT EXISTS',
        'CREATE INDEX entity_name_index IF NOT EXISTS',
        'CREATE INDEX entity_type_index IF NOT EXISTS',
        'CREATE INDEX memory_timestamp_index IF NOT EXISTS',
        'CREATE VECTOR INDEX entity_embedding_index IF NOT EXISTS',
        'CREATE VECTOR INDEX memory_embedding_index IF NOT EXISTS',
      ];

      await neo4jService.initialize();

      // Should call run for each schema query
      expect(mockSession.run).toHaveBeenCalledTimes(expectedSchemaQueries.length);
      expectedSchemaQueries.forEach((query) => {
        expect(mockSession.run).toHaveBeenCalledWith(expect.stringContaining(query));
      });
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should throw error if connectivity check fails', async () => {
      mockDriver.verifyConnectivity.mockRejectedValue(new Error('Connection failed'));

      await expect(neo4jService.initialize()).rejects.toThrow('Connection failed');
    });
  });

  describe('saveEntity', () => {
    beforeEach(async () => {
      await neo4jService.initialize();
    });

    it('should save entity successfully and return element ID', async () => {
      const mockEntity: Entity = {
        name: 'John Doe',
        type: 'PERSON',
        description: 'Software engineer',
        createdAt: '2023-01-01T00:00:00Z',
        embedding: [0.1, 0.2, 0.3],
      };

      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue('element-123') }],
      });

      const result = await neo4jService.saveEntity(mockEntity);

      expect(result).toBe('element-123');
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (e:Entity {name: $name, type: $type})'),
        expect.objectContaining({
          name: 'John Doe',
          type: 'PERSON',
          description: 'Software engineer',
          createdAt: '2023-01-01T00:00:00Z',
          embedding: [0.1, 0.2, 0.3],
        })
      );
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle entity with coordinates', async () => {
      const mockEntity: Entity = {
        name: 'Google HQ',
        type: 'LOCATION',
        description: 'Google headquarters',
        createdAt: '2023-01-01T00:00:00Z',
        embedding: [0.1, 0.2, 0.3],
        coordinates: { latitude: 37.4220, longitude: -122.0841 },
      };

      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue('element-456') }],
      });

      await neo4jService.saveEntity(mockEntity);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          coordinates: { latitude: 37.4220, longitude: -122.0841 },
        })
      );
    });

    it('should throw error if no element ID returned', async () => {
      const mockEntity: Entity = {
        name: 'John Doe',
        type: 'PERSON',
        createdAt: '2023-01-01T00:00:00Z',
      };

      mockSession.run.mockResolvedValue({ records: [] });

      await expect(neo4jService.saveEntity(mockEntity)).rejects.toThrow('Failed to create entity');
    });

    it('should handle save errors properly', async () => {
      const mockEntity: Entity = {
        name: 'John Doe',
        type: 'PERSON',
        createdAt: '2023-01-01T00:00:00Z',
      };

      mockSession.run.mockRejectedValue(new Error('Neo4j error'));

      await expect(neo4jService.saveEntity(mockEntity)).rejects.toThrow('Neo4j error');
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('saveMemory', () => {
    beforeEach(async () => {
      await neo4jService.initialize();
    });

    it('should save memory with entity relationships', async () => {
      const mockMemory: Memory = {
        content: 'Meeting with John about project',
        timestamp: '2023-01-01T12:00:00Z',
        embedding: [0.4, 0.5, 0.6],
        entities: [],
      };

      const entityUids = ['element-123', 'element-456'];

      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue('memory-789') }],
      });

      const result = await neo4jService.saveMemory(mockMemory, entityUids);

      expect(result).toBe('memory-789');
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (m:Memory {'),
        expect.objectContaining({
          content: 'Meeting with John about project',
          timestamp: '2023-01-01T12:00:00Z',
          embedding: [0.4, 0.5, 0.6],
          entityUids: ['element-123', 'element-456'],
        })
      );
    });

    it('should handle memory save errors', async () => {
      const mockMemory: Memory = {
        content: 'Test content',
        timestamp: '2023-01-01T12:00:00Z',
        entities: [],
      };

      mockSession.run.mockRejectedValue(new Error('Save failed'));

      await expect(neo4jService.saveMemory(mockMemory, [])).rejects.toThrow('Save failed');
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('findEntitiesByName', () => {
    beforeEach(async () => {
      await neo4jService.initialize();
    });

    it('should find entities by name', async () => {
      const mockEntities = [
        {
          get: jest.fn()
            .mockReturnValueOnce('element-123') // uid
            .mockReturnValueOnce('John Doe') // name
            .mockReturnValueOnce('PERSON') // type
            .mockReturnValueOnce('Software engineer') // description
            .mockReturnValueOnce('2023-01-01T00:00:00Z') // createdAt
            .mockReturnValueOnce([0.1, 0.2, 0.3]), // embedding
        }
      ];

      mockSession.run.mockResolvedValue({ records: mockEntities });

      const result = await neo4jService.findEntitiesByName(['John Doe']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        uid: 'element-123',
        name: 'John Doe',
        type: 'PERSON',
        description: 'Software engineer',
        createdAt: '2023-01-01T00:00:00Z',
        embedding: [0.1, 0.2, 0.3],
      });

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('WHERE e.name IN $names'),
        { names: ['John Doe'] }
      );
    });

    it('should return empty array if no entities found', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      const result = await neo4jService.findEntitiesByName(['NonExistent']);

      expect(result).toEqual([]);
    });
  });

  describe('vectorSearch', () => {
    beforeEach(async () => {
      await neo4jService.initialize();
    });

    it('should perform vector search with default limit', async () => {
      const embedding = [0.1, 0.2, 0.3];
      const mockResults = [
        {
          get: jest.fn()
            .mockReturnValueOnce('element-123') // uid
            .mockReturnValueOnce('John Doe') // name
            .mockReturnValueOnce('PERSON') // type
            .mockReturnValueOnce('Software engineer') // description
            .mockReturnValueOnce('2023-01-01T00:00:00Z') // createdAt
            .mockReturnValueOnce([0.1, 0.2, 0.3]) // embedding
            .mockReturnValueOnce([]) // memories
            .mockReturnValueOnce([]) // relatedEntities
            .mockReturnValueOnce(0.95), // score
        }
      ];

      mockSession.run.mockResolvedValue({ records: mockResults });

      const result = await neo4jService.vectorSearch(embedding);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John Doe');
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining("CALL db.index.vector.queryNodes('entity_embedding_index', $limit, $embedding)"),
        expect.objectContaining({
          embedding,
          limit: 10,
        })
      );
    });

    it('should perform vector search with custom limit', async () => {
      const embedding = [0.1, 0.2, 0.3];
      mockSession.run.mockResolvedValue({ records: [] });

      await neo4jService.vectorSearch(embedding, 5);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ limit: 5 })
      );
    });
  });

  describe('saveEntityRelationships', () => {
    beforeEach(async () => {
      await neo4jService.initialize();
    });

    it('should save entity relationships', async () => {
      const relationships: EntityRelationship[] = [
        {
          fromEntity: 'John Doe',
          toEntity: 'TechCorp',
          type: 'WORKS_AT',
          validAt: '2023-01-01T00:00:00Z',
        }
      ];

      const entityNameToUid = new Map([
        ['John Doe', 'element-123'],
        ['TechCorp', 'element-456'],
      ]);

      await neo4jService.saveEntityRelationships(relationships, entityNameToUid);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (from)-[r:RELATED_TO'),
        expect.objectContaining({
          fromUid: 'element-123',
          toUid: 'element-456',
          relType: 'WORKS_AT',
          validAt: '2023-01-01T00:00:00Z',
        })
      );
    });

    it('should skip relationships with missing UIDs', async () => {
      const relationships: EntityRelationship[] = [
        {
          fromEntity: 'John Doe',
          toEntity: 'NonExistent',
          type: 'KNOWS',
        }
      ];

      const entityNameToUid = new Map([['John Doe', 'element-123']]);

      // Clear mocks to exclude initialization calls
      jest.clearAllMocks();

      await neo4jService.saveEntityRelationships(relationships, entityNameToUid);

      // Should not call run since the relationship is skipped
      expect(mockSession.run).not.toHaveBeenCalled();
    });

    it('should handle empty relationships array', async () => {
      const entityNameToUid = new Map();

      // Clear mocks to exclude initialization calls
      jest.clearAllMocks();

      await neo4jService.saveEntityRelationships([], entityNameToUid);

      expect(mockSession.run).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close the driver connection', async () => {
      await neo4jService.initialize();
      await neo4jService.close();

      expect(mockDriver.close).toHaveBeenCalled();
    });

    it('should handle close when driver is null', async () => {
      // Don't initialize first
      await neo4jService.close();

      expect(mockDriver.close).not.toHaveBeenCalled();
    });
  });
});