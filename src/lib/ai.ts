import { generateText, embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { AIConfig } from '../types/index.js';


export class AIService {
  private config: AIConfig;
  private provider: any;

  constructor(config: AIConfig) {
    console.log(`[AIService] Initializing AI service with provider: ${config.provider}`);
    console.log(`[AIService] LLM Model: ${config.llmModel}`);
    console.log(`[AIService] Embedding Model: ${config.embeddingModel}`);
    this.config = config;
    this.provider = this.getProvider();
    console.log(`[AIService] AI service initialized successfully`);
  }

  private getProvider(): any {
    console.log(`[AIService] Setting up provider: ${this.config.provider}`);
    switch (this.config.provider.toLowerCase()) {
      case 'openai':
        console.log(`[AIService] Creating OpenAI client`);
        return createOpenAI({ apiKey: this.config.apiKey });
      case 'anthropic':
        console.log(`[AIService] Creating Anthropic client`);
        return createAnthropic({ apiKey: this.config.apiKey });
      default:
        console.error(`[AIService] Unsupported provider: ${this.config.provider}`);
        throw new Error(`Unsupported AI provider: ${this.config.provider}`);
    }
  }

  async extractEntities(text: string): Promise<Array<{ name: string; type: string; description?: string }>> {
    console.log(`[AIService] Starting entity extraction for text (${text.length} chars)`);
    console.log(`[AIService] Text preview: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    
    const prompt = `
      Analyze the following text and extract all entities (people, places, organizations, concepts, etc.).
      For each entity, provide:
      1. name: the exact name/mention in the text
      2. type: the category (PERSON, PLACE, ORGANIZATION, CONCEPT, EVENT, etc.)
      3. description: optional brief description if context is available

      Text: "${text}"
    `;

    try {
      console.log(`[AIService] Calling LLM for entity extraction using model: ${this.config.llmModel}`);
      const startTime = Date.now();
      
      const {text} = await generateText({
        model: this.provider(this.config.llmModel) as any,
        prompt: prompt + '\n\nOnly respond with a valid JSON object. Do not use a backtick code block. The JSON object should be in the following format: {"entities": [{"name": "...", "type": "...", "description": "..."}]}',
      });
      
      const llmTime = Date.now() - startTime;
      console.log(`[AIService] LLM response received in ${llmTime}ms`);
      console.log(`[AIService] Raw LLM response: ${text}`);
      
      console.log(`[AIService] Parsing JSON response...`);
      const parsed = JSON.parse(text);
      const entities = parsed.entities || [];
      console.log(`[AIService] Successfully extracted ${entities.length} entities`);
      entities.forEach((entity: any, index: number) => {
        console.log(`[AIService]   ${index + 1}. ${entity.name} (${entity.type}) - ${entity.description || 'no description'}`);
      });
      
      return entities;
    } catch (error) {
      console.error(`[AIService] Entity extraction failed:`, error);
      console.error(`[AIService] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    console.log(`[AIService] Generating embedding for text (${text.length} chars): "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    console.log(`[AIService] Using embedding model: ${this.config.embeddingModel}`);
    
    try {
      const startTime = Date.now();
      const result = await embed({
        model: this.provider(this.config.embeddingModel) as any,
        value: text,
      });
      
      const embeddingTime = Date.now() - startTime;
      console.log(`[AIService] Embedding generated in ${embeddingTime}ms (${result.embedding.length} dimensions)`);
      return result.embedding;
    } catch (error) {
      console.error(`[AIService] Embedding generation failed:`, error);
      console.error(`[AIService] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error('Failed to generate embedding');
    }
  }

  async generateMemorySummary(entities: Array<{ name: string; type: string }>, memories: any[]): Promise<string> {
    console.log(`[AIService] Generating memory summary for ${entities.length} entities and ${memories.length} memories`);
    console.log(`[AIService] Entities: ${entities.map(e => e.name).join(', ')}`);
    
    const entityList = entities.map(e => `${e.name} (${e.type})`).join(', ');
    const memoryContent = memories.map(m => m.content).join('\n\n');
    console.log(`[AIService] Memory content total length: ${memoryContent.length} characters`);

    const prompt = `
      Based on the following entities and related memories, provide a concise summary of what is known:
      
      Entities: ${entityList}
      
      Related memories:
      ${memoryContent}
      
      Provide a helpful summary that contextualizes these entities and their relationships.
    `;

    try {
      console.log(`[AIService] Calling LLM for memory summary using model: ${this.config.llmModel}`);
      const startTime = Date.now();
      
      const result = await generateText({
        model: this.provider(this.config.llmModel) as any,
        prompt,
      });
      
      const summaryTime = Date.now() - startTime;
      console.log(`[AIService] Memory summary generated in ${summaryTime}ms`);
      console.log(`[AIService] Summary length: ${result.text.length} characters`);
      console.log(`[AIService] Summary preview: "${result.text.substring(0, 100)}${result.text.length > 100 ? '...' : ''}"`);
      
      return result.text;
    } catch (error) {
      console.error(`[AIService] Memory summary generation failed:`, error);
      console.error(`[AIService] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      const fallbackSummary = `Found entities: ${entityList}`;
      console.log(`[AIService] Using fallback summary: "${fallbackSummary}"`);
      return fallbackSummary;
    }
  }
}