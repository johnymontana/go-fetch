import { DgraphService } from '../lib/dgraph.js';
import { AIService } from '../lib/ai.js';
import type { Entity, Memory } from '../types/index.js';

export interface SaveUserMessageArgs {
  message: string;
}

export class SaveUserMessageTool {
  constructor(
    private readonly dgraphService: DgraphService,
    private readonly aiService: AIService
  ) {}

  async execute(args: SaveUserMessageArgs): Promise<string> {
    try {
      const { message } = args;
      
      if (!message?.trim()) {
        throw new Error('Message cannot be empty');
      }

      // Extract entities from the message using AI
      const extractedEntities = await this.aiService.extractEntities(message);
      
      if (extractedEntities.length === 0) {
        return 'No entities found in the message to save.';
      }

      // Check if entities already exist in the database
      const entityNames = extractedEntities.map(e => e.name);
      const existingEntities = await this.dgraphService.findEntitiesByName(entityNames);
      const existingEntityNames = new Set(existingEntities.map(e => e.name));

      // Create embeddings and save new entities
      const entityUids: string[] = [];
      const allEntities: Entity[] = [...existingEntities];

      for (const extractedEntity of extractedEntities) {
        if (existingEntityNames.has(extractedEntity.name)) {
          // Use existing entity
          const existing = existingEntities.find(e => e.name === extractedEntity.name);
          if (existing?.uid) {
            entityUids.push(existing.uid);
          }
        } else {
          // Create new entity
          const embedding = await this.aiService.generateEmbedding(extractedEntity.name);
          
          const newEntity: Entity = {
            name: extractedEntity.name,
            type: extractedEntity.type,
            embedding,
            description: extractedEntity.description || undefined,
            createdAt: new Date().toISOString(),
          };

          const uid = await this.dgraphService.saveEntity(newEntity);
          entityUids.push(uid);
          allEntities.push({ ...newEntity, uid });
        }
      }

      // Create memory embedding
      const memoryEmbedding = await this.aiService.generateEmbedding(message);

      // Save the memory with entity relationships
      const memory: Memory = {
        content: message,
        timestamp: new Date().toISOString(),
        embedding: memoryEmbedding,
        entities: allEntities,
      };

      const memoryUid = await this.dgraphService.saveMemory(memory, entityUids);

      const entityCount = extractedEntities.length;
      const newEntityCount = extractedEntities.filter(e => !existingEntityNames.has(e.name)).length;
      
      return `Successfully saved message with ${entityCount} entities (${newEntityCount} new). Memory ID: ${memoryUid}`;

    } catch (error) {
      console.error('Error saving user message:', error);
      throw new Error(`Failed to save message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}