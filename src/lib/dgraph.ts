import * as dgraph from "dgraph-js";
import { Mutation, Operation } from "dgraph-js";
import type { DgraphConfig, Entity, Memory } from "../types/index.js";

export class DgraphService {
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
    // Connect to Dgraph using the connection string
    this.client = await dgraph.open(this.config.connectionString);
    const schema = `
      name: string @index(exact, term) .
      type: string @index(exact) .
      embedding: float32vector @index(hnsw(metric: "cosine")) .
      description: string .
      createdAt: datetime .
      memories: [uid] @reverse .
      content: string @index(fulltext) .
      timestamp: datetime @index(hour) .
      entities: [uid] .

      type Entity {
        name
        type
        embedding
        description
        createdAt
        memories
      }

      type Memory {
        content
        timestamp
        embedding
        entities
      }
    `;

    const operation = new Operation();
    operation.setSchema(schema);
    await this.ensureClient().alter(operation);
  }

  async saveEntity(entity: Entity): Promise<string> {
    const txn = this.ensureClient().newTxn();
    try {
      const mutation = new Mutation();
      const entityData = {
        uid: "_:entity",
        "dgraph.type": "Entity",
        name: entity.name,
        type: entity.type,
        embedding: entity.embedding || [],
        description: entity.description || "",
        createdAt: entity.createdAt,
      };

      mutation.setSetJson(entityData);
      const response = await txn.mutate(mutation);
      await txn.commit();

      const uid = response.getUidsMap().get("entity");
      if (!uid) {
        throw new Error("Failed to create entity");
      }
      return uid;
    } catch (error) {
      await txn.discard();
      throw error;
    }
  }

  async saveMemory(memory: Memory, entityUids: string[]): Promise<string> {
    const txn = this.ensureClient().newTxn();
    try {
      const mutation = new Mutation();
      const memoryData = {
        uid: "_:memory",
        "dgraph.type": "Memory",
        content: memory.content,
        timestamp: memory.timestamp,
        embedding: memory.embedding || [],
        entities: entityUids.map((uid) => ({ uid })),
      };

      mutation.setSetJson(memoryData);
      const response = await txn.mutate(mutation);
      await txn.commit();

      const uid = response.getUidsMap().get("memory");
      if (!uid) {
        throw new Error("Failed to create memory");
      }
      return uid;
    } catch (error) {
      await txn.discard();
      throw error;
    }
  }

  async findEntitiesByName(names: string[]): Promise<Entity[]> {
    const query = `
      query findEntities($names: [string!]) {
        entities(func: eq(name, $names)) {
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
    const response = await txn.queryWithVars(query, {
      $names: JSON.stringify(names),
    });
    const result = response.getJson();
    return result.entities || [];
  }

  async vectorSearch(embedding: number[], limit = 10): Promise<Entity[]> {
    const query = `
      query vectorSearch($embedding: [float!], $limit: int) {
        entities(func: similar_to(embedding, $limit, $embedding)) {
          uid
          name
          type
          description
          createdAt
          embedding
          memories: ~entities {
            uid
            content
            timestamp
          }
        }
      }
    `;

    const txn = this.ensureClient().newTxn();
    const response = await txn.queryWithVars(query, {
      $embedding: JSON.stringify(embedding),
      $limit: limit.toString(),
    });
    const result = response.getJson();
    return result.entities || [];
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}
