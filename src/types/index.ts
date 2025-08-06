export interface Entity {
  uid?: string;
  name: string;
  type: string;
  embedding?: number[];
  description?: string | undefined;
  createdAt: string;
  memories?: Memory[];
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
  connectionString: string;
}

export interface AIConfig {
  provider: string;
  apiKey: string;
  embeddingModel: string;
  llmModel: string;
}