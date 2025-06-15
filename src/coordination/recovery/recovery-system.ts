import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { AgentInfo, AgentState } from '../../types/index.js';
import { ContextManager } from '../context/context-manager.js';

interface AgentProcess {
  id: string;
  type: 'auditor' | 'implementer' | 'validator';
  process?: ChildProcess;
  startTime: number;
  restartCount: number;
  lastHealthCheck: number;
  isHealthy: boolean;
}

export class RecoverySystem extends EventEmitter {
  private agents: Map<string, AgentProcess> = new Map();
  private contextManager: ContextManager;
  private healthCheckInterval?: NodeJS.Timeout;
  private isRunning = false;
  private recoveryInProgress = false;

  constructor() {
    super();
    this.contextManager = new ContextManager();
  }

  async initialize(): Promise<void> {
    logger.info('RecoverySystem', 'Initializing recovery system');
    
    await this.contextManager.initialize();
    
    // Subscribe to context updates
    this.contextManager.on('contextUpdated', (context) => {
      this.handleContextUpdate(context);
    });
    
    logger.info('RecoverySystem', 'Recovery system initialized');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('RecoverySystem', 'Recovery system already running');
      return;
    }

    logger.info('RecoverySystem', 'Starting recovery system');
    this.isRunning = true;
    
    // Start health check interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, config.recovery.healthCheckInterval);
    
    // Perform initial health check
    await this.performHealthChecks();
    
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    logger.info('RecoverySystem', 'Stopping recovery system');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Stop all agent processes
    for (const [id, agent] of this.agents) {
      await this.stopAgent(id);
    }
    
