# Graph Fetch - MCP Server for Graph-Based Memory

![fetch logo](img/fetch.png)

An MCP (Model Context Protocol) server that provides graph-based memory tools for AI agents using Dgraph as the backend database. Includes specialized tooling for ingesting and benchmarking against the Locomo-10 AI agent memory dataset. Built with TypeScript, Vercel AI SDK, and the Vercel MCP adapter.

## Features

- **Entity Extraction**: Automatically extracts entities from user messages using LLMs
- **Vector Search**: Semantic search through memories using embeddings
- **Graph Relationships**: Stores entities and memories with relationships in Dgraph
- **Locomo Benchmark Integration**: Purpose-built ingestion for AI agent memory benchmarking
- **Two MCP Tools**:
  - `save_user_message`: Process and save messages with entity extraction
  - `graph_memory_search`: Vector-based search through stored memories

## Graph Data Model

![fetch data model](img/fetch-schema.png)

## Prerequisites

- Node.js 20+
- Dgraph database instance (local or cloud)
- OpenAI or Anthropic API key

## Dgraph Connection

The project uses standard Dgraph connection strings with `dgraph.open()`:

- **Local**: `dgraph://localhost:9080`
- **With auth**: `dgraph://user:password@localhost:9080`
- **Cloud**: `dgraph://your-instance.cloud:443?sslmode=verify-ca&bearertoken=your-token`

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

   For cloud instances, use the full connection string:
   ```env
   DGRAPH_CONNECTION_STRING=dgraph://your-instance.cloud:443?sslmode=verify-ca&bearertoken=your-token
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

2. **Start Dgraph** (if testing with real database):
   ```bash
   docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest
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
- **Database errors**: Make sure Dgraph is running and accessible on the configured port (`docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest`)
- **Tool errors**: Check the inspector console and server logs for detailed error messages
- **Server startup fails**: The MCP server requires Dgraph to be running to initialize. Start Dgraph before testing the server

### Manual Testing

You can also test the server manually using stdio:

```bash
# Start Dgraph (in separate terminal)
docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest

# Build and start the server (in main terminal)
npm run build
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/index.js
```

### Quick Testing Workflow

Here's a complete workflow to test the MCP server:

```bash
# 1. Start Dgraph
docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest

# 2. In a new terminal, build the project
npm run build

# 3. Start MCP Inspector
npm run inspector

# 4. Open the inspector in your browser (usually http://localhost:3000)
# 5. Configure connection with: node dist/index.js
# 6. Test the tools with sample data
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

## Locomo AI Agent Memory Benchmark

Graph Fetch includes a specialized ingestion script for the **Locomo-10** AI agent memory benchmark dataset. This benchmark contains 10 realistic multi-session conversations designed to test an AI agent's ability to build and maintain long-term memory across interactions.

### Quick Start

```bash
# 1. Start Dgraph and MCP server
docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest
npm run build && npm start

# 2. Test with small sample
node scripts/ingest-locomo.js --max-conversations 1 --max-sessions 1 --max-messages 5

# 3. Process larger batches
node scripts/ingest-locomo.js --max-conversations 2 --max-sessions 3 --max-messages 10
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
│   │   ├── dgraph.ts                 # Dgraph database operations and schema management
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
│   │   │   └── dgraph.test.ts        # DgraphService tests with mocked database
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
- **`src/lib/dgraph.ts`**: `DgraphService` class handling all Dgraph database operations
  - Connection management with `dgraph.open()` connection strings
  - Schema initialization and management (Entity, Memory, Community types)
  - CRUD operations for entities, memories, and relationships
  - Vector similarity search using HNSW index
  - Faceted relationship storage with metadata
  
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

### Data Flow Architecture

```
User Message → MCP Server → AI Service → Entity Extraction
                    ↓
                DgraphService → Store Entities & Memories
                    ↓
            [Optional] Python Service → Community Detection → Community Nodes
                    ↓
                DQL Queries ← Graph Memory Search ← Vector Similarity
```

This architecture provides a complete pipeline from raw conversational data to sophisticated graph analytics, enabling AI agents to build, search, and analyze long-term semantic memory.

## License

ISC