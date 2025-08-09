# Locomo AI Agent Memory Benchmark Ingestion Script

This script ingests conversation data from the **Locomo-10** AI agent memory benchmark dataset into the Graph Fetch MCP server. The Locomo dataset contains realistic multi-session conversations designed to test an AI agent's ability to build and maintain long-term memory across interactions.

## Overview

The **Locomo-10** dataset is a benchmark for evaluating AI agent memory systems. It consists of:
- **10 realistic conversations** between pairs of people
- **Multi-session interactions** spanning weeks/months 
- **Rich contextual information** including timestamps, relationships, and personal details
- **~4000+ total messages** across all conversations and sessions

This script processes the dataset through the Graph Fetch MCP server to:
- **Extract entities** (people, places, organizations, events, etc.) using LLMs
- **Build relationships** between entities automatically
- **Generate embeddings** for semantic search capabilities  
- **Store in Dgraph** as a connected knowledge graph
- **Enable memory retrieval** through vector similarity search

The result is a comprehensive graph-based memory system that can answer complex questions about people, relationships, events, and context from the conversations.

## Quick Start

```bash
# 1. Start Dgraph database
docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest

# 2. Build and start MCP server (in another terminal)
npm run build && npm start

# 3. Test with small sample
node scripts/ingest-locomo.js --max-conversations 1 --max-sessions 1 --max-messages 5

# 4. Process larger batches
node scripts/ingest-locomo.js --max-conversations 2 --max-sessions 3 --max-messages 10
```

## Usage Options

### Basic Commands
```bash
# Process all data (WARNING: 4000+ messages - takes time!)
node scripts/ingest-locomo.js

# Recommended: Start with small samples for testing
node scripts/ingest-locomo.js --max-conversations 1 --max-sessions 2 --max-messages 5

# Medium-sized batches for development
node scripts/ingest-locomo.js --max-conversations 3 --max-sessions 5 --max-messages 15

# Get help and see all options
node scripts/ingest-locomo.js --help
```

### Recommended Ingestion Strategies

**🧪 Testing & Development**
```bash
# Single conversation, minimal data
node scripts/ingest-locomo.js --max-conversations 1 --max-sessions 1 --max-messages 3

# Single conversation, moderate data  
node scripts/ingest-locomo.js --max-conversations 1 --max-sessions 3 --max-messages 10
```

**🚀 Production Ingestion**
```bash
# Staged approach - ingest in batches
node scripts/ingest-locomo.js --max-conversations 2 --max-sessions 5 --max-messages 20
node scripts/ingest-locomo.js --max-conversations 5 --max-sessions 10 --max-messages 30

# Full dataset (monitor system resources!)
node scripts/ingest-locomo.js
```

## Configuration Options

