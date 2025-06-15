import { spawn, ChildProcess } from 'child_process';
import { logger } from '../src/utils/logger.js';
import { existsSync } from 'fs';
import { join } from 'path';
import simpleGit from 'simple-git';
import { config } from '../src/config/index.js';

interface SystemComponent {
  name: string;
  command: string;
  args: string[];
  process?: ChildProcess;
  startTime?: number;
  status: 'stopped' | 'starting' | 'running' | 'error';
  restartOnFailure: boolean;
}

class SystemLauncher {
  private components: SystemComponent[] = [
    {
      name: 'mcp-server',
      command: 'tsx',
      args: ['src/coordination/mcp-server.ts'],
      status: 'stopped',
      restartOnFailure: true
    },
    {
      name: 'recovery-system',
      command: 'tsx',
      args: ['src/coordination/recovery/recovery-system.ts'],
      status: 'stopped',
      restartOnFailure: true
    },
    {
      name: 'auditor-agent',
      command: 'tsx',
      args: ['src/agents/auditor/auditor-agent.ts'],
      status: 'stopped',
      restartOnFailure: true
    },
    {
      name: 'implementer-agent',
      command: 'tsx',
      args: ['src/agents/implementer/implementer-agent.ts'],
      status: 'stopped',
      restartOnFailure: true
    },
    {
      name: 'validator-agent',
      command: 'tsx',
      args: ['src/agents/validator/validator-agent.ts'],
      status: 'stopped',
      restartOnFailure: true
    }
  ];

  private isShuttingDown = false;
  private git = simpleGit();

  async launch(): Promise<void> {
    logger.info('SystemLauncher', 'Starting Autonomous MCP/RAG System');
    
    try {
      // Pre-flight checks
      await this.performPreflightChecks();
      
      // Start components in order
      await this.startComponent('mcp-server');
      await this.delay(2000); // Wait for MCP server to initialize
      
      await this.startComponent('recovery-system');
      await this.delay(1000);
      
      // Start agents in parallel
      await Promise.all([
        this.startComponent('auditor-agent'),
        this.startComponent('implementer-agent'),
        this.startComponent('validator-agent')
      ]);
      
      logger.info('SystemLauncher', 'All components started successfully');
      
      // Setup shutdown handlers
      this.setupShutdownHandlers();
      
      // Monitor components
      this.startComponentMonitoring();
      
      // Show status
      this.displaySystemStatus();
      
    } catch (error) {
      logger.error('SystemLauncher', 'Failed to launch system', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  private async performPreflightChecks(): Promise<void> {
    logger.info('SystemLauncher', 'Performing pre-flight checks');
    
    // Check if we're in a git repository
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      throw new Error('Not in a git repository. Please run setup first.');
    }
    
    // Check required directories
    const requiredDirs = [
      'src',
      'agents',
      'worktrees',
      'rag-store',
      'logs'
    ];
    
    for (const dir of requiredDirs) {
      if (!existsSync(dir)) {
        throw new Error(`Required directory missing: ${dir}. Please run setup first.`);
      }
    }
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    if (majorVersion < 18) {
      throw new Error(`Node.js version 18 or higher required. Current: ${nodeVersion}`);
    }
    
    // Check if MCP server port is available
    // (In production, actually check if port is in use)
    
    logger.info('SystemLauncher', 'Pre-flight checks passed');
  }

  private async startComponent(name: string): Promise<void> {
    const component = this.components.find(c => c.name === name);
    if (!component) {
      throw new Error(`Unknown component: ${name}`);
    }
    
    if (component.status === 'running') {
      logger.warn('SystemLauncher', `Component ${name} already running`);
      return;
    }
    
    logger.info('SystemLauncher', `Starting component: ${name}`);
    component.status = 'starting';
    
    try {
      component.process = spawn(component.command, component.args, {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          COMPONENT_NAME: name
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      component.startTime = Date.now();
      
      // Handle stdout
      component.process.stdout?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          logger.info(`${name}`, message);
        }
      });
      
      // Handle stderr
      component.process.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          logger.error(`${name}`, message);
        }
      });
      
