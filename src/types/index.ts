export interface Entity {
  uid?: string;
  name: string;
  type: string;
  embedding?: number[];
  description?: string | undefined;
  createdAt: string;
}

export interface Memory {
  uid?: string;
  content: string;
  entities: Entity[];
  timestamp: string;
  embedding?: number[];
}

export interface SearchResult {
  entity: Entity;
  similarity: number;
  relatedMemories: Memory[];
}

export interface DgraphConfig {
  alphaUrl: string;
  grpcUrl: string;
}

export interface AIConfig {
  provider: string;
  apiKey: string;
  embeddingModel: string;
  llmModel: string;
}