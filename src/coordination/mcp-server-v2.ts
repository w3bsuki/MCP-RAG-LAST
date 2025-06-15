import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ContextManager } from './context/context-manager.js';
import { RAGSystem } from './rag-system.js';
import { TaskManager } from './task-manager.js';
import { TaskPriority } from '../types/tasks.js';

// Tool schemas
const CreateTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  priority: z.number().min(1).max(5).optional(),
  assignedRole: z.enum(['auditor', 'implementer', 'validator']).optional(),
  dependencies: z.array(z.string()).optional(),
  context: z.string().optional()
});

const UpdateTaskSchema = z.object({
  taskId: z.string(),
  status: z.enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled']).optional(),
  assignedTo: z.string().optional(),
  blockedBy: z.string().optional(),
  results: z.object({
    files: z.array(z.string()).optional(),
    commands: z.array(z.string()).optional(),
    tests: z.array(z.string()).optional(),
    metrics: z.record(z.any()).optional()
  }).optional()
});

const GetTasksSchema = z.object({
  tags: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
  roles: z.array(z.enum(['auditor', 'implementer', 'validator'])).optional(),
  status: z.array(z.enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])).optional(),
  priority: z.array(z.number().min(1).max(5)).optional(),
  assignedTo: z.string().optional(),
  includeCompleted: z.boolean().optional()
});

const ClaimTaskSchema = z.object({
  taskId: z.string()
});

const CompleteTaskSchema = z.object({
  taskId: z.string(),
  results: z.object({
    files: z.array(z.string()).optional(),
    commands: z.array(z.string()).optional(),
    tests: z.array(z.string()).optional(),
    metrics: z.record(z.any()).optional()
  }).optional()
});

export class MCPServerV2 {
  private server: Server;
  private contextManager: ContextManager;
  private ragSystem: RAGSystem;
  private taskManager: TaskManager;
  private instanceId: string;