      // Handle exit
      component.process.on('exit', (code) => {
        logger.warn('SystemLauncher', `Component ${name} exited with code ${code}`);
        component.status = 'stopped';
        component.process = undefined;
        
        if (!this.isShuttingDown && component.restartOnFailure && code !== 0) {
          logger.info('SystemLauncher', `Attempting to restart ${name}`);
          setTimeout(() => this.startComponent(name), 5000);
        }
      });
      
      // Wait a bit to ensure process started successfully
      await this.delay(500);
      
      if (component.process && !component.process.killed) {
        component.status = 'running';
        logger.info('SystemLauncher', `Component ${name} started successfully`);
      } else {
        throw new Error(`Failed to start component ${name}`);
      }
      
    } catch (error) {
      component.status = 'error';
      logger.error('SystemLauncher', `Failed to start component ${name}`, error);
      throw error;
    }
  }

  private async stopComponent(name: string): Promise<void> {
    const component = this.components.find(c => c.name === name);
    if (!component || !component.process) {
      return;
    }
    
    logger.info('SystemLauncher', `Stopping component: ${name}`);
    
    component.process.kill('SIGTERM');
    
    // Wait for graceful shutdown
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (component.process && !component.process.killed) {
          logger.warn('SystemLauncher', `Force killing component: ${name}`);
          component.process.kill('SIGKILL');
        }
        resolve(null);
      }, 5000);
      
      component.process?.on('exit', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
    
    component.status = 'stopped';
    component.process = undefined;
    logger.info('SystemLauncher', `Component ${name} stopped`);
  }

  private startComponentMonitoring(): void {
    setInterval(() => {
      for (const component of this.components) {
        if (component.status === 'running' && component.process) {
          // Check if process is still alive
          try {
            process.kill(component.process.pid!, 0);
          } catch {
            logger.warn('SystemLauncher', `Component ${component.name} died unexpectedly`);
            component.status = 'stopped';
            component.process = undefined;
            
            if (!this.isShuttingDown && component.restartOnFailure) {
              this.startComponent(component.name);
            }
          }
        }
      }
    }, 5000);
  }

  private displaySystemStatus(): void {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║         AUTONOMOUS MCP/RAG SYSTEM - LAUNCHED                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    console.log('Component Status:');
    for (const component of this.components) {
      const status = component.status === 'running' ? '✅' : '❌';
      const uptime = component.startTime 
        ? `(up ${Math.floor((Date.now() - component.startTime) / 1000)}s)`
        : '';
      console.log(`  ${status} ${component.name.padEnd(20)} ${component.status.padEnd(10)} ${uptime}`);
    }
    
    console.log('\nSystem Commands:');
    console.log('  npm run monitor     - Open system monitor');
    console.log('  npm run debug       - Debug system state');
    console.log('  npm test           - Run system tests');
    console.log('  Ctrl+C             - Graceful shutdown');
    
    console.log('\nSystem is running. Press Ctrl+C to stop.\n');
  }

  private setupShutdownHandlers(): void {
    const shutdownHandler = async () => {
      if (this.isShuttingDown) return;
      
      console.log('\n\nShutting down system...');
      await this.shutdown();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);
  }

  private async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    logger.info('SystemLauncher', 'Shutting down system');
    
    // Stop agents first
    await Promise.all([
      this.stopComponent('auditor-agent'),
      this.stopComponent('implementer-agent'),
      this.stopComponent('validator-agent')
    ]);
    
    // Stop recovery system
    await this.stopComponent('recovery-system');
    
    // Stop MCP server last
    await this.stopComponent('mcp-server');
    
    logger.info('SystemLauncher', 'System shutdown complete');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main entry point
const launcher = new SystemLauncher();
launcher.launch().catch((error) => {
  console.error('Failed to launch system:', error);
  process.exit(1);
});