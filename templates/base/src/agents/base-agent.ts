import { EventEmitter } from 'events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { logger } from '../utils/logger.js';
import { AgentInfo, AgentState, Task } from '../types/index.js';
import { config } from '../config/index.js';

export interface AgentConfig {
  id: string;
  type: 'auditor' | 'implementer' | 'validator';
  mcpServerUrl?: string;
  worktreePath?: string;
  capabilities: string[];
  maxConcurrentTasks: number;
}

export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected state: AgentState = 'idle';
  protected mcpClient?: Client;
  protected currentTask?: Task;
  protected metrics = {
    tasksCompleted: 0,
    tasksFailed: 0,
    uptime: Date.now(),
    totalTaskTime: 0
  };
  private heartbeatInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    logger.info(`Agent-${this.config.id}`, 'Initializing agent');
    
    try {
      // Connect to MCP server
      await this.connectToMCPServer();
      
      // Initialize agent-specific components
      await this.onInitialize();
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Update state
      this.setState('idle');
      
      logger.info(`Agent-${this.config.id}`, 'Agent initialized successfully');
    } catch (error) {
      logger.error(`Agent-${this.config.id}`, 'Failed to initialize', error);
      this.setState('error');
      throw error;
    }
  }

  private async connectToMCPServer(): Promise<void> {
    this.mcpClient = new Client({
      name: `agent-${this.config.id}`,
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    const transport = new StdioClientTransport({
      command: 'tsx',
      args: ['src/coordination/mcp-server.ts']
    });

    await this.mcpClient.connect(transport);
    logger.info(`Agent-${this.config.id}`, 'Connected to MCP server');
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.updateAgentInfo();
      } catch (error) {
        logger.error(`Agent-${this.config.id}`, 'Heartbeat failed', error);
      }
    }, config.recovery.healthCheckInterval);
  }

  protected async updateAgentInfo(): Promise<void> {
    if (!this.mcpClient) return;

    const info: AgentInfo = {
      id: this.config.id,
      type: this.config.type,
      state: this.state,
      currentTask: this.currentTask?.id,
      lastHeartbeat: new Date().toISOString(),
      metrics: {
        tasksCompleted: this.metrics.tasksCompleted,
        tasksFailed: this.metrics.tasksFailed,
        uptime: Date.now() - this.metrics.uptime,
        averageTaskTime: this.metrics.tasksCompleted > 0 
          ? this.metrics.totalTaskTime / this.metrics.tasksCompleted 
          : 0
      }
    };

    await this.mcpClient.callTool('update_context', {
      updates: {
        [`agentStates.${this.config.id}`]: info
      },
      agentId: this.config.id
    });
  }

  protected setState(state: AgentState): void {
    const oldState = this.state;
    this.state = state;
    
    if (oldState !== state) {
      logger.info(`Agent-${this.config.id}`, `State changed: ${oldState} -> ${state}`);
      this.emit('stateChanged', { oldState, newState: state });
    }
  }

  async executeTask(task: Task): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error(`Agent is not idle (current state: ${this.state})`);
    }

    logger.info(`Agent-${this.config.id}`, `Starting task ${task.id}`, task);
    
    this.currentTask = task;
    this.setState('working');
    
    const startTime = Date.now();
    
    try {
      // Update task status
      await this.updateTaskStatus(task.id, 'in_progress');
      
      // Execute agent-specific task logic
      const result = await this.onExecuteTask(task);
      
      // Update task completion
      await this.updateTaskStatus(task.id, 'completed', result);
      
      // Update metrics
      const taskTime = Date.now() - startTime;
      this.metrics.tasksCompleted++;
      this.metrics.totalTaskTime += taskTime;
      
      logger.info(`Agent-${this.config.id}`, `Completed task ${task.id} in ${taskTime}ms`);
    } catch (error) {
      logger.error(`Agent-${this.config.id}`, `Failed to execute task ${task.id}`, error);
      
      // Update task failure
      await this.updateTaskStatus(task.id, 'failed', undefined, error instanceof Error ? error.message : 'Unknown error');
      
      // Update metrics
      this.metrics.tasksFailed++;
      
      throw error;
    } finally {
      this.currentTask = undefined;
      this.setState('idle');
    }
  }

  protected async updateTaskStatus(
    taskId: string, 
    status: 'in_progress' | 'completed' | 'failed',
    result?: any,
    error?: string
  ): Promise<void> {
    if (!this.mcpClient) return;

    const updates: any = {
      [`tasks.${taskId}.status`]: status,
      [`tasks.${taskId}.updatedAt`]: new Date().toISOString()
    };

    if (status === 'completed') {
      updates[`tasks.${taskId}.completedAt`] = new Date().toISOString();
      if (result !== undefined) {
        updates[`tasks.${taskId}.result`] = result;
      }
    } else if (status === 'failed' && error) {
      updates[`tasks.${taskId}.error`] = error;
    }

    await this.mcpClient.callTool('update_context', {
      updates,
      agentId: this.config.id
    });
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info(`Agent-${this.config.id}`, 'Shutting down agent');
    
    try {
      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      // Set state to offline
      this.setState('offline');
      await this.updateAgentInfo();

      // Agent-specific shutdown
      await this.onShutdown();

      // Disconnect from MCP server
      if (this.mcpClient) {
        await this.mcpClient.close();
      }

      logger.info(`Agent-${this.config.id}`, 'Agent shut down successfully');
    } catch (error) {
      logger.error(`Agent-${this.config.id}`, 'Error during shutdown', error);
      throw error;
    }
  }

  // Abstract methods to be implemented by specific agents
  protected abstract onInitialize(): Promise<void>;
  protected abstract onExecuteTask(task: Task): Promise<any>;
  protected abstract onShutdown(): Promise<void>;

  // Helper methods for agents
  protected async storeInRAG(content: string, metadata: Record<string, any>): Promise<void> {
    if (!this.mcpClient) throw new Error('MCP client not connected');

    await this.mcpClient.callTool('rag_store', {
      content,
      metadata: {
        ...metadata,
        agentId: this.config.id,
        timestamp: new Date().toISOString()
      }
    });
  }

  protected async queryRAG(query: string, maxResults: number = 10): Promise<any> {
    if (!this.mcpClient) throw new Error('MCP client not connected');

    const result = await this.mcpClient.callTool('rag_query', {
      query,
      maxResults
    });

    return JSON.parse(result.content[0].text);
  }

  protected async getContext(keys?: string[]): Promise<any> {
    if (!this.mcpClient) throw new Error('MCP client not connected');

    const result = await this.mcpClient.callTool('get_context', {
      keys
    });

    return JSON.parse(result.content[0].text);
  }

  protected async updateContext(updates: Record<string, any>): Promise<void> {
    if (!this.mcpClient) throw new Error('MCP client not connected');

    await this.mcpClient.callTool('update_context', {
      updates,
      agentId: this.config.id
    });
  }

  // Public getters
  getId(): string {
    return this.config.id;
  }

  getType(): string {
    return this.config.type;
  }

  getState(): AgentState {
    return this.state;
  }

  getCurrentTask(): Task | undefined {
    return this.currentTask;
  }

  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }
}