- `--max-conversations <number>`: Maximum number of conversations to process
- `--max-sessions <number>`: Maximum number of sessions per conversation  
- `--max-messages <number>`: Maximum number of messages per session
- `--file <path>`: Path to the Locomo JSON file (default: ./eval/locomo/Locomo-10.json)
- `--mcp-url <url>`: MCP server URL (default: http://localhost:3001)

## Dataset Structure

### Locomo-10.json Format
```json
[
  {
    "qa": [...],  // Question-answer evaluation pairs
    "conversation": {
      "speaker_a": "Caroline",
      "speaker_b": "Melanie", 
      "session_1_date_time": "1:56 pm on 8 May, 2023",
      "session_1": [
        {
          "speaker": "Caroline",
          "dia_id": "D1:1", 
          "text": "Hey Mel! Good to see you! How have you been?"
        }
      ],
      "session_2": [...],
      // ... up to 19 sessions per conversation
    }
  }
]
```

### Processing Pipeline
1. **Message Extraction**: Extracts messages from conversation sessions
2. **Context Formatting**: Adds timestamp and speaker context: `[timestamp] Speaker: message`
3. **Entity Recognition**: LLM identifies people, places, organizations, events, emotions
4. **Relationship Mapping**: Builds connections between entities (knows, lives_in, works_at, etc.)
5. **Embedding Generation**: Creates vector embeddings for semantic search
6. **Graph Storage**: Persists in Dgraph with HNSW vector indexing

## Before Running

1. **Start your Dgraph instance**:
   ```bash
   docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Start the MCP server** (in another terminal):
   ```bash
   npm start
   # or for development with hot reload:
   npm run dev
   ```

## Testing the Integration

To test with the MCP Inspector:

1. Start MCP Inspector: `npm run inspector`
2. Configure with:
   - **Server Command**: `node`
   - **Server Arguments**: `["dist/index.js"]`
   - **Working Directory**: Project root path

3. Test the `save_user_message` tool manually with a sample message first

4. Run the ingestion script with a small sample:
   ```bash
   node scripts/ingest-locomo.js --max-conversations 1 --max-sessions 1 --max-messages 5
   ```

## Performance & Scale

### Dataset Statistics
- **10 conversations** between different speaker pairs
- **~19 sessions per conversation** on average (spanning days/weeks)
- **~20-50 messages per session** with rich context
- **~4000+ total messages** across the full dataset

### Processing Performance 
- **~2-5 seconds per message** (entity extraction + embedding generation)
- **Memory usage**: ~100-200MB during processing
- **Storage**: ~1-2GB in Dgraph for full dataset
- **Recommended**: Process in batches of 50-100 messages

### System Requirements
- **Memory**: 4GB+ RAM recommended
- **Storage**: 2GB+ available disk space  
- **Network**: Stable connection to LLM API (OpenAI/Anthropic)
- **Processing time**: 2-4 hours for full dataset

⚠️ **Start with small limits to test your system capacity!**

## Example Output

```bash
$ node scripts/ingest-locomo.js --max-conversations 1 --max-sessions 2 --max-messages 3

Loading data from: /Users/.../eval/locomo/Locomo-10.json
Loaded 10 conversations from file
🚀 Starting ingestion with config: { maxConversations: 1, maxSessions: 2, maxMessages: 3 }

📋 Processing conversation 1: Caroline & Melanie
   Found 6 messages across sessions
[SAVE] [1:56 pm on 8 May, 2023] Caroline: Hey Mel! Good to see you! How have you been?
🔗 Connecting to MCP server at http://localhost:3001/mcp
✅ Connected to MCP server
     ✅ Saved - Successfully saved message with 3 entities (0 new) and 3 relationships. Memory ID: 0x753d
[SAVE] [1:56 pm on 8 May, 2023] Melanie: Hey Caroline! Good to see you! I'm swamped with the kids & work...
     ✅ Saved - Successfully saved message with 5 entities (2 new) and 4 relationships. Memory ID: 0x753e
[SAVE] [1:56 pm on 8 May, 2023] Caroline: I went to a LGBTQ support group yesterday and it was so powerful.
     ✅ Saved - Successfully saved message with 3 entities (1 new) and 2 relationships. Memory ID: 0x7540
🔌 Disconnected from MCP server

✅ Ingestion completed!
   📈 Total processed: 6 messages from 1 conversations
   ✅ Successfully saved: 6
   ❌ Errors: 0
```

## What Gets Created

### Entities Extracted
- **People**: Caroline, Melanie, family members
- **Organizations**: LGBTQ support groups, workplaces  
- **Locations**: Meeting places, homes, cities
- **Events**: Support group meetings, work activities
- **Topics/Themes**: Mental health, family, relationships
- **Emotions/Sentiments**: Happiness, stress, inspiration

### Relationships Built
- **Social**: Caroline `knows` Melanie
- **Temporal**: Events `occurred_on` specific dates
- **Participation**: People `attended` events  
- **Location**: People `live_in` or `work_at` places
- **Emotional**: People `feel` emotions about topics

### Memory Capabilities
After ingestion, you can query the system:
```bash
# Search for memories about specific topics
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/call","params":{"name":"graph_memory_search","arguments":{"query":"LGBTQ support groups","limit":5}}}'

# Find relationships and connections
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/call","params":{"name":"graph_memory_search","arguments":{"query":"Caroline work stress","limit":3}}}'
```

## Technical Implementation

The script uses the MCP SDK to make real calls to the `save_user_message` tool:

- **Real MCP Client**: Uses `@modelcontextprotocol/sdk` 
- **HTTP Transport**: Connects to MCP server at `/mcp` endpoint
- **Error Handling**: Graceful handling of connection and processing failures
- **Progress Tracking**: Real-time success/error reporting
- **Connection Management**: Automatic connect/disconnect lifecycle

Each message triggers the full Graph Fetch pipeline: entity extraction → relationship mapping → embedding generation → graph storage.

## Troubleshooting

### Common Issues

**Connection Refused**
```bash
❌ Failed to save message: fetch failed [ECONNREFUSED]
```
**Solution**: Ensure MCP server is running on port 3001:
```bash
npm run build && npm start
curl http://localhost:3001/health  # Should return {"status":"ok",...}
```

**Dgraph Connection Issues**  
```bash
❌ Failed to initialize Dgraph schema
```
**Solution**: Start Dgraph database:
```bash
docker run --rm -it -p 8080:8080 -p 9080:9080 -p 8000:8000 dgraph/standalone:latest
```

**API Rate Limits**
```bash
❌ Rate limit exceeded (429)
```
**Solution**: Add delays between requests or use smaller batch sizes:
```bash
node scripts/ingest-locomo.js --max-messages 5  # Smaller batches
```

**Memory Issues**
```bash
❌ JavaScript heap out of memory
```
**Solution**: Increase Node.js memory or process in smaller batches:
```bash
node --max-old-space-size=4096 scripts/ingest-locomo.js --max-conversations 2
```

### Monitoring Progress

- **Watch server logs** for entity extraction details
- **Monitor Dgraph Alpha** at http://localhost:8080 for graph growth  
- **Check memory usage** with system monitoring tools
- **Track API costs** if using paid LLM services

## Next Steps

After successful ingestion:

1. **Test Memory Search**: Use `graph_memory_search` tool to query the knowledge graph
2. **Benchmark Performance**: Run evaluation queries from the Locomo dataset  
3. **Scale Up**: Process additional conversation datasets
4. **Optimize**: Tune entity extraction and relationship mapping for your use case
5. **Integration**: Connect to your AI agent or application

## Dataset Citation

If you use the Locomo dataset in research, please cite the original work:
```
Locomo: Long-term Conversational Memory Dataset
[Add proper citation when available]
```