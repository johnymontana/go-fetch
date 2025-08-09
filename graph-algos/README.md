# Graph Algorithms Service for Dgraph

A comprehensive Python service for computing graph algorithms on Dgraph data using NetworkX. Features community detection, centrality measures, and other graph analytics with results written back to Dgraph.

## Features

- **Multiple Algorithm Types**:
  - **Centrality**: PageRank, Betweenness, Closeness, Eigenvector
  - **Community Detection**: Louvain, Label Propagation, Leiden, Greedy Modularity

- **Dgraph Integration**: 
  - Native `dgraph://` connection string support
  - Automatic graph building from Entity/relatedTo structure
  - Results written back as node attributes

- **Multiple Interfaces**:
  - **REST API**: Flask server with comprehensive endpoints
  - **CLI**: Command-line interface for batch processing  
  - **Scheduler**: Cron-style periodic execution

- **Production Ready**:
  - Configurable via environment variables or CLI
  - Structured logging with JSON/text formats
  - Error handling and timeout management
  - UV/UVX dependency management

## Quick Start

### Installation

```bash
# Using UV (recommended)
cd graph-algos
uv sync

# Or using pip
pip install -e .
```

### Configuration

```bash
# Copy example configuration
cp .env.example .env

# Edit configuration
DGRAPH_CONNECTION_STRING=dgraph://localhost:9080
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
```

### Basic Usage

```bash
# Test connection
uv run graph-algos test-connection

# Get graph information
uv run graph-algos graph-info

# Run centrality algorithms
uv run graph-algos centrality --algorithm pagerank

# Run community detection
uv run graph-algos community --algorithm louvain

# Run all algorithms
uv run graph-algos run-all

# Start API server
uv run graph-algos server --port 5000

# Start periodic scheduler (every 6 hours)
uv run graph-algos scheduler --schedule "0 */6 * * *"
```

## API Endpoints

### Core Endpoints

```bash
# Health check
GET /health

# List available algorithms  
GET /algorithms

# Graph information
GET /graph/info
POST /graph/info  # with parameters
```

### Algorithm Execution

```bash
# Run centrality algorithms
POST /centrality/run
{
  "algorithm": "pagerank",  # or "all" 
  "parameters": {
    "pagerank": {"alpha": 0.85}
  },
  "write_to_dgraph": true,
  "graph_parameters": {
    "entity_type": "Entity",
    "limit": 10000
  }
}

# Run community detection  
POST /community/run
{
  "algorithm": "louvain",
  "analyze_communities": true,
  "parameters": {
    "louvain": {"resolution": 1.0}
  }
}

# Run all algorithms
POST /algorithms/run
```

## Algorithm Details

### Centrality Algorithms

- **PageRank**: Measures node importance based on link structure
- **Betweenness Centrality**: Measures nodes that act as bridges  
- **Closeness Centrality**: Measures average distance to all other nodes
- **Eigenvector Centrality**: Measures influence based on connections to high-scoring nodes

### Community Detection

- **Louvain**: Fast modularity optimization for community detection
- **Label Propagation**: Simple algorithm based on label spreading
- **Leiden**: Improved version of Louvain with better quality guarantees  
- **Greedy Modularity**: Classical greedy approach for modularity optimization

## Community Node Creation

The service can create dedicated Community nodes in Dgraph that represent discovered communities, with direct edges connecting each community to its member entities. This creates a rich semantic structure for exploring and querying community relationships.

### Usage

```bash
# Run label propagation and create community nodes with edges
uv run graph-algos community --algorithm label_propagation --write --create-communities

# Run any community algorithm with node creation
uv run graph-algos community --algorithm louvain --write --create-communities

# Run all community algorithms with node creation
uv run graph-algos community --write --create-communities
```

### What It Does

1. **Runs Community Detection**: Executes the specified algorithm (e.g., label propagation) on your graph data
2. **Creates Community Nodes**: For each discovered community, creates a new node with type `Community`
3. **Establishes Member Relationships**: Creates direct edges from each community node to all its member entities
4. **Stores Metadata**: Records algorithm details, community size, and execution metadata

### Community Node Structure

Each created community node has the following properties:

```json
{
  "dgraph.type": "Community",
  "name": "label_propagation_community_0",
  "algorithm": "label_propagation", 
  "community_id": 0,
  "member_count": 37,
  "members": [
    {"uid": "0x123", "name": "Caroline", "type": "PERSON"},
    {"uid": "0x456", "name": "Google", "type": "ORGANIZATION"},
    // ... more members
  ]
}
```

### Example Results

When running label propagation on an AI agent memory graph:

```bash
✅ Found 17 community nodes
📊 Community Statistics:
   Total communities: 17
   Total member relationships: 134
   Average community size: 7.9

📊 Example Communities:
   Community 0: Caroline, Mel, dates (37 members)
   Community 1: Melanie, inspiring stories, concepts (11 members) 
   Community 2: Mental health, charity events (3 members)
   Community 4: Family, community concepts (35 members)
```

### Verification

After running community detection with `--create-communities`, you can verify the results:

```bash
# Check that community nodes were created
uv run python verify_communities.py
```

### Querying Community Structures

With community nodes created, you can perform sophisticated queries:

```dql
# Find all communities and their members
{
  communities(func: type(Community)) {
    uid
    name 
    algorithm
    member_count
    members {
      uid
      name
      type
    }
  }
}

# Find which community a specific entity belongs to
{
  entity(func: eq(name, "Caroline")) {
    name
    ~members {
      name
      algorithm
      community_id
    }
  }
}

# Find the largest communities
{
  largest_communities(func: type(Community), orderdesc: member_count, first: 5) {
    name
    algorithm
    member_count
  }
}
```

