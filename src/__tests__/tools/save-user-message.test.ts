import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockEntity, mockExtractedEntities, mockEmbedding } from '../../test-fixtures/test-data.js';
import { SaveUserMessageTool } from '../../tools/save-user-message.js';

// Mock the dependencies
const mockDgraphService = {
  findEntitiesByName: jest.fn(),
  saveEntity: jest.fn(),
  saveMemory: jest.fn(),
  saveEntityRelationships: jest.fn(),
} as any;

const mockAIService = {
  extractEntities: jest.fn(),
  generateEmbedding: jest.fn(),
  extractEntityRelationships: jest.fn(),
  extractTemporalInformation: jest.fn(),
} as any;

describe('SaveUserMessageTool', () => {
  let tool: SaveUserMessageTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new SaveUserMessageTool(mockDgraphService, mockAIService);
  });

  describe('execute', () => {
    it('should process message with new entities successfully', async () => {
      // Setup mocks
      mockAIService.extractEntities.mockResolvedValue(mockExtractedEntities);
      mockDgraphService.findEntitiesByName.mockResolvedValue([]);
      mockAIService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDgraphService.saveEntity.mockResolvedValue('entity-uid-1');
      mockDgraphService.saveMemory.mockResolvedValue('memory-uid-1');

      // Mock relationship extraction
      const mockRelationships = [
        { fromEntity: 'John Doe', toEntity: 'TechCorp', type: 'WORKS_AT' }
      ];
      mockAIService.extractEntityRelationships.mockResolvedValue(mockRelationships);

      // Mock temporal information extraction
      const mockEnrichedRelationships = [
        { fromEntity: 'John Doe', toEntity: 'TechCorp', type: 'WORKS_AT', validAt: '2024-01-01T00:00:00.000Z' }
      ];
      mockAIService.extractTemporalInformation.mockResolvedValue(mockEnrichedRelationships);

      mockDgraphService.saveEntityRelationships.mockResolvedValue(undefined);

      const args = { message: 'John Doe works at TechCorp as a software engineer.' };
      const result = await tool.execute(args);

      expect(result).toContain('Successfully saved message with 2 entities (2 new)');
      expect(result).toContain('Memory ID: memory-uid-1');
      expect(result).toContain('1 with temporal data');
      
      expect(mockAIService.extractEntities).toHaveBeenCalledWith(args.message);
      expect(mockDgraphService.findEntitiesByName).toHaveBeenCalledWith(['John Doe', 'TechCorp']);
      expect(mockDgraphService.saveEntity).toHaveBeenCalledTimes(2);
      expect(mockDgraphService.saveMemory).toHaveBeenCalledTimes(1);
      expect(mockAIService.extractEntityRelationships).toHaveBeenCalledWith(mockExtractedEntities, args.message);
      expect(mockAIService.extractTemporalInformation).toHaveBeenCalledWith(mockRelationships, args.message, expect.any(String));
      expect(mockDgraphService.saveEntityRelationships).toHaveBeenCalledWith(mockEnrichedRelationships, expect.any(Map));
    });

    it('should reuse existing entities', async () => {
      // Setup mocks - return existing entity
      mockAIService.extractEntities.mockResolvedValue([mockExtractedEntities[0]]);
      mockDgraphService.findEntitiesByName.mockResolvedValue([mockEntity]);
      mockAIService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDgraphService.saveMemory.mockResolvedValue('memory-uid-1');

      // Mock relationship extraction (no relationships in this case)
      mockAIService.extractEntityRelationships.mockResolvedValue([]);

      const args = { message: 'Met with John Doe again.' };
      const result = await tool.execute(args);

      expect(result).toContain('Successfully saved message with 1 entities (0 new)');
      expect(mockDgraphService.saveEntity).not.toHaveBeenCalled();
      expect(mockDgraphService.saveMemory).toHaveBeenCalledWith(
        expect.objectContaining({ content: args.message }),
        [mockEntity.uid]
      );
    });

    it('should handle empty message', async () => {
      await expect(tool.execute({ message: '' })).rejects.toThrow('Message cannot be empty');
      await expect(tool.execute({ message: '   ' })).rejects.toThrow('Message cannot be empty');
    });

    it('should handle no entities found', async () => {
      mockAIService.extractEntities.mockResolvedValue([]);

      const result = await tool.execute({ message: 'No entities here.' });

      expect(result).toBe('No entities found in the message to save.');
      expect(mockDgraphService.saveEntity).not.toHaveBeenCalled();
      expect(mockDgraphService.saveMemory).not.toHaveBeenCalled();
    });

    it('should handle entity extraction errors', async () => {
      mockAIService.extractEntities.mockRejectedValue(new Error('AI service error'));

      await expect(tool.execute({ message: 'Some message' })).rejects.toThrow('Failed to save message: AI service error');
    });

    it('should handle database save errors', async () => {
      mockAIService.extractEntities.mockResolvedValue([mockExtractedEntities[0]]);
      mockDgraphService.findEntitiesByName.mockResolvedValue([]);
      mockAIService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDgraphService.saveEntity.mockRejectedValue(new Error('Database error'));

      await expect(tool.execute({ message: 'Some message' })).rejects.toThrow('Failed to save message: Database error');
    });

    it('should handle embedding generation errors', async () => {
      mockAIService.extractEntities.mockResolvedValue([mockExtractedEntities[0]]);
      mockDgraphService.findEntitiesByName.mockResolvedValue([]);
      mockAIService.generateEmbedding.mockRejectedValue(new Error('Embedding error'));

      await expect(tool.execute({ message: 'Some message' })).rejects.toThrow('Failed to save message: Embedding error');
    });

    it('should handle mixed existing and new entities', async () => {
      // Setup mocks - one existing, one new entity
      mockAIService.extractEntities.mockResolvedValue(mockExtractedEntities);
      mockDgraphService.findEntitiesByName.mockResolvedValue([
        { ...mockEntity, name: 'John Doe' }, // Existing entity
      ]);
      mockAIService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDgraphService.saveEntity.mockResolvedValue('new-entity-uid');
      mockDgraphService.saveMemory.mockResolvedValue('memory-uid-1');

      const args = { message: 'John Doe and TechCorp are collaborating.' };
      const result = await tool.execute(args);

      expect(result).toContain('Successfully saved message with 2 entities (1 new)');
      expect(mockDgraphService.saveEntity).toHaveBeenCalledTimes(1); // Only for new entity
    });
  });
});