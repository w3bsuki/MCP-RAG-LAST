import { spawn, ChildProcess } from 'child_process';
import { getRoleConfig, RoleConfig } from '../types/roles.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ClaudeInstance {
  role: string;
  process?: ChildProcess;
  config: RoleConfig;
  logFile: string;
}

export class ClaudeCodeLauncher {
  private instances: Map<string, ClaudeInstance> = new Map();
  private mcpServerUrl: string;

  constructor(mcpServerUrl: string = 'http://localhost:3000') {
    this.mcpServerUrl = mcpServerUrl;
  }

  async launchInstance(roleName: 'auditor' | 'implementer' | 'validator'): Promise<void> {
    if (this.instances.has(roleName)) {
      logger.warn('ClaudeCodeLauncher', `Instance for role ${roleName} already running`);
      return;
    }

    const roleConfig = getRoleConfig(roleName);
    const instanceId = `claude-${roleName}-${Date.now()}`;
    const logFile = path.join('logs', `${roleName}-${new Date().toISOString().split('T')[0]}.log`);

    // Ensure logs directory exists
    await fs.mkdir('logs', { recursive: true });

    // Create role-specific configuration file
    const configPath = path.join('configs', `${roleName}.config.json`);
    await fs.mkdir('configs', { recursive: true });
    
    const instanceConfig = {
      instanceId,
      role: roleName,
      roleConfig,
      mcpServerUrl: this.mcpServerUrl,
      mcpConfigPath: '.claude/config.json',
      taskCheckInterval: roleConfig.checkInterval * 1000, // Convert to ms
      prompts: roleConfig.prompts
    };

    await fs.writeFile(configPath, JSON.stringify(instanceConfig, null, 2));

    // Create MCP config for Claude-Code
    const mcpConfig = {
      servers: {
        "mcp-rag": {
          command: "tsx",
          args: ["src/coordination/mcp-server-v2.ts"],
          env: {
            CLAUDE_INSTANCE_ID: instanceId,
            CLAUDE_ROLE: roleName
          }
        }
      }
    };

    await fs.mkdir('.claude', { recursive: true });
    await fs.writeFile('.claude/config.json', JSON.stringify(mcpConfig, null, 2));

    // Create initialization prompt file
    const initPromptPath = path.join('prompts', `${roleName}-init.md`);
    await fs.mkdir('prompts', { recursive: true });
    
    const initPrompt = `# You are operating as: ${roleConfig.name}

${roleConfig.prompts.initialization}

## Your Configuration
- Instance ID: ${instanceId}
- Role: ${roleName}
- Task Check Interval: ${roleConfig.checkInterval} seconds
- Max Concurrent Tasks: ${roleConfig.maxConcurrentTasks}

## Available MCP Tools
${roleConfig.tools.map(tool => `- ${tool}`).join('\n')}

## Task Selection Criteria
${roleConfig.prompts.taskSelection}

## Task Execution Guidelines
${roleConfig.prompts.taskExecution}

## Coordination Strategy
${roleConfig.prompts.coordination}

## Rules to Follow
${roleConfig.rules.map(rule => `- ${rule}`).join('\n')}

## Constraints
${roleConfig.constraints.map(constraint => `- ${constraint}`).join('\n')}

## Getting Started
1. Use 'get_tasks' to see available tasks matching your role
2. Use 'claim_task' to assign a task to yourself
3. Work on the task following the guidelines above
4. Use 'update_task' to track progress
5. Use 'complete_task' when done
6. Use 'create_task' to create follow-up tasks for other roles

Start by checking for available tasks with:
\`\`\`
get_tasks({
  tags: ${JSON.stringify(roleConfig.watchTags)},
  excludeTags: ${JSON.stringify(roleConfig.ignoreTags)},
  status: ["pending"]
})
\`\`\`
`;

    await fs.writeFile(initPromptPath, initPrompt);

    // Launch Claude-Code instance
    logger.info('ClaudeCodeLauncher', `Launching Claude-Code instance for ${roleName}`);

    // Note: This assumes 'claude' CLI is installed and available
    // In reality, you might need to adjust this based on your setup
    const claudeProcess = spawn('claude', [
      'code',
      '--mcp-config', '.claude/config.json',
      '--init-prompt', initPromptPath,
      '--log-file', logFile
    ], {
      env: {
        ...process.env,
        CLAUDE_INSTANCE_ID: instanceId,
        CLAUDE_ROLE: roleName,
        MCP_SERVER_URL: this.mcpServerUrl
      },
      detached: false
    });

    claudeProcess.stdout?.on('data', (data) => {
      logger.info(`Claude-${roleName}`, data.toString().trim());
    });

    claudeProcess.stderr?.on('data', (data) => {
      logger.error(`Claude-${roleName}`, data.toString().trim());
    });

    claudeProcess.on('exit', (code) => {
      logger.info('ClaudeCodeLauncher', `Claude-Code ${roleName} exited with code ${code}`);
      this.instances.delete(roleName);
    });

    this.instances.set(roleName, {
      role: roleName,
      process: claudeProcess,
      config: roleConfig,
      logFile
    });

    logger.info('ClaudeCodeLauncher', `Claude-Code ${roleName} launched successfully`);
  }

  async launchAll(): Promise<void> {
    logger.info('ClaudeCodeLauncher', 'Launching all Claude-Code instances');
    
    // Launch in sequence with delays to prevent resource contention
    await this.launchInstance('auditor');
    await this.delay(5000);
    
    await this.launchInstance('implementer');
    await this.delay(5000);
    
    await this.launchInstance('validator');
    
    logger.info('ClaudeCodeLauncher', 'All Claude-Code instances launched');
  }

  async stopInstance(roleName: string): Promise<void> {
    const instance = this.instances.get(roleName);
    if (!instance || !instance.process) {
      logger.warn('ClaudeCodeLauncher', `No running instance for role ${roleName}`);
      return;
    }

    logger.info('ClaudeCodeLauncher', `Stopping Claude-Code ${roleName}`);
    instance.process.kill('SIGTERM');
    
    // Give it time to gracefully shutdown
    await this.delay(5000);
    
    if (!instance.process.killed) {
      instance.process.kill('SIGKILL');
    }
    
    this.instances.delete(roleName);
  }

  async stopAll(): Promise<void> {
    logger.info('ClaudeCodeLauncher', 'Stopping all Claude-Code instances');
    
    for (const [roleName] of this.instances) {
      await this.stopInstance(roleName);
    }
  }

  getStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [roleName, instance] of this.instances) {
      status[roleName] = {
        running: instance.process && !instance.process.killed,
        pid: instance.process?.pid,
        logFile: instance.logFile
      };
    }
    
    return status;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const launcher = new ClaudeCodeLauncher();
  const command = process.argv[2];

  switch (command) {
    case 'start':
      const role = process.argv[3];
      if (role && ['auditor', 'implementer', 'validator'].includes(role)) {
        launcher.launchInstance(role as any).catch(console.error);
      } else {
        launcher.launchAll().catch(console.error);
      }
      break;
      
    case 'stop':
      launcher.stopAll().then(() => process.exit(0)).catch(console.error);
      break;
      
    case 'status':
      console.log(JSON.stringify(launcher.getStatus(), null, 2));
      break;
      
    default:
      console.log(`Usage: tsx launcher.ts [start|stop|status] [role?]`);
      process.exit(1);
  }
}