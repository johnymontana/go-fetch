# Graph Fetch - MCP Server for Graph-Based Memory

![fetch logo](img/fetch.png)

An MCP (Model Context Protocol) server that provides graph-based memory tools for AI agents using Dgraph as the backend database. Built with TypeScript, Vercel AI SDK, and the Vercel MCP adapter.

## Features

- **Entity Extraction**: Automatically extracts entities from user messages using LLMs
- **Vector Search**: Semantic search through memories using embeddings
- **Graph Relationships**: Stores entities and memories with relationships in Dgraph
- **Two MCP Tools**:
  - `save_user_message`: Process and save messages with entity extraction
  - `graph_memory_search`: Vector-based search through stored memories

## Prerequisites

- Node.js 20+
- Dgraph database instance (local or cloud)
- OpenAI or Anthropic API key

## Dgraph Connection Formats

The project supports flexible Dgraph connection string formats:

- **Single port**: `dgraph://localhost:9080` (HTTP port auto-derived as gRPC-1000)
- **Dual port**: `dgraph://localhost:9080,8080` (explicit gRPC and HTTP ports)
- **Remote**: `dgraph://dgraph.example.com:443,443` (for cloud instances)

## Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   DGRAPH_CONNECTION_STRING=dgraph://localhost:9080
   AI_PROVIDER=openai
   OPENAI_API_KEY=your_openai_api_key
   EMBEDDING_MODEL=text-embedding-3-small
   LLM_MODEL=gpt-4o-mini
   ```

3. **Start Dgraph** (if running locally):
   ```bash
   docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest
   ```

## Development

```bash
# Build the project
npm run build

# Run in development mode
npm run dev

# Start production server
npm start

# Lint code
npm run lint

# Type check
npm run type-check

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
```

## Testing

The project includes a comprehensive test suite with:

### Unit Tests
- **DgraphService**: Database operations, schema initialization, vector search
- **AIService**: Entity extraction, embedding generation, summary creation  
- **MCP Tools**: save_user_message and graph_memory_search functionality

### Integration Tests
- **MCP Server**: End-to-end server functionality and tool integration

### Test Structure
```
tests/
├── fixtures/          # Test data and mock objects
├── mocks/             # Service mocks (Dgraph, AI)
├── integration/       # Integration tests
└── setup.ts           # Global test configuration

src/__tests__/         # Unit tests alongside source code
├── lib/               # Service unit tests
└── tools/             # Tool unit tests
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch

# Run tests for CI (no watch, with coverage)
npm run test:ci
```

### Test Configuration
- **Jest** with TypeScript support via ts-jest
- **ESM modules** support for modern JavaScript
- **Mocking** of external dependencies (Dgraph, AI services)
- **Coverage reporting** with HTML and LCOV formats
- **GitHub Actions** CI pipeline for automated testing

## Deployment

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel`
3. Set environment variables in Vercel dashboard
4. Configure Dgraph Cloud or hosted Dgraph instance

## MCP Tools

### save_user_message

Processes a user message, extracts entities, and saves them to Dgraph with relationships.

**Parameters**:
- `message` (string): The user message to process

**Example**:
```json
{
  "message": "I met John Smith at Google headquarters in Mountain View yesterday."
}
```

### graph_memory_search

Searches for relevant memories using vector similarity on entity embeddings.

**Parameters**:
- `query` (string): Search query
- `limit` (number, optional): Max results (default: 10)

**Example**:
```json
{
  "query": "meetings with Google employees",
  "limit": 5
}
```

## Architecture

- **src/lib/dgraph.ts**: Dgraph database operations and schema management
- **src/lib/ai.ts**: AI operations (entity extraction, embeddings, summaries)
- **src/tools/**: MCP tool implementations
- **src/types/**: TypeScript type definitions
- **src/index.ts**: MCP server setup and configuration

## License

ISC