import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockDgraphConfig, mockEntity, mockMemory } from '../../test-fixtures/test-data.js';
import { DgraphService } from '../../lib/dgraph.js';
import * as dgraph from 'dgraph-js';

// Mock dgraph-js
const mockTxn = {
  mutate: jest.fn(),
  commit: jest.fn(),
  discard: jest.fn(),
  queryWithVars: jest.fn(),
};

const mockClient = {
  newTxn: jest.fn(() => mockTxn),
  alter: jest.fn(),
  close: jest.fn(),
};

const mockClientStub = jest.fn();

const mockOperation = {
  setSchema: jest.fn(),
};

const mockMutation = {
  setSetJson: jest.fn(),
};

jest.mock('dgraph-js', () => ({
  DgraphClient: jest.fn(() => mockClient),
  DgraphClientStub: jest.fn(() => mockClientStub),
  Mutation: jest.fn(() => mockMutation),
  Operation: jest.fn(() => mockOperation),
  Request: jest.fn(),
  open: jest.fn(() => Promise.resolve(mockClient)),
}));

describe('DgraphService', () => {
  let dgraphService: DgraphService;

  describe('constructor', () => {
    it('should create DgraphService instance', () => {
      const config = { connectionString: 'dgraph://localhost:9080' };
      expect(() => new DgraphService(config)).not.toThrow();
    });

    it('should not initialize client in constructor', () => {
      const config = { connectionString: 'dgraph://localhost:9080' };
      const service = new DgraphService(config);
      // Client should be null until initialize() is called
      expect(() => service.close()).not.toThrow(); // close() handles null client
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    (mockTxn.mutate as any).mockResolvedValue({ 
      getUidsMap: () => new Map([['entity', 'test-uid']]) 
    });
    (mockTxn.commit as any).mockResolvedValue(undefined);
    (mockTxn.discard as any).mockResolvedValue(undefined);
    (mockTxn.queryWithVars as any).mockResolvedValue({ 
      getJson: () => ({ entities: [] as any }) 
    });
    (mockClient.alter as any).mockResolvedValue(undefined);
    
    dgraphService = new DgraphService(mockDgraphConfig);
  });

  beforeEach(async () => {
    // Initialize the service for tests that need it
    await dgraphService.initialize();
  });

  describe('initialize', () => {
    it('should call dgraph.open with connection string', async () => {
      const freshService = new DgraphService(mockDgraphConfig);
      await freshService.initialize();

      expect(dgraph.open).toHaveBeenCalledWith(mockDgraphConfig.connectionString);
    });

    it('should initialize Dgraph schema successfully', async () => {
      // This test runs after the global beforeEach, so alter has been called once already
      const initialCallCount = (mockClient.alter as any).mock.calls.length;
      await dgraphService.initialize();

      expect(mockClient.alter).toHaveBeenCalledTimes(initialCallCount + 1);
      // Just verify that alter was called - schema verification is complex with mocks
    });

    it('should throw error if schema initialization fails', async () => {
      (mockClient.alter as any).mockRejectedValue(new Error('Schema error'));

      await expect(dgraphService.initialize()).rejects.toThrow('Schema error');
    });
  });

  describe('saveEntity', () => {
    it('should save entity successfully and return UID', async () => {
      const testUid = 'test-entity-uid';
      (mockTxn.mutate as any).mockResolvedValue({
        getUidsMap: () => new Map([['entity', testUid]]),
      });

      const result = await dgraphService.saveEntity(mockEntity);

      expect(result).toBe(testUid);
      expect(mockClient.newTxn).toHaveBeenCalled();
      expect(mockTxn.mutate).toHaveBeenCalled();
      expect(mockTxn.commit).toHaveBeenCalled();
    });

    it('should handle transaction errors properly', async () => {
      (mockTxn.mutate as any).mockRejectedValue(new Error('Mutation failed'));

      await expect(dgraphService.saveEntity(mockEntity)).rejects.toThrow('Mutation failed');
      expect(mockTxn.discard).toHaveBeenCalled();
    });

    it('should throw error if UID is not returned', async () => {
      (mockTxn.mutate as any).mockResolvedValue({
        getUidsMap: () => new Map(),
      });

      await expect(dgraphService.saveEntity(mockEntity)).rejects.toThrow('Failed to create entity');
    });
  });

  describe('saveMemory', () => {
    it('should save memory with entity relationships', async () => {
      const testUid = 'test-memory-uid';
      const entityUids = ['entity-1', 'entity-2'];
      
      (mockTxn.mutate as any).mockResolvedValue({
        getUidsMap: () => new Map([['memory', testUid]]),
      });

      const result = await dgraphService.saveMemory(mockMemory, entityUids);

      expect(result).toBe(testUid);
      expect(mockTxn.mutate).toHaveBeenCalled();
      expect(mockTxn.commit).toHaveBeenCalled();
    });

    it('should handle memory save errors', async () => {
      (mockTxn.mutate as any).mockRejectedValue(new Error('Memory save failed'));

      await expect(dgraphService.saveMemory(mockMemory, ['entity-1'])).rejects.toThrow('Memory save failed');
      expect(mockTxn.discard).toHaveBeenCalled();
    });
  });

  describe('findEntitiesByName', () => {
    it('should find entities by name', async () => {
      const mockEntities = [mockEntity];
      (mockTxn.queryWithVars as any).mockResolvedValue({
        getJson: () => ({ entities: mockEntities }),
      });

      const result = await dgraphService.findEntitiesByName(['John Doe']);

      expect(result).toEqual(mockEntities);
      expect(mockTxn.queryWithVars).toHaveBeenCalledWith(
        expect.stringContaining('func: eq(name, $names)'),
        expect.objectContaining({ $names: JSON.stringify(['John Doe']) })
      );
    });

    it('should return empty array if no entities found', async () => {
      (mockTxn.queryWithVars as any).mockResolvedValue({
        getJson: () => ({}),
      });

      const result = await dgraphService.findEntitiesByName(['NonExistent']);

      expect(result).toEqual([]);
    });
  });

  describe('vectorSearch', () => {
    it('should perform vector search with default limit', async () => {
      const mockEntities = [mockEntity];
      (mockTxn.queryWithVars as any).mockResolvedValue({
        getJson: () => ({ entities: mockEntities }),
      });

      const embedding = [0.1, 0.2, 0.3];
      const result = await dgraphService.vectorSearch(embedding);

      expect(result).toEqual(mockEntities);
      expect(mockTxn.queryWithVars).toHaveBeenCalledWith(
        expect.stringContaining('similar_to(embedding, $limit, $embedding)'),
        expect.objectContaining({
          $embedding: JSON.stringify(embedding),
          $limit: '10',
        })
      );
    });

    it('should perform vector search with custom limit', async () => {
      const mockEntities = [mockEntity];
      (mockTxn.queryWithVars as any).mockResolvedValue({
        getJson: () => ({ entities: mockEntities }),
      });

      const embedding = [0.1, 0.2, 0.3];
      const result = await dgraphService.vectorSearch(embedding, 5);

      expect(result).toEqual(mockEntities);
      expect(mockTxn.queryWithVars).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ $limit: '5' })
      );
    });
  });

  describe('close', () => {
    it('should close the client connection', async () => {
      await dgraphService.close();

      expect(mockClient.close).toHaveBeenCalled();
    });
  });
});