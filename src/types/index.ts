export interface Entity {
  uid?: string;
  name: string;
  type: string;
  embedding?: number[];
  coordinates?: any;
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
  relatedEntities: Entity[];
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

export interface EntityRelationship {
  fromEntity: string;
  toEntity: string;
  type: string;
}