import { ContextManager } from './context/context-manager.js';
import { RecoverySystem } from './recovery/recovery-system.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import * as process from 'process';

interface SystemMetrics {
  timestamp: string;
  agents: {
    total: number;
    healthy: number;
    unhealthy: number;
    states: Record<string, string>;
  };
  tasks: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    avgCompletionTime: number;
  };
  performance: {
    contextSyncLatency: number;
    ragQueryTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  uptime: number;
}

export class Monitor {
  private contextManager: ContextManager;
  private recoverySystem?: RecoverySystem;
  private metrics: SystemMetrics[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private displayInterval?: NodeJS.Timeout;
  private startTime = Date.now();

  constructor() {
    this.contextManager = new ContextManager();
  }

  async initialize(): Promise<void> {
    logger.info('Monitor', 'Initializing system monitor');
    
    await this.contextManager.initialize();
    
    // Clear console for dashboard
    console.clear();
    
    logger.info('Monitor', 'Monitor initialized');
  }

  async start(): Promise<void> {
    logger.info('Monitor', 'Starting monitoring');
    
    // Collect metrics every 5 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000);
    
    // Update display every second
    this.displayInterval = setInterval(() => {
      this.updateDisplay();
    }, 1000);
    
    // Initial collection and display
    await this.collectMetrics();
    this.updateDisplay();
  }

  async stop(): Promise<void> {
    logger.info('Monitor', 'Stopping monitoring');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const context = await this.contextManager.getContext();
      const memUsage = process.memoryUsage();
      
      const metrics: SystemMetrics = {
        timestamp: new Date().toISOString(),
        agents: this.analyzeAgents(context.agentStates || {}),
        tasks: this.analyzeTasks(context.taskQueue || []),
        performance: {
          contextSyncLatency: this.measureContextLatency(context),
          ragQueryTime: 0, // Would be tracked from actual queries
          memoryUsage: memUsage.heapUsed,
          cpuUsage: process.cpuUsage().user / 1000000 // Convert to seconds
        },
        uptime: Date.now() - this.startTime
      };
      
      this.metrics.push(metrics);
      
      // Keep only last 100 metrics
      if (this.metrics.length > 100) {
        this.metrics.shift();
      }
      
      // Check for alerts
      this.checkAlerts(metrics);
    } catch (error) {
      logger.error('Monitor', 'Failed to collect metrics', error);
    }
  }

  private analyzeAgents(agentStates: Record<string, any>): any {
    const states: Record<string, string> = {};
    let healthy = 0;
    let unhealthy = 0;
    
    for (const [id, info] of Object.entries(agentStates)) {
      states[id] = info.state;
      
      if (info.state === 'idle' || info.state === 'working') {
        healthy++;
      } else {
        unhealthy++;
      }
    }
    
    return {
      total: Object.keys(agentStates).length,
      healthy,
      unhealthy,
      states
    };
  }

  private analyzeTasks(taskQueue: any[]): any {
    const statusCounts = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0
    };
    
    let totalCompletionTime = 0;
    let completedCount = 0;
    
    for (const task of taskQueue) {
      statusCounts[task.status as keyof typeof statusCounts]++;
      
      if (task.status === 'completed' && task.completedAt && task.createdAt) {
        const completionTime = new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime();
        totalCompletionTime += completionTime;
        completedCount++;
      }
    }
    
