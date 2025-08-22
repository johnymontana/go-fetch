import type { Entity, Memory, EntityRelationship } from "../types/index.js";

export interface DatabaseService {
  initialize(): Promise<void>;
  saveEntity(entity: Entity): Promise<string>;
  saveMemory(memory: Memory, entityUids: string[]): Promise<string>;
  findEntitiesByName(names: string[]): Promise<Entity[]>;
  vectorSearch(embedding: number[], limit?: number): Promise<Entity[]>;
  saveEntityRelationships(
    relationships: EntityRelationship[],
    entityNameToUid: Map<string, string>
  ): Promise<void>;
  close(): Promise<void>;
}