    this.isRunning = false;
    this.emit('stopped');
  }

  async registerAgent(id: string, type: 'auditor' | 'implementer' | 'validator'): Promise<void> {
    logger.info('RecoverySystem', `Registering agent: ${id} (${type})`);
    
    this.agents.set(id, {
      id,
      type,
      startTime: Date.now(),
      restartCount: 0,
      lastHealthCheck: Date.now(),
      isHealthy: true
    });
  }

  async startAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent ${id} not registered`);
    }

    logger.info('RecoverySystem', `Starting agent: ${id}`);
    
    try {
      // Spawn agent process
      const agentPath = `src/agents/${agent.type}/${agent.type}-agent.ts`;
      const worktreePath = `worktrees/agent-${id}`;
      
      agent.process = spawn('tsx', [agentPath], {
        env: {
          ...process.env,
          AGENT_ID: id,
          AGENT_TYPE: agent.type,
          WORKTREE_PATH: worktreePath
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Handle process events
      agent.process.stdout?.on('data', (data) => {
        logger.debug(`Agent-${id}`, data.toString().trim());
      });
      
      agent.process.stderr?.on('data', (data) => {
        logger.error(`Agent-${id}`, data.toString().trim());
      });
      
      agent.process.on('exit', (code) => {
        logger.warn('RecoverySystem', `Agent ${id} exited with code ${code}`);
        this.handleAgentExit(id, code);
      });
      
      agent.startTime = Date.now();
      agent.isHealthy = true;
      
      // Update context with agent state
      await this.updateAgentState(id, 'idle');
      
      logger.info('RecoverySystem', `Agent ${id} started successfully`);
      this.emit('agentStarted', { id, type: agent.type });
    } catch (error) {
      logger.error('RecoverySystem', `Failed to start agent ${id}`, error);
      throw error;
    }
  }

  async stopAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent || !agent.process) {
      return;
    }

    logger.info('RecoverySystem', `Stopping agent: ${id}`);
    
    // Update state to offline
    await this.updateAgentState(id, 'offline');
    
    // Graceful shutdown
    agent.process.kill('SIGTERM');
    
    // Wait for process to exit
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if not exited
        agent.process?.kill('SIGKILL');
        resolve(null);
      }, 5000);
      
      agent.process?.on('exit', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
    
    agent.process = undefined;
    logger.info('RecoverySystem', `Agent ${id} stopped`);
    this.emit('agentStopped', { id });
  }

  private async performHealthChecks(): Promise<void> {
    if (this.recoveryInProgress) return;
    
    logger.debug('RecoverySystem', 'Performing health checks');
    
    const context = await this.contextManager.getContext(['agentStates']);
    const agentStates = context.agentStates || {};
    
    for (const [id, agent] of this.agents) {
      const agentInfo = agentStates[id] as AgentInfo | undefined;
      await this.checkAgentHealth(agent, agentInfo);
    }
  }

  private async checkAgentHealth(agent: AgentProcess, info?: AgentInfo): Promise<void> {
    const now = Date.now();
    let isHealthy = true;
    
    // Check if process is running
    if (!agent.process || agent.process.killed) {
      isHealthy = false;
      logger.warn('RecoverySystem', `Agent ${agent.id} process not running`);
    }
    
    // Check heartbeat
    if (info) {
      const lastHeartbeat = new Date(info.lastHeartbeat).getTime();
      const heartbeatAge = now - lastHeartbeat;
      
      if (heartbeatAge > config.recovery.healthCheckInterval * 2) {
        isHealthy = false;
        logger.warn('RecoverySystem', `Agent ${agent.id} heartbeat stale: ${heartbeatAge}ms`);
      }
      
      // Check if agent is in error state
      if (info.state === 'error') {
        isHealthy = false;
        logger.warn('RecoverySystem', `Agent ${agent.id} in error state`);
      }
    } else {
      // No agent info in context
      isHealthy = false;
      logger.warn('RecoverySystem', `Agent ${agent.id} not found in context`);
    }
    
    agent.lastHealthCheck = now;
    
    if (isHealthy !== agent.isHealthy) {
      agent.isHealthy = isHealthy;
      this.emit('agentHealthChanged', { id: agent.id, isHealthy });
      
      if (!isHealthy) {
        await this.handleUnhealthyAgent(agent);
      }
    }
  }

  private async handleUnhealthyAgent(agent: AgentProcess): Promise<void> {
    logger.warn('RecoverySystem', `Agent ${agent.id} is unhealthy, attempting recovery`);
    
    if (agent.restartCount >= config.recovery.maxRestartAttempts) {
      logger.error('RecoverySystem', `Agent ${agent.id} exceeded max restart attempts`);
      this.emit('agentFailed', { id: agent.id, reason: 'max_restarts_exceeded' });
      return;
    }
    
    this.recoveryInProgress = true;
    
    try {
      // Stop the agent
      await this.stopAgent(agent.id);
      
      // Wait before restart
      await new Promise(resolve => setTimeout(resolve, config.recovery.restartDelay));
      
      // Restart the agent
      agent.restartCount++;
      await this.startAgent(agent.id);
      
      logger.info('RecoverySystem', `Agent ${agent.id} recovered successfully`);
      this.emit('agentRecovered', { id: agent.id, restartCount: agent.restartCount });
    } catch (error) {
      logger.error('RecoverySystem', `Failed to recover agent ${agent.id}`, error);
      this.emit('agentRecoveryFailed', { id: agent.id, error });
    } finally {
      this.recoveryInProgress = false;
    }
  }

  private async handleAgentExit(id: string, code: number | null): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) return;
    
    logger.warn('RecoverySystem', `Agent ${id} exited with code ${code}`);
    
    // Mark as unhealthy
    agent.isHealthy = false;
    agent.process = undefined;
    
    // Update context
    await this.updateAgentState(id, 'offline');
    
    // Attempt recovery if system is running
    if (this.isRunning && code !== 0) {
      await this.handleUnhealthyAgent(agent);
    }
  }

  private async updateAgentState(id: string, state: AgentState): Promise<void> {
    await this.contextManager.updateContext({
      [`agentStates.${id}.state`]: state,
      [`agentStates.${id}.lastHeartbeat`]: new Date().toISOString()
    }, 'recovery-system');
  }

  private handleContextUpdate(context: any): void {
    // Monitor for critical context changes that might require intervention
    const taskQueue = context.taskQueue || [];
    
    // Check if tasks are piling up
    if (taskQueue.length > 50) {
      logger.warn('RecoverySystem', `Task queue growing large: ${taskQueue.length} tasks`);
      this.emit('taskQueueAlert', { queueLength: taskQueue.length });
    }
  }

  // Public methods for monitoring
  getAgentStatus(id: string): AgentProcess | undefined {
    return this.agents.get(id);
  }

  getAllAgentStatuses(): Map<string, AgentProcess> {
    return new Map(this.agents);
  }

  getSystemHealth(): {
    healthy: number;
    unhealthy: number;
    totalRestarts: number;
    uptime: number;
  } {
    let healthy = 0;
    let unhealthy = 0;
    let totalRestarts = 0;
    
    for (const agent of this.agents.values()) {
      if (agent.isHealthy) healthy++;
      else unhealthy++;
      totalRestarts += agent.restartCount;
    }
    
    return {
      healthy,
      unhealthy,
      totalRestarts,
      uptime: Date.now() - Math.min(...Array.from(this.agents.values()).map(a => a.startTime))
    };
  }
}

// Main entry point for standalone recovery system
if (import.meta.url === `file://${process.argv[1]}`) {
  const recovery = new RecoverySystem();
  
  recovery.on('agentFailed', ({ id, reason }) => {
    logger.error('RecoverySystem', `Agent ${id} failed: ${reason}`);
    // Could send alerts, notifications, etc.
  });
  
  recovery.on('taskQueueAlert', ({ queueLength }) => {
    logger.warn('RecoverySystem', `High task queue: ${queueLength} tasks`);
    // Could trigger scaling actions
  });
  
  process.on('SIGINT', async () => {
    await recovery.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await recovery.stop();
    process.exit(0);
  });
  
  recovery.initialize()
    .then(() => recovery.start())
    .catch((error) => {
      logger.error('RecoverySystem', 'Fatal error', error);
      process.exit(1);
    });
}