    return {
      total: taskQueue.length,
      ...statusCounts,
      avgCompletionTime: completedCount > 0 ? totalCompletionTime / completedCount : 0
    };
  }

  private measureContextLatency(context: any): number {
    if (!context.lastUpdated) return 0;
    
    const lastUpdate = new Date(context.lastUpdated).getTime();
    return Date.now() - lastUpdate;
  }

  private checkAlerts(metrics: SystemMetrics): void {
    // Check for unhealthy agents
    if (metrics.agents.unhealthy > 0) {
      logger.warn('Monitor', `${metrics.agents.unhealthy} unhealthy agents detected`);
    }
    
    // Check for high task failure rate
    const failureRate = metrics.tasks.failed / metrics.tasks.total;
    if (failureRate > 0.1 && metrics.tasks.total > 10) {
      logger.warn('Monitor', `High task failure rate: ${(failureRate * 100).toFixed(1)}%`);
    }
    
    // Check memory usage
    if (metrics.performance.memoryUsage > config.performance.maxMemoryUsage) {
      logger.warn('Monitor', `Memory usage exceeds threshold: ${(metrics.performance.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
    }
    
    // Check context sync latency
    if (metrics.performance.contextSyncLatency > config.performance.contextSyncMaxLatency) {
      logger.warn('Monitor', `Context sync latency high: ${metrics.performance.contextSyncLatency}ms`);
    }
  }

  private updateDisplay(): void {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return;
    
    // Clear and redraw dashboard
    console.clear();
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           AUTONOMOUS MCP/RAG SYSTEM MONITOR                    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    // System Status
    const uptimeHours = Math.floor(latest.uptime / 3600000);
    const uptimeMinutes = Math.floor((latest.uptime % 3600000) / 60000);
    console.log(`📊 SYSTEM STATUS`);
    console.log(`   Uptime: ${uptimeHours}h ${uptimeMinutes}m`);
    console.log(`   Memory: ${(latest.performance.memoryUsage / 1024 / 1024).toFixed(1)}MB / ${(config.performance.maxMemoryUsage / 1024 / 1024).toFixed(0)}MB`);
    console.log(`   CPU Time: ${latest.performance.cpuUsage.toFixed(1)}s`);
    console.log('');
    
    // Agent Status
    console.log(`🤖 AGENTS (${latest.agents.total} total)`);
    console.log(`   ✅ Healthy: ${latest.agents.healthy}`);
    console.log(`   ❌ Unhealthy: ${latest.agents.unhealthy}`);
    
    for (const [id, state] of Object.entries(latest.agents.states)) {
      const icon = state === 'idle' ? '🟢' : state === 'working' ? '🔵' : state === 'error' ? '🔴' : '⚫';
      console.log(`   ${icon} ${id}: ${state}`);
    }
    console.log('');
    
    // Task Status
    console.log(`📋 TASKS (${latest.tasks.total} total)`);
    console.log(`   ⏳ Pending: ${latest.tasks.pending}`);
    console.log(`   🔄 In Progress: ${latest.tasks.inProgress}`);
    console.log(`   ✅ Completed: ${latest.tasks.completed}`);
    console.log(`   ❌ Failed: ${latest.tasks.failed}`);
    
    if (latest.tasks.completed > 0) {
      const avgTime = latest.tasks.avgCompletionTime / 1000; // Convert to seconds
      console.log(`   ⏱️  Avg Completion: ${avgTime.toFixed(1)}s`);
    }
    
    const completionRate = latest.tasks.total > 0 
      ? (latest.tasks.completed / latest.tasks.total * 100).toFixed(1)
      : 0;
    console.log(`   📈 Completion Rate: ${completionRate}%`);
    console.log('');
    
    // Performance Metrics
    console.log(`⚡ PERFORMANCE`);
    console.log(`   Context Sync: ${latest.performance.contextSyncLatency}ms`);
    console.log(`   RAG Query: ${latest.performance.ragQueryTime}ms`);
    console.log('');
    
    // Recent Alerts
    const recentAlerts = this.getRecentAlerts();
    if (recentAlerts.length > 0) {
      console.log(`🚨 RECENT ALERTS`);
      recentAlerts.forEach(alert => {
        console.log(`   - ${alert}`);
      });
      console.log('');
    }
    
    console.log('─'.repeat(66));
    console.log('Press Ctrl+C to exit');
  }

  private getRecentAlerts(): string[] {
    // In a real implementation, this would track actual alerts
    const alerts: string[] = [];
    
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return alerts;
    
    if (latest.agents.unhealthy > 0) {
      alerts.push(`${latest.agents.unhealthy} agents are unhealthy`);
    }
    
    if (latest.performance.memoryUsage > config.performance.maxMemoryUsage * 0.8) {
      alerts.push('Memory usage approaching limit');
    }
    
    return alerts;
  }

  // API methods for external monitoring
  getLatestMetrics(): SystemMetrics | undefined {
    return this.metrics[this.metrics.length - 1];
  }

  getMetricsHistory(): SystemMetrics[] {
    return [...this.metrics];
  }

  getHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const latest = this.getLatestMetrics();
    if (!latest) return 'unhealthy';
    
    if (latest.agents.unhealthy > 0) return 'unhealthy';
    if (latest.tasks.failed > latest.tasks.completed * 0.1) return 'degraded';
    if (latest.performance.memoryUsage > config.performance.maxMemoryUsage * 0.9) return 'degraded';
    
    return 'healthy';
  }
}

// Main entry point for standalone monitor
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new Monitor();
  
  process.on('SIGINT', async () => {
    await monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await monitor.stop();
    process.exit(0);
  });
  
  monitor.initialize()
    .then(() => monitor.start())
    .catch((error) => {
      logger.error('Monitor', 'Fatal error', error);
      process.exit(1);
    });
}