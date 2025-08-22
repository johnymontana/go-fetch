import type { DatabaseService } from '../lib/database-interface.js';
import { AIService } from '../lib/ai.js';
import type { SearchResult } from '../types/index.js';

export interface GraphMemorySearchArgs {
  query: string;
  limit?: number;
}

export class GraphMemorySearchTool {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly aiService: AIService
  ) {}

  async execute(args: GraphMemorySearchArgs): Promise<string> {
    try {
      const { query, limit = 10 } = args;
      
      if (!query?.trim()) {
        throw new Error('Search query cannot be empty');
      }

      // Generate embedding for the search query
      const queryEmbedding = await this.aiService.generateEmbedding(query);

      // Perform vector search in the database
      const entities = await this.databaseService.vectorSearch(queryEmbedding, limit);

      if (entities.length === 0) {
        return 'No relevant memories found for your query.';
      }

      // Process results to calculate similarity and structure data
      const searchResults: SearchResult[] = entities.map((entity: any) => {
        // Calculate cosine similarity (database already ranks by similarity)
        const similarity = this.calculateCosineSimilarity(queryEmbedding, entity.embedding || []);
        
        return {
          entity: {
            uid: entity.uid,
            name: entity.name,
            type: entity.type,
            description: entity.description,
            createdAt: entity.createdAt,
            embedding: entity.embedding,
          },
          similarity,
          relatedMemories: entity.memories || [],
          relatedEntities: entity.relatedTo || [],
        };
      });

      // Generate a comprehensive summary using AI
      let summary: string;
      try {
        summary = await this.aiService.generateMemorySummary(
          searchResults.map(r => ({ name: r.entity.name, type: r.entity.type })),
          searchResults.flatMap(r => r.relatedMemories),
          searchResults.flatMap(r => r.relatedEntities),
        );
      } catch (error) {
        console.error('Summary generation failed:', error);
        summary = 'Found relevant memories but summary generation failed.';
      }

      // Format the response
      const formattedResults = searchResults
        .slice(0, 5) // Limit to top 5 for readability
        .map((result, index) => {
          const memoryCount = result.relatedMemories.length;
          const recentMemory = result.relatedMemories[0]?.content?.substring(0, 100);
          const recentText = recentMemory ? recentMemory + '...' : 'No recent memories';
          
          return `${index + 1}. **${result.entity.name}** (${result.entity.type})
   - Similarity: ${(result.similarity * 100).toFixed(1)}%
   - Related memories: ${memoryCount}
   - Related entities: ${result.relatedEntities.length}
   - Recent: ${recentText}`;
        })
        .join('\n\n');

      return `## Memory Search Results for: "${query}"

${summary}

### Top Matching Entities:
${formattedResults}

Found ${entities.length} total entities with ${searchResults.reduce((sum, r) => sum + r.relatedMemories.length, 0)} related memories.`;

    } catch (error) {
      console.error('Error searching graph memory:', error);
      throw new Error(`Failed to search memories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      const a = vecA[i] ?? 0;
      const b = vecB[i] ?? 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
}