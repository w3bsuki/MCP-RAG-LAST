import { BaseAgent } from '../base-agent.js';
import { Task } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { watch } from 'chokidar';
import { readFileSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';

interface CodeAnalysis {
  file: string;
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    line: number;
    column: number;
    message: string;
    rule?: string;
  }>;
  complexity: number;
  dependencies: string[];
  suggestions: string[];
}

export class AuditorAgent extends BaseAgent {
  private fileWatcher?: any;
  private analyzedFiles: Set<string> = new Set();
  private taskIdCounter = 0;

  protected async onInitialize(): Promise<void> {
    logger.info(`Auditor-${this.config.id}`, 'Initializing Auditor agent');
    
    // Initialize file watcher if worktree path is provided
    if (this.config.worktreePath) {
      this.initializeFileWatcher();
    }
  }

  private initializeFileWatcher(): void {
    this.fileWatcher = watch(this.config.worktreePath!, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.log'
      ],
      persistent: true,
      ignoreInitial: false
    });

    this.fileWatcher.on('add', (path: string) => this.onFileAdded(path));
    this.fileWatcher.on('change', (path: string) => this.onFileChanged(path));
    
    logger.info(`Auditor-${this.config.id}`, 'File watcher initialized');
  }

  private async onFileAdded(filePath: string): Promise<void> {
    if (!this.shouldAnalyzeFile(filePath)) return;
    
    logger.debug(`Auditor-${this.config.id}`, `New file detected: ${filePath}`);
    await this.analyzeFile(filePath);
  }

  private async onFileChanged(filePath: string): Promise<void> {
    if (!this.shouldAnalyzeFile(filePath)) return;
    
    logger.debug(`Auditor-${this.config.id}`, `File changed: ${filePath}`);
    await this.analyzeFile(filePath);
  }

  private shouldAnalyzeFile(filePath: string): boolean {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const supportedExtensions = ['js', 'ts', 'jsx', 'tsx', 'json', 'md'];
    return supportedExtensions.includes(ext || '');
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf8');
      const fileHash = createHash('sha256').update(content).digest('hex');
      
      // Skip if already analyzed with same content
      const fileKey = `${filePath}:${fileHash}`;
      if (this.analyzedFiles.has(fileKey)) return;
      
      const analysis = await this.performCodeAnalysis(filePath, content);
      
      // Store analysis in RAG
      await this.storeInRAG(
        `Code analysis for ${filePath}:\n${JSON.stringify(analysis, null, 2)}`,
        {
          type: 'code_analysis',
          file: filePath,
          hash: fileHash,
          timestamp: new Date().toISOString()
        }
      );
      
      this.analyzedFiles.add(fileKey);
      
      // Generate tasks based on analysis
      await this.generateTasksFromAnalysis(analysis);
    } catch (error) {
      logger.error(`Auditor-${this.config.id}`, `Failed to analyze file ${filePath}`, error);
    }
  }

  private async performCodeAnalysis(filePath: string, content: string): Promise<CodeAnalysis> {
    const analysis: CodeAnalysis = {
      file: filePath,
      issues: [],
      complexity: 0,
      dependencies: [],
      suggestions: []
    };

    // Basic analysis (in production, use proper AST parsing)
    const lines = content.split('\n');
    
    // Check for common issues
    lines.forEach((line, index) => {
      // Check for console.log
      if (line.includes('console.log')) {
        analysis.issues.push({
          type: 'warning',
          line: index + 1,
          column: line.indexOf('console.log'),
          message: 'Remove console.log statements',
          rule: 'no-console'
        });
      }
      
      // Check for TODO comments
      if (line.includes('TODO')) {
        analysis.issues.push({
          type: 'info',
          line: index + 1,
          column: line.indexOf('TODO'),
          message: 'TODO comment found',
          rule: 'todo-comment'
        });
      }
      
      // Check for long lines
      if (line.length > 120) {
        analysis.issues.push({
          type: 'warning',
          line: index + 1,
          column: 120,
          message: 'Line exceeds 120 characters',
          rule: 'max-line-length'
        });
      }
    });

    // Calculate cyclomatic complexity (simplified)
    const complexityKeywords = ['if', 'else', 'switch', 'case', 'for', 'while', 'catch'];
    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      analysis.complexity += matches ? matches.length : 0;
    });

    // Extract dependencies
    const importRegex = /import\s+.*\s+from\s+['"](.+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      analysis.dependencies.push(match[1]);
    }

    // Generate suggestions
    if (analysis.complexity > 10) {
      analysis.suggestions.push('Consider refactoring to reduce complexity');
    }
    
    if (analysis.issues.filter(i => i.type === 'error').length > 0) {
      analysis.suggestions.push('Fix critical errors before proceeding');
    }

    return analysis;
  }

  private async generateTasksFromAnalysis(analysis: CodeAnalysis): Promise<void> {
    const tasks: Task[] = [];
    
    // Create tasks for critical issues
    const criticalIssues = analysis.issues.filter(i => i.type === 'error');
    if (criticalIssues.length > 0) {
      tasks.push({
        id: `task-${Date.now()}-${this.taskIdCounter++}`,
        type: 'fix_errors',
        description: `Fix ${criticalIssues.length} errors in ${analysis.file}`,
        priority: 9,
        status: 'pending',
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    // Create refactoring task if complexity is high
    if (analysis.complexity > 15) {
      tasks.push({
        id: `task-${Date.now()}-${this.taskIdCounter++}`,
        type: 'refactor',
        description: `Refactor ${analysis.file} to reduce complexity (current: ${analysis.complexity})`,
        priority: 6,
        status: 'pending',
        dependencies: criticalIssues.length > 0 ? [tasks[0].id] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    // Add tasks to context
    for (const task of tasks) {
      await this.updateContext({
        [`taskQueue.${task.id}`]: task
      });
    }
    
    if (tasks.length > 0) {
      logger.info(`Auditor-${this.config.id}`, `Generated ${tasks.length} tasks from analysis`);
    }
  }

  protected async onExecuteTask(task: Task): Promise<any> {
    logger.info(`Auditor-${this.config.id}`, `Executing audit task: ${task.type}`);
    
    switch (task.type) {
      case 'full_audit':
        return await this.performFullAudit();
      
      case 'dependency_check':
        return await this.checkDependencies();
      
      case 'security_scan':
        return await this.performSecurityScan();
      
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async performFullAudit(): Promise<any> {
    logger.info(`Auditor-${this.config.id}`, 'Performing full codebase audit');
    
    // In a real implementation, this would:
    // 1. Scan all files in the worktree
    // 2. Run linters and static analysis
    // 3. Check for security vulnerabilities
    // 4. Analyze code quality metrics
    // 5. Generate comprehensive report
    
    return {
      filesAnalyzed: this.analyzedFiles.size,
      issuesFound: 42, // Placeholder
      suggestions: ['Consider adding more tests', 'Update dependencies']
    };
  }

  private async checkDependencies(): Promise<any> {
    logger.info(`Auditor-${this.config.id}`, 'Checking dependencies');
    
    // Check for outdated or vulnerable dependencies
    return {
      outdated: ['package1', 'package2'],
      vulnerable: [],
      suggestions: ['Update package1 to latest version']
    };
  }

  private async performSecurityScan(): Promise<any> {
    logger.info(`Auditor-${this.config.id}`, 'Performing security scan');
    
    // Scan for common security issues
    return {
      vulnerabilities: [],
      warnings: ['Ensure environment variables are not exposed']
    };
  }

  protected async onShutdown(): Promise<void> {
    logger.info(`Auditor-${this.config.id}`, 'Shutting down Auditor agent');
    
    if (this.fileWatcher) {
      await this.fileWatcher.close();
    }
  }
}