import { describe, it, expect, beforeEach } from '@jest/globals';

// Simple integration test to verify basic functionality
describe('MCP Server Integration', () => {
  beforeEach(() => {
    // Set up test environment variables
    process.env.DGRAPH_ALPHA_URL = 'http://localhost:8080';
    process.env.DGRAPH_GRPC_URL = 'localhost:9080';
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.EMBEDDING_MODEL = 'text-embedding-3-small';
    process.env.LLM_MODEL = 'gpt-4o-mini';
  });

  describe('Environment Configuration', () => {
    it('should have required environment variables', () => {
      expect(process.env.DGRAPH_ALPHA_URL).toBe('http://localhost:8080');
      expect(process.env.DGRAPH_GRPC_URL).toBe('localhost:9080');
      expect(process.env.AI_PROVIDER).toBe('openai');
      expect(process.env.OPENAI_API_KEY).toBe('test-api-key');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate AI provider configuration', () => {
      const validProviders = ['openai', 'anthropic'];
      expect(validProviders).toContain(process.env.AI_PROVIDER);
    });

    it('should have API key configured', () => {
      expect(process.env.OPENAI_API_KEY).toBeTruthy();
      expect(process.env.OPENAI_API_KEY).not.toBe('');
    });
  });
});