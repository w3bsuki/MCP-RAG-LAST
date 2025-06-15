#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();

program
  .name('mcp-rag')
  .description('CLI for MCP/RAG Autonomous Agent System')
  .version(packageJson.version);

// Start command
program
  .command('start')
  .description('Start the MCP/RAG system')
  .option('-m, --mode <mode>', 'Automation mode (observer|assistant|semi-auto|full-auto)', 'assistant')
  .option('-a, --agents <agents>', 'Comma-separated list of agents to start', 'auditor,implementer,validator')
  .option('-d, --dashboard', 'Start with dashboard', false)
  .action(async (options) => {
    console.log(chalk.cyan.bold('\n🚀 Starting MCP/RAG System...\n'));

    const configPath = path.join(process.cwd(), 'mcp-rag.config.json');
    if (!fs.existsSync(configPath)) {
      console.error(chalk.red('❌ No MCP/RAG configuration found. Run "npx create-mcp-rag" first.'));
      process.exit(1);
    }

    const config = await fs.readJson(configPath);
    
    // Start the system
    const spinner = ora('Launching agents...').start();
    
    try {
      const env = {
        ...process.env,
        AUTOMATION_LEVEL: options.mode,
        ENABLED_AGENTS: options.agents
      };

      const proc = spawn('npm', ['start'], {
        cwd: process.cwd(),
        env,
        stdio: 'inherit'
      });

      spinner.succeed('System started');

      if (options.dashboard) {
        console.log(chalk.cyan('\n📊 Dashboard available at: http://localhost:3001\n'));
        spawn('npm', ['run', 'dashboard'], {
          cwd: process.cwd(),
          stdio: 'ignore'
        });
      }

      proc.on('exit', (code) => {
        process.exit(code || 0);
      });

    } catch (error) {
      spinner.fail('Failed to start system');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Monitor command
program
  .command('monitor')
  .description('Open the system monitor')
  .action(() => {
    console.log(chalk.cyan('\n📊 Opening system monitor...\n'));
    
    const proc = spawn('npm', ['run', 'monitor'], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    proc.on('exit', (code) => {
      process.exit(code || 0);
    });
  });

// Config command
program
  .command('config')
  .description('Configure the MCP/RAG system')
  .action(async () => {
    const inquirer = (await import('inquirer')).default;
    
    console.log(chalk.cyan.bold('\n⚙️  MCP/RAG Configuration\n'));

    const configPath = path.join(process.cwd(), 'mcp-rag.config.json');
    const currentConfig = fs.existsSync(configPath) 
      ? await fs.readJson(configPath)
      : {};

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'automationLevel',
        message: 'Select automation level:',
        choices: [
          { name: 'Observer Mode', value: 'observer' },
          { name: 'Assistant Mode', value: 'assistant' },
          { name: 'Semi-Auto', value: 'semi-auto' },
          { name: 'Full Auto', value: 'full-auto' }
        ],
        default: currentConfig.automationLevel || 'assistant'
      },
      {
        type: 'checkbox',
        name: 'agents',
        message: 'Which agents to enable?',
        choices: [
          { name: 'Auditor', value: 'auditor', checked: true },
          { name: 'Implementer', value: 'implementer', checked: true },
          { name: 'Validator', value: 'validator', checked: true }
        ],
        default: currentConfig.agents || ['auditor', 'implementer', 'validator']
      },
      {
        type: 'confirm',
        name: 'dashboard',
        message: 'Enable web dashboard?',
        default: currentConfig.dashboard !== false
      }
    ]);

    const newConfig = { ...currentConfig, ...answers };
    await fs.writeJson(configPath, newConfig, { spaces: 2 });

    console.log(chalk.green('\n✅ Configuration saved!\n'));
  });

// Status command
program
  .command('status')
  .description('Check system status')
  .action(async () => {
    console.log(chalk.cyan.bold('\n📊 System Status\n'));

    const checks = [
      { name: 'Node.js version', check: () => process.version, required: 'v18+' },
      { name: 'Configuration', check: () => fs.existsSync('mcp-rag.config.json') ? '✓' : '✗' },
      { name: 'Dependencies', check: () => fs.existsSync('node_modules') ? '✓' : '✗' },
      { name: 'Git repository', check: () => fs.existsSync('.git') ? '✓' : '✗' },
      { name: 'Milvus connection', check: async () => {
        // Check if Milvus is running
        try {
          const response = await fetch('http://localhost:9091/healthz');
          return response.ok ? '✓' : '✗';
        } catch {
          return '✗';
        }
      }}
    ];

    for (const check of checks) {
      const result = await check.check();
      const status = result === '✓' ? chalk.green(result) : 
                     result === '✗' ? chalk.red(result) : 
                     chalk.yellow(result);
      console.log(`${check.name}: ${status} ${check.required ? `(${check.required})` : ''}`);
    }

    console.log('');
  });

// Logs command
program
  .command('logs [agent]')
  .description('View agent logs')
  .action((agent) => {
    const logPath = path.join(process.cwd(), 'logs');
    
    if (!fs.existsSync(logPath)) {
      console.error(chalk.red('No logs directory found'));
      process.exit(1);
    }

    const logFiles = fs.readdirSync(logPath)
      .filter(f => f.endsWith('.log'))
      .sort((a, b) => b.localeCompare(a));

    if (logFiles.length === 0) {
      console.log(chalk.yellow('No log files found'));
      return;
    }

    const latestLog = path.join(logPath, logFiles[0]);
    
    if (agent) {
      // Filter logs for specific agent
      spawn('tail', ['-f', latestLog], {
        stdio: 'pipe'
      }).stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (line.toLowerCase().includes(agent.toLowerCase())) {
            console.log(line);
          }
        });
      });
    } else {
      // Show all logs
      spawn('tail', ['-f', latestLog], {
        stdio: 'inherit'
      });
    }
  });

// Stop command
program
  .command('stop')
  .description('Stop the MCP/RAG system')
  .action(() => {
    console.log(chalk.yellow('\n⏹️  Stopping MCP/RAG system...\n'));
    
    // Find and kill all related processes
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/F', '/IM', 'node.exe'], { stdio: 'ignore' });
      } else {
        spawn('pkill', ['-f', 'mcp-rag'], { stdio: 'ignore' });
      }
      
      console.log(chalk.green('✅ System stopped\n'));
    } catch (error) {
      console.error(chalk.red('Failed to stop system:', error.message));
    }
  });

program.parse();