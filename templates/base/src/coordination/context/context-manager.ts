import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { SharedContext, SharedContextSchema } from '../../types/index.js';
import { EventEmitter } from 'events';

export class ContextManager extends EventEmitter {
  private context: SharedContext;
  private contextPath: string;
  private backupPath: string;
  private updateQueue: Array<{ updates: Record<string, any>; agentId: string }> = [];
  private isProcessing = false;
  private lastUpdate: number = Date.now();

  constructor() {
    super();
    this.contextPath = config.context.filePath;
    this.backupPath = `${this.contextPath}.backup`;
    
    this.context = this.createEmptyContext();
  }

  private createEmptyContext(): SharedContext {
    return {
      version: 1,
      taskQueue: [],
      agentStates: {},
      globalState: {},
      lastUpdated: new Date().toISOString()
    };
  }

  async initialize(): Promise<void> {
    logger.info('ContextManager', 'Initializing context manager');
    
    try {
      if (existsSync(this.contextPath)) {
        const data = readFileSync(this.contextPath, 'utf8');
        const parsed = JSON.parse(data);
        this.context = SharedContextSchema.parse(parsed);
        logger.info('ContextManager', 'Loaded existing context', { version: this.context.version });
      } else {
        await this.saveContext();
        logger.info('ContextManager', 'Created new context file');
      }
      
      // Start the update processor
      this.startUpdateProcessor();
    } catch (error) {
      logger.error('ContextManager', 'Failed to initialize context', error);
      
      // Try to recover from backup
      if (existsSync(this.backupPath)) {
        logger.info('ContextManager', 'Attempting to recover from backup');
        try {
          const backupData = readFileSync(this.backupPath, 'utf8');
          this.context = SharedContextSchema.parse(JSON.parse(backupData));
          await this.saveContext();
          logger.info('ContextManager', 'Recovered from backup successfully');
        } catch (backupError) {
          logger.error('ContextManager', 'Failed to recover from backup', backupError);
          throw new Error('Failed to initialize context manager');
        }
      } else {
        throw error;
      }
    }
  }

  private startUpdateProcessor(): void {
    setInterval(() => {
      if (!this.isProcessing && this.updateQueue.length > 0) {
        this.processUpdateQueue();
      }
    }, 100); // Check every 100ms
  }

  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessing || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const updates = [...this.updateQueue];
    this.updateQueue = [];

    try {
      // Apply all updates
      for (const update of updates) {
        this.applyUpdate(update.updates, update.agentId);
      }

      // Save context
      await this.saveContext();
      
      // Check performance
      const updateLatency = Date.now() - this.lastUpdate;
      if (updateLatency > config.performance.contextSyncMaxLatency) {
        logger.warn('ContextManager', `Update latency exceeded threshold: ${updateLatency}ms`);
      }
      
      this.lastUpdate = Date.now();
      
      // Emit update event
      this.emit('contextUpdated', this.context);
    } catch (error) {
      logger.error('ContextManager', 'Failed to process update queue', error);
      // Re-add updates to queue for retry
      this.updateQueue.unshift(...updates);
    } finally {
      this.isProcessing = false;
    }
  }

  private applyUpdate(updates: Record<string, any>, agentId: string): void {
    logger.debug('ContextManager', `Applying updates from agent ${agentId}`, updates);
    
    // Update version
    this.context.version++;
    
    // Apply updates to globalState
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined) {
        delete this.context.globalState[key];
      } else {
        this.context.globalState[key] = value;
      }
    }
    
    // Update timestamp
    this.context.lastUpdated = new Date().toISOString();
    
    // Update agent heartbeat if it's an agent state update
    if (this.context.agentStates[agentId]) {
      this.context.agentStates[agentId].lastHeartbeat = new Date().toISOString();
    }
  }

  async updateContext(updates: Record<string, any>, agentId: string): Promise<void> {
    this.updateQueue.push({ updates, agentId });
    
    // If update interval has passed, trigger immediate processing
    if (Date.now() - this.lastUpdate >= config.context.updateInterval) {
      await this.processUpdateQueue();
    }
  }

  async getContext(keys?: string[]): Promise<Partial<SharedContext> | any> {
    if (!keys || keys.length === 0) {
      return this.context;
    }

    const result: Record<string, any> = {};
    
    for (const key of keys) {
      if (key === 'version') result.version = this.context.version;
      else if (key === 'currentTask') result.currentTask = this.context.currentTask;
      else if (key === 'taskQueue') result.taskQueue = this.context.taskQueue;
      else if (key === 'agentStates') result.agentStates = this.context.agentStates;
      else if (key === 'lastUpdated') result.lastUpdated = this.context.lastUpdated;
      else if (key.startsWith('globalState.')) {
        const globalKey = key.substring('globalState.'.length);
        result[key] = this.context.globalState[globalKey];
      }
    }
    
    return result;
  }

  private async saveContext(): Promise<void> {
    try {
      // Create backup if enabled
      if (config.context.backupEnabled && existsSync(this.contextPath)) {
        renameSync(this.contextPath, this.backupPath);
      }
      
      // Write atomically
      const tempPath = `${this.contextPath}.tmp`;
      writeFileSync(tempPath, JSON.stringify(this.context, null, 2), 'utf8');
      renameSync(tempPath, this.contextPath);
      
      logger.debug('ContextManager', 'Context saved', { version: this.context.version });
    } catch (error) {
      logger.error('ContextManager', 'Failed to save context', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    logger.info('ContextManager', 'Shutting down context manager');
    
    // Process any remaining updates
    if (this.updateQueue.length > 0) {
      await this.processUpdateQueue();
    }
    
    // Final save
    await this.saveContext();
    
    this.removeAllListeners();
  }

  // Helper methods for specific context operations
  async addTask(task: any): Promise<void> {
    await this.updateContext({
      'taskQueue': [...this.context.taskQueue, task]
    }, 'system');
  }

  async updateAgentState(agentId: string, state: any): Promise<void> {
    await this.updateContext({
      [`agentStates.${agentId}`]: state
    }, agentId);
  }

  async setCurrentTask(task: any): Promise<void> {
    await this.updateContext({
      'currentTask': task
    }, 'system');
  }
}