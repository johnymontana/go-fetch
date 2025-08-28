import { DgraphService } from "./dgraph.js";
import { Neo4jService } from "./neo4j.js";
import type { DatabaseService } from "./database-interface.js";
import type { DatabaseConfig } from "../types/index.js";

export function createDatabaseService(config: DatabaseConfig): DatabaseService {
  switch (config.type) {
    case 'dgraph':
      if (!config.dgraph) {
        throw new Error('Dgraph configuration is required when type is "dgraph"');
      }
      return new DgraphService(config.dgraph);
    
    case 'neo4j':
      if (!config.neo4j) {
        throw new Error('Neo4j configuration is required when type is "neo4j"');
      }
      return new Neo4jService(config.neo4j);
    
    default:
      throw new Error(`Unsupported database type: ${(config as any).type}`);
  }
}