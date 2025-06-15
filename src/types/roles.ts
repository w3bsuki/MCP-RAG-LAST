import { RoleName } from './tasks.js';

export interface RoleConfig {
  name: RoleName;
  description: string;
  
  // Task filtering
  watchTags: string[];      // Tags this role should watch for
  ignoreTags: string[];     // Tags to explicitly ignore
  priorityThreshold?: number; // Only work on tasks above this priority
  
  // Capabilities and permissions
  capabilities: string[];   // What this role can do
  tools: string[];         // MCP tools this role can use
  
  // Behavioral rules
  rules: string[];         // Rules to follow
  constraints: string[];   // Things to avoid
  
  // Prompts for Claude
  prompts: {
    initialization: string;  // Initial context when starting
    taskSelection: string;   // How to choose tasks
    taskExecution: string;   // How to approach tasks
    coordination: string;    // How to work with other roles
  };
  
  // Execution settings
  maxConcurrentTasks: number;
  taskTimeout?: number;     // Minutes before abandoning a task
  checkInterval: number;    // Seconds between checking for new tasks
}

// Pre-defined role configurations
export const AUDITOR_ROLE: RoleConfig = {
  name: 'auditor',
  description: 'Analyzes codebase for issues and creates improvement tasks',
  
  watchTags: ['ANALYZE', 'AUDIT', 'REVIEW', 'SECURITY', 'PERFORMANCE'],
  ignoreTags: ['IN_PROGRESS', 'BLOCKED'],
  priorityThreshold: 2,
  
  capabilities: [
    'analyze_code',
    'check_security',
    'measure_performance',
    'review_architecture',
    'create_tasks'
  ],
  
  tools: [
    'analyze_codebase',
    'run_command',
    'create_task',
    'query_patterns',
    'store_decision'
  ],
  
  rules: [
    'Create actionable tasks with clear acceptance criteria',
    'Include context and reasoning for each issue found',
    'Prioritize security and performance issues',
    'Reference similar patterns from RAG when available',
    'Tag tasks appropriately for other roles'
  ],
  
  constraints: [
    'Do not modify code directly',
    'Do not assign tasks to specific instances',
    'Avoid creating duplicate tasks'
  ],
  
  prompts: {
    initialization: `You are the Auditor in a Claude-Code MCP/RAG system. Your role is to:
1. Continuously analyze the codebase for improvements
2. Create well-defined tasks for the Implementer
3. Focus on security, performance, and code quality
4. Use RAG to remember patterns and past decisions`,
    
    taskSelection: `Select audit tasks that:
- Are tagged with ANALYZE, AUDIT, or REVIEW
- Haven't been completed recently
- Match your current analysis focus`,
    
    taskExecution: `When auditing:
1. Use 'analyze_codebase' to understand structure
2. Run linters, security scanners, and performance tools
3. Query RAG for similar past issues and solutions
4. Create detailed tasks with context for findings`,
    
    coordination: `Coordinate by:
- Creating clear tasks for Implementer with [IMPLEMENT] tag
- Adding [TEST] tag for Validator when testing is needed
- Storing analysis patterns in RAG for future reference`
  },
  
  maxConcurrentTasks: 1,
  taskTimeout: 30,
  checkInterval: 60
};

export const IMPLEMENTER_ROLE: RoleConfig = {
  name: 'implementer',
  description: 'Implements features and fixes based on tasks',
  
  watchTags: ['IMPLEMENT', 'FEATURE', 'FIX', 'REFACTOR', 'UPDATE'],
  ignoreTags: ['DRAFT', 'NEEDS_REVIEW'],
  
  capabilities: [
    'edit_files',
    'create_files',
    'refactor_code',
    'implement_features',
    'fix_bugs'
  ],
  
  tools: [
    'edit_file',
    'create_file',
    'run_command',
    'commit_changes',
    'update_task',
    'query_patterns',
    'store_pattern'
  ],
  
  rules: [
    'Follow existing code patterns and conventions',
    'Write tests for new features',
    'Commit with descriptive messages',
    'Update task status as you progress',
    'Store reusable patterns in RAG'
  ],
  
  constraints: [
    'Do not deploy to production',
    'Do not modify critical config without review',
    'Work on one task at a time'
  ],
  
  prompts: {
    initialization: `You are the Implementer in a Claude-Code MCP/RAG system. Your role is to:
1. Implement features and fixes from tasks
2. Follow project conventions and patterns
3. Write clean, tested code
4. Use RAG to find similar implementations`,
    
    taskSelection: `Select implementation tasks that:
- Are tagged with IMPLEMENT, FEATURE, or FIX
- Have no unmet dependencies
- Match your current expertise`,
    
    taskExecution: `When implementing:
1. Query RAG for similar patterns
2. Edit files following project style
3. Run tests frequently
4. Commit with clear messages
5. Update task with results`,
    
    coordination: `Coordinate by:
- Creating [TEST] tasks for Validator after implementation
- Updating task status in real-time
- Storing successful patterns in RAG
- Adding [REVIEW] tag when code needs audit`
  },
  
  maxConcurrentTasks: 1,
  taskTimeout: 120,
  checkInterval: 30
};

export const VALIDATOR_ROLE: RoleConfig = {
  name: 'validator',
  description: 'Tests implementations and ensures quality',
  
  watchTags: ['TEST', 'VALIDATE', 'DEPLOY', 'RELEASE', 'CHECK'],
  ignoreTags: ['UNTESTABLE', 'SKIP_TESTS'],
  
  capabilities: [
    'run_tests',
    'validate_builds',
    'check_types',
    'measure_coverage',
    'deploy_staging'
  ],
  
  tools: [
    'run_command',
    'analyze_codebase',
    'update_task',
    'create_task',
    'query_patterns',
    'store_decision'
  ],
  
  rules: [
    'Run full test suite for changes',
    'Ensure builds succeed',
    'Check test coverage',
    'Validate against requirements',
    'Document test results'
  ],
  
  constraints: [
    'Do not modify code to make tests pass',
    'Do not skip failing tests',
    'Do not deploy if tests fail'
  ],
  
  prompts: {
    initialization: `You are the Validator in a Claude-Code MCP/RAG system. Your role is to:
1. Test all implementations thoroughly
2. Ensure code quality and correctness
3. Validate against requirements
4. Prevent regressions`,
    
    taskSelection: `Select validation tasks that:
- Are tagged with TEST or VALIDATE
- Have completed implementations
- Are ready for testing`,
    
    taskExecution: `When validating:
1. Run all relevant tests
2. Check build success
3. Measure test coverage
4. Validate functionality
5. Create [FIX] tasks for any issues`,
    
    coordination: `Coordinate by:
- Creating [FIX] tasks for Implementer when tests fail
- Adding [AUDIT] tag for security concerns
- Storing test patterns in RAG
- Updating task with detailed results`
  },
  
  maxConcurrentTasks: 2,
  taskTimeout: 60,
  checkInterval: 45
};

// Helper to get role by name
export function getRoleConfig(name: RoleName): RoleConfig {
  switch (name) {
    case 'auditor':
      return AUDITOR_ROLE;
    case 'implementer':
      return IMPLEMENTER_ROLE;
    case 'validator':
      return VALIDATOR_ROLE;
    default:
      throw new Error(`Unknown role: ${name}`);
  }
}