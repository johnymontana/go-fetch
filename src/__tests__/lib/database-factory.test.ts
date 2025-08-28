import { describe, it, expect, jest } from '@jest/globals';
import { createDatabaseService } from '../../lib/database-factory.js';
import type { DatabaseConfig } from '../../types/index.js';

// Mock the database services
jest.mock('../../lib/dgraph.js', () => ({
  DgraphService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    saveEntity: jest.fn(),
    saveMemory: jest.fn(),
    findEntitiesByName: jest.fn(),
    vectorSearch: jest.fn(),
    saveEntityRelationships: jest.fn(),
    close: jest.fn(),
  }))
}));

jest.mock('../../lib/neo4j.js', () => ({
  Neo4jService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    saveEntity: jest.fn(),
    saveMemory: jest.fn(),
    findEntitiesByName: jest.fn(),
    vectorSearch: jest.fn(),
    saveEntityRelationships: jest.fn(),
    close: jest.fn(),
  }))
}));

const MockedDgraphService = jest.mocked(require('../../lib/dgraph.js').DgraphService);
const MockedNeo4jService = jest.mocked(require('../../lib/neo4j.js').Neo4jService);

describe('createDatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('dgraph configuration', () => {
    it('should create DgraphService when type is dgraph', () => {
      const config: DatabaseConfig = {
        type: 'dgraph',
        dgraph: {
          connectionString: 'dgraph://localhost:9080',
        },
      };

      const service = createDatabaseService(config);

      expect(MockedDgraphService).toHaveBeenCalledWith(config.dgraph);
      expect(service).toBeDefined();
    });

    it('should throw error when dgraph config is missing', () => {
      const config: DatabaseConfig = {
        type: 'dgraph',
        // dgraph config is missing
      };

      expect(() => createDatabaseService(config)).toThrow(
        'Dgraph configuration is required when type is "dgraph"'
      );
    });
  });

  describe('neo4j configuration', () => {
    it('should create Neo4jService when type is neo4j', () => {
      const config: DatabaseConfig = {
        type: 'neo4j',
        neo4j: {
          uri: 'bolt://localhost:7687',
          username: 'neo4j',
          password: 'password',
        },
      };

      const service = createDatabaseService(config);

      expect(MockedNeo4jService).toHaveBeenCalledWith(config.neo4j);
      expect(service).toBeDefined();
    });

    it('should create Neo4jService with minimal config', () => {
      const config: DatabaseConfig = {
        type: 'neo4j',
        neo4j: {
          uri: 'bolt://localhost:7687',
        },
      };

      const service = createDatabaseService(config);

      expect(MockedNeo4jService).toHaveBeenCalledWith({
        uri: 'bolt://localhost:7687',
      });
      expect(service).toBeDefined();
    });

    it('should throw error when neo4j config is missing', () => {
      const config: DatabaseConfig = {
        type: 'neo4j',
        // neo4j config is missing
      };

      expect(() => createDatabaseService(config)).toThrow(
        'Neo4j configuration is required when type is "neo4j"'
      );
    });
  });

  describe('unsupported database type', () => {
    it('should throw error for unsupported database type', () => {
      const config = {
        type: 'unsupported',
      } as any;

      expect(() => createDatabaseService(config)).toThrow(
        'Unsupported database type: unsupported'
      );
    });
  });

  describe('service interface compliance', () => {
    it('should return service with DatabaseService interface for dgraph', () => {
      const config: DatabaseConfig = {
        type: 'dgraph',
        dgraph: {
          connectionString: 'dgraph://localhost:9080',
        },
      };

      const service = createDatabaseService(config);

      // Check that service has all required DatabaseService methods
      expect(typeof service.initialize).toBe('function');
      expect(typeof service.saveEntity).toBe('function');
      expect(typeof service.saveMemory).toBe('function');
      expect(typeof service.findEntitiesByName).toBe('function');
      expect(typeof service.vectorSearch).toBe('function');
      expect(typeof service.saveEntityRelationships).toBe('function');
      expect(typeof service.close).toBe('function');
    });

    it('should return service with DatabaseService interface for neo4j', () => {
      const config: DatabaseConfig = {
        type: 'neo4j',
        neo4j: {
          uri: 'bolt://localhost:7687',
        },
      };

      const service = createDatabaseService(config);

      // Check that service has all required DatabaseService methods
      expect(typeof service.initialize).toBe('function');
      expect(typeof service.saveEntity).toBe('function');
      expect(typeof service.saveMemory).toBe('function');
      expect(typeof service.findEntitiesByName).toBe('function');
      expect(typeof service.vectorSearch).toBe('function');
      expect(typeof service.saveEntityRelationships).toBe('function');
      expect(typeof service.close).toBe('function');
    });
  });
});