This feature transforms flat community membership scores into a rich, queryable graph structure that makes it easy to explore how entities cluster together semantically.

## Data Model

### Input: Dgraph Schema

```
Entity: {
  uid: string
  name: string  
  type: string
  relatedTo: [Entity] @facets(type: string)
}
```

### Output: Algorithm Results

Results are written back to Dgraph as node attributes:

```
Entity: {
  # Original attributes
  uid: string
  name: string
  type: string
  
  # Centrality scores
  pagerank_score: float
  betweenness_centrality_score: float
  closeness_centrality_score: float
  
  # Community memberships
  louvain: int
  label_propagation: int
  
  # Metadata
  pagerank_computed_at: datetime
  louvain_computed_at: datetime
}
```

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DGRAPH_CONNECTION_STRING` | `dgraph://localhost:9080` | Dgraph connection |
| `FLASK_HOST` | `0.0.0.0` | API server host |
| `FLASK_PORT` | `5000` | API server port |
| `LOG_LEVEL` | `INFO` | Log level |
| `DEFAULT_ALGORITHM_TIMEOUT` | `300` | Algorithm timeout (seconds) |
| `MAX_GRAPH_SIZE` | `100000` | Maximum nodes to process |
| `ENABLE_SCHEDULER` | `true` | Enable periodic scheduler |

### Algorithm Toggles

```env
ENABLE_PAGERANK=true
ENABLE_BETWEENNESS=true  
ENABLE_CLOSENESS=true
ENABLE_EIGENVECTOR=true
ENABLE_LOUVAIN=true
ENABLE_LABEL_PROPAGATION=true
ENABLE_LEIDEN=true
```

## Usage Examples

### Python API

```python
from graph_algos import Config, DgraphClient, CentralityAlgorithms
from graph_algos.algorithms import GraphBuilder

# Setup
config = Config()
client = DgraphClient(config.dgraph_connection_string)
builder = GraphBuilder()

# Build graph
nodes, edges = client.get_graph_data("Entity", limit=5000)
graph = builder.build_graph(nodes, edges)

# Run PageRank
algorithms = CentralityAlgorithms(config)
result = algorithms.run_algorithm(
    "pagerank", 
    graph, 
    write_to_dgraph=True, 
    dgraph_client=client
)

print(f"PageRank computed for {len(result['results'])} nodes")
```

### REST API

```python
import requests

# Run Louvain community detection
response = requests.post('http://localhost:5000/community/run', json={
    "algorithm": "louvain",
    "parameters": {"louvain": {"resolution": 1.2}},
    "graph_parameters": {"limit": 5000},
    "analyze_communities": true
})

result = response.json()
print(f"Found {result['results']['louvain']['analysis']['num_communities']} communities")
```

### Scheduler Configuration

```bash
# Daily at 2 AM
uv run graph-algos scheduler --schedule "0 2 * * *" --algorithms all

# Every 6 hours, centrality only  
uv run graph-algos scheduler --schedule "0 */6 * * *" --algorithms centrality

# Twice per day, community detection only
uv run graph-algos scheduler --schedule "0 6,18 * * *" --algorithms community
```

## Graph Building Parameters

```python
{
  "entity_type": "Entity",          # Node type to query
  "limit": 10000,                   # Max nodes
  "directed": false,                # Create directed graph
  "include_self_loops": false,      # Include self-loops
  "min_degree": 0,                  # Min degree filter
  "largest_component": false        # Use largest connected component only
}
```

## Performance Considerations

- **Graph Size**: Algorithms scale differently (PageRank: O(n+m), Betweenness: O(n³))
- **Memory Usage**: ~100-200MB for 10k nodes, scales with graph size
- **Timeouts**: Configure per-algorithm timeouts for large graphs
- **Batching**: Results written in batches of 100 for performance
- **Caching**: Enable result caching to avoid recomputation

## Integration with Graph Fetch

This service integrates seamlessly with the Graph Fetch memory system:

1. **Graph Fetch** ingests conversations and builds entity graph
2. **Graph Algorithms** computes centrality and communities
3. **Enhanced Queries** use algorithm results for better memory retrieval

```bash
# After running Graph Fetch Locomo ingestion:
cd ../graph-algos
uv run graph-algos run-all --entity-type Entity --limit 5000

# Results enhance memory search with:
# - PageRank scores for entity importance
# - Community IDs for finding related entities  
# - Centrality measures for hub detection
```

## Development

### Running Tests

```bash
uv run pytest tests/
uv run pytest tests/ --cov=graph_algos
```

### Code Quality

```bash
uv run black src/
uv run ruff check src/
uv run mypy src/
```

### Building

```bash
uv build
```

## Docker Deployment

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY . .

RUN pip install uv && uv sync --frozen

EXPOSE 5000

CMD ["uv", "run", "graph-algos", "server"]
```

## Architecture

```
graph-algos/
├── src/graph_algos/
│   ├── algorithms/          # NetworkX algorithm implementations
│   ├── api/                 # Flask REST API
│   ├── core/                # Configuration, logging, Dgraph client
│   ├── schedulers/          # Periodic execution
│   └── cli.py               # Command-line interface
├── tests/                   # Test suite
├── config/                  # Configuration files
└── docs/                    # Documentation
```

## License

MIT License - see LICENSE file for details.