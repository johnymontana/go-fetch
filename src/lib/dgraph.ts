import * as dgraph from "dgraph-js";
import { Mutation, Operation } from "dgraph-js";
import type { DgraphConfig, Entity, Memory, EntityRelationship } from "../types/index.js";
import type { DatabaseService } from "./database-interface.js";

export class DgraphService implements DatabaseService {
  private client: dgraph.DgraphClient | null = null;

  constructor(private config: DgraphConfig) {
    // Client will be initialized asynchronously in initialize()
  }

  private ensureClient(): dgraph.DgraphClient {
    if (!this.client) {
      throw new Error(
        "DgraphService not initialized. Call initialize() first.",
      );
    }
    return this.client;
  }

  async initialize(): Promise<void> {
    console.log(`[DgraphService] Initializing connection to Dgraph...`);
    console.log(`[DgraphService] Connection string: ${this.config.connectionString.replace(/bearertoken=[^&?]*/g, 'bearertoken=***')}`);
    
    try {
      // Connect to Dgraph using the connection string
      this.client = await dgraph.open(this.config.connectionString);
      console.log(`[DgraphService] Successfully connected to Dgraph`);
    } catch (error) {
      console.error(`[DgraphService] Failed to connect to Dgraph:`, error);
      throw error;
    }
    const schema = `
      name: string @index(exact, term) .
      type: string @index(exact) .
      embedding: float32vector @index(hnsw(metric: "cosine")) .
      description: string .
      createdAt: datetime .
      memories: [uid] @reverse .
      content: string @index(fulltext) .
      timestamp: datetime @index(hour) .
      entities: [uid] @reverse .
      location: geo @index(geo) .
      relatedTo: [uid] @reverse .
      relatedTo.type: string @index(exact, term) .
      relatedTo.validAt: datetime @index(hour) .
      relatedTo.invalidAt: datetime @index(hour) .

      type Entity {
        name
        type
        embedding
        description
        createdAt
        memories
        location
        relatedTo
      }

      type Memory {
        content
        timestamp
        embedding
        entities
      }
    `;

    console.log(`[DgraphService] Setting up Dgraph schema...`);
    const operation = new Operation();
    operation.setSchema(schema);
    
    try {
      await this.ensureClient().alter(operation);
      console.log(`[DgraphService] Schema initialized successfully`);
    } catch (error) {
      console.error(`[DgraphService] Failed to set schema:`, error);
      throw error;
    }
  }

  async saveEntity(entity: Entity): Promise<string> {
    console.log(`[DgraphService] Saving entity: ${entity.name} (type: ${entity.type})`);
    console.log(`[DgraphService] Entity embedding size: ${entity.embedding?.length || 0}`);
    console.log(entity);
    const embeddingString = JSON.stringify(entity.embedding || []);
    const txn = this.ensureClient().newTxn();
    try {
      const mutation = new Mutation();
      const entityData = {
        uid: "_:entity",
        "dgraph.type": "Entity",
        name: entity.name,
        type: entity.type,
        embedding: embeddingString,
        description: entity.description || "",
        createdAt: entity.createdAt,
      } as any;

        // Only add location if coordinates are provided
    if (entity.coordinates ) {
      entityData.location = {
        type: "Point",
        coordinates: [entity.coordinates.longitude, entity.coordinates.latitude] // [lon, lat]
      };
    }

      mutation.setSetJson(entityData);
      console.log(`[DgraphService] Executing entity mutation...`);
      const response = await txn.mutate(mutation);
      console.log(`[DgraphService] Entity mutation response received`);
      await txn.commit();
      console.log(`[DgraphService] Entity transaction committed`);

      const uid = response.getUidsMap().get("entity");
      if (!uid) {
        console.error(`[DgraphService] No UID returned for entity: ${entity.name}`);
        throw new Error("Failed to create entity");
      }
      console.log(`[DgraphService] Entity saved successfully with UID: ${uid}`);
      return uid;
    } catch (error) {
      console.error(`[DgraphService] Error saving entity ${entity.name}:`, error);
      await txn.discard();
      throw error;
    }
  }

  async saveMemory(memory: Memory, entityUids: string[]): Promise<string> {
    console.log(`[DgraphService] Saving memory with ${entityUids.length} linked entities`);
    console.log(`[DgraphService] Memory content length: ${memory.content.length} characters`);
    console.log(`[DgraphService] Memory embedding size: ${memory.embedding?.length || 0}`);
    console.log(`[DgraphService] Linked entity UIDs: [${entityUids.join(', ')}]`);
    console.log(memory);
    const txn = this.ensureClient().newTxn();
    try {
      const mutation = new Mutation();
      const memoryData = {
        uid: "_:memory",
        "dgraph.type": "Memory",
        content: memory.content,
        timestamp: memory.timestamp,
        embedding: JSON.stringify(memory.embedding || []),
        entities: entityUids.map((uid) => ({ uid })),
      };

      mutation.setSetJson(memoryData);
      console.log(`[DgraphService] Executing memory mutation...`);
      const response = await txn.mutate(mutation);
      console.log(`[DgraphService] Memory mutation response received`);
      await txn.commit();
      console.log(`[DgraphService] Memory transaction committed`);

      const uid = response.getUidsMap().get("memory");
      if (!uid) {
        console.error(`[DgraphService] No UID returned for memory`);
        throw new Error("Failed to create memory");
      }
      console.log(`[DgraphService] Memory saved successfully with UID: ${uid}`);
      return uid;
    } catch (error) {
      console.error(`[DgraphService] Error saving memory:`, error);
      await txn.discard();
      throw error;
    }
  }

  async findEntitiesByName(names: string[]): Promise<Entity[]> {
    console.log(`[DgraphService] Searching for entities by names: [${names.join(', ')}]`);
    
    const query = `
      query findEntities($names: string) {
        entities(func: anyofterms(name, $names)) {
          uid
          name
          type
          description
          createdAt
          embedding
        }
      }
    `;

    const txn = this.ensureClient().newTxn();
    try {
      console.log(`[DgraphService] Executing entity search query...`);
      console.log(JSON.stringify(names));
      const response = await txn.queryWithVars(query, {
        $names: JSON.stringify(names),
      });
      const result = response.getJson();
      const entities = result.entities || [];
      console.log(`[DgraphService] Found ${entities.length} existing entities`);
      entities.forEach((entity: Entity) => {
        console.log(`[DgraphService] - ${entity.name} (${entity.type}) [${entity.uid}]`);
      });
      return entities;
    } catch (error) {
      console.error(`[DgraphService] Error searching entities:`, error);
      throw error;
    }
  }

  async vectorSearch(embedding: number[], limit = 10): Promise<Entity[]> {
    console.log(`[DgraphService] Performing vector search with embedding size: ${embedding.length}, limit: ${limit}`);
    
    const query = `
      query vectorSearch($embedding: string, $limit: int) {
        entities(func: similar_to(embedding, $limit, $embedding)) {
          uid
          name
          type
          description
          createdAt
          embedding
          relatedTo @facets {
            uid
            name
            type
            description
            createdAt
            embedding
            relatedTo @facets {
              uid
              name
              type
              description
              createdAt
              embedding
            }
          }
          memories: ~entities {
            uid
            content
            timestamp
          }
        }
      }
    `;

    const txn = this.ensureClient().newTxn();
    try {
      console.log(`[DgraphService] Executing vector search query...`);
      const response = await txn.queryWithVars(query, {
        $embedding: JSON.stringify(embedding),
        $limit: limit.toString(),
      });
      const result = response.getJson();
      const entities = result.entities || [];
      console.log(`[DgraphService] Vector search returned ${entities.length} results`);
      entities.forEach((entity: Entity, index: number) => {
        const memoryCount = entity.memories?.length || 0;
        console.log(`[DgraphService] ${index + 1}. ${entity.name} (${entity.type}) - ${memoryCount} memories [${entity.uid}]`);
      });
      return entities;
    } catch (error) {
      console.error(`[DgraphService] Error in vector search:`, error);
      throw error;
    }
  }

  async saveEntityRelationships(
    relationships: EntityRelationship[],
    entityNameToUid: Map<string, string>
  ): Promise<void> {
    if (relationships.length === 0) {
      console.log(`[DgraphService] No relationships to save`);
      return;
    }

    console.log(`[DgraphService] Saving ${relationships.length} entity relationships`);
    const txn = this.ensureClient().newTxn();
    
    try {
      const mutation = new Mutation();
      const mutations: any[] = [];

      for (const relationship of relationships) {
        const fromUid = entityNameToUid.get(relationship.fromEntity);
        const toUid = entityNameToUid.get(relationship.toEntity);

        if (!fromUid || !toUid) {
          console.warn(`[DgraphService] Skipping relationship ${relationship.fromEntity} -> ${relationship.toEntity}: missing UID(s)`);
          continue;
        }

        console.log(`[DgraphService] Creating relationship: ${relationship.fromEntity} [${fromUid}] -> ${relationship.toEntity} [${toUid}] (${relationship.type})`);
        
        const relationshipData: any = {
          uid: toUid,
          "relatedTo|type": relationship.type
        };

        // Add temporal fields if they exist
        if (relationship.validAt) {
          relationshipData["relatedTo|validAt"] = relationship.validAt;
        }
        if (relationship.invalidAt) {
          relationshipData["relatedTo|invalidAt"] = relationship.invalidAt;
        }

        mutations.push({
          uid: fromUid,
          relatedTo: relationshipData
        });
      }

      if (mutations.length === 0) {
        console.log(`[DgraphService] No valid relationships to save (all skipped due to missing UIDs)`);
        return;
      }

      mutation.setSetJson(mutations);
      console.log(`[DgraphService] Executing relationship mutations for ${mutations.length} relationships...`);
      await txn.mutate(mutation);
      await txn.commit();
      console.log(`[DgraphService] Successfully saved ${mutations.length} relationships`);
    } catch (error) {
      console.error(`[DgraphService] Error saving relationships:`, error);
      await txn.discard();
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      console.log(`[DgraphService] Closing Dgraph connection...`);
      await this.client.close();
      this.client = null;
      console.log(`[DgraphService] Dgraph connection closed`);
    }
  }
}
