#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     🤖 MCP/RAG Autonomous Agent System Installer 🤖      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    if (majorVersion < 18) {
      console.error(chalk.red(`❌ Node.js 18 or higher is required. Current version: ${nodeVersion}`));
      process.exit(1);
    }

    // Interactive configuration
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'What is your project name?',
        default: 'mcp-rag-system',
        validate: (input) => {
          if (!input.match(/^[a-zA-Z0-9-_]+$/)) {
            return 'Project name can only contain letters, numbers, hyphens, and underscores';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'projectType',
        message: 'What type of project are you building?',
        choices: [
          { name: 'Full Stack (React + Node.js)', value: 'fullstack' },
          { name: 'Frontend (React/Vue/Angular)', value: 'frontend' },
          { name: 'Backend (Node.js/Python/Java)', value: 'backend' },
          { name: 'Monorepo (Multiple projects)', value: 'monorepo' },
          { name: 'Custom Configuration', value: 'custom' }
        ]
      },
      {
        type: 'list',
        name: 'milvusSetup',
        message: 'How do you want to set up Milvus (Vector DB)?',
        choices: [
          { name: 'Docker (Recommended)', value: 'docker' },
          { name: 'Milvus Lite (Embedded)', value: 'lite' },
          { name: 'Existing Milvus Server', value: 'existing' },
          { name: 'Skip for now', value: 'skip' }
        ]
      },
      {
        type: 'confirm',
        name: 'enableDashboard',
        message: 'Enable web dashboard?',
        default: true
      },
      {
        type: 'checkbox',
        name: 'agents',
        message: 'Which agents do you want to enable?',
        choices: [
          { name: 'Auditor (Code Analysis)', value: 'auditor', checked: true },
          { name: 'Implementer (Code Generation)', value: 'implementer', checked: true },
          { name: 'Validator (Testing)', value: 'validator', checked: true }
        ]
      },
      {
        type: 'list',
        name: 'automationLevel',
        message: 'Select automation level:',
        choices: [
          { name: 'Observer Mode (Just watch and suggest)', value: 'observer' },
          { name: 'Assistant Mode (Suggest and create tasks)', value: 'assistant' },
          { name: 'Semi-Auto (Implement simple fixes)', value: 'semi-auto' },
          { name: 'Full Auto (Complete autonomy)', value: 'full-auto' }
        ]
      }
    ]);

    // Additional questions based on project type
    if (answers.projectType === 'frontend') {
      const frontendAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'framework',
          message: 'Which frontend framework?',
          choices: ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js']
        }
      ]);
      Object.assign(answers, frontendAnswers);
    }

    // Create project directory
    const projectPath = path.join(process.cwd(), answers.projectName);
    const spinner = ora('Creating project structure...').start();

    try {
      // Copy template files
      await fs.ensureDir(projectPath);
      
      // Copy base system
      const templatePath = path.join(__dirname, '..', 'templates', 'base');
      await fs.copy(templatePath, projectPath);

      // Create configuration
      const config = generateConfig(answers);
      await fs.writeFile(
        path.join(projectPath, '.env'),
        config.env
      );

      await fs.writeJson(
        path.join(projectPath, 'mcp-rag.config.json'),
        config.json,
        { spaces: 2 }
      );

      spinner.succeed('Project structure created');

      // Install dependencies
      spinner.start('Installing dependencies...');
      execSync('npm install', { 
        cwd: projectPath,
        stdio: 'ignore'
      });
      spinner.succeed('Dependencies installed');

      // Setup Milvus if needed
      if (answers.milvusSetup === 'docker') {
        spinner.start('Setting up Milvus with Docker...');
        try {
          execSync('docker --version', { stdio: 'ignore' });
          const milvusScript = `
docker run -d \\
  --name milvus-${answers.projectName} \\
  -p 19530:19530 \\
  -p 9091:9091 \\
  -v milvus_data:/var/lib/milvus \\
  milvusdb/milvus:latest
          `.trim();
          
          await fs.writeFile(
            path.join(projectPath, 'start-milvus.sh'),
            milvusScript,
            { mode: 0o755 }
          );
          
          spinner.succeed('Milvus Docker setup ready (run ./start-milvus.sh to start)');
        } catch (error) {
          spinner.warn('Docker not found. Please install Docker to use Milvus');
        }
      }

      // Initialize git
      spinner.start('Initializing git repository...');
      execSync('git init', { cwd: projectPath, stdio: 'ignore' });
      execSync('git add .', { cwd: projectPath, stdio: 'ignore' });
      execSync('git commit -m "Initial MCP/RAG system setup"', { 
        cwd: projectPath, 
        stdio: 'ignore' 
      });
      spinner.succeed('Git repository initialized');

      // Success message
      console.log(chalk.green.bold('\n✅ Success! Your MCP/RAG system is ready!\n'));
      
      console.log(chalk.cyan('📁 Project created at:'), chalk.white(projectPath));
      console.log(chalk.cyan('\n🚀 Get started with:\n'));
      console.log(chalk.white(`   cd ${answers.projectName}`));
      
      if (answers.milvusSetup === 'docker') {
        console.log(chalk.white('   ./start-milvus.sh    # Start Milvus'));
      }
      
      console.log(chalk.white('   npm run setup        # Initialize system'));
      console.log(chalk.white('   npm start            # Launch agents'));
      
      if (answers.enableDashboard) {
        console.log(chalk.white('   npm run dashboard    # Open web dashboard'));
      }
      
      console.log(chalk.cyan('\n📚 Documentation:'));
      console.log(chalk.white('   - README.md          # Getting started'));
      console.log(chalk.white('   - docs/              # Full documentation'));
      console.log(chalk.white('   - mcp-rag.config.json # Configuration'));
      
      console.log(chalk.cyan('\n🤝 Need help?'));
      console.log(chalk.white('   GitHub: https://github.com/w3bsuki/MCP-RAG-LAST'));
      console.log(chalk.white('   Issues: https://github.com/w3bsuki/MCP-RAG-LAST/issues\n'));

    } catch (error) {
      spinner.fail('Failed to create project');
      console.error(chalk.red(error.message));
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('Installation failed:'), error.message);
    process.exit(1);
  }
}

