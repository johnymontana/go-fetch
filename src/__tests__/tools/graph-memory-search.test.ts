import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockSearchResults, mockEmbedding } from '../../../tests/fixtures/test-data.js';
import { GraphMemorySearchTool } from '../../tools/graph-memory-search.js';

// Mock the dependencies
const mockDgraphService = {
  vectorSearch: jest.fn(),
} as any;

const mockAIService = {
  generateEmbedding: jest.fn(),
  generateMemorySummary: jest.fn(),
} as any;

describe('GraphMemorySearchTool', () => {
  let tool: GraphMemorySearchTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new GraphMemorySearchTool(mockDgraphService, mockAIService);
  });

  describe('execute', () => {
    it('should perform search and return formatted results', async () => {
      const query = 'meetings with John Doe';
      const mockSummary = 'Found information about John Doe meetings and collaborations.';

      // Setup mocks
      mockAIService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDgraphService.vectorSearch.mockResolvedValue(mockSearchResults);
      mockAIService.generateMemorySummary.mockResolvedValue(mockSummary);

      const result = await tool.execute({ query });

      expect(result).toContain(`Memory Search Results for: "${query}"`);
      expect(result).toContain(mockSummary);
      expect(result).toContain('**John Doe** (PERSON)');
      expect(result).toContain('Similarity:');
      expect(result).toContain('Related memories: 2');
      expect(result).toContain('Found 1 total entities');

      expect(mockAIService.generateEmbedding).toHaveBeenCalledWith(query);
      expect(mockDgraphService.vectorSearch).toHaveBeenCalledWith(mockEmbedding, 10);
      expect(mockAIService.generateMemorySummary).toHaveBeenCalledWith(
        [{ name: 'John Doe', type: 'PERSON' }],
        mockSearchResults[0].memories
      );
    });

    it('should handle custom limit parameter', async () => {
      const query = 'test query';
      const limit = 5;

      mockAIService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDgraphService.vectorSearch.mockResolvedValue(mockSearchResults);
      mockAIService.generateMemorySummary.mockResolvedValue('Summary');

      await tool.execute({ query, limit });

      expect(mockDgraphService.vectorSearch).toHaveBeenCalledWith(mockEmbedding, limit);
    });

    it('should handle empty query', async () => {
      await expect(tool.execute({ query: '' })).rejects.toThrow('Search query cannot be empty');
      await expect(tool.execute({ query: '   ' })).rejects.toThrow('Search query cannot be empty');
    });

    it('should handle no search results', async () => {
      mockAIService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDgraphService.vectorSearch.mockResolvedValue([]);

      const result = await tool.execute({ query: 'nonexistent query' });

      expect(result).toBe('No relevant memories found for your query.');
      expect(mockAIService.generateMemorySummary).not.toHaveBeenCalled();
    });

    it('should handle embedding generation errors', async () => {
      mockAIService.generateEmbedding.mockRejectedValue(new Error('Embedding failed'));

      await expect(tool.execute({ query: 'test query' })).rejects.toThrow('Failed to search memories: Embedding failed');
    });

    it('should handle vector search errors', async () => {
      mockAIService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDgraphService.vectorSearch.mockRejectedValue(new Error('Search failed'));

      await expect(tool.execute({ query: 'test query' })).rejects.toThrow('Failed to search memories: Search failed');
    });

    it('should handle summary generation errors gracefully', async () => {
      mockAIService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDgraphService.vectorSearch.mockResolvedValue(mockSearchResults);
      mockAIService.generateMemorySummary.mockRejectedValue(new Error('Summary failed'));

      // Should still return results even if summary fails
      const result = await tool.execute({ query: 'test query' });

      expect(result).toContain('Memory Search Results');
      expect(result).toContain('John Doe');
    });

    it('should limit results to top 5 for readability', async () => {
      const manyResults = Array(10).fill(0).map((_, i) => ({
        ...mockSearchResults[0],
        name: `Entity ${i}`,
        uid: `entity-${i}`,
      }));

      mockAIService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDgraphService.vectorSearch.mockResolvedValue(manyResults);
      mockAIService.generateMemorySummary.mockResolvedValue('Summary');

      const result = await tool.execute({ query: 'test query' });

      // Should show "Found 10 total entities" but only display top 5
      expect(result).toContain('Found 10 total entities');
      const entityMatches = result.match(/\*\*Entity \d+\*\*/g);
      expect(entityMatches).toHaveLength(5);
    });

    it('should handle entities without recent memories', async () => {
      const resultWithoutMemories = [{
        ...mockSearchResults[0],
        memories: [] as any,
      }];

      mockAIService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDgraphService.vectorSearch.mockResolvedValue(resultWithoutMemories);
      mockAIService.generateMemorySummary.mockResolvedValue('Summary');

      const result = await tool.execute({ query: 'test query' });

      expect(result).toContain('Related memories: 0');
      expect(result).toContain('Recent: No recent memories');
    });

    it('should calculate cosine similarity correctly', async () => {
      // Test the private calculateCosineSimilarity method indirectly
      const resultsWithEmbedding = [{
        ...mockSearchResults[0],
        embedding: [0.5, 0.5, 0.5, 0.5, 0.5],
      }];

      mockAIService.generateEmbedding.mockResolvedValue([0.5, 0.5, 0.5, 0.5, 0.5]);
      mockDgraphService.vectorSearch.mockResolvedValue(resultsWithEmbedding);
      mockAIService.generateMemorySummary.mockResolvedValue('Summary');

      const result = await tool.execute({ query: 'test query' });

      // Should show high similarity (100% for identical vectors)
      expect(result).toContain('Similarity: 100.0%');
    });
  });
});