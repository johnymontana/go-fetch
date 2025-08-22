import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createDatabaseService } from './lib/database-factory.js';
import { AIService } from './lib/ai.js';
import { SaveUserMessageTool } from './tools/save-user-message.js';
import { GraphMemorySearchTool } from './tools/graph-memory-search.js';
import type { DatabaseConfig, AIConfig } from './types/index.js';

// Load environment variables from .env file
dotenv.config();

// Load environment variables
const databaseType = (process.env.DATABASE_TYPE || 'dgraph') as 'dgraph' | 'neo4j';

const config = {
  database: {
    type: databaseType,
    dgraph: databaseType === 'dgraph' ? {
      connectionString: process.env.DGRAPH_CONNECTION_STRING || 'dgraph://localhost:9080',
    } : undefined,
    neo4j: databaseType === 'neo4j' ? {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME,
      password: process.env.NEO4J_PASSWORD,
    } : undefined,
  } as DatabaseConfig,
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
  } as AIConfig,
  server: {
    mcpTimeout: parseInt(process.env.MCP_TIMEOUT || '300000'), // 5 minutes default (milliseconds)
    port: parseInt(process.env.PORT || '3000'),
  },
};

// Validate configuration
if (!config.ai.apiKey) {
  throw new Error('AI API key is required. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.');
}

console.log(`[${new Date().toISOString()}] Configuration loaded:`);
console.log(`[${new Date().toISOString()}] - MCP Timeout: ${config.server.mcpTimeout}ms (${config.server.mcpTimeout / 1000}s)`);
console.log(`[${new Date().toISOString()}] - AI Provider: ${config.ai.provider}`);
console.log(`[${new Date().toISOString()}] - Database Type: ${config.database.type}`);
if (config.database.type === 'dgraph' && config.database.dgraph) {
  console.log(`[${new Date().toISOString()}] - Dgraph: ${config.database.dgraph.connectionString.replace(/bearertoken=[^&?]*/g, 'bearertoken=***')}`);
} else if (config.database.type === 'neo4j' && config.database.neo4j) {
  console.log(`[${new Date().toISOString()}] - Neo4j: ${config.database.neo4j.uri}`);
}

// Timeout wrapper function
async function withTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  operation: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation '${operation}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

// Initialize services
const databaseService = createDatabaseService(config.database);
const aiService = new AIService(config.ai);

// Initialize tools
const saveUserMessageTool = new SaveUserMessageTool(databaseService, aiService);
const graphMemorySearchTool = new GraphMemorySearchTool(databaseService, aiService);

// Create MCP server
const server = new Server(
  {
    name: 'graph-fetch',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'save_user_message',
        description: 'Save a user message with entity extraction and relationship mapping to the graph database',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The user message to process and save',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'graph_memory_search',
        description: 'Search for memories using vector similarity on entity embeddings',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to find relevant memories',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)',
              minimum: 1,
              maximum: 50,
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const startTime = Date.now();
  
  console.log(`[${new Date().toISOString()}] MCP Tool '${name}' started with timeout ${config.server.mcpTimeout}ms`);

  try {
    let result: string;
    
    switch (name) {
      case 'save_user_message': {
        result = await withTimeout(
          saveUserMessageTool.execute(args as { message: string }),
          config.server.mcpTimeout,
          'save_user_message'
        );
        break;
      }
      case 'graph_memory_search': {
        result = await withTimeout(
          graphMemorySearchTool.execute(args as { query: string; limit?: number }),
          config.server.mcpTimeout,
          'graph_memory_search'
        );
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] MCP Tool '${name}' completed successfully in ${duration}ms`);
    
    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    console.error(`[${new Date().toISOString()}] MCP Tool '${name}' failed after ${duration}ms: ${errorMessage}`);
    
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Initialize database schema on startup
async function initialize(): Promise<void> {
  try {
    await databaseService.initialize();
    console.log(`${config.database.type.charAt(0).toUpperCase() + config.database.type.slice(1)} schema initialized successfully`);
  } catch (error) {
    console.error(`Failed to initialize ${config.database.type} schema:`, error);
    process.exit(1);
  }
}

// Helper function to get client IP
function getClientIP(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded) ||
         (Array.isArray(realIp) ? realIp[0] : realIp) ||
         req.socket?.remoteAddress ||
         'unknown';
}

// Helper function to format log timestamp
function getTimestamp(): string {
  return new Date().toISOString();
}

// Start the server
async function startServer(): Promise<void> {
  await initialize();
  
  console.error(`[${getTimestamp()}] Creating Express app...`);
  
  const app = express();
  app.use(express.json());
  
  // Configure CORS to expose MCP session headers
  app.use(cors({
    origin: '*', // Allow all origins - adjust as needed for production
    exposedHeaders: ['Mcp-Session-Id']
  }));
  
  // Add comprehensive logging middleware
  app.use((req, res, next) => {
    const startTime = Date.now();
    const clientIP = getClientIP(req);
    const requestId = Math.random().toString(36).substring(2, 15);
    
    console.error(`[${getTimestamp()}] [${requestId}] Incoming request: ${req.method} ${req.url} from ${clientIP}`);
    console.error(`[${getTimestamp()}] [${requestId}] Headers:`, JSON.stringify(req.headers, null, 2));
    
    // Add response logging
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      console.error(`[${getTimestamp()}] [${requestId}] Response completed: ${res.statusCode} in ${duration}ms`);
      return originalEnd.call(this, chunk, encoding);
    };
    
    next();
  });
  
  // MCP endpoint
  app.post('/mcp', async (req, res) => {
    console.error(`[${getTimestamp()}] Handling MCP request`);
    
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });
      
      console.error(`[${getTimestamp()}] Connecting transport to MCP server`);
      await server.connect(transport);
      
      console.error(`[${getTimestamp()}] Handling request with transport`);
      await transport.handleRequest(req, res, req.body);
      
      res.on('close', () => {
        console.error(`[${getTimestamp()}] Request closed, cleaning up transport`);
        transport.close();
        server.close();
      });
      
    } catch (error) {
      console.error(`[${getTimestamp()}] Error handling MCP request:`, error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      tools: ['save_user_message', 'graph_memory_search']
    });
  });
  
  // Start the Express server
  app.listen(config.server.port, () => {
    console.error(`[${getTimestamp()}] Graph Fetch MCP Server is ready on port ${config.server.port}!`);
    console.error(`[${getTimestamp()}] MCP Timeout: ${config.server.mcpTimeout}ms (${config.server.mcpTimeout / 1000}s)`);
    console.error(`[${getTimestamp()}] Available tools: save_user_message, graph_memory_search`);
    console.error(`[${getTimestamp()}] MCP endpoint: http://localhost:${config.server.port}/mcp`);
    console.error(`[${getTimestamp()}] Health check: http://localhost:${config.server.port}/health`);
    console.error(`[${getTimestamp()}] Server process ID: ${process.pid}`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error(`[${getTimestamp()}] Received SIGINT, shutting down gracefully...`);
  try {
    await databaseService.close();
    console.error(`[${getTimestamp()}] Database connection closed successfully`);
  } catch (error) {
    console.error(`[${getTimestamp()}] Error closing database connection:`, error);
  }
  console.error(`[${getTimestamp()}] Server shutdown complete`);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error(`[${getTimestamp()}] Received SIGTERM, shutting down gracefully...`);
  try {
    await databaseService.close();
    console.error(`[${getTimestamp()}] Database connection closed successfully`);
  } catch (error) {
    console.error(`[${getTimestamp()}] Error closing database connection:`, error);
  }
  console.error(`[${getTimestamp()}] Server shutdown complete`);
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`[${getTimestamp()}] Uncaught Exception:`, error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${getTimestamp()}] Unhandled Rejection at:`, promise, 'reason:', reason);
  process.exit(1);
});

// Start server if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.error(`[${getTimestamp()}] Starting Graph Fetch MCP Server...`);
  startServer().catch((error) => {
    console.error(`[${getTimestamp()}] Failed to start server:`, error);
    process.exit(1);
  });
}