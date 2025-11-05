#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LocomoIngester {
  constructor(config = {}) {
    this.config = {
      maxConversations: config.maxConversations,
      maxSessions: config.maxSessions,
      maxMessages: config.maxMessages,
      filePath: config.filePath || './eval/locomo/Locomo-10.json',
      mcpServerUrl: config.mcpServerUrl || 'http://localhost:3003',
      ...config
    };
    
    // Initialize MCP client
    this.mcpClient = null;

    // Load the data
    const fullPath = path.resolve(this.config.filePath);
    console.log(`Loading data from: ${fullPath}`);
    
    try {
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      this.data = JSON.parse(fileContent);
      console.log(`Loaded ${this.data.length} conversations from file`);
    } catch (error) {
      console.error('Failed to load data file:', error);
      process.exit(1);
    }
  }

  async initializeMCPClient() {
    if (!this.mcpClient) {
      console.log(`🔗 Connecting to MCP server at ${this.config.mcpServerUrl}/mcp`);
      
      const transport = new StreamableHTTPClientTransport(new URL(`${this.config.mcpServerUrl}/mcp`));
      
      this.mcpClient = new Client({
        name: 'locomo-ingester',
        version: '1.0.0'
      }, {
        capabilities: {}
      });
      
      await this.mcpClient.connect(transport);
      console.log('✅ Connected to MCP server');
    }
    return this.mcpClient;
  }

  async saveMessage(message) {
    try {
      console.log(`[SAVE] ${message.substring(0, 120)}${message.length > 120 ? '...' : ''}`);
      
      // Ensure MCP client is initialized
      const client = await this.initializeMCPClient();
      
      // Call the save_user_message tool via MCP using proper request format
      const request = {
        method: 'tools/call',
        params: {
          name: 'save_user_message',
          arguments: {
            message: message
          }
        }
      };
      
      const result = await client.request(request, CallToolResultSchema);
      
      // Log successful result (truncated for readability)
      if (result.content && result.content[0] && result.content[0].text) {
        const resultText = result.content[0].text;
        console.log(`     ✅ Saved - ${resultText.substring(0, 100)}${resultText.length > 100 ? '...' : ''}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to save message:', error);
      throw error;
    }
  }

  async closeMCPClient() {
    if (this.mcpClient) {
      try {
        await this.mcpClient.close();
        this.mcpClient = null;
        console.log('🔌 Disconnected from MCP server');
      } catch (error) {
        console.error('Error closing MCP client:', error);
      }
    }
  }

  extractSessionMessages(conversation) {
    const messages = [];
    const sessionKeys = Object.keys(conversation)
      .filter(key => key.startsWith('session_') && !key.includes('date_time'))
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

      const sessionMessages = conversation[sessionKey];
      if (Array.isArray(sessionMessages)) {
        let messageCount = 0;
        for (const message of sessionMessages) {
          if (this.config.maxMessages && messageCount >= this.config.maxMessages) {
            break;
          }
          messages.push({
            ...message,
            session: sessionKey,
            sessionDateTime: conversation[`${sessionKey}_date_time`] || 'unknown'
          });
          messageCount++;
        }
      }
      sessionCount++;
    }

    return messages;
  }

  async ingest() {
    console.log('🚀 Starting ingestion with config:', {
      maxConversations: this.config.maxConversations || 'unlimited',
      maxSessions: this.config.maxSessions || 'unlimited', 
      maxMessages: this.config.maxMessages || 'unlimited'
    });

    let totalMessages = 0;
    let conversationCount = 0;
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const item of this.data) {
        if (this.config.maxConversations && conversationCount >= this.config.maxConversations) {
          break;
        }

        const conversation = item.conversation;
        console.log(`\n📋 Processing conversation ${conversationCount + 1}: ${conversation.speaker_a} & ${conversation.speaker_b}`);

        const messages = this.extractSessionMessages(conversation);
        console.log(`   Found ${messages.length} messages across sessions`);

        for (const message of messages) {
          try {
            // Create contextual message with speaker and session info
            const contextualMessage = `[${message.sessionDateTime}] ${message.speaker}: ${message.text}`;
            await this.saveMessage(contextualMessage);
            totalMessages++;
            successCount++;
            
            if (totalMessages % 10 === 0) {
              console.log(`   📊 Progress: ${successCount} saved, ${errorCount} errors, ${totalMessages} total processed`);
            }
          } catch (error) {
            console.error(`❌ Failed to save message ${message.dia_id}:`, error.message || error);
            errorCount++;
            // Continue with next message
          }
        }

        conversationCount++;
      }

    } finally {
      // Always close the MCP client
      await this.closeMCPClient();
    }

    console.log(`\n✅ Ingestion completed!`);
    console.log(`   📈 Total processed: ${totalMessages} messages from ${conversationCount} conversations`);
    console.log(`   ✅ Successfully saved: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const config = {};

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
🔧 Locomo Data Ingestion Script

Usage: node scripts/ingest-locomo.js [options]

Options:
  --max-conversations <number>  Maximum number of conversations to process
  --max-sessions <number>       Maximum number of sessions per conversation  
  --max-messages <number>       Maximum number of messages per session
  --file <path>                 Path to the Locomo JSON file (default: ./eval/locomo/Locomo-10.json)
  --mcp-url <url>              MCP server URL (default: http://localhost:3000)
  --help                       Show this help message

Examples:
  # Process all data (careful - this is a lot!)
  node scripts/ingest-locomo.js

  # Process first 2 conversations, 3 sessions each, 10 messages per session
  node scripts/ingest-locomo.js --max-conversations 2 --max-sessions 3 --max-messages 10

  # Quick test with minimal data
  node scripts/ingest-locomo.js --max-conversations 1 --max-sessions 1 --max-messages 5

  # Use custom file path
  node scripts/ingest-locomo.js --file /path/to/data.json --max-conversations 5
        `);
        process.exit(0);
      default:
        if (flag.startsWith('--')) {
          console.error(`❌ Unknown flag: ${flag}`);
          console.error('Use --help to see available options');
          process.exit(1);
        }
    }
  }

  try {
    const ingester = new LocomoIngester(config);
    await ingester.ingest();
  } catch (error) {
    console.error('💥 Ingestion failed:', error);
    
    // Try to close any open MCP connections
    try {
      if (ingester && ingester.mcpClient) {
        await ingester.closeMCPClient();
      }
    } catch (closeError) {
      console.error('Error closing MCP client during cleanup:', closeError);
    }
    
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { LocomoIngester };