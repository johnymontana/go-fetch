import { generateText, embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { AIConfig } from '../types/index.js';


export class AIService {
  private config: AIConfig;
  private provider: any;

  constructor(config: AIConfig) {
    this.config = config;
    this.provider = this.getProvider();
  }

  private getProvider(): any {
    switch (this.config.provider.toLowerCase()) {
      case 'openai':
        return createOpenAI({ apiKey: this.config.apiKey });
      case 'anthropic':
        return createAnthropic({ apiKey: this.config.apiKey });
      default:
        throw new Error(`Unsupported AI provider: ${this.config.provider}`);
    }
  }

  async extractEntities(text: string): Promise<Array<{ name: string; type: string; description?: string }>> {
    const prompt = `
      Analyze the following text and extract all entities (people, places, organizations, concepts, etc.).
      For each entity, provide:
      1. name: the exact name/mention in the text
      2. type: the category (PERSON, PLACE, ORGANIZATION, CONCEPT, EVENT, etc.)
      3. description: optional brief description if context is available

      Text: "${text}"
    `;

    try {
      const result = await generateText({
        model: this.provider(this.config.llmModel) as any,
        prompt: prompt + '\n\nRespond with JSON format: {"entities": [{"name": "...", "type": "...", "description": "..."}]}',
      });

      const parsed = JSON.parse(result.text);
      return parsed.entities || [];
    } catch (error) {
      console.error('Entity extraction failed:', error);
      return [];
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const result = await embed({
        model: this.provider(this.config.embeddingModel) as any,
        value: text,
      });

      return result.embedding;
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  async generateMemorySummary(entities: Array<{ name: string; type: string }>, memories: any[]): Promise<string> {
    const entityList = entities.map(e => `${e.name} (${e.type})`).join(', ');
    const memoryContent = memories.map(m => m.content).join('\n\n');

    const prompt = `
      Based on the following entities and related memories, provide a concise summary of what is known:
      
      Entities: ${entityList}
      
      Related memories:
      ${memoryContent}
      
      Provide a helpful summary that contextualizes these entities and their relationships.
    `;

    try {
      const result = await generateText({
        model: this.provider(this.config.llmModel) as any,
        prompt,
      });

      return result.text;
    } catch (error) {
      console.error('Summary generation failed:', error);
      return `Found entities: ${entityList}`;
    }
  }
}