import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ContextManager } from './context/context-manager.js';
import { RAGSystem } from './rag-system.js';
import { SharedContextSchema } from '../types/index.js';

const UpdateContextSchema = z.object({
  updates: z.record(z.string(), z.any()),
  agentId: z.string()
});

const GetContextSchema = z.object({
  keys: z.array(z.string()).optional()
});

const RAGStoreSchema = z.object({
  content: z.string(),
  metadata: z.record(z.string(), z.any()),
  id: z.string().optional()
});

const RAGQuerySchema = z.object({
  query: z.string(),
  maxResults: z.number().optional(),
  threshold: z.number().optional()
});

export class MCPServer {
  private server: Server;
  private contextManager: ContextManager;
  private ragSystem: RAGSystem;

  constructor() {
    this.server = new Server(
      {
        name: config.server.name,
        version: config.server.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.contextManager = new ContextManager();
    this.ragSystem = new RAGSystem();
    
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'update_context',
          description: 'Update the shared context with new information. Use this to share state between agents.',
          inputSchema: {
            type: 'object',
            properties: {
              updates: {
                type: 'object',
                description: 'Key-value pairs to update in the context'
              },
              agentId: {
                type: 'string',
                description: 'ID of the agent making the update'
              }
            },
            required: ['updates', 'agentId']
          }
        },
        {
          name: 'get_context',
          description: 'Retrieve the current shared context or specific keys from it.',
          inputSchema: {
            type: 'object',
            properties: {
              keys: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific keys to retrieve. If not provided, returns the entire context.'
              }
            }
          }
        },
        {
          name: 'rag_store',
          description: 'Store information in the RAG system for later retrieval.',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Content to store'
              },
              metadata: {
                type: 'object',
                description: 'Additional metadata to associate with the content'
              },
              id: {
                type: 'string',
                description: 'Optional ID for the document'
              }
            },
            required: ['content', 'metadata']
          }
        },
        {
          name: 'rag_query',
          description: 'Query the RAG system for relevant information.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Query string to search for'
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 10
              },
              threshold: {
                type: 'number',
                description: 'Similarity threshold (0-1)',
                default: 0.7
              }
            },
            required: ['query']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'update_context': {
            const validatedArgs = UpdateContextSchema.parse(args);
            logger.info('MCPServer', `Agent ${validatedArgs.agentId} updating context`, validatedArgs.updates);
            
            const startTime = Date.now();
            await this.contextManager.updateContext(validatedArgs.updates, validatedArgs.agentId);
            const latency = Date.now() - startTime;
            
            if (latency > config.performance.contextSyncMaxLatency) {
              logger.warn('MCPServer', `Context update exceeded max latency: ${latency}ms`);
            }
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ 
                  success: true, 
                  message: 'Context updated successfully',
                  latency: `${latency}ms`
                })
              }]
            };
          }

          case 'get_context': {
            const validatedArgs = GetContextSchema.parse(args);
            logger.debug('MCPServer', 'Getting context', validatedArgs);
            
            const context = await this.contextManager.getContext(validatedArgs.keys);
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(context)
              }]
            };
          }

          case 'rag_store': {
            const validatedArgs = RAGStoreSchema.parse(args);
            logger.info('MCPServer', 'Storing in RAG', { id: validatedArgs.id, metadataKeys: Object.keys(validatedArgs.metadata) });
            
            const documentId = await this.ragSystem.store(
              validatedArgs.content,
              validatedArgs.metadata,
              validatedArgs.id
            );
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ 
                  success: true, 
                  documentId,
                  message: 'Content stored successfully in RAG system'
                })
              }]
            };
          }

          case 'rag_query': {
            const validatedArgs = RAGQuerySchema.parse(args);
            logger.info('MCPServer', 'Querying RAG', validatedArgs);
            
            const startTime = Date.now();
            const results = await this.ragSystem.query(
              validatedArgs.query,
              validatedArgs.maxResults || config.rag.maxResults,
              validatedArgs.threshold || config.rag.similarityThreshold
            );
            const queryTime = Date.now() - startTime;
            
            if (queryTime > config.performance.ragRetrievalMaxTime) {
              logger.warn('MCPServer', `RAG query exceeded max time: ${queryTime}ms`);
            }
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  ...results,
                  queryTime: `${queryTime}ms`
                })
              }]
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error('MCPServer', `Error executing tool ${name}`, error);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: error instanceof Error ? error.message : 'Unknown error occurred'
            })
          }]
        };
      }
    });
  }

  async start(): Promise<void> {
    logger.info('MCPServer', 'Starting MCP server...');
    
    try {
      await this.contextManager.initialize();
      await this.ragSystem.initialize();
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('MCPServer', 'MCP server started successfully');
    } catch (error) {
      logger.error('MCPServer', 'Failed to start MCP server', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('MCPServer', 'Stopping MCP server...');
    
    try {
      await this.contextManager.shutdown();
      await this.ragSystem.shutdown();
      await this.server.close();
      
      logger.info('MCPServer', 'MCP server stopped successfully');
    } catch (error) {
      logger.error('MCPServer', 'Error stopping MCP server', error);
      throw error;
    }
  }

  private checkRateLimit(agentId: string): boolean {
    const now = Date.now();
    const limit = 60; // 60 requests per minute
    const window = 60 * 1000; // 1 minute window

    let record = this.rateLimiter.get(agentId);
    
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + window };
      this.rateLimiter.set(agentId, record);
    }

    if (record.count >= limit) {
      logger.warn('MCPServer', `Rate limit exceeded for ${agentId}`);
      return false;
    }

    record.count++;
    return true;
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MCPServer();
  
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
  
  server.start().catch((error) => {
    logger.error('MCPServer', 'Fatal error', error);
    process.exit(1);
  });
}