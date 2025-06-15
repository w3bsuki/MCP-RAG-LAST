import { BaseAgent } from '../base-agent.js';
import { Task } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(spawn);

interface ValidationResult {
  passed: boolean;
  tests: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  coverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  performance: {
    buildTime: number;
    testTime: number;
    bundleSize?: number;
  };
  issues: Array<{
    type: 'error' | 'warning';
    file: string;
    message: string;
  }>;
}

export class ValidatorAgent extends BaseAgent {
  private validationHistory: Map<string, ValidationResult> = new Map();

  protected async onInitialize(): Promise<void> {
    logger.info(`Validator-${this.config.id}`, 'Initializing Validator agent');
    
    // Load validation rules and thresholds from config
    const context = await this.getContext(['globalState.validationRules']);
    if (context?.globalState?.validationRules) {
      logger.info(`Validator-${this.config.id}`, 'Loaded validation rules from context');
    }
  }

  protected async onExecuteTask(task: Task): Promise<any> {
    logger.info(`Validator-${this.config.id}`, `Executing validation task: ${task.type}`);
    
    switch (task.type) {
      case 'validate_implementation':
        return await this.validateImplementation(task);
      
      case 'run_tests':
        return await this.runTests(task);
      
      case 'check_performance':
        return await this.checkPerformance(task);
      
      case 'validate_pr':
        return await this.validatePullRequest(task);
      
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async validateImplementation(task: Task): Promise<ValidationResult> {
    logger.info(`Validator-${this.config.id}`, 'Validating implementation');
    
    const result: ValidationResult = {
      passed: true,
      tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
      coverage: { statements: 0, branches: 0, functions: 0, lines: 0 },
      performance: { buildTime: 0, testTime: 0 },
      issues: []
    };
    
    try {
      // Run build
      const buildResult = await this.runBuild();
      result.performance.buildTime = buildResult.duration;
      
      if (!buildResult.success) {
        result.passed = false;
        result.issues.push(...buildResult.errors.map((err: any) => ({
          type: 'error' as const,
          file: err.file || 'unknown',
          message: err.message
        })));
      }
      
      // Run tests
      const testResult = await this.runTests(task);
      result.tests = testResult.tests;
      result.coverage = testResult.coverage;
      result.performance.testTime = testResult.performance.testTime;
      
      if (testResult.tests.failed > 0) {
        result.passed = false;
      }
      
      // Check code quality
      const qualityResult = await this.checkCodeQuality();
      result.issues.push(...qualityResult.issues);
      
      // Check performance metrics
      const perfResult = await this.checkPerformance(task);
      result.performance.bundleSize = perfResult.bundleSize;
      
      // Store validation result in RAG
      await this.storeInRAG(
        `Validation result for ${task.id}:\n${JSON.stringify(result, null, 2)}`,
        {
          type: 'validation_result',
          taskId: task.id,
          passed: result.passed,
          timestamp: new Date().toISOString()
        }
      );
      
      // Update task with validation result
      await this.updateContext({
        [`validationResults.${task.id}`]: result
      });
      
    } catch (error) {
      logger.error(`Validator-${this.config.id}`, 'Validation failed', error);
      result.passed = false;
      result.issues.push({
        type: 'error',
        file: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return result;
  }

  private async runBuild(): Promise<any> {
    logger.info(`Validator-${this.config.id}`, 'Running build');
    
    const startTime = Date.now();
    
    try {
      // Run build command (adjust based on project)
      const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: this.config.worktreePath,
        stdio: 'pipe'
      });
      
      const output: string[] = [];
      const errors: any[] = [];
      
      buildProcess.stdout.on('data', (data) => {
        output.push(data.toString());
      });
      
      buildProcess.stderr.on('data', (data) => {
        const error = data.toString();
        errors.push({ message: error });
        logger.error(`Validator-${this.config.id}`, 'Build error', error);
      });
      
      await new Promise((resolve, reject) => {
        buildProcess.on('close', (code) => {
          if (code === 0) resolve(code);
          else reject(new Error(`Build failed with code ${code}`));
        });
      });
      
      return {
        success: true,
        duration: Date.now() - startTime,
        output: output.join('\n'),
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        output: '',
        errors: [{ message: error instanceof Error ? error.message : 'Build failed' }]
      };
    }
  }

  private async runTests(task: Task): Promise<any> {
    logger.info(`Validator-${this.config.id}`, 'Running tests');
    
    const startTime = Date.now();
    
    try {
      // Run test command with coverage
      const testProcess = spawn('npm', ['run', 'test', '--', '--coverage'], {
        cwd: this.config.worktreePath,
        stdio: 'pipe'
      });
      
      let output = '';
      let coverage = { statements: 0, branches: 0, functions: 0, lines: 0 };
      let testStats = { total: 0, passed: 0, failed: 0, skipped: 0 };
      
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
        
        // Parse test results (simplified - in reality, parse JSON output)
        const passMatch = output.match(/(\d+) passing/);
        const failMatch = output.match(/(\d+) failing/);
        
        if (passMatch) testStats.passed = parseInt(passMatch[1]);
        if (failMatch) testStats.failed = parseInt(failMatch[1]);
        testStats.total = testStats.passed + testStats.failed;
      });
      
      await new Promise((resolve) => {
        testProcess.on('close', resolve);
      });
      
      return {
        tests: testStats,
        coverage,
        performance: {
          testTime: Date.now() - startTime
        }
      };
    } catch (error) {
      logger.error(`Validator-${this.config.id}`, 'Test execution failed', error);
      return {
        tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
        coverage: { statements: 0, branches: 0, functions: 0, lines: 0 },
        performance: { testTime: Date.now() - startTime }
      };
    }
  }

  private async checkCodeQuality(): Promise<any> {
    logger.info(`Validator-${this.config.id}`, 'Checking code quality');
    
    const issues: any[] = [];
    
    try {
      // Run linter
      const lintProcess = spawn('npm', ['run', 'lint'], {
        cwd: this.config.worktreePath,
        stdio: 'pipe'
      });
      
      lintProcess.stderr.on('data', (data) => {
        const output = data.toString();
        // Parse lint errors (simplified)
        const lines = output.split('\n');
        lines.forEach((line: string) => {
          if (line.includes('error')) {
            issues.push({
              type: 'error',
              file: 'unknown',
              message: line
            });
          } else if (line.includes('warning')) {
            issues.push({
              type: 'warning',
              file: 'unknown',
              message: line
            });
          }
        });
      });
      
      await new Promise((resolve) => {
        lintProcess.on('close', resolve);
      });
    } catch (error) {
      logger.error(`Validator-${this.config.id}`, 'Lint check failed', error);
    }
    
    return { issues };
  }

  private async checkPerformance(task: Task): Promise<any> {
    logger.info(`Validator-${this.config.id}`, 'Checking performance metrics');
    
    // In a real implementation, this would:
    // 1. Measure bundle size
    // 2. Run performance benchmarks
    // 3. Check memory usage
    // 4. Analyze load times
    
    return {
      bundleSize: 1024 * 512, // 512KB (placeholder)
      loadTime: 250, // ms
      memoryUsage: 1024 * 1024 * 50, // 50MB
      passed: true
    };
  }

  private async validatePullRequest(task: Task): Promise<any> {
    logger.info(`Validator-${this.config.id}`, 'Validating pull request');
    
    // Get all changes in the PR
    const changes = task.result?.changes || [];
    
    // Run validation on each changed file
    const validationResults = [];
    for (const change of changes) {
      const result = await this.validateFile(change);
      validationResults.push(result);
    }
    
    // Aggregate results
    const allPassed = validationResults.every(r => r.passed);
    
    return {
      passed: allPassed,
      filesValidated: validationResults.length,
      results: validationResults,
      recommendation: allPassed ? 'approve' : 'request_changes'
    };
  }

  private async validateFile(file: any): Promise<any> {
    // Simplified file validation
    return {
      file: file.path,
      passed: true,
      issues: []
    };
  }

  protected async onShutdown(): Promise<void> {
    logger.info(`Validator-${this.config.id}`, 'Shutting down Validator agent');
    
    // Save validation history to RAG
    if (this.validationHistory.size > 0) {
      await this.storeInRAG(
        `Validation history:\n${JSON.stringify(Array.from(this.validationHistory.entries()), null, 2)}`,
        {
          type: 'validation_history',
          agentId: this.config.id,
          timestamp: new Date().toISOString()
        }
      );
    }
  }
}

// Main entry point for standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new ValidatorAgent({
    id: process.env.AGENT_ID || 'validator-1',
    name: process.env.AGENT_NAME || 'Validator Agent',
    type: 'validator',
    capabilities: ['testing', 'validation', 'quality-assurance'],
    mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:3000',
    worktreePath: process.env.WORKTREE_PATH || process.cwd()
  });

  agent.initialize().catch((error) => {
    logger.error('ValidatorAgent', 'Failed to start agent', error);
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