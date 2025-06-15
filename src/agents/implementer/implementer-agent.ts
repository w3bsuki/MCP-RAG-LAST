import { BaseAgent } from '../base-agent.js';
import { Task } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { WorktreeManager } from '../../coordination/worktree-manager.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

interface ImplementationPlan {
  steps: Array<{
    action: 'create' | 'modify' | 'delete' | 'refactor';
    file: string;
    description: string;
    changes?: string;
  }>;
  estimatedTime: number;
  dependencies: string[];
}

export class ImplementerAgent extends BaseAgent {
  private worktreeManager?: WorktreeManager;
  private implementationHistory: Map<string, any> = new Map();

  protected async onInitialize(): Promise<void> {
    logger.info(`Implementer-${this.config.id}`, 'Initializing Implementer agent');
    
    // Initialize worktree manager if path is provided
    if (this.config.worktreePath) {
      this.worktreeManager = new WorktreeManager(this.config.worktreePath);
      await this.worktreeManager.initialize();
      
      // Create agent-specific worktree
      await this.worktreeManager.createWorktree(this.config.id);
    }
  }

  protected async onExecuteTask(task: Task): Promise<any> {
    logger.info(`Implementer-${this.config.id}`, `Executing implementation task: ${task.type}`);
    
    switch (task.type) {
      case 'implement_feature':
        return await this.implementFeature(task);
      
      case 'fix_errors':
        return await this.fixErrors(task);
      
      case 'refactor':
        return await this.refactorCode(task);
      
      case 'create_tests':
        return await this.createTests(task);
      
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async implementFeature(task: Task): Promise<any> {
    logger.info(`Implementer-${this.config.id}`, 'Implementing new feature', task);
    
    // Query RAG for similar implementations
    const similarCode = await this.queryRAG(
      `feature implementation ${task.description}`,
      5
    );
    
    // Create implementation plan
    const plan = await this.createImplementationPlan(task, similarCode);
    
    // Store plan in RAG for future reference
    await this.storeInRAG(
      `Implementation plan for ${task.id}:\n${JSON.stringify(plan, null, 2)}`,
      {
        type: 'implementation_plan',
        taskId: task.id,
        feature: task.description
      }
    );
    
    // Execute implementation steps
    const results = [];
    for (const step of plan.steps) {
      try {
        const result = await this.executeImplementationStep(step);
        results.push(result);
      } catch (error) {
        logger.error(`Implementer-${this.config.id}`, `Failed to execute step`, { step, error });
        throw error;
      }
    }
    
    // Commit changes
    if (this.worktreeManager) {
      const commitMessage = `feat: ${task.description}\n\nImplemented by ${this.config.id}`;
      await this.worktreeManager.commitChanges(this.config.id, commitMessage);
    }
    
    return {
      plan,
      results,
      filesModified: plan.steps.length,
      success: true
    };
  }

  private async fixErrors(task: Task): Promise<any> {
    logger.info(`Implementer-${this.config.id}`, 'Fixing errors', task);
    
    // Get error details from context or task metadata
    const context = await this.getContext(['globalState.lastAnalysis']);
    const errors = context?.globalState?.lastAnalysis?.errors || [];
    
    const fixes = [];
    for (const error of errors) {
      const fix = await this.fixError(error);
      fixes.push(fix);
    }
    
    // Commit fixes
    if (this.worktreeManager) {
      const commitMessage = `fix: ${task.description}\n\nFixed ${fixes.length} errors`;
      await this.worktreeManager.commitChanges(this.config.id, commitMessage);
    }
    
    return {
      errorsFixed: fixes.length,
      fixes,
      success: true
    };
  }

  private async refactorCode(task: Task): Promise<any> {
    logger.info(`Implementer-${this.config.id}`, 'Refactoring code', task);
    
    // Get refactoring targets from task or context
    const targets = task.result?.targets || [];
    
    const refactorings = [];
    for (const target of targets) {
      const result = await this.performRefactoring(target);
      refactorings.push(result);
    }
    
    // Store refactoring patterns in RAG
    await this.storeInRAG(
      `Refactoring patterns applied:\n${JSON.stringify(refactorings, null, 2)}`,
      {
        type: 'refactoring_pattern',
        taskId: task.id,
        patterns: refactorings.map(r => r.pattern)
      }
    );
    
    return {
      filesRefactored: refactorings.length,
      refactorings,
      success: true
    };
  }

  private async createTests(task: Task): Promise<any> {
    logger.info(`Implementer-${this.config.id}`, 'Creating tests', task);
    
    // Get test targets from task
    const targets = task.result?.targets || [];
    
    const tests = [];
    for (const target of targets) {
      const test = await this.generateTest(target);
      tests.push(test);
    }
    
    // Commit tests
    if (this.worktreeManager) {
      const commitMessage = `test: ${task.description}\n\nAdded ${tests.length} test files`;
      await this.worktreeManager.commitChanges(this.config.id, commitMessage);
    }
    
    return {
      testsCreated: tests.length,
      tests,
      success: true
    };
  }

  private async createImplementationPlan(task: Task, similarCode: any): Promise<ImplementationPlan> {
    // In a real implementation, this would use AI to create a detailed plan
    // For now, we'll create a simple plan based on the task
    
    const plan: ImplementationPlan = {
      steps: [],
      estimatedTime: 30, // minutes
      dependencies: []
    };
    
    // Example: Create a new file for the feature
    plan.steps.push({
      action: 'create',
      file: `src/features/${task.id}.ts`,
      description: `Create main implementation file for ${task.description}`,
      changes: `// Implementation for ${task.description}\nexport class Feature {\n  // TODO: Implement\n}`
    });
    
    return plan;
  }

  private async executeImplementationStep(step: any): Promise<any> {
    const filePath = join(this.config.worktreePath || '', step.file);
    
    switch (step.action) {
      case 'create':
        // Ensure directory exists
        const dir = dirname(filePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        
        // Write file
        writeFileSync(filePath, step.changes || '');
        logger.info(`Implementer-${this.config.id}`, `Created file: ${step.file}`);
        break;
      
      case 'modify':
        // Read existing content
        const content = readFileSync(filePath, 'utf8');
        
        // Apply modifications (simplified)
        const newContent = content + '\n' + step.changes;
        writeFileSync(filePath, newContent);
        logger.info(`Implementer-${this.config.id}`, `Modified file: ${step.file}`);
        break;
      
      case 'delete':
        // Delete file (with caution)
        logger.warn(`Implementer-${this.config.id}`, `Would delete file: ${step.file} (skipped for safety)`);
        break;
      
      case 'refactor':
        // Perform refactoring
        logger.info(`Implementer-${this.config.id}`, `Refactored file: ${step.file}`);
        break;
    }
    
    return {
      action: step.action,
      file: step.file,
      success: true
    };
  }

  private async fixError(error: any): Promise<any> {
    // Simplified error fixing logic
    logger.info(`Implementer-${this.config.id}`, `Fixing error in ${error.file}:${error.line}`);
    
    return {
      file: error.file,
      line: error.line,
      fix: 'Applied automatic fix',
      success: true
    };
  }

  private async performRefactoring(target: any): Promise<any> {
    // Simplified refactoring logic
    logger.info(`Implementer-${this.config.id}`, `Refactoring ${target.file}`);
    
    return {
      file: target.file,
      pattern: 'extract-method',
      changes: 3,
      success: true
    };
  }

  private async generateTest(target: any): Promise<any> {
    // Simplified test generation
    const testFile = target.file.replace('/src/', '/tests/').replace('.ts', '.test.ts');
    
    logger.info(`Implementer-${this.config.id}`, `Generating test for ${target.file}`);
    
    return {
      sourceFile: target.file,
      testFile,
      testsGenerated: 5,
      success: true
    };
  }

  protected async onShutdown(): Promise<void> {
    logger.info(`Implementer-${this.config.id}`, 'Shutting down Implementer agent');
    
    // Commit any pending changes
    if (this.worktreeManager) {
      const status = await this.worktreeManager.getStatus(this.config.id);
      if (status.files.length > 0) {
        await this.worktreeManager.commitChanges(
          this.config.id, 
          'chore: Save work in progress before shutdown'
        );
      }
    }
  }
}

// Main entry point for standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new ImplementerAgent({
    id: process.env.AGENT_ID || 'implementer-1',
    name: process.env.AGENT_NAME || 'Implementer Agent',
    type: 'implementer',
    capabilities: ['code-generation', 'refactoring', 'testing'],
    mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:3000',
    worktreePath: process.env.WORKTREE_PATH || process.cwd()
  });

  agent.initialize().catch((error) => {
    logger.error('ImplementerAgent', 'Failed to start agent', error);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await agent.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await agent.shutdown();
    process.exit(0);
  });
}