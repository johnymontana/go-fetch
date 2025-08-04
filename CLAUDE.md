# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Graph Fetch is a TypeScript MCP (Model Context Protocol) server that provides graph-based memory tools for AI agents using Dgraph as the backend database. The server exposes two main tools for entity extraction, storage, and semantic search through the MCP protocol.

## Development Commands

```bash
# Build the TypeScript project
npm run build

# Run in development mode with hot reload
npm run dev

# Start production server
npm start

# Lint code and fix issues
npm run lint
npm run lint:fix

# Type checking without emitting files
npm run type-check

# Run tests
npm test
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
npm run test:ci         # CI mode
```

## Project Structure

```
src/
├── lib/           # Core services
│   ├── dgraph.ts  # Dgraph database operations and schema
│   └── ai.ts      # AI operations (LLM, embeddings)
├── tools/         # MCP tool implementations
│   ├── save-user-message.ts
│   └── graph-memory-search.ts
├── types/         # TypeScript type definitions
├── __tests__/     # Unit tests (co-located with source)
└── index.ts       # MCP server setup and entry point

tests/
├── fixtures/      # Test data and mock objects
├── mocks/         # Service mocks (Dgraph, AI SDK)
├── integration/   # Integration tests
└── setup.ts       # Global test configuration
```

## Architecture Notes

### Core Components
- **DgraphService**: Handles all database operations, schema initialization, and vector searches
- **AIService**: Manages LLM calls for entity extraction and embedding generation using Vercel AI SDK
- **MCP Tools**: Implements the two main tools as classes with execute methods

### Data Flow
1. `save_user_message`: Message → Entity Extraction (LLM) → Embeddings → Dgraph Storage
2. `graph_memory_search`: Query → Embedding → Vector Search → Memory Retrieval → AI Summary

### Environment Variables
Required: `DGRAPH_CONNECTION_STRING`, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
Optional: `AI_PROVIDER`, `EMBEDDING_MODEL`, `LLM_MODEL`

### Dgraph Connection String Format
- Single port: `dgraph://localhost:9080` (HTTP auto-derived as gRPC-1000)
- Dual port: `dgraph://localhost:9080,8080` (explicit gRPC,HTTP ports)
- Cloud: `dgraph://your-instance.cloud:443,443`

### Dgraph Schema
- Entity nodes with vector embeddings for semantic search
- Memory nodes linked to entities via relationships
- HNSW vector index for efficient similarity search

## Testing with MCP Inspector

### Quick Setup
```bash
# 1. Start Dgraph
docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest

# 2. Build project
npm run build

# 3. Launch MCP Inspector
npm run inspector
```

### Inspector Configuration
- **Server Command**: `node`
- **Server Arguments**: `["dist/index.js"]`
- **Working Directory**: Project root path

### Test Examples
**Save User Message**:
```json
{
  "message": "I met John Smith at Google headquarters in Mountain View yesterday to discuss the new AI project."
}
```

**Graph Memory Search**:
```json
{
  "query": "meetings with Google employees",
  "limit": 5
}
```

## Testing

The project includes comprehensive testing with Jest:
- **Unit Tests**: Test individual services and tools with mocked dependencies
- **Integration Tests**: Test MCP server functionality end-to-end
- **Coverage**: Aim for >90% code coverage on core business logic
- **CI/CD**: Automated testing in GitHub Actions for all PRs and pushes

Run tests locally:
- `npm test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode during development
- `npm run test:coverage` - Generate coverage reports

## Deployment

The project is configured for Vercel deployment with `vercel.json`. Environment variables must be set in the Vercel dashboard. Requires a hosted Dgraph instance (Dgraph Cloud recommended for production).