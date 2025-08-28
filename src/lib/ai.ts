import { generateText, embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { AIConfig, EntityRelationship } from '../types/index.js';


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

  async extractEntities(text: string): Promise<Array<{ name: string; type: string; description?: string; coordinates?: any }>> {
    console.log(`[AIService] Starting entity extraction for text (${text.length} chars)`);
    console.log(`[AIService] Text preview: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    
    const prompt = `
      
      <CURRENT_MESSAGE>
            Text: "${text}"
      </CURRENT_MESSAGE>
            
      Given the above conversation, extract entity nodes from the CURRENT MESSAGE that are explicitly or implicitly mentioned:

      Guidelines:
      1. If available, extract the speaker/actor as the first node. The speaker is the part before the colon in each line of dialogue.
      2. Extract other significant entities, concepts, or actors mentioned in the CURRENT MESSAGE.
      3. DO NOT create nodes for relationships or actions.
      4. DO NOT create nodes for temporal information like dates, times or years (these will be added to edges later).
      5. Be as explicit as possible in your node names, using full names.
      6. DO NOT extract entities mentioned only
    `;

    try {
      console.log(`[AIService] Calling LLM for entity extraction using model: ${this.config.llmModel}`);
      const startTime = Date.now();
      
      const {text} = await generateText({
        model: this.provider(this.config.llmModel) as any,
        prompt: prompt + '\n\nOnly respond with a valid JSON object. Do not use a backtick code block. The JSON object should be in the following format: {"entities": [{"name": "...", "type": "...", "description": "..."}]} If the entity is a LOCATION, then geocode the location and return the latitude and longitude coordinates in an optional "coordinates" field.',
      });
      
      const llmTime = Date.now() - startTime;
      console.log(`[AIService] LLM response received in ${llmTime}ms`);
      console.log(`[AIService] Raw LLM response: ${text}`);
      
      console.log(`[AIService] Parsing JSON response...`);

      // Try to clean and parse the JSON response
      let parsed;
      try {
        // First try direct parsing
        parsed = JSON.parse(text);
      } catch {
        console.log(`[AIService] Direct JSON parsing failed, attempting to clean response...`);

        // Try to extract JSON from the response
        let cleanedResponse = text.trim();

        // Remove markdown code blocks if present
        cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '');

        // Try to find JSON object boundaries
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }

        // Remove any trailing text after the JSON object
        const lastBraceIndex = cleanedResponse.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
          cleanedResponse = cleanedResponse.substring(0, lastBraceIndex + 1);
        }

        // Fix common JSON escaping issues
        // Replace unescaped apostrophes and quotes in string values
        cleanedResponse = cleanedResponse.replace(/"([^"]*?)'([^"]*?)"/g, '"$1\\\'$2"');
        cleanedResponse = cleanedResponse.replace(/'([^']*?)"([^']*?)'/g, '\'$1\\"$2\'');

        // Fix missing commas between array elements
        // Look for patterns like }}{"name" and add missing commas
        cleanedResponse = cleanedResponse.replace(/}\s*\{/g, '},{');

        // Also fix missing commas in nested objects
        cleanedResponse = cleanedResponse.replace(/}\s*"([^"]+)":/g, '}, "$1":');

        // Fix double closing braces that commonly break JSON
        // Look for patterns like }}] and fix them to }]
        cleanedResponse = cleanedResponse.replace(/}\s*}\s*\]/g, '}]');

        // Also fix patterns like }}}
        cleanedResponse = cleanedResponse.replace(/}\s*}\s*}/g, '}}');

        console.log(`[AIService] Cleaned response: ${cleanedResponse}`);

        try {
          parsed = JSON.parse(cleanedResponse);
        } catch (cleanParseError) {
          console.error(`[AIService] Cleaned JSON parsing also failed:`, cleanParseError);

          // Try one more time with more aggressive cleaning
          try {
            console.log(`[AIService] Attempting aggressive JSON cleaning...`);

            // Remove all problematic characters that commonly break JSON
            const aggressiveCleaned = cleanedResponse
              .replace(/'/g, "\\'")  // Escape all single quotes
              .replace(/"/g, '\\"')  // Escape all double quotes
              .replace(/\\"/g, '"')  // But keep the JSON structure quotes
              .replace(/\\'/g, "'"); // And keep the JSON structure single quotes

            console.log(`[AIService] Aggressively cleaned response: ${aggressiveCleaned}`);

            parsed = JSON.parse(aggressiveCleaned);
            console.log(`[AIService] Aggressive cleaning succeeded!`);
          } catch (aggressiveError) {
            console.error(`[AIService] Aggressive cleaning also failed:`, aggressiveError);
            console.error(`[AIService] Failed to parse LLM response as JSON. Response was: "${text}"`);
            return [];
          }
        }
      }

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
        // FIXME: will this also work for anthropic? Need to verify
        model: this.provider.textEmbedding(this.config.embeddingModel) as any,
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

  async generateMemorySummary(entities: Array<{ name: string; type: string }>, memories: any[], relatedEntities: any[]): Promise<string> {
    console.log(`[AIService] Generating memory summary for ${entities.length} entities and ${memories.length} memories`);
    console.log(`[AIService] Entities: ${entities.map(e => e.name).join(', ')}`);
    
    const entityList = entities.map(e => `${e.name} (${e.type})`).join(', ');
    const relatedEntitiesList = relatedEntities.map(e => `${e.name} (${e.type})`).join(', ');
    const memoryContent = memories.map(m => m.content).join('\n\n');
    console.log(`[AIService] Memory content total length: ${memoryContent.length} characters`);

    const prompt = `
      Based on the following entities and related memories, provide a concise summary of what is known:
      
      Entities: ${entityList}
      
      Related memories:
      ${memoryContent}

      Related entities:
      ${relatedEntitiesList}
      
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

  async extractEntityRelationships(
    entities: Array<{ name: string; type: string; description?: string }>,
    memoryContent: string
  ): Promise<EntityRelationship[]> {
    console.log(`[AIService] Extracting relationships between ${entities.length} entities`);
    console.log(`[AIService] Entities: ${entities.map(e => e.name).join(', ')}`);

    if (entities.length < 2) {
      console.log(`[AIService] Not enough entities to create relationships (need at least 2)`);
      return [];
    }

    const entityList = entities.map(e => `${e.name} (${e.type})`).join(', ');

          const prompt = `
      Based on the following memory content and entities, identify relationships between the entities.

      Memory: "${memoryContent}"

      Entities: ${entityList}

      For each relationship you identify, provide:
      1. fromEntity: the name of the first entity (exactly as provided)
      2. toEntity: the name of the second entity (exactly as provided)
      3. type: a brief description of how they are related (e.g., "works with", "located in", "member of", "discussed", "collaborated on")

      Guidelines:
      1. Extract facts only between the provided entities.
      2. Each fact should represent a clear relationship between two DISTINCT nodes.
      3. The relation_type should be a concise, all-caps description of the fact (e.g., LOVES, IS_FRIENDS_WITH, WORKS_FOR).
      4. Provide a more detailed fact containing all relevant information.
      5. Consider temporal aspects of relationships when relevant.
      6. Only include relationships that are clearly evident from the memory content.
      7. Do not create speculative relationships.
    `;

    try {
      console.log(`[AIService] Calling LLM for relationship extraction using model: ${this.config.llmModel}`);
      const startTime = Date.now();

      const { text } = await generateText({
        model: this.provider(this.config.llmModel) as any,
        prompt: prompt + '\n\nOnly respond with a valid JSON object. Do not use a backtick code block. The JSON object should be in the following format: {"relationships": [{"fromEntity": "...", "toEntity": "...", "type": "..."}]}',
      });

      const llmTime = Date.now() - startTime;
      console.log(`[AIService] LLM response received in ${llmTime}ms`);
      console.log(`[AIService] Raw LLM response: ${text}`);

      console.log(`[AIService] Parsing JSON response...`);
      const parsed = JSON.parse(text);
      const relationships = parsed.relationships || [];
      
      console.log(`[AIService] Successfully extracted ${relationships.length} relationships`);
      relationships.forEach((rel: EntityRelationship, index: number) => {
        console.log(`[AIService]   ${index + 1}. ${rel.fromEntity} -> ${rel.toEntity} (${rel.type})`);
      });

      return relationships;
    } catch (error) {
      console.error(`[AIService] Relationship extraction failed:`, error);
      console.error(`[AIService] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
    }
  }

  async extractTemporalInformation(
    relationships: EntityRelationship[],
    memoryContent: string,
    referenceTimestamp: string
  ): Promise<EntityRelationship[]> {
    console.log(`[AIService] Extracting temporal information for ${relationships.length} relationships`);

    if (relationships.length === 0) {
      return relationships;
    }

    const enrichedRelationships: EntityRelationship[] = [];

    for (const relationship of relationships) {
      try {
        console.log(`[AIService] Processing temporal information for relationship: ${relationship.fromEntity} -> ${relationship.toEntity} (${relationship.type})`);

        const prompt = `
<CURRENT MESSAGE>
${memoryContent}
</CURRENT MESSAGE>
<REFERENCE TIMESTAMP>
${referenceTimestamp}
</REFERENCE TIMESTAMP>
<FACT>
${relationship.fromEntity} ${relationship.type} ${relationship.toEntity}
</FACT>
IMPORTANT: Only extract time information if it is part of the provided fact. Otherwise ignore the time mentioned.
Make sure to do your best to determine the dates if only the relative time is mentioned. (eg 10 years ago, 2 mins ago)
based on the provided reference timestamp
If the relationship is not of spanning nature, but you are still able to determine the dates, set the valid_at only.
Definitions:
- valid_at: The date and time when the relationship described by the edge fact became true or was established.
- invalid_at: The date and time when the relationship described by the edge fact stopped being true or ended.
Task:
Analyze the conversation and determine if there are dates that are part of the edge fact. Only set dates if they explicitly
relate to the formation or alteration of the relationship itself.
Guidelines:
1. Use ISO 8601 format (YYYY-MM-DDTHH:MM:SS.SSSSSSZ) for datetimes.
2. Use the reference timestamp as the current time when determining the valid_at and invalid_at dates.
3. If the fact is written in the present tense, use the Reference Timestamp for the valid_at date
4. If no temporal information is found that establishes or changes the relationship, leave the fields as null.
5. Do not infer dates from related events. Only use dates that are directly stated to establish or change the relationship.
6. For relative time mentions directly related to the relationship, calculate the actual datetime based on the reference
timestamp.
7. If only a date is mentioned without a specific time, use 00:00:00 (midnight) for that date.
8. If only year is mentioned, use January 1st of that year at 00:00:00.
9. Always include the time zone offset (use Z for UTC if no specific time zone is mentioned).

Only respond with a valid JSON object in this format: {"validAt": "YYYY-MM-DDTHH:MM:SS.SSSSSSZ" | null, "invalidAt": "YYYY-MM-DDTHH:MM:SS.SSSSSSZ" | null}
`;

        console.log(`[AIService] Calling LLM for temporal extraction using model: ${this.config.llmModel}`);
        const startTime = Date.now();

        const { text } = await generateText({
          model: this.provider(this.config.llmModel) as any,
          prompt,
        });

        const llmTime = Date.now() - startTime;
        console.log(`[AIService] Temporal extraction LLM response received in ${llmTime}ms`);
        console.log(`[AIService] Raw temporal LLM response: ${text}`);

        console.log(`[AIService] Parsing temporal JSON response...`);
        const temporalData = JSON.parse(text);

        const enrichedRelationship: EntityRelationship = {
          ...relationship,
          validAt: temporalData.validAt || undefined,
          invalidAt: temporalData.invalidAt || undefined
        };

        enrichedRelationships.push(enrichedRelationship);

        console.log(`[AIService] Enriched relationship: ${enrichedRelationship.fromEntity} -> ${enrichedRelationship.toEntity} (${enrichedRelationship.type}) - validAt: ${enrichedRelationship.validAt || 'null'}, invalidAt: ${enrichedRelationship.invalidAt || 'null'}`);

      } catch (error) {
        console.error(`[AIService] Temporal extraction failed for relationship ${relationship.fromEntity} -> ${relationship.toEntity}:`, error);
        // If temporal extraction fails, keep the original relationship without temporal data
        enrichedRelationships.push(relationship);
      }
    }

    console.log(`[AIService] Successfully enriched ${enrichedRelationships.length} relationships with temporal information`);
    return enrichedRelationships;
  }
}