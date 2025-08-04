import { beforeEach, afterEach } from '@jest/globals';

// Global test setup
beforeEach(() => {
  // Reset environment variables to defaults for each test
  process.env.NODE_ENV = 'test';
  process.env.DGRAPH_CONNECTION_STRING = 'dgraph://localhost:9080';
  process.env.AI_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-api-key';
  process.env.EMBEDDING_MODEL = 'text-embedding-3-small';
  process.env.LLM_MODEL = 'gpt-4o-mini';
});

afterEach(() => {
  // Clean up any global state
  jest.clearAllMocks();
});