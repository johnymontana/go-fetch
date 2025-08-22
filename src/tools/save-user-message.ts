import type { DatabaseService } from '../lib/database-interface.js';
import { AIService } from '../lib/ai.js';
import type { Entity, Memory, EntityRelationship } from '../types/index.js';

export interface SaveUserMessageArgs {
  message: string;
}

export class SaveUserMessageTool {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly aiService: AIService
  ) {}

  async execute(args: SaveUserMessageArgs): Promise<string> {
    const startTime = Date.now();
    console.log(`[SaveUserMessage] Starting message processing...`);
    console.log(`[SaveUserMessage] Message length: ${args.message?.length || 0} characters`);
    
    try {
      const { message } = args;
      
      if (!message?.trim()) {
        console.error(`[SaveUserMessage] Empty message received`);
        throw new Error('Message cannot be empty');
      }
      
      console.log(`[SaveUserMessage] Processing message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);

      // Extract entities from the message using AI
      console.log(`[SaveUserMessage] Extracting entities using AI service...`);
      const extractedEntities = await this.aiService.extractEntities(message);
      console.log(`[SaveUserMessage] Extracted ${extractedEntities.length} entities:`);
      extractedEntities.forEach((entity, index) => {
        console.log(`[SaveUserMessage]   ${index + 1}. ${entity.name} (${entity.type}) - ${entity.description || 'no description'}`);
      });
      
      if (extractedEntities.length === 0) {
        console.log(`[SaveUserMessage] No entities found, skipping save operation`);
        return 'No entities found in the message to save.';
      }

      // Check if entities already exist in the database
      const entityNames = extractedEntities.map(e => e.name);
      console.log(`[SaveUserMessage] Checking for existing entities in database...`);
      const existingEntities = await this.databaseService.findEntitiesByName(entityNames);
      const existingEntityNames = new Set(existingEntities.map(e => e.name));
      console.log(`[SaveUserMessage] Found ${existingEntities.length} existing entities out of ${entityNames.length} total`);

      // Create embeddings and save new entities
      console.log(`[SaveUserMessage] Processing entity storage...`);
      const entityUids: string[] = [];
      const allEntities: Entity[] = [...existingEntities];
      let newEntitiesCreated = 0;
      let existingEntitiesReused = 0;

      for (const extractedEntity of extractedEntities) {
        if (existingEntityNames.has(extractedEntity.name)) {
          // Use existing entity
          console.log(`[SaveUserMessage] Reusing existing entity: ${extractedEntity.name}`);
          const existing = existingEntities.find(e => e.name === extractedEntity.name);
          if (existing?.uid) {
            entityUids.push(existing.uid);
            existingEntitiesReused++;
          }
        } else {
          // Create new entity
          console.log(`[SaveUserMessage] Creating new entity: ${extractedEntity.name} (${extractedEntity.type})`);
          console.log(`[SaveUserMessage] Generating embedding for entity...`);
          const embedding = await this.aiService.generateEmbedding(extractedEntity.name);
          console.log(`[SaveUserMessage] Generated embedding with ${embedding.length} dimensions`);
          
          const newEntity: Entity = {
            name: extractedEntity.name,
            type: extractedEntity.type,
            embedding,
            coordinates: extractedEntity.coordinates,
            description: extractedEntity.description || undefined,
            createdAt: new Date().toISOString(),
          };

          const uid = await this.databaseService.saveEntity(newEntity);
          entityUids.push(uid);
          allEntities.push({ ...newEntity, uid });
          newEntitiesCreated++;
          console.log(`[SaveUserMessage] New entity created with UID: ${uid}`);
        }
      }

      // Create memory embedding
      console.log(`[SaveUserMessage] Generating embedding for memory content...`);
      const memoryEmbedding = await this.aiService.generateEmbedding(message);
      console.log(`[SaveUserMessage] Generated memory embedding with ${memoryEmbedding.length} dimensions`);

      // Save the memory with entity relationships
      console.log(`[SaveUserMessage] Creating memory object with ${allEntities.length} linked entities...`);
      const memory: Memory = {
        content: message,
        timestamp: new Date().toISOString(),
        embedding: memoryEmbedding,
        entities: allEntities,
      };

      const memoryUid = await this.databaseService.saveMemory(memory, entityUids);
      console.log(`[SaveUserMessage] Memory saved successfully with UID: ${memoryUid}`);

      // Generate and save relationships between entities
      console.log(`[SaveUserMessage] Generating relationships between entities...`);
      const relationships = await this.aiService.extractEntityRelationships(extractedEntities, message);
      
      let enrichedRelationships: EntityRelationship[] = [];

      if (relationships.length > 0) {
        // Extract temporal information from relationships
        console.log(`[SaveUserMessage] Extracting temporal information from relationships...`);
        const currentTimestamp = new Date().toISOString();
        enrichedRelationships = await this.aiService.extractTemporalInformation(
          relationships,
          message,
          currentTimestamp
        );
        console.log(`[SaveUserMessage] Temporal information extracted for ${enrichedRelationships.length} relationships`);

        // Create mapping from entity names to UIDs for relationship storage
        const entityNameToUid = new Map<string, string>();
        allEntities.forEach(entity => {
          if (entity.uid) {
            entityNameToUid.set(entity.name, entity.uid);
          }
        });
        
        console.log(`[SaveUserMessage] Saving ${enrichedRelationships.length} enriched relationships to database...`);
        await this.databaseService.saveEntityRelationships(enrichedRelationships, entityNameToUid);
        console.log(`[SaveUserMessage] Enriched relationships saved successfully`);
      } else {
        console.log(`[SaveUserMessage] No relationships found to save`);
      }

      const processingTime = Date.now() - startTime;
      console.log(`[SaveUserMessage] ✅ Processing completed successfully`);
      console.log(`[SaveUserMessage] Summary:`);
      console.log(`[SaveUserMessage]   - Total entities: ${extractedEntities.length}`);
      console.log(`[SaveUserMessage]   - New entities created: ${newEntitiesCreated}`);
      console.log(`[SaveUserMessage]   - Existing entities reused: ${existingEntitiesReused}`);
      console.log(`[SaveUserMessage]   - Relationships created: ${relationships.length}`);
      console.log(`[SaveUserMessage]   - Enriched relationships with temporal data: ${enrichedRelationships?.length || 0}`);
      console.log(`[SaveUserMessage]   - Memory UID: ${memoryUid}`);
      console.log(`[SaveUserMessage]   - Processing time: ${processingTime}ms`);
      
      return `Successfully saved message with ${extractedEntities.length} entities (${newEntitiesCreated} new) and ${relationships.length} relationships (${enrichedRelationships?.length || 0} with temporal data). Memory ID: ${memoryUid}`;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[SaveUserMessage] ❌ Error during processing (after ${processingTime}ms):`, error);
      console.error(`[SaveUserMessage] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to save message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}