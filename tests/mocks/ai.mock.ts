import { jest } from '@jest/globals';

// Mock AI SDK functions
export const mockGenerateText = jest.fn();
export const mockEmbed = jest.fn();
export const mockCreateOpenAI = jest.fn();
export const mockCreateAnthropic = jest.fn();

// Mock AI SDK module
jest.unstable_mockModule('ai', () => ({
  generateText: mockGenerateText,
  embed: mockEmbed,
}));

jest.unstable_mockModule('@ai-sdk/openai', () => ({
  createOpenAI: mockCreateOpenAI,
}));

jest.unstable_mockModule('@ai-sdk/anthropic', () => ({
  createAnthropic: mockCreateAnthropic,
}));

export const resetAIMocks = (): void => {
  jest.clearAllMocks();
  
  // Default mock implementations
  mockGenerateText.mockResolvedValue({
    text: '{"entities": [{"name": "Test Entity", "type": "PERSON", "description": "A test entity"}]}',
  });
  
  mockEmbed.mockResolvedValue({
    embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
  });
  
  mockCreateOpenAI.mockReturnValue((model: string) => `openai-${model}`);
  mockCreateAnthropic.mockReturnValue((model: string) => `anthropic-${model}`);
};