  constructor() {
    this.instanceId = process.env.CLAUDE_INSTANCE_ID || 'claude-default';
    
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
    this.taskManager = new TaskManager(this.contextManager, this.ragSystem);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Task management tools
        {
          name: 'create_task',
          description: 'Create a new task with tags and metadata',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title' },
              description: { type: 'string', description: 'Detailed task description' },
              tags: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Tags like IMPLEMENT, TEST, FEATURE, etc.'
              },
              priority: { 
                type: 'number', 
                minimum: 1, 
                maximum: 5,
                description: 'Priority from 1 (low) to 5 (high)'
              },
              assignedRole: {
                type: 'string',
                enum: ['auditor', 'implementer', 'validator'],
                description: 'Role this task is intended for'
              },
              dependencies: {
                type: 'array',
                items: { type: 'string' },
                description: 'IDs of tasks that must complete first'
              }
            },
            required: ['title', 'description', 'tags']
          }
        },
        {
          name: 'update_task',
          description: 'Update task status or details',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              status: { 
                type: 'string',
                enum: ['pending', 'in_progress', 'blocked', 'completed', 'cancelled']
              },
              assignedTo: { type: 'string' },
              blockedBy: { type: 'string' },
              results: { type: 'object' }
            },
            required: ['taskId']
          }
        },
        {
          name: 'get_tasks',
          description: 'Get filtered list of tasks',
          inputSchema: {
            type: 'object',
            properties: {
              tags: { type: 'array', items: { type: 'string' } },
              excludeTags: { type: 'array', items: { type: 'string' } },
              roles: { type: 'array', items: { type: 'string' } },
              status: { type: 'array', items: { type: 'string' } },
              priority: { type: 'array', items: { type: 'number' } },
              assignedTo: { type: 'string' },
              includeCompleted: { type: 'boolean' }
            }
          }
        },
        {
          name: 'claim_task',
          description: 'Claim a task to work on it',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string' }
            },
            required: ['taskId']
          }
        },
        {
          name: 'complete_task',
          description: 'Mark a task as completed',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              results: { type: 'object' }
            },
            required: ['taskId']
          }
        },
        // Context tools
        {
          name: 'update_context',
          description: 'Update shared context',
          inputSchema: {
            type: 'object',
            properties: {
              updates: { 
                type: 'object',
                description: 'Key-value pairs to update in context'
              }
            },
            required: ['updates']
          }
        },
        {
          name: 'get_context',
          description: 'Get shared context',
          inputSchema: {
            type: 'object',
            properties: {
              paths: { 
                type: 'array',
                items: { type: 'string' },
                description: 'Specific paths to retrieve'
              }
            }
          }
        },
        // RAG tools
        {
          name: 'rag_store',
          description: 'Store document in RAG system',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              metadata: { type: 'object' },
              id: { type: 'string' }
            },
            required: ['content', 'metadata']
          }
        },
        {
          name: 'rag_query',
          description: 'Query RAG system for similar documents',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              maxResults: { type: 'number' },
              threshold: { type: 'number' }
            },
            required: ['query']
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // Task management
          case 'create_task': {
            const validated = CreateTaskSchema.parse(args);
            const task = await this.taskManager.createTask(
              validated.title,
              validated.description,
              validated.tags,
              this.instanceId,
              {
                priority: validated.priority as TaskPriority,
                assignedRole: validated.assignedRole,
                dependencies: validated.dependencies,
                context: validated.context
              }
            );
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(task, null, 2)
              }]
            };
          }

          case 'update_task': {
            const validated = UpdateTaskSchema.parse(args);
            const task = await this.taskManager.updateTask(
              validated.taskId,
              validated,
              this.instanceId
            );
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(task, null, 2)
              }]
            };
          }

          case 'get_tasks': {
            const validated = GetTasksSchema.parse(args);
            const tasks = await this.taskManager.getTasks({
              ...validated,
              priority: validated.priority as TaskPriority[]
            });
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(tasks, null, 2)
              }]
            };
          }

          case 'claim_task': {
            const validated = ClaimTaskSchema.parse(args);
            const task = await this.taskManager.claimTask(
              validated.taskId,
              this.instanceId
            );
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(task, null, 2)
              }]
            };
          }

          case 'complete_task': {
            const validated = CompleteTaskSchema.parse(args);
            const task = await this.taskManager.completeTask(
              validated.taskId,
              this.instanceId,
              validated.results
            );
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(task, null, 2)
              }]
            };
          }

          // Context management
          case 'update_context': {
            await this.contextManager.updateContext(args.updates);
            return {
              content: [{
                type: 'text',
                text: 'Context updated successfully'
              }]
            };
          }

          case 'get_context': {
            const context = await this.contextManager.getContext(args.paths);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(context, null, 2)
              }]
            };
          }

          // RAG operations
          case 'rag_store': {
            const docId = await this.ragSystem.store(
              args.content,
              args.metadata,
              args.id
            );
            return {
              content: [{
                type: 'text',
                text: `Document stored with ID: ${docId}`
              }]
            };
          }

          case 'rag_query': {
            const results = await this.ragSystem.query(
              args.query,
              args.maxResults || 10,
              args.threshold || 0.7
            );
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(results, null, 2)
              }]
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error('MCPServerV2', `Tool execution failed: ${name}`, error);
        throw error;
      }
    });
  }

  async start(): Promise<void> {
    logger.info('MCPServerV2', 'Starting MCP server v2...');
    
    await this.contextManager.initialize();
    await this.ragSystem.initialize();
    await this.taskManager.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    logger.info('MCPServerV2', 'MCP server v2 started successfully');
  }

  async stop(): Promise<void> {
    logger.info('MCPServerV2', 'Stopping MCP server v2...');
    
    await this.contextManager.shutdown();
    await this.ragSystem.shutdown();
    
    logger.info('MCPServerV2', 'MCP server v2 stopped successfully');
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MCPServerV2();
  
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
  
  server.start().catch((error) => {
    logger.error('MCPServerV2', 'Failed to start server', error);
    process.exit(1);
  });
}