function generateConfig(answers) {
  const env = [];
  const json = {
    name: answers.projectName,
    type: answers.projectType,
    agents: answers.agents,
    automationLevel: answers.automationLevel,
    dashboard: answers.enableDashboard
  };

  // Basic configuration
  env.push('# MCP/RAG System Configuration');
  env.push(`PROJECT_NAME=${answers.projectName}`);
  env.push(`PROJECT_TYPE=${answers.projectType}`);
  env.push(`AUTOMATION_LEVEL=${answers.automationLevel}`);
  env.push('');

  // Milvus configuration
  env.push('# Milvus Configuration');
  if (answers.milvusSetup === 'lite') {
    env.push('MILVUS_ADDRESS=./milvus.db');
  } else {
    env.push('MILVUS_ADDRESS=localhost:19530');
  }
  env.push('');

  // Agent configuration
  env.push('# Agent Configuration');
  env.push(`ENABLED_AGENTS=${answers.agents.join(',')}`);
  env.push('CONTEXT_UPDATE_INTERVAL=5000');
  env.push('HEALTH_CHECK_INTERVAL=10000');
  env.push('');

  // Project-specific configuration
  if (answers.projectType === 'frontend') {
    json.framework = answers.framework;
    env.push('# Frontend Configuration');
    env.push(`FRONTEND_FRAMEWORK=${answers.framework}`);
    env.push('WATCH_PATTERNS=src/**/*.{js,jsx,ts,tsx,css,scss}');
    env.push('IGNORE_PATTERNS=node_modules/**,build/**,dist/**');
  } else if (answers.projectType === 'backend') {
    env.push('# Backend Configuration');
    env.push('WATCH_PATTERNS=src/**/*.{js,ts,py,java}');
    env.push('IGNORE_PATTERNS=node_modules/**,dist/**,__pycache__/**');
  }

  return {
    env: env.join('\n'),
    json
  };
}

// Run the installer
main().catch(console.error);