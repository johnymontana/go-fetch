import type { Entity, Memory, DgraphConfig, AIConfig } from '../../src/types/index.js';

export const mockDgraphConfig: DgraphConfig = {
  connectionString: 'dgraph://localhost:9080',
};

export const mockAIConfig: AIConfig = {
  provider: 'openai',
  apiKey: 'test-api-key',
  embeddingModel: 'text-embedding-3-small',
  llmModel: 'gpt-4o-mini',
};

export const mockEntity: Entity = {
  uid: 'test-uid-123',
  name: 'John Doe',
  type: 'PERSON',
  embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
  description: 'Software engineer at TechCorp',
  createdAt: '2024-01-01T00:00:00.000Z',
};

export const mockMemory: Memory = {
  uid: 'memory-uid-123',
  content: 'Met John Doe at the coffee shop to discuss the new project.',
  entities: [mockEntity],
  timestamp: '2024-01-01T00:00:00.000Z',
  embedding: [0.2, 0.3, 0.4, 0.5, 0.6],
};

export const mockExtractedEntities = [
  {
    name: 'John Doe',
    type: 'PERSON',
    description: 'Software engineer',
  },
  {
    name: 'TechCorp',
    type: 'ORGANIZATION',
    description: 'Technology company',
  },
];

export const mockSearchResults = [
  {
    uid: 'test-uid-123',
    name: 'John Doe',
    type: 'PERSON',
    embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
    description: 'Software engineer at TechCorp',
    createdAt: '2024-01-01T00:00:00.000Z',
    memories: [
      {
        uid: 'memory-1',
        content: 'First meeting with John Doe',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
      {
        uid: 'memory-2',
        content: 'Follow-up discussion about the project',
        timestamp: '2024-01-02T00:00:00.000Z',
      },
    ],
  },
];

export const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];