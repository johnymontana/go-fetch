import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DgraphService } from './lib/dgraph.js';
import { AIService } from './lib/ai.js';
import { SaveUserMessageTool } from './tools/save-user-message.js';
import { GraphMemorySearchTool } from './tools/graph-memory-search.js';
import type { DgraphConfig, AIConfig } from './types/index.js';

// Load environment variables from .env file
dotenv.config();

// Load environment variables
const config = {
  dgraph: {
    connectionString: process.env.DGRAPH_CONNECTION_STRING || 'dgraph://localhost:9080',
  } as DgraphConfig,
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
  } as AIConfig,
};

// Validate configuration
if (!config.ai.apiKey) {
  throw new Error('AI API key is required. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.');
}

// Initialize services
const dgraphService = new DgraphService(config.dgraph);
const aiService = new AIService(config.ai);

// Initialize tools
const saveUserMessageTool = new SaveUserMessageTool(dgraphService, aiService);
const graphMemorySearchTool = new GraphMemorySearchTool(dgraphService, aiService);

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
        description: 'Save a user message with entity extraction and relationship mapping to Dgraph',
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

  try {
    switch (name) {
      case 'save_user_message': {
        const result = await saveUserMessageTool.execute(args as { message: string });
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }
      case 'graph_memory_search': {
        const result = await graphMemorySearchTool.execute(args as { query: string; limit?: number });
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        },
      ],
      isError: true,
    };
  }
});

// Initialize Dgraph schema on startup
async function initialize(): Promise<void> {
  try {
    await dgraphService.initialize();
    console.log('Dgraph schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Dgraph schema:', error);
    process.exit(1);
  }
}

// Helper function to get client IP
function getClientIP(req: any): string {
  return req.headers['x-forwarded-for'] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
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
  
  const httpServer = createServer((req, res) => {
    const startTime = Date.now();
    const clientIP = getClientIP(req);
    const requestId = Math.random().toString(36).substring(2, 15);
    
    // Log incoming request
    console.error(`[${getTimestamp()}] [${requestId}] Incoming request: ${req.method} ${req.url} from ${clientIP}`);
    console.error(`[${getTimestamp()}] [${requestId}] Headers:`, JSON.stringify(req.headers, null, 2));
    
    // Add response logging
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      console.error(`[${getTimestamp()}] [${requestId}] Response completed: ${res.statusCode} in ${duration}ms`);
      return originalEnd.call(this, chunk, encoding);
    };
    
    if (req.url === '/message' || req.url?.startsWith('/message?')) {
      console.error(`[${getTimestamp()}] [${requestId}] Handling MCP request: ${req.method} ${req.url}`);
      
      try {
        const transport = new SSEServerTransport('/message', res);
        
        // Log transport connection
        console.error(`[${getTimestamp()}] [${requestId}] SSE transport created, connecting to MCP server`);
        
        server.connect(transport).then(() => {
          console.error(`[${getTimestamp()}] [${requestId}] MCP server connected successfully`);
        }).catch((error) => {
          console.error(`[${getTimestamp()}] [${requestId}] MCP server connection failed:`, error);
        });
        
      } catch (error) {
        console.error(`[${getTimestamp()}] [${requestId}] Failed to create SSE transport:`, error);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    } else {
      console.error(`[${getTimestamp()}] [${requestId}] Route not found: ${req.method} ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });
  
  // Add server event logging
  httpServer.on('connection', (socket) => {
    const clientIP = socket.remoteAddress;
    console.error(`[${getTimestamp()}] New connection established from ${clientIP}`);
    
    socket.on('close', () => {
      console.error(`[${getTimestamp()}] Connection closed from ${clientIP}`);
    });
    
    socket.on('error', (error) => {
      console.error(`[${getTimestamp()}] Socket error from ${clientIP}:`, error);
    });
  });
  
  httpServer.on('error', (error) => {
    console.error(`[${getTimestamp()}] HTTP server error:`, error);
  });
  
  httpServer.on('clientError', (error, socket) => {
    console.error(`[${getTimestamp()}] Client error:`, error);
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  });
  
  const port = process.env.PORT || 3000;
  httpServer.listen(port, () => {
    console.error(`[${getTimestamp()}] Graph Fetch MCP Server is ready on port ${port}!`);
    console.error(`[${getTimestamp()}] Available tools: save_user_message, graph_memory_search`);
    console.error(`[${getTimestamp()}] Connect to: http://localhost:${port}/message`);
    console.error(`[${getTimestamp()}] Server process ID: ${process.pid}`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error(`[${getTimestamp()}] Received SIGINT, shutting down gracefully...`);
  try {
    await dgraphService.close();
    console.error(`[${getTimestamp()}] Dgraph connection closed successfully`);
  } catch (error) {
    console.error(`[${getTimestamp()}] Error closing Dgraph connection:`, error);
  }
  console.error(`[${getTimestamp()}] Server shutdown complete`);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error(`[${getTimestamp()}] Received SIGTERM, shutting down gracefully...`);
  try {
    await dgraphService.close();
    console.error(`[${getTimestamp()}] Dgraph connection closed successfully`);
  } catch (error) {
    console.error(`[${getTimestamp()}] Error closing Dgraph connection:`, error);
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