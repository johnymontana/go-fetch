#!/usr/bin/env tsx

import { readFileSync } from 'fs';
import { resolve } from 'path';

interface Message {
  speaker: string;
  dia_id: string;
  text: string;
}

interface Session {
  [key: string]: Message[] | string;
}

interface Conversation {
  speaker_a: string;
  speaker_b: string;
  [key: string]: string | Message[];
}

interface LocomoData {
  qa: any[];
  conversation: Conversation;
}

interface Config {
  maxConversations?: number;
  maxSessions?: number;
  maxMessages?: number;
  filePath?: string;
  mcpServerUrl?: string;
}

class LocomoIngester {
  private config: Config;
  private data: LocomoData[];

  constructor(config: Config = {}) {
    this.config = {
      maxConversations: config.maxConversations,
      maxSessions: config.maxSessions,
      maxMessages: config.maxMessages,
      filePath: config.filePath || './eval/locomo/Locomo-10.json',
      mcpServerUrl: config.mcpServerUrl || 'http://localhost:3000',
      ...config
    };

    // Load the data
    const fullPath = resolve(this.config.filePath!);
    console.log(`Loading data from: ${fullPath}`);
    
    try {
      const fileContent = readFileSync(fullPath, 'utf-8');
      this.data = JSON.parse(fileContent);
      console.log(`Loaded ${this.data.length} conversations from file`);
    } catch (error) {
      console.error('Failed to load data file:', error);
      process.exit(1);
    }
  }

  private async saveMessage(message: string): Promise<void> {
    try {
      // For now, we'll simulate the MCP call by logging
      // In a real implementation, you would make an HTTP request to the MCP server
      console.log(`Saving message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // TODO: Implement actual MCP server call
      // const response = await fetch(`${this.config.mcpServerUrl}/tools/save_user_message`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ message })
      // });
      // 
      // if (!response.ok) {
      //   throw new Error(`MCP server responded with ${response.status}`);
      // }
      
    } catch (error) {
      console.error('Failed to save message:', error);
      throw error;
    }
  }

  private extractSessionMessages(conversation: Conversation): Message[] {
    const messages: Message[] = [];
    const sessionKeys = Object.keys(conversation)
      .filter(key => key.startsWith('session_') && key !== 'session_1_date_time')
      .sort((a, b) => {
        const aNum = parseInt(a.replace('session_', ''));
        const bNum = parseInt(b.replace('session_', ''));
        return aNum - bNum;
      });

    let sessionCount = 0;
    for (const sessionKey of sessionKeys) {
      if (this.config.maxSessions && sessionCount >= this.config.maxSessions) {
        break;
      }

      const sessionMessages = conversation[sessionKey] as Message[];
      if (Array.isArray(sessionMessages)) {
        let messageCount = 0;
        for (const message of sessionMessages) {
          if (this.config.maxMessages && messageCount >= this.config.maxMessages) {
            break;
          }
          messages.push(message);
          messageCount++;
        }
      }
      sessionCount++;
    }

    return messages;
  }

  async ingest(): Promise<void> {
    console.log('Starting ingestion with config:', {
      maxConversations: this.config.maxConversations || 'unlimited',
      maxSessions: this.config.maxSessions || 'unlimited',
      maxMessages: this.config.maxMessages || 'unlimited'
    });

    let totalMessages = 0;
    let conversationCount = 0;

    for (const item of this.data) {
      if (this.config.maxConversations && conversationCount >= this.config.maxConversations) {
        break;
      }

      const conversation = item.conversation;
      console.log(`\nProcessing conversation ${conversationCount + 1}: ${conversation.speaker_a} & ${conversation.speaker_b}`);

      const messages = this.extractSessionMessages(conversation);
      console.log(`Found ${messages.length} messages in this conversation`);

      for (const message of messages) {
        try {
          const fullMessage = `${message.speaker}: ${message.text}`;
          await this.saveMessage(fullMessage);
          totalMessages++;
          
          if (totalMessages % 10 === 0) {
            console.log(`Processed ${totalMessages} messages...`);
          }
        } catch (error) {
          console.error(`Failed to save message ${message.dia_id}:`, error);
          // Continue with next message
        }
      }

      conversationCount++;
    }

    console.log(`\nIngestion completed! Processed ${totalMessages} messages from ${conversationCount} conversations.`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const config: Config = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--max-conversations':
        config.maxConversations = parseInt(value);
        break;
      case '--max-sessions':
        config.maxSessions = parseInt(value);
        break;
      case '--max-messages':
        config.maxMessages = parseInt(value);
        break;
      case '--file':
        config.filePath = value;
        break;
      case '--mcp-url':
        config.mcpServerUrl = value;
        break;
      case '--help':
        console.log(`
Usage: tsx scripts/ingest-locomo.ts [options]

Options:
  --max-conversations <number>  Maximum number of conversations to process
  --max-sessions <number>       Maximum number of sessions per conversation
  --max-messages <number>       Maximum number of messages per session
  --file <path>                 Path to the Locomo JSON file (default: ./eval/locomo/Locomo-10.json)
  --mcp-url <url>              MCP server URL (default: http://localhost:3000)
  --help                       Show this help message

Examples:
  # Process all data
  tsx scripts/ingest-locomo.ts

  # Process first 2 conversations, 3 sessions each, 10 messages per session
  tsx scripts/ingest-locomo.ts --max-conversations 2 --max-sessions 3 --max-messages 10

  # Use custom file path
  tsx scripts/ingest-locomo.ts --file /path/to/data.json --max-conversations 5
        `);
        process.exit(0);
      default:
        console.error(`Unknown flag: ${flag}`);
        process.exit(1);
    }
  }

  const ingester = new LocomoIngester(config);
  await ingester.ingest();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Ingestion failed:', error);
    process.exit(1);
  });
}

export { LocomoIngester };