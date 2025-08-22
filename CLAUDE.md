# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Graph Fetch is a TypeScript MCP (Model Context Protocol) server that provides graph-based memory tools for AI agents using either Dgraph or Neo4j as the backend database. The server exposes two main tools for entity extraction, storage, and semantic search through the MCP protocol.

## Development Commands

```bash
# Build the TypeScript project
npm run build

# Run in development mode with hot reload (using nodemon)
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
- **DatabaseService Interface**: Common interface for database operations across different backends
- **DgraphService**: Handles database operations for Dgraph, including schema initialization and vector searches
- **Neo4jService**: Handles database operations for Neo4j, including schema initialization and vector searches
- **DatabaseFactory**: Creates the appropriate database service based on configuration
- **AIService**: Manages LLM calls for entity extraction and embedding generation using Vercel AI SDK
- **MCP Tools**: Implements the two main tools as classes with execute methods

### Data Flow
1. `save_user_message`: Message → Entity Extraction (LLM) → Embeddings → Database Storage (Dgraph or Neo4j)
2. `graph_memory_search`: Query → Embedding → Vector Search → Memory Retrieval → AI Summary

### Environment Variables

#### Required
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: API key for AI services

#### Database Configuration
- `DATABASE_TYPE`: `dgraph` or `neo4j` (default: `dgraph`)

#### Dgraph Configuration (when DATABASE_TYPE=dgraph)
- `DGRAPH_CONNECTION_STRING`: Connection string for Dgraph (default: `dgraph://localhost:9080`)

#### Neo4j Configuration (when DATABASE_TYPE=neo4j)
- `NEO4J_URI`: Neo4j connection URI (default: `bolt://localhost:7687`)
- `NEO4J_USERNAME`: Neo4j username (optional for local development)
- `NEO4J_PASSWORD`: Neo4j password (optional for local development)

#### Optional
- `AI_PROVIDER`: `openai` or `anthropic` (default: `openai`)
- `EMBEDDING_MODEL`: Embedding model name (default: `text-embedding-3-small`)
- `LLM_MODEL`: Language model name (default: `gpt-4o-mini`)

### Database Connection Formats

#### Dgraph
Uses standard `dgraph.open()` connection strings:
- Local: `dgraph://localhost:9080`
- With auth: `dgraph://user:password@localhost:9080`
- Cloud: `dgraph://your-instance.cloud:443?sslmode=verify-ca&bearertoken=your-token`

#### Neo4j
Uses standard Neo4j connection URIs:
- Local (no auth): `bolt://localhost:7687`
- Local (with auth): Set `NEO4J_USERNAME` and `NEO4J_PASSWORD` environment variables
- Neo4j AuraDB: `neo4j+s://your-instance.databases.neo4j.io` with username/password
- Local via HTTP: `http://localhost:7474`

### Database Schema

#### Dgraph Schema
- Entity nodes with vector embeddings for semantic search
- Memory nodes linked to entities via relationships
- HNSW vector index for efficient similarity search

#### Neo4j Schema
- `:Entity` nodes with vector embeddings for semantic search
- `:Memory` nodes connected to entities via `:RELATES_TO` relationships
- Entity relationships via `:RELATED_TO` relationships with type and temporal properties
- Vector indexes on embedding properties for efficient similarity search
- Constraints and indexes on entity names and types

## Testing with MCP Inspector

### Quick Setup

#### For Dgraph (default)
```bash
# 1. Start Dgraph
docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest

# 2. Build project
npm run build

# 3. Launch MCP Inspector
npm run inspector
```

#### For Neo4j
```bash
# 1. Start Neo4j (with APOC plugin for vector operations)
docker run --rm -it -p 7474:7474 -p 7687:7687 \
    -e NEO4J_AUTH=neo4j/password \
    -e NEO4J_PLUGINS='["apoc"]' \
    neo4j:5.15

# 2. Set environment variables
export DATABASE_TYPE=neo4j
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USERNAME=neo4j
export NEO4J_PASSWORD=password

# 3. Build project
npm run build

# 4. Launch MCP Inspector
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

The project is configured for Vercel deployment with `vercel.json`. Environment variables must be set in the Vercel dashboard.

### Database Requirements

#### Dgraph
Requires a hosted Dgraph instance (Dgraph Cloud recommended for production).

#### Neo4j
Requires a hosted Neo4j instance. Options include:
- **Neo4j AuraDB**: Fully managed cloud service (recommended for production)
- **Neo4j Enterprise Cloud**: Enterprise-grade cloud deployment
- **Self-hosted**: Neo4j deployed on your infrastructure

### Environment Variables for Production

#### Dgraph Production Example
```bash
DATABASE_TYPE=dgraph
DGRAPH_CONNECTION_STRING=dgraph://your-instance.cloud:443?sslmode=verify-ca&bearertoken=your-token
OPENAI_API_KEY=your-openai-key
```

#### Neo4j AuraDB Production Example
```bash
DATABASE_TYPE=neo4j
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-auradb-password
OPENAI_API_KEY=your-openai-key
```