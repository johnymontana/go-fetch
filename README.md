# Go Fetch - MCP Server for Graph-Based Memory

![fetch logo](img/fetch.png)

An MCP (Model Context Protocol) server that provides graph-based memory tools for AI agents using either **Dgraph** or **Neo4j** as the backend database. Features a unified database interface with automatic schema management and vector indexing for both graph databases. Includes specialized tooling for ingesting and benchmarking against the Locomo-10 AI agent memory dataset. Built with TypeScript, Vercel AI SDK, and the Vercel MCP adapter.

## Features

- **Entity Extraction**: Automatically extracts entities from user messages using LLMs
- **Vector Search**: Semantic search through memories using embeddings
- **Graph Relationships**: Stores entities and memories with relationships in Dgraph or Neo4j
- **Graph Algorithms**: Analyzes graph structure (community detection and centrality)
- **Locomo Benchmark Integration**: Purpose-built ingestion for AI agent memory benchmarking
- **Two MCP Tools**:
  - `save_user_message`: Process and save messages with entity extraction
  - `graph_memory_search`: Vector-based search through stored memories

![go fetch architecture](img/go-fetch-arch.png)

## Graph Data Model

![fetch data model](img/fetch-schema.png)

### Database Schema Comparison

Both Dgraph and Neo4j support the same logical data model with different implementations:

#### Dgraph Schema
- **Entity nodes** with vector embeddings for semantic search
- **Memory nodes** linked to entities via relationships
- **HNSW vector index** for efficient similarity search
- **Faceted relationships** with type and temporal metadata

#### Neo4j Schema
- **`:Entity` nodes** with vector embeddings for semantic search
- **`:Memory` nodes** connected to entities via `:RELATES_TO` relationships
- **Entity relationships** via `:RELATED_TO` relationships with type and temporal properties
- **Vector indexes** on embedding properties (requires Neo4j 5.11+)
- **Constraints and indexes** on entity names and types

**Key Differences:**
- **Neo4j** uses labeled property graph model with explicit relationship types (`:RELATES_TO`, `:RELATED_TO`)
- **Dgraph** uses RDF-style predicates with faceted edges for metadata
- **Neo4j** requires explicit schema creation with constraints and indexes
- **Dgraph** infers schema automatically from data mutations

## Prerequisites

- Node.js 20+
- **Database** (choose one):
  - **Dgraph** database instance (local or cloud)
  - **Neo4j** database instance (local or cloud) - requires Neo4j 5.11+ for vector indexing
- OpenAI or Anthropic API key

## Database Configuration

### Dgraph Connection

The project uses standard Dgraph connection strings with `dgraph.open()`:

- **Local**: `dgraph://localhost:9080`
- **With auth**: `dgraph://user:password@localhost:9080`
- **Cloud**: `dgraph://your-instance.cloud:443?sslmode=verify-ca&bearertoken=your-token`

### Neo4j Connection

The project uses standard Neo4j connection URIs with the Neo4j driver:

- **Local (no auth)**: `bolt://localhost:7687`
- **Local with auth**: `bolt://localhost:7687` + `NEO4J_USERNAME`/`NEO4J_PASSWORD` environment variables
- **Neo4j AuraDB**: `neo4j+s://your-instance.databases.neo4j.io` + username/password
- **Local HTTP**: `http://localhost:7474`

**Requirements:**
- Neo4j 5.11+ (for vector indexing support)
- APOC plugin (recommended for advanced operations)

## Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   **For Dgraph (default)**:
   ```env
   DATABASE_TYPE=dgraph
   DGRAPH_CONNECTION_STRING=dgraph://localhost:9080
   AI_PROVIDER=openai
   OPENAI_API_KEY=your_openai_api_key
   EMBEDDING_MODEL=text-embedding-3-small
   LLM_MODEL=gpt-4o-mini
   ```

   **For Neo4j**:
   ```env
   DATABASE_TYPE=neo4j
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=password
   AI_PROVIDER=openai
   OPENAI_API_KEY=your_openai_api_key
   EMBEDDING_MODEL=text-embedding-3-small
   LLM_MODEL=gpt-4o-mini
   ```

   **For cloud instances**:
   ```env
   # Dgraph Cloud
   DATABASE_TYPE=dgraph
   DGRAPH_CONNECTION_STRING=dgraph://your-instance.cloud:443?sslmode=verify-ca&bearertoken=your-token
   
   # Neo4j AuraDB
   DATABASE_TYPE=neo4j
   NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your-auradb-password
   ```

3. **Start your database** (if running locally):
   
   **For Dgraph**:
   ```bash
   docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest
   ```
   
   **For Neo4j** (with APOC plugin for enhanced functionality):
   ```bash
   docker run --rm -it -p 7474:7474 -p 7687:7687 \
     -e NEO4J_AUTH=neo4j/password \
     -e NEO4J_PLUGINS='["apoc"]' \
     neo4j:5.15
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

# Launch MCP Inspector for testing
npm run inspector

# Quick MCP server test
npm run test:mcp
```

## Testing the MCP Server

### Using MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is a debugging tool that allows you to test and interact with your MCP server directly. It provides a web interface to call tools, inspect responses, and debug your server implementation.

#### Prerequisites

1. **Install MCP Inspector**:
   ```bash
   npm install -g @modelcontextprotocol/inspector
   ```

2. **Start your database** (if testing with real database):
   
   **For Dgraph**:
   ```bash
   docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest
   ```
   
   **For Neo4j**:
   ```bash
   docker run --rm -it -p 7474:7474 -p 7687:7687 \
     -e NEO4J_AUTH=neo4j/password \
     -e NEO4J_PLUGINS='["apoc"]' \
     neo4j:5.15
   ```

3. **Configure your API keys** in `.env`:
   ```env
   OPENAI_API_KEY=your_actual_openai_api_key
   # or
   ANTHROPIC_API_KEY=your_actual_anthropic_api_key
   ```

#### Running the Inspector

1. **Start the MCP Inspector**:
   ```bash
   npx @modelcontextprotocol/inspector
   ```

2. **Configure the connection** in the inspector web interface:
   - **Server Command**: `node`
   - **Server Arguments**: `["dist/index.js"]`
   - **Working Directory**: `/path/to/your/graph-fetch/project`

   Or for development mode:
   - **Server Command**: `npm`
   - **Server Arguments**: `["run", "dev"]`
   - **Working Directory**: `/path/to/your/graph-fetch/project`

3. **Test the tools**:

   **Save User Message Tool**:
   ```json
   {
     "message": "I met John Smith at Google headquarters in Mountain View yesterday to discuss the new AI project."
   }
   ```

   ![](img/example-save-user-message.png)

   **Graph Memory Search Tool**:
   ```json
   {
     "query": "meetings with Google employees",
     "limit": 5
   }
   ```

#### Expected Behavior

- **save_user_message**: Should extract entities (John Smith, Google, Mountain View, AI project) and save them to Dgraph with relationships
- **graph_memory_search**: Should return semantically similar memories based on vector embeddings

#### Troubleshooting

- **Connection issues**: Ensure the server builds successfully with `npm run build`
- **API errors**: Verify your AI provider API key is correctly set in `.env`
- **Database errors**: Make sure your database is running and accessible:
  - **Dgraph**: `docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest`
  - **Neo4j**: `docker run --rm -it -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:5.15`
- **Tool errors**: Check the inspector console and server logs for detailed error messages
- **Server startup fails**: The MCP server requires the database to be running to initialize. Start your database before testing the server

### Manual Testing

You can also test the server manually using stdio:

```bash
# Start your database (in separate terminal)
# For Dgraph:
docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest

# For Neo4j:
docker run --rm -it -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:5.15

# Build and start the server (in main terminal)
npm run build
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/index.js
```

### Quick Testing Workflow

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

#### Using the Inspector
1. Open the inspector in your browser (usually http://localhost:3000)
2. Configure connection with: `node dist/index.js`
3. Test the tools with sample data

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
4. Configure your database backend:
   - **Dgraph Cloud**: Set `DATABASE_TYPE=dgraph` and `DGRAPH_CONNECTION_STRING`
   - **Neo4j AuraDB**: Set `DATABASE_TYPE=neo4j`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`

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

## Locomo AI Agent Memory Benchmark

Graph Fetch includes a specialized ingestion script for the **Locomo-10** AI agent memory benchmark dataset. This benchmark contains 10 realistic multi-session conversations designed to test an AI agent's ability to build and maintain long-term memory across interactions.

### Quick Start

**For Dgraph:**
```bash
# 1. Start Dgraph and MCP server
docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest
npm run build && npm start

# 2. Test with small sample
node scripts/ingest-locomo.js --max-conversations 1 --max-sessions 1 --max-messages 5
```

**For Neo4j:**
```bash
# 1. Start Neo4j and MCP server
docker run --rm -it -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:5.15
export DATABASE_TYPE=neo4j NEO4J_URI=bolt://localhost:7687 NEO4J_USERNAME=neo4j NEO4J_PASSWORD=password
npm run build && npm start

# 2. Test with small sample
node scripts/ingest-locomo.js --max-conversations 1 --max-sessions 1 --max-messages 5
```

### Dataset Overview

- **10 conversations** between different speaker pairs
- **~190 sessions** total (spanning days/weeks per conversation)
- **~4000+ messages** with rich contextual information
- **Realistic scenarios**: Work stress, relationships, life events, personal growth

The ingestion script processes conversations through the Graph Fetch pipeline to:
- Extract entities (people, places, organizations, events, emotions)
- Build relationships between entities automatically  
- Generate embeddings for semantic search
- Store everything in Dgraph as a connected knowledge graph

### Example Output

```bash
📋 Processing conversation 1: Caroline & Melanie
[SAVE] [1:56 pm on 8 May, 2023] Caroline: Hey Mel! Good to see you!
✅ Saved - Successfully saved message with 3 entities (1 new) and 2 relationships. Memory ID: 0x753d

✅ Ingestion completed!
📈 Total processed: 10 messages from 1 conversations  
✅ Successfully saved: 10 ❌ Errors: 0
```

### Use Cases

- **Benchmark AI agent memory systems** against standardized dataset
- **Test graph-based memory retrieval** with complex multi-session contexts
- **Evaluate entity extraction** on realistic conversation data
- **Research long-term memory** patterns in AI agent interactions

### Querying Your Data

After ingestion, explore the generated knowledge graph with powerful DQL queries:
- **Relationship analysis**: Find support networks, advocacy patterns, community connections
- **Entity centrality**: Discover most connected people and concepts
- **Temporal tracking**: Analyze relationship evolution across conversations  
- **Semantic search**: Query by relationship types like "expressed gratitude for", "member of", "advocates for"

**📖 [Complete Locomo Ingestion Guide →](scripts/README.md)**  
**🔍 [Example DQL Queries & Analysis →](eval/README.md)**

## Community Detection & Graph Enrichment

Graph Fetch includes a powerful Python companion service for advanced graph analytics that can discover semantic communities within your memory graph and enrich the data model with dedicated community nodes.

### Label Propagation Community Detection

The service uses **Label Propagation** algorithm to automatically discover communities of related entities in your graph data. This unsupervised approach identifies clusters of entities that are semantically connected, revealing the underlying structure of your AI agent's memory.

**How it works:**
1. **Analyzes entity relationships** in your existing Dgraph memory graph
2. **Discovers semantic communities** using NetworkX label propagation algorithm  
3. **Creates dedicated Community nodes** with type `Community` in Dgraph
4. **Establishes member relationships** connecting each community to its member entities
5. **Enriches queries** enabling community-based memory retrieval and analysis

### Graph Data Model Enrichment

The community detection transforms your flat entity-relationship structure into a rich, hierarchical graph:

**Before**: `Entity ←→ relatedTo ←→ Entity`

**After**: `Entity ←→ relatedTo ←→ Entity`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↕  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Community`

Each discovered community becomes a first-class entity with:
- **Semantic groupings**: Related people, concepts, events clustered together
- **Metadata**: Algorithm used, community size, execution timestamp
- **Queryable structure**: Find all members of a community or which communities an entity belongs to

### Running Community Detection

Prerequisites:
- Python 3.11+ with UV package manager
- Existing Dgraph instance with Entity/Memory data

```bash
# Navigate to the graph algorithms service
cd graph-algos

# Install dependencies
uv sync

# Configure connection to your Dgraph instance
cp .env.example .env
# Edit .env with your DGRAPH_CONNECTION_STRING

# Run label propagation with community node creation
uv run graph-algos community --algorithm label_propagation --write --create-communities

# Verify communities were created
uv run python verify_communities.py
```

### Example Results

When run on an AI agent memory graph with 134 entities:

```bash
✅ Found 17 community nodes
📊 Community Statistics:
   Total communities: 17
   Total member relationships: 134
   Average community size: 7.9

📊 Example Discovered Communities:
   Community 0: Caroline, Mel, conversation dates (37 members)
   Community 1: Melanie, inspiring stories, creative concepts (11 members) 
   Community 2: Mental health topics, charity events (3 members)
   Community 4: Family relationships, community involvement (35 members)
```



### Use Cases

- **Contextual Memory Retrieval**: Find memories by community themes rather than individual entities
- **Semantic Organization**: Understand how your AI agent naturally groups related information
- **Conversation Analysis**: Identify topic clusters and relationship patterns across sessions
- **Memory Summarization**: Generate community-level summaries and insights
- **Graph Exploration**: Navigate memory graph by semantic communities rather than individual connections

**🔧 [Complete Graph Algorithms Documentation →](graph-algos/README.md)**

## Architecture

Graph Fetch consists of a TypeScript MCP server for AI agent memory operations and a Python companion service for advanced graph analytics.

### Project Structure

```
fetch/
├── src/                              # TypeScript MCP server source code
│   ├── lib/
│   │   ├── database-factory.ts       # Database service factory for Dgraph/Neo4j selection
│   │   ├── database-interface.ts     # Common interface for database operations
│   │   ├── dgraph.ts                 # Dgraph database operations and schema management
│   │   ├── neo4j.ts                  # Neo4j database operations and schema management
│   │   └── ai.ts                     # AI operations (entity extraction, embeddings, summaries)
│   ├── tools/
│   │   ├── save-user-message.ts      # MCP tool for processing and saving user messages
│   │   └── graph-memory-search.ts    # MCP tool for vector-based memory search
│   ├── types/
│   │   └── index.ts                  # TypeScript type definitions and interfaces
│   ├── test-fixtures/
│   │   └── test-data.ts              # Shared test data and mock objects
│   ├── __tests__/                    # Unit tests alongside source code
│   │   ├── lib/
│   │   │   ├── ai.test.ts            # AIService unit tests with mocked providers
│   │   │   ├── dgraph.test.ts        # DgraphService tests with mocked database
│   │   │   ├── neo4j.test.ts         # Neo4jService tests with mocked database
│   │   │   └── database-factory.test.ts # Database factory tests
│   │   └── tools/
│   │       ├── save-user-message.test.ts      # Save message tool integration tests
│   │       └── graph-memory-search.test.ts    # Search tool functionality tests
│   ├── test-setup.ts                 # Global test configuration and setup
│   └── index.ts                      # MCP server initialization and HTTP transport
├── tests/
│   ├── integration/                  # End-to-end MCP server integration tests
│   ├── fixtures/                     # Test data and mock objects
│   └── mocks/                        # Service mocks (Dgraph, AI SDK)
├── scripts/
│   ├── ingest-locomo.ts              # Locomo-10 benchmark dataset ingestion script
│   ├── ingest-locomo.js              # Compiled JavaScript version
│   └── README.md                     # Ingestion guide and usage examples
├── eval/
│   ├── README.md                     # Analysis guides and example DQL queries
│   └── locomo/
│       └── Locomo-10.json            # Complete AI agent memory benchmark dataset
├── graph-algos/                      # Python companion service for graph analytics
│   ├── src/
│   │   └── graph_algos/
│   │       ├── core/
│   │       │   ├── config.py         # Pydantic configuration management
│   │       │   ├── dgraph_client.py  # Python Dgraph client with auth support
│   │       │   └── logger.py         # Structured logging configuration
│   │       ├── algorithms/
│   │       │   ├── base.py           # Abstract base class for all algorithms
│   │       │   ├── centrality.py     # NetworkX centrality implementations
│   │       │   ├── community.py      # Community detection algorithms
│   │       │   └── graph_builder.py  # Dgraph to NetworkX graph conversion
│   │       ├── api/
│   │       │   └── server.py         # Flask REST API server
│   │       ├── schedulers/
│   │       │   └── periodic_runner.py # APScheduler cron-style execution
│   │       └── cli.py                # Click-based command-line interface
│   ├── tests/                        # Python test suite
│   ├── examples/
│   │   ├── api_client.py             # API usage examples
│   │   ├── community_analysis.py     # Community detection examples
│   │   └── run_pagerank.py           # Centrality algorithm examples
│   ├── config/                       # Configuration templates
│   ├── docs/                         # Additional documentation
│   ├── pyproject.toml                # Python project and UV dependency configuration
│   ├── uv.lock                       # UV dependency lock file
│   ├── .env.example                  # Environment variable template
│   ├── .gitignore                    # Python-specific gitignore rules
│   ├── Dockerfile                    # Docker container configuration
│   ├── docker-compose.yml            # Multi-service Docker setup
│   └── README.md                     # Graph algorithms service documentation
├── img/
│   ├── fetch.png                     # Project logo
│   ├── fetch-schema.png              # Graph data model visualization
│   └── arrows/
│       └── fetch-schema.json         # Arrows graph editor schema file
├── dist/                             # Compiled JavaScript output
├── node_modules/                     # Node.js dependencies
├── package.json                      # Node.js project configuration and dependencies
├── package-lock.json                 # Node.js dependency lock file
├── tsconfig.json                     # TypeScript compiler configuration
├── jest.config.js                    # Jest testing framework configuration
├── eslint.config.js                  # ESLint code quality configuration
├── nodemon.json                      # Development server auto-reload configuration
├── vercel.json                       # Vercel deployment configuration
├── .env.example                      # Environment variables template
├── CLAUDE.md                         # AI assistant project context and instructions
└── README.md                         # Main project documentation
```

### TypeScript MCP Server

#### Core Services
- **`src/lib/database-factory.ts`**: `createDatabaseService()` factory function
  - Selects between Dgraph and Neo4j based on `DATABASE_TYPE` configuration
  - Returns appropriate database service implementing common interface
  - Validates configuration and throws helpful error messages

- **`src/lib/database-interface.ts`**: `DatabaseService` interface
  - Common interface for database operations across Dgraph and Neo4j
  - Standardizes methods: `initialize()`, `saveEntity()`, `saveMemory()`, `vectorSearch()`
  - Enables database-agnostic tool implementations

- **`src/lib/dgraph.ts`**: `DgraphService` class handling all Dgraph database operations
  - Connection management with `dgraph.open()` connection strings
  - Schema initialization and management (Entity, Memory, Community types)
  - CRUD operations for entities, memories, and relationships
  - Vector similarity search using HNSW index
  - Faceted relationship storage with metadata

- **`src/lib/neo4j.ts`**: `Neo4jService` class handling all Neo4j database operations
  - Connection management with Neo4j driver and authentication
  - Schema creation with constraints, indexes, and vector indexes
  - CRUD operations for entities and memories using Cypher queries
  - Vector similarity search using Neo4j 5.11+ vector indexes
  - Labeled property graph with `:RELATES_TO` and `:RELATED_TO` relationships
  
- **`src/lib/ai.ts`**: `AIService` class for AI operations using Vercel AI SDK
  - Multi-provider support (OpenAI, Anthropic) with automatic provider switching
  - Entity extraction from messages using structured LLM prompts
  - Vector embedding generation for semantic search
  - Memory summarization and relationship extraction
  - Configurable models for different AI providers

#### MCP Tools
- **`src/tools/save-user-message.ts`**: `SaveUserMessageTool` class
  - Processes user messages through complete entity extraction pipeline
  - Extracts entities (people, places, organizations, events, emotions, concepts)
  - Generates embeddings for each entity and the message
  - Stores entities with relationships and faceted edges in Dgraph
  - Creates Memory nodes linked to extracted entities
  - Returns structured response with entity counts and memory ID

- **`src/tools/graph-memory-search.ts`**: `GraphMemorySearchTool` class  
  - Vector-based semantic search through stored memories
  - Generates query embeddings and performs HNSW similarity search
  - Retrieves relevant entities and their connected memories
  - AI-powered summarization of search results
  - Configurable result limits and similarity thresholds

#### Server & Configuration
- **`src/index.ts`**: MCP server initialization and HTTP transport setup
  - Express server with CORS support for web clients
  - MCP protocol implementation with tool registration
  - Environment-based configuration loading
  - Service initialization and dependency injection
  - Error handling and graceful shutdown

- **`src/types/index.ts`**: TypeScript type definitions
  - `Entity`, `Memory`, `EntityRelationship` data models
  - `DgraphConfig`, `AIConfig` configuration interfaces  
  - MCP tool argument and response types
  - Vector search and graph operation types

#### Testing & Benchmarking
- **`src/__tests__/`**: Comprehensive test suite with Jest
  - **`lib/ai.test.ts`**: AIService unit tests with mocked providers
  - **`lib/dgraph.test.ts`**: DgraphService tests with mocked database
  - **`tools/save-user-message.test.ts`**: Tool integration tests
  - **`tools/graph-memory-search.test.ts`**: Search functionality tests

- **`src/test-fixtures/test-data.ts`**: Shared test data and fixtures
- **`tests/integration/`**: End-to-end MCP server integration tests

#### Data Ingestion & Benchmarking
- **`scripts/ingest-locomo.ts`**: Locomo-10 benchmark dataset ingestion
  - Processes 10 multi-session AI agent conversations (~4000 messages)
  - Batch processing with configurable conversation/session/message limits
  - Progress tracking and error reporting
  - Integration with Graph Fetch entity extraction pipeline
  - Designed for AI agent memory benchmarking and evaluation

- **`eval/`**: Benchmark analysis and DQL query examples
  - **`README.md`**: Analysis guides and example queries
  - **`locomo/Locomo-10.json`**: Complete benchmark dataset

### Python Graph Analytics Service

#### Core Components
- **`graph-algos/src/graph_algos/core/`**:
  - **`config.py`**: Pydantic-based configuration management with environment variables
  - **`dgraph_client.py`**: Python Dgraph client with `dgraph://` connection string support, SSL/bearer token auth
  - **`logger.py`**: Structured logging configuration with JSON/text output formats

#### Graph Algorithms
- **`graph-algos/src/graph_algos/algorithms/`**:
  - **`base.py`**: `BaseAlgorithm` abstract class with timing, error handling, and result storage
  - **`centrality.py`**: NetworkX centrality implementations (PageRank, Betweenness, Closeness, Eigenvector)
  - **`community.py`**: Community detection algorithms (Louvain, Label Propagation, Leiden, Greedy Modularity)
  - **`graph_builder.py`**: `GraphBuilder` class for converting Dgraph data to NetworkX graphs

#### Service Interfaces  
- **`graph-algos/src/graph_algos/api/server.py`**: Flask REST API server
  - Endpoints for running algorithms (`/centrality/run`, `/community/run`)
  - Graph information and health check endpoints
  - JSON request/response handling with error management

- **`graph-algos/src/graph_algos/cli.py`**: Click-based command-line interface
  - Commands for centrality, community detection, and batch processing
  - Support for `--create-communities` flag to create Community nodes
  - Configuration via CLI arguments or environment variables

- **`graph-algos/src/graph_algos/schedulers/periodic_runner.py`**: APScheduler cron-style execution
  - Configurable periodic algorithm execution
  - Multiple scheduler backends (BlockingScheduler, BackgroundScheduler)

#### Key Features
- **Community Node Creation**: Transforms community detection results into first-class Dgraph nodes
- **Multi-Algorithm Support**: Runs multiple algorithms in parallel with result aggregation
- **NetworkX Integration**: Full compatibility with NetworkX ecosystem and algorithms
- **Production Ready**: Comprehensive error handling, logging, and configuration management

### Project Configuration
- **`package.json`**: Node.js dependencies, scripts, and MCP server configuration
- **`pyproject.toml`**: Python project configuration with UV dependency management
- **`tsconfig.json`**: TypeScript compiler configuration with ESM modules
- **`jest.config.js`**: Jest testing framework setup with TypeScript support
- **`vercel.json`**: Vercel deployment configuration for MCP server



## Example Agent Memory Queries

Graph Fetch creates a rich knowledge graph that you can explore using either Neo4j's Cypher or Dgraph's DQL query languages. Here are practical examples for both databases.

## Neo4j Cypher Queries

Neo4j uses Cypher, a declarative query language designed for property graphs. Here are practical examples to explore your agent memory data:

### 1. Basic Data Exploration

**Count entities and memories:**
```cypher
// Count all entities and memories
MATCH (e:Entity) 
WITH count(e) as entityCount
MATCH (m:Memory) 
WITH entityCount, count(m) as memoryCount
RETURN entityCount, memoryCount
```

**Get entity type distribution:**
```cypher
MATCH (e:Entity)
RETURN e.type as entityType, count(*) as count
ORDER BY count DESC
```

### 2. Entity and Relationship Analysis

**Find highly connected entities:**
```cypher
MATCH (e:Entity)-[r:RELATED_TO]-()
WITH e, count(r) as connectionCount
WHERE connectionCount > 5
RETURN e.name, e.type, connectionCount
ORDER BY connectionCount DESC
LIMIT 10
```

**Find memories mentioning specific people:**
```cypher
MATCH (m:Memory)-[:RELATES_TO]->(e:Entity {type: "PERSON"})
WHERE e.name CONTAINS "Caroline"
RETURN m.content as memoryContent, m.timestamp as timestamp, e.name as personName
ORDER BY m.timestamp
```

### 3. Semantic Search with Vector Similarity

**Vector similarity search (requires embedding parameter):**
```cypher
CALL db.index.vector.queryNodes('entity_embedding_index', 5, $queryEmbedding)
YIELD node as e, score
MATCH (e)<-[:RELATES_TO]-(m:Memory)
RETURN e.name, e.type, e.description, score, collect(m.content) as relatedMemories
ORDER BY score DESC
```

### 4. Temporal Analysis

**Find recent memories:**
```cypher
MATCH (m:Memory)
WHERE m.timestamp > datetime('2023-01-01T00:00:00Z')
RETURN m.content, m.timestamp
ORDER BY m.timestamp DESC
LIMIT 10
```

**Timeline of entity creation:**
```cypher
MATCH (e:Entity)
RETURN e.name, e.type, e.createdAt
ORDER BY e.createdAt DESC
LIMIT 20
```

### 5. Relationship Path Analysis

**Find paths between entities:**
```cypher
MATCH (start:Entity {name: "Caroline"}), (end:Entity {name: "LGBTQ"})
MATCH path = shortestPath((start)-[*1..4]-(end))
RETURN path
```

**Find common connections between entities:**
```cypher
MATCH (e1:Entity {name: "Caroline"})-[:RELATED_TO]->(common)<-[:RELATED_TO]-(e2:Entity)
WHERE e1 <> e2 AND e2.name <> "Caroline"
RETURN e2.name as connectedEntity, common.name as commonConnection, common.type
ORDER BY connectedEntity
```

### 6. Memory Content Analysis

**Search memories by content:**
```cypher
MATCH (m:Memory)
WHERE m.content CONTAINS "dance" OR m.content CONTAINS "dancing"
RETURN m.content, m.timestamp
ORDER BY m.timestamp
```

**Find memories related to specific concepts:**
```cypher
MATCH (m:Memory)-[:RELATES_TO]->(e:Entity {type: "CONCEPT"})
WHERE e.name IN ["dance", "education", "LGBTQ"]
RETURN m.content, e.name as concept, m.timestamp
ORDER BY m.timestamp
```

### 7. Complex Aggregations

**Entity relationship statistics:**
```cypher
MATCH (e:Entity)-[r:RELATED_TO]->(related:Entity)
WITH e, r.type as relType, count(related) as relatedCount
RETURN e.name, e.type, relType, relatedCount
ORDER BY relatedCount DESC
LIMIT 20
```

**Memory-entity connection analysis:**
```cypher
MATCH (m:Memory)-[:RELATES_TO]->(e:Entity)
WITH m, count(e) as entityCount, collect(DISTINCT e.type) as entityTypes
WHERE entityCount > 3
RETURN m.content, entityCount, entityTypes, m.timestamp
ORDER BY entityCount DESC
```

## Dgraph DQL Queries

Graph Fetch creates a rich knowledge graph that you can explore using Dgraph's DQL (Dgraph Query Language). Here are practical examples of queries to explore your agent memory data, tested and verified with actual results.

### 1. Basic Data Exploration

**Count total entities and memories:**
```dql
{
  entity_count(func: type(Entity)) {
    count(uid)
  }
  
  memory_count(func: type(Memory)) {
    count(uid)
  }
}
```

**Result:**
```json
{
  "entity_count": [{"count": 134}],
  "memory_count": [{"count": 85}]
}
```

**Get entity types:**
```dql
{
  entity_types(func: type(Entity)) {
    type
  }
}
```

**Result:** Shows distribution of PERSON, CONCEPT, EVENT, ORGANIZATION, PLACE, and DATE entities across 134 total entities.

### 2. Entity Type Exploration

**Sample PERSON entities:**
```dql
{
  persons(func: type(Entity)) @filter(eq(type, "PERSON")) {
    uid
    name
    type
    description
    createdAt
  }
}
```

**Result:**
```json
{
  "persons": [
    {
      "uid": "0x7558",
      "name": "Caroline",
      "type": "PERSON",
      "description": "One of the individuals communicating in the text.",
      "createdAt": "2025-08-09T18:31:51.16Z"
    },
    {
      "uid": "0x7559",
      "name": "Mel",
      "type": "PERSON",
      "description": "The other individual being addressed by Caroline.",
      "createdAt": "2025-08-09T18:31:51.721Z"
    },
    {
      "uid": "0x755d",
      "name": "Melanie",
      "type": "PERSON",
      "description": "A person engaging in a conversation.",
      "createdAt": "2025-08-09T18:31:57.489Z"
    }
  ]
}
```

**Sample CONCEPT entities:**
```dql
{
  concepts(func: type(Entity)) @filter(eq(type, "CONCEPT")) {
    uid
    name
    type
    description
    createdAt
  }
}
```

**Result:** Returns 89 concept entities including LGBTQ, support group, inspiring stories, transgender stories, support, painting, group, edu, career options, jobs, mental health, self-care, family, running, reading, playing my violin, fam, summer break, camping, adoption agencies, kids, kids in need, future family, friends, mentors, LGBTQ community, transgender journey, trans community, gender identity, inclusion, inclusivity, acceptance, community, hope, understanding, courage, vulnerability, stories, love, inclusive, change, journey, impact, life's challenges, banker, business, dance studio, dancing, biz, Dance, contemporary dance, Contemporary dance, dance class, clothing store, store, dance floor, Dance floors, Marley flooring, dance studios, Marley, dance, trendy pieces, furniture, decor, chandelier, customers, cool oasis, shopping experience, family road trip, aerial yoga, kickboxing, Kickboxing, local politics, education, infrastructure, funding, campaign, networking, Networking, community's education, future generations, tools for success, foundation of progress and opportunity, system, positive difference, passion, online group, supportive community, group of people, advice, encouragement, like-minded individuals.

**Sample EVENT entities:**
```dql
{
  events(func: type(Entity)) @filter(eq(type, "EVENT")) {
    uid
    name
    type
    description
    createdAt
  }
}
```

**Result:** Returns 23 event entities including dates (8 May, 2023, 25 May, 2023, 9 June 2023, 20 January, 2023, 29 January, 2023, 1 February, 2023, 17 December, 2022, 22 December, 2022, 1 January, 2023), times (3:56 pm, 4:04 pm, 8:30 pm), and activities (charity race, last Saturday, event, my school event, pic, toy drive).

### 3. Memory and Conversation Analysis

**Get memories with their connected entities:**
```dql
{
  memories(func: type(Memory)) {
    uid
    content
    timestamp
    entities {
      uid
      name
      type
    }
  }
}
```

**Result:** Returns 85 memories with their content, timestamps, and connected entities. Each memory shows the conversation content and links to relevant entities (people, concepts, events, places).

**Find memories by specific person:**
```dql
{
  caroline_memories(func: type(Memory)) @filter(anyoftext(content, "Caroline")) {
    uid
    content
    timestamp
    entities {
      name
      type
    }
  }
}
```

![](img/query-caroline-memories.png)

**Result:** Returns memories mentioning Caroline, showing her conversations about LGBTQ support groups, transgender stories, adoption plans, and school events.

### 4. Relationship and Network Analysis

**Find highly connected entities:**
```dql
{
  connected_entities(func: type(Entity)) {
    uid
    name
    type
    relatedTo @facets(weight) {
      uid
      name
      type
    }
  }
}
```

![](img/query-connected-entities.png)

**Result:** Shows entities with their relationship networks. Caroline has 35+ connections, Melanie has 25+ connections, Jon has 30+ connections, Gina has 25+ connections, and John has 30+ connections to various concepts, events, and other entities.

**Search for specific concept relationships:**
```dql
{
  dance_entities(func: type(Entity)) @filter(eq(name, "dance")) {
    uid
    name
    type
    description
  }
  
  dancing_entities(func: type(Entity)) @filter(eq(name, "dancing")) {
    uid
    name
    type
    description
  }
}
```

**Result:**
```json
{
  "dance_entities": [
    {
      "uid": "0x75de",
      "name": "dance",
      "type": "CONCEPT",
      "description": "An art form that Jon is passionate about and aiming to pursue professionally."
    }
  ],
  "dancing_entities": [
    {
      "uid": "0x75bc",
      "name": "dancing",
      "type": "CONCEPT",
      "description": "The art of movement of the body, usually to music."
    }
  ]
}
```

### 5. Temporal and Chronological Analysis

**Get entities in chronological order:**
```dql
{
  timeline_entities(func: type(Entity)) @filter(ge(createdAt, "2025-08-09T18:31:00Z")) {
    uid
    name
    type
    createdAt
  }
}
```

**Result:** Returns all 134 entities ordered by creation time, showing the progression of conversation topics and entity extraction over time.

**Get memories in chronological order:**
```dql
{
  timeline_memories(func: type(Memory)) @filter(ge(timestamp, "2025-08-09T18:31:00Z")) {
    uid
    content
    timestamp
  }
}
```

**Result:** Returns all 85 memories ordered by timestamp, showing conversation flow from May 2023 through February 2023.

### 6. Community and Theme Analysis

### Advanced Querying with Communities

With community nodes created, you can perform sophisticated graph queries:

```dql
# Find all communities and their members
{
  communities(func: type(Community)) {
    uid name algorithm member_count
    members { uid name type }
  }
}

# Find which communities a person belongs to
{
  caroline(func: eq(name, "Caroline")) {
    name
    ~members { name algorithm community_id }
  }
}

# Search memories by community context
{
  mental_health_community(func: eq(name, "label_propagation_community_2")) {
    name member_count
    members {
      name type
      ~relatedTo {
        dgraph.type
        content  # If linked to Memory nodes
      }
    }
  }
}
```

### 7. Advanced Pattern Matching

**Find memories containing specific concepts:**
```dql
{
  lgbtq_memories(func: type(Memory)) @filter(anyoftext(content, "LGBTQ")) {
    uid
    content
    entities {
      name
      type
    }
  }
}
```

**Result:**
```json
{
  "lgbtq_memories": [
    {
      "uid": "0x7561",
      "content": "[1:56 pm on 8 May, 2023] Caroline: I went to a LGBTQ support group yesterday and it was so powerful.",
      "entities": [
        {"name": "Caroline", "type": "PERSON"},
        {"name": "8 May, 2023", "type": "EVENT"},
        {"name": "LGBTQ", "type": "CONCEPT"},
        {"name": "support group", "type": "CONCEPT"}
      ]
    },
    {
      "uid": "0x7592",
      "content": "[7:55 pm on 9 June, 2023] Caroline: Hey Melanie! How's it going? I wanted to tell you about my school event last week. It was awesome! I talked about my transgender journey and encouraged students to get involved in the LGBTQ community. It was great to see their reactions. It made me reflect on how far I've come since I started transitioning three years ago.",
      "entities": [
        {"name": "Caroline", "type": "PERSON"},
        {"name": "Melanie", "type": "PERSON"},
        {"name": "LGBTQ community", "type": "CONCEPT"},
        {"name": "my school event", "type": "EVENT"},
        {"name": "transgender journey", "type": "CONCEPT"}
      ]
    }
  ]
}
```

**Note:** The `anyoftext()` function only works on fields with fulltext indexing (like `content`), not on `name` fields.

### 8. Graph Traversal and Path Finding

**Find shortest path between entities:**
```dql
{
  q(func: eq(name, "Caroline")) {
    a as uid
  }
  q1(func: eq(name, "Melanie")) {
    b as uid
  }
  path as shortest(from: uid(a), to: uid(b), numpaths: 5) {
    relatedTo @facets(weight)
  }
  path(func: uid(path)) {
    uid
    name
    type
  }
}
```

**Result:** Returns empty path results, indicating no direct relationship path exists between Caroline and Melanie in the current graph structure.

### 9. Statistical Analysis

**Entity type distribution:**
```dql
{
  type_stats(func: type(Entity)) {
    type
    count(uid)
  }
}
```

**Result:** Returns entity types but count aggregation doesn't work as expected in this version. Use the basic count query instead.

**Memory timeline analysis:**
```dql
{
  memory_timeline(func: type(Memory)) {
    timestamp
    count(uid)
  }
}
```

**Result:** Similar count aggregation issue. Use the basic memory count query for accurate totals.

### 10. Semantic Search and Discovery

**Find related concepts:**
```dql
{
  related_concepts(func: eq(name, "dance")) {
    name
    type
    relatedTo {
      name
      type
      description
    }
  }
}
```

**Result:**
```json
{
  "related_concepts": [
    {
      "name": "dance",
      "type": "CONCEPT"
    }
  ]
}
```

**Discover entity clusters:**
```dql
{
  entity_clusters(func: type(Entity)) {
    name
    type
    relatedTo {
      name
      type
    }
  }
}
```

**Result:** Returns all entities with their relationships, showing the complete knowledge graph structure.

### 11. Geospatial Queries

Graph Fetch includes geospatial data for PLACE entities, enabling location-based queries and analysis. Some places have precise coordinates while others represent conceptual locations.

**Find all places with geographic coordinates:**
```dql
{
  places_with_coords(func: type(Entity)) @filter(eq(type, "PLACE") AND has(location)) {
    uid
    name
    type
    description
    location
  }
}
```

**Result:**
```json
{
  "places_with_coords": [
    {
      "uid": "0x75cf",
      "name": "Paris",
      "type": "PLACE",
      "description": "A city in France that Jon visited.",
      "location": {
        "type": "Point",
        "coordinates": [2.3522, 48.8566]
      }
    },
    {
      "uid": "0x75d1",
      "name": "Rome",
      "type": "PLACE",
      "description": "Capital city of Italy.",
      "location": {
        "type": "Point",
        "coordinates": [12.4964, 41.9028]
      }
    }
  ]
}
```

**Find all place entities (with and without coordinates):**
```dql
{
  all_places(func: type(Entity)) @filter(eq(type, "PLACE")) {
    uid
    name
    type
    description
    location
  }
}
```

**Result:** Returns 7 place entities including:
- **With coordinates**: Paris (France), Rome (Italy)
- **Conceptual places**: downtown, a great spot, homeless shelter, neighborhood, area

**Find places by specific name:**
```dql
{
  paris_info(func: eq(name, "Paris")) {
    uid
    name
    type
    description
    location
    relatedTo {
      name
      type
      description
    }
  }
}
```

**Result:**
```json
{
  "paris_info": [
    {
      "uid": "0x75cf",
      "name": "Paris",
      "type": "PLACE",
      "description": "A city in France that Jon visited.",
      "location": {
        "type": "Point",
        "coordinates": [2.3522, 48.8566]
      }
    }
  ]
}
```

**Find memories mentioning specific places:**
```dql
{
  paris_memories(func: type(Memory)) @filter(anyoftext(content, "Paris")) {
    uid
    content
    timestamp
    entities {
      name
      type
      location
    }
  }
}
```

**Result:**
```json
{
  "paris_memories": [
    {
      "uid": "0x75d0",
      "content": "[2:32 pm on 29 January, 2023] Jon: Hey Gina! Thanks for asking. I'm on the hunt for the ideal spot for my dance studio and it's been quite a journey! I've been looking at different places and picturing how the space would look. I even found a place with great natural light! Oh, I've been to Paris yesterday! It was sooo cool.",
      "timestamp": "2025-08-09T18:36:34.214Z",
      "entities": [
        {"name": "Gina", "type": "PERSON"},
        {"name": "Jon", "type": "PERSON"},
        {"name": "dance studio", "type": "CONCEPT"},
        {"name": "Paris", "type": "PLACE", "location": {"type":"Point","coordinates":[2.3522,48.8566]}}
      ]
    }
  ]
}
```

**Find places mentioned in conversations:**
```dql
{
  place_mentions(func: type(Entity)) @filter(eq(type, "PLACE")) {
    name
    description
    location
    ~relatedTo {
      name
      type
      content
    }
  }
}
```

**Result:** Shows places and their connections to other entities and memories in the conversation graph.

**Find memories and entities within 1000km of specific coordinates:**
```dql
{
  # Find places within 1000km of Rome (12.4964, 41.9028)
  # Rome coordinates: [12.4964, 41.9028]
  # Paris coordinates: [2.3522, 48.8566] - within 1000km of Rome
  places_near_rome(func: type(Entity)) @filter(eq(type, "PLACE")) {
    uid
    name
    type
    description
    location
  }
  
  # Find memories mentioning places near Rome
  memories_near_rome(func: type(Memory)) @filter(anyoftext(content, "Rome") OR anyoftext(content, "Paris")) {
    uid
    content
    timestamp
    entities {
      name
      type
      location
    }
  }
}
```

**Result:**
```json
{
  "places_near_rome": [
    {
      "uid": "0x75cf",
      "name": "Paris",
      "type": "PLACE",
      "description": "A city in France that Jon visited.",
      "location": {
        "type": "Point",
        "coordinates": [2.3522, 48.8566]
      }
    },
    {
      "uid": "0x75d1",
      "name": "Rome",
      "type": "PLACE",
      "description": "Capital city of Italy.",
      "location": {
        "type": "Point",
        "coordinates": [12.4964, 41.9028]
      }
    },
    {
      "uid": "0x75d3",
      "name": "downtown",
      "type": "PLACE",
      "description": "A central area of a city, known for accessibility."
    },
    {
      "uid": "0x75e5",
      "name": "a great spot",
      "type": "PLACE",
      "description": "A location that is being referred to as cozy and inviting."
    },
    {
      "uid": "0x75fc",
      "name": "homeless shelter",
      "type": "PLACE",
      "description": "A facility providing assistance to homeless individuals."
    },
    {
      "uid": "0x760a",
      "name": "place",
      "type": "PLACE",
      "description": "A residential area where people live."
    },
    {
      "uid": "0x7616",
      "name": "area",
      "type": "PLACE",
      "description": "The unspecified geographic location where John aims to improve education."
    }
  ],
  "memories_near_rome": [
    {
      "uid": "0x75d0",
      "content": "[2:32 pm on 29 January, 2023] Jon: Hey Gina! Thanks for asking. I'm on the hunt for the ideal spot for my dance studio and it's been quite a journey! I've been looking at different places and picturing how the space would look. I even found a place with great natural light! Oh, I've been to Paris yesterday! It was sooo cool.",
      "timestamp": "2025-08-09T18:36:34.214Z",
      "entities": [
        {"name": "Gina", "type": "PERSON"},
        {"name": "Jon", "type": "PERSON"},
        {"name": "dance studio", "type": "CONCEPT"},
        {"name": "Paris", "type": "PLACE", "location": {"type":"Point","coordinates":[2.3522,48.8566]}}
      ]
    },
    {
      "uid": "0x75d2",
      "content": "[2:32 pm on 29 January, 2023] Gina: Wow, nice spot! Where is it? Got any other features you want to think about before you decide? Paris?! That is really great Jon! Never had a chance to visit it. Been only to Rome once.",
      "timestamp": "2025-08-09T18:36:42.49Z",
      "entities": [
        {"name": "Gina", "type": "PERSON"},
        {"name": "Jon", "type": "PERSON"},
        {"name": "29 January, 2023", "type": "EVENT"},
        {"name": "Paris", "type": "PLACE", "location": {"type":"Point","coordinates":[2.3522,48.8566]}},
        {"name": "Rome", "type": "PLACE", "location": {"type":"Point","coordinates":[12.4964,41.9028]}}
      ]
    }
  ]
}
```

**Geographic Analysis:**
- **Rome**: [12.4964, 41.9028] - Central Italy
- **Paris**: [2.3522, 48.8566] - Northern France
- **Distance**: Paris is approximately 1,100km from Rome (within reasonable range)
- **Conversation Context**: Jon visited Paris, Gina has been to Rome
- **Memory Connections**: Both cities mentioned in dance studio planning conversation

### Geospatial Data Structure

The geospatial data in Graph Fetch follows the GeoJSON Point format:

```json
{
  "location": {
    "type": "Point",
    "coordinates": [longitude, latitude]
  }
}
```

**Available coordinates:**
- **Paris, France**: [2.3522, 48.8566] (longitude, latitude)
- **Rome, Italy**: [12.4964, 41.9028] (longitude, latitude)

**Conceptual places** (without coordinates) include:
- downtown, homeless shelter, neighborhood, area, a great spot

## Data Flow Architecture

```
User Message → MCP Server → AI Service → Entity Extraction
                    ↓
          Database Factory → DatabaseService Interface
                    ↓                    ↓
            DgraphService        Neo4jService
                    ↓                    ↓
          Store Entities & Memories in Dgraph or Neo4j
                    ↓
            [Optional] Python Service → Community Detection → Community Nodes
                    ↓
        DQL/Cypher Queries ← Graph Memory Search ← Vector Similarity
```

This architecture provides:
- **Database Abstraction**: Unified interface supporting both Dgraph and Neo4j
- **Runtime Selection**: Choose database backend via environment configuration
- **Complete Pipeline**: From raw conversational data to sophisticated graph analytics
- **Dual Query Support**: Both DQL (Dgraph) and Cypher (Neo4j) query examples
- **AI Agent Memory**: Enables building, searching, and analyzing long-term semantic memory

## References

- Rasmussen, Preston. ["Zep: A Temporal Knowledge Graph Architecture for Agent Memory."](https://arxiv.org/abs/2501.13956) arXiv, 20 Jan. 2025, arxiv.org/abs/2501.13956.
- Packer, Charles, et al. ["MemGPT: Towards LLMs as Operating Systems."](https://arxiv.org/abs/2310.08560) arXiv, 12 Oct. 2023, arxiv.org/abs/2310.08560.
- Wigg, Danny, et al. ["Temporal Agents with Knowledge Graphs."](https://cookbook.openai.com/examples/partners/temporal_agents_with_knowledge_graphs/temporal_agents_with_knowledge_graphs) OpenAI Cookbook, 2025
- Chhikara, Prateek, et al. ["Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory."](https://arxiv.org/abs/2504.19413) arXiv, 28 Apr. 2025, arxiv.org/abs/2504.19413.
- Jain, Manish. ["Dgraph: Synchronously Replicated, Transactional and Distributed Graph Database."](https://github.com/hypermodeinc/dgraph/blob/main/paper/dgraph.pdf) Version 0.8, Dgraph Labs, Inc., 1 Mar. 2021
