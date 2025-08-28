import neo4j, { Driver } from "neo4j-driver";
import type { Neo4jConfig, Entity, Memory, EntityRelationship } from "../types/index.js";
import type { DatabaseService } from "./database-interface.js";

export class Neo4jService implements DatabaseService {
  private driver: Driver | null = null;

  constructor(private config: Neo4jConfig) {
    // Driver will be initialized asynchronously in initialize()
  }

  private ensureDriver(): Driver {
    if (!this.driver) {
      throw new Error(
        "Neo4jService not initialized. Call initialize() first.",
      );
    }
    return this.driver;
  }

  async initialize(): Promise<void> {
    console.log(`[Neo4jService] Initializing connection to Neo4j...`);
    console.log(`[Neo4jService] URI: ${this.config.uri}`);
    
    try {
      // Create Neo4j driver
      const auth = this.config.username && this.config.password 
        ? neo4j.auth.basic(this.config.username, this.config.password)
        : undefined;
      
      this.driver = neo4j.driver(this.config.uri, auth);
      
      // Test connection
      await this.driver.verifyConnectivity();
      console.log(`[Neo4jService] Successfully connected to Neo4j`);
    } catch (error) {
      console.error(`[Neo4jService] Failed to connect to Neo4j:`, error);
      throw error;
    }

    // Create indexes and constraints
    console.log(`[Neo4jService] Setting up Neo4j schema...`);
    const session = this.ensureDriver().session();
    
    try {
      // Create constraints and indexes
      const schemaQueries = [
        // Unique constraint on Entity name and type combination
        `CREATE CONSTRAINT entity_name_type_unique IF NOT EXISTS 
         FOR (e:Entity) REQUIRE (e.name, e.type) IS UNIQUE`,
        
        // Index on Entity name for faster lookups
        `CREATE INDEX entity_name_index IF NOT EXISTS FOR (e:Entity) ON (e.name)`,
        
        // Index on Entity type for faster filtering
        `CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:Entity) ON (e.type)`,
        
        // Index on Memory timestamp for temporal queries
        `CREATE INDEX memory_timestamp_index IF NOT EXISTS FOR (m:Memory) ON (m.timestamp)`,
        
        // Create vector index for semantic search (requires Neo4j 5.11+)
        `CREATE VECTOR INDEX entity_embedding_index IF NOT EXISTS 
         FOR (e:Entity) ON (e.embedding) 
         OPTIONS {indexConfig: {
           \`vector.dimensions\`: 1536,
           \`vector.similarity_function\`: 'cosine'
         }}`,
         
        `CREATE VECTOR INDEX memory_embedding_index IF NOT EXISTS 
         FOR (m:Memory) ON (m.embedding) 
         OPTIONS {indexConfig: {
           \`vector.dimensions\`: 1536,
           \`vector.similarity_function\`: 'cosine'
         }}`
      ];

      for (const query of schemaQueries) {
        try {
          await session.run(query);
          console.log(`[Neo4jService] Schema query executed successfully`);
        } catch (error) {
          // Some errors are expected (like constraint already exists)
          console.log(`[Neo4jService] Schema query result: ${(error as Error).message}`);
        }
      }
      
      console.log(`[Neo4jService] Schema initialized successfully`);
    } catch (error) {
      console.error(`[Neo4jService] Failed to set schema:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async saveEntity(entity: Entity): Promise<string> {
    console.log(`[Neo4jService] Saving entity: ${entity.name} (type: ${entity.type})`);
    console.log(`[Neo4jService] Entity embedding size: ${entity.embedding?.length || 0}`);
    
    const session = this.ensureDriver().session();
    try {
      const query = `
        MERGE (e:Entity {name: $name, type: $type})
        SET e.description = $description,
            e.createdAt = datetime($createdAt),
            e.embedding = $embedding,
            e.latitude = $latitude,
            e.longitude = $longitude,
            e.location = point({latitude: $latitude, longitude: $longitude}),
            e.uid = randomUUID()
        RETURN e.uid as uid
      `;
      
      const result = await session.run(query, {
        name: entity.name,
        type: entity.type,
        description: entity.description || "",
        createdAt: entity.createdAt,
        embedding: entity.embedding || [],
        latitude: entity.coordinates?.latitude || null,
        longitude: entity.coordinates?.longitude || null
      });
      
      if (result.records.length === 0) {
        throw new Error("Failed to create entity");
      }
      
      const uid = result.records[0].get('uid');
      console.log(`[Neo4jService] Entity saved successfully with ID: ${uid}`);
      return uid;
    } catch (error) {
      console.error(`[Neo4jService] Error saving entity ${entity.name}:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async saveMemory(memory: Memory, entityUids: string[]): Promise<string> {
    console.log(`[Neo4jService] Saving memory with ${entityUids.length} linked entities`);
    console.log(`[Neo4jService] Entity UIDs: ${entityUids}`);
    console.log(`[Neo4jService] Memory content length: ${memory.content.length} characters`);
    console.log(`[Neo4jService] Memory embedding size: ${memory.embedding?.length || 0}`);
    
    const session = this.ensureDriver().session();
    try {
      const query = `
        CREATE (m:Memory {
          content: $content,
          timestamp: datetime($timestamp),
          embedding: $embedding
        })
        WITH m
        UNWIND $entityUids as entityId
        MATCH (e:Entity) WHERE e.uid = entityId
        CREATE (m)-[:RELATES_TO]->(e)
        RETURN m.uid as uid
      `;
      
      const result = await session.run(query, {
        content: memory.content,
        timestamp: memory.timestamp,
        embedding: memory.embedding || [],
        entityUids: entityUids
      });
      
      if (result.records.length === 0) {
        throw new Error("Failed to create memory");
      }
      
      const uid = result.records[0].get('uid');
      console.log(`[Neo4jService] Memory saved successfully with ID: ${uid}`);
      return uid;
    } catch (error) {
      console.error(`[Neo4jService] Error saving memory:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async findEntitiesByName(names: string[]): Promise<Entity[]> {
    console.log(`[Neo4jService] Searching for entities by names: [${names.join(', ')}]`);
    
    const session = this.ensureDriver().session();
    try {
      const query = `
        MATCH (e:Entity)
        WHERE e.name IN $names
        RETURN e.id as uid, e.name as name, e.type as type,
               e.description as description, e.createdAt as createdAt,
               e.embedding as embedding, e.latitude as latitude, e.longitude as longitude
      `;
      
      const result = await session.run(query, { names });
      
      const entities: Entity[] = result.records.map(record => {
        const latitude = record.get('latitude');
        const longitude = record.get('longitude');

        // Reconstruct coordinates object if both latitude and longitude exist
        let coordinates = undefined;
        if (latitude !== null && longitude !== null) {
          coordinates = { latitude, longitude };
        }

        return {
          uid: record.get('uid'),
          name: record.get('name'),
          type: record.get('type'),
          description: record.get('description'),
          createdAt: record.get('createdAt')?.toString() || new Date().toISOString(),
          embedding: record.get('embedding'),
          coordinates
        };
      });
      
      console.log(`[Neo4jService] Found ${entities.length} entities`);
      return entities;
    } catch (error) {
      console.error(`[Neo4jService] Error searching entities:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async vectorSearch(embedding: number[], limit = 10): Promise<Entity[]> {
    console.log(`[Neo4jService] Performing vector search with embedding size: ${embedding.length}, limit: ${limit}`);
    
    const session = this.ensureDriver().session();
    try {
      // Use vector similarity search
      const query = `
        CALL db.index.vector.queryNodes('entity_embedding_index', $limit, $embedding)
        YIELD node as e, score
        OPTIONAL MATCH (e)<-[:RELATES_TO]-(m:Memory)
        WITH e, score, collect(DISTINCT {
          uid: m.elementId,
          content: m.content,
          timestamp: toString(m.timestamp)
        }) as memories
        OPTIONAL MATCH (e)-[r:RELATED_TO]->(related:Entity)
        WITH e, score, memories, collect(DISTINCT {
          uid: related.elementId,
          name: related.name,
          type: related.type,
          description: related.description,
          createdAt: toString(related.createdAt),
          embedding: related.embedding,
          relationshipType: r.type
        }) as relatedEntities
        RETURN e.elementId as uid, e.name as name, e.type as type,
               e.description as description, e.createdAt as createdAt,
               e.embedding as embedding, memories, relatedEntities, score
        ORDER BY score DESC
      `;
      
      const result = await session.run(query, { embedding, limit });
      
      const entities: Entity[] = result.records.map(record => {
        const entity: Entity = {
          uid: record.get('uid'),
          name: record.get('name'),
          type: record.get('type'),
          description: record.get('description'),
          createdAt: record.get('createdAt').toString(),
          embedding: record.get('embedding'),
          memories: record.get('memories').filter((m: any) => m.uid !== null)
        };
        
        // Add related entities if they exist
        const relatedEntities = record.get('relatedEntities').filter((e: any) => e.uid !== null);
        if (relatedEntities.length > 0) {
          (entity as any).relatedTo = relatedEntities;
        }
        
        return entity;
      });
      
      console.log(`[Neo4jService] Vector search returned ${entities.length} results`);
      entities.forEach((entity: Entity, index: number) => {
        const memoryCount = entity.memories?.length || 0;
        console.log(`[Neo4jService] ${index + 1}. ${entity.name} (${entity.type}) - ${memoryCount} memories [${entity.uid}]`);
      });
      
      return entities;
    } catch (error) {
      console.error(`[Neo4jService] Error in vector search:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async saveEntityRelationships(
    relationships: EntityRelationship[],
    entityNameToUid: Map<string, string>
  ): Promise<void> {
    if (relationships.length === 0) {
      console.log(`[Neo4jService] No relationships to save`);
      return;
    }

    console.log(`[Neo4jService] Saving ${relationships.length} entity relationships`);
    const session = this.ensureDriver().session();
    
    try {
      for (const relationship of relationships) {
        const fromUid = entityNameToUid.get(relationship.fromEntity);
        const toUid = entityNameToUid.get(relationship.toEntity);

        if (!fromUid || !toUid) {
          console.warn(`[Neo4jService] Skipping relationship ${relationship.fromEntity} -> ${relationship.toEntity}: missing UID(s)`);
          continue;
        }

        console.log(`[Neo4jService] Creating relationship: ${relationship.fromEntity} [${fromUid}] -> ${relationship.toEntity} [${toUid}] (${relationship.type})`);
        
        const query = `
          MATCH (from:Entity), (to:Entity)
          WHERE from.uid = $fromUid AND to.uid = $toUid
          CREATE (from)-[r:RELATED_TO {
            type: $relType,
            validAt: datetime($validAt),
            invalidAt: $invalidAt,
            uid: randomUUID()
          }]->(to)
          RETURN r.uid as uid
        `;
        
        await session.run(query, {
          fromUid,
          toUid,
          relType: relationship.type,
          validAt: relationship.validAt || null,
          invalidAt: relationship.invalidAt ? new Date(relationship.invalidAt).toISOString() : null
        });
      }
      
      console.log(`[Neo4jService] Successfully saved ${relationships.length} relationships`);
    } catch (error) {
      console.error(`[Neo4jService] Error saving relationships:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    if (this.driver) {
      console.log(`[Neo4jService] Closing Neo4j connection...`);
      await this.driver.close();
      this.driver = null;
      console.log(`[Neo4jService] Neo4j connection closed`);
    }
  }
}