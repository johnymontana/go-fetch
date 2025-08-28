import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockAIConfig, mockExtractedEntities } from '../../test-fixtures/test-data.js';
import { AIService } from '../../lib/ai.js';

// Mock the AI SDK modules
jest.mock('ai', () => ({
  generateText: jest.fn(),
  embed: jest.fn(),
}));

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(),
}));

jest.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: jest.fn(),
}));

const mockGenerateText = jest.mocked(require('ai').generateText);
const mockEmbed = jest.mocked(require('ai').embed);
const mockCreateOpenAI = jest.mocked(require('@ai-sdk/openai').createOpenAI);
const mockCreateAnthropic = jest.mocked(require('@ai-sdk/anthropic').createAnthropic);

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({ entities: mockExtractedEntities }),
    });
    
    mockEmbed.mockResolvedValue({
      embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
    });
    
    // Create provider function that also has textEmbedding method
    const mockOpenAIProvider = Object.assign(
      jest.fn((model: string) => `openai-${model}`),
      { textEmbedding: jest.fn((model: string) => `openai-embedding-${model}`) }
    );
    
    const mockAnthropicProvider = Object.assign(
      jest.fn((model: string) => `anthropic-${model}`),
      { textEmbedding: jest.fn((model: string) => `anthropic-embedding-${model}`) }
    );
    
    mockCreateOpenAI.mockReturnValue(mockOpenAIProvider as any);
    mockCreateAnthropic.mockReturnValue(mockAnthropicProvider as any);
    
    aiService = new AIService(mockAIConfig);
  });

  describe('constructor', () => {
    it('should initialize with OpenAI provider', () => {
      new AIService({ ...mockAIConfig, provider: 'openai' });
      expect(mockCreateOpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });

    it('should initialize with Anthropic provider', () => {
      new AIService({ ...mockAIConfig, provider: 'anthropic' });
      expect(mockCreateAnthropic).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });

    it('should throw error for unsupported provider', () => {
      expect(() => {
        new AIService({ ...mockAIConfig, provider: 'unsupported' });
      }).toThrow('Unsupported AI provider: unsupported');
    });
  });

  describe('extractEntities', () => {
    it('should extract entities from text successfully', async () => {
      const mockResponse = {
        text: JSON.stringify({ entities: mockExtractedEntities }),
      };
      mockGenerateText.mockResolvedValue(mockResponse);

      const text = 'John Doe works at TechCorp as a software engineer.';
      const result = await aiService.extractEntities(text);

      expect(result).toEqual(mockExtractedEntities);
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: expect.any(String),
        prompt: expect.stringContaining(text),
      });
    });

    it('should handle malformed JSON response', async () => {
      mockGenerateText.mockResolvedValue({ text: 'invalid json' });

      const result = await aiService.extractEntities('Some text');

      expect(result).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      mockGenerateText.mockRejectedValue(new Error('API Error'));

      const result = await aiService.extractEntities('Some text');

      expect(result).toEqual([]);
    });

    it('should handle response without entities field', async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({ data: 'no entities' }),
      });

      const result = await aiService.extractEntities('Some text');

      expect(result).toEqual([]);
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding successfully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding });

      const text = 'Sample text for embedding';
      const result = await aiService.generateEmbedding(text);

      expect(result).toEqual(mockEmbedding);
      expect(mockEmbed).toHaveBeenCalledWith({
        model: expect.any(String),
        value: text,
      });
    });

    it('should throw error if embedding generation fails', async () => {
      mockEmbed.mockRejectedValue(new Error('Embedding failed'));

      await expect(aiService.generateEmbedding('Some text')).rejects.toThrow('Failed to generate embedding');
    });
  });

  describe('generateMemorySummary', () => {
    it('should generate summary of entities and memories', async () => {
      const mockSummary = 'Summary of John Doe and TechCorp interactions';
      mockGenerateText.mockResolvedValue({ text: mockSummary });

      const entities = [
        { name: 'John Doe', type: 'PERSON' },
        { name: 'TechCorp', type: 'ORGANIZATION' },
      ];
      const memories = [
        { content: 'Met John at TechCorp office' },
        { content: 'Discussed project requirements' },
      ];

      const result = await aiService.generateMemorySummary(entities, memories, []);

      expect(result).toBe(mockSummary);
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: expect.any(String),
        prompt: expect.stringContaining('John Doe (PERSON), TechCorp (ORGANIZATION)'),
      });
    });

    it('should handle summary generation errors', async () => {
      mockGenerateText.mockRejectedValue(new Error('Summary failed'));

      const entities = [{ name: 'John Doe', type: 'PERSON' }];
      const memories = [{ content: 'Some memory' }];

      const result = await aiService.generateMemorySummary(entities, memories, []);

      expect(result).toBe('Found entities: John Doe (PERSON)');
    });

    it('should work with empty entities and memories', async () => {
      const mockSummary = 'No entities found';
      mockGenerateText.mockResolvedValue({ text: mockSummary });

      const result = await aiService.generateMemorySummary([], [], []);

      expect(result).toBe(mockSummary);
    });
  });
});