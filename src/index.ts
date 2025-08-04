import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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

// Start the server
async function startServer(): Promise<void> {
  await initialize();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Graph Fetch MCP Server is ready!');
  console.error('Available tools: save_user_message, graph_memory_search');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down gracefully...');
  await dgraphService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Shutting down gracefully...');
  await dgraphService.close();
  process.exit(0);
});

// Start server if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}