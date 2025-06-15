#!/usr/bin/env tsx

import { ContextManager } from '../src/coordination/context/context-manager.js';
import { RAGSystem } from '../src/coordination/rag-system.js';
import { TaskManager } from '../src/coordination/task-manager.js';
import { TaskPriority } from '../src/types/tasks.js';

async function main() {
  const command = process.argv[2];
  
  // Initialize managers
  const contextManager = new ContextManager();
  const ragSystem = new RAGSystem();
  const taskManager = new TaskManager(contextManager, ragSystem);
  
  await contextManager.initialize();
  await ragSystem.initialize();
  await taskManager.initialize();

  switch (command) {
    case 'list': {
      const tasks = await taskManager.getTasks({
        includeCompleted: process.argv.includes('--all')
      });
      
      console.log('\n📋 Tasks:\n');
      tasks.forEach(task => {
        const status = task.status === 'completed' ? '✅' : 
                      task.status === 'in_progress' ? '🔄' : 
                      task.status === 'blocked' ? '🚫' : '⏳';
        
        console.log(`${status} [${task.priority}] ${task.title}`);
        console.log(`   ID: ${task.id}`);
        console.log(`   Tags: ${task.tags.join(', ')}`);
        console.log(`   Status: ${task.status}`);
        if (task.assignedTo) {
          console.log(`   Assigned: ${task.assignedTo}`);
        }
        console.log('');
      });
      
      const stats = await taskManager.getStats();
      console.log('📊 Statistics:');
      console.log(`   Total: ${stats.total}`);
      console.log(`   Pending: ${stats.byStatus.pending}`);
      console.log(`   In Progress: ${stats.byStatus.in_progress}`);
      console.log(`   Completed: ${stats.byStatus.completed}`);
      break;
    }
    
    case 'create': {
      // Example: npm run task:create "Add dark mode" "Implement dark mode toggle" "FEATURE,IMPLEMENT" 4
      const title = process.argv[3];
      const description = process.argv[4];
      const tags = process.argv[5]?.split(',') || [];
      const priority = parseInt(process.argv[6] || '3') as TaskPriority;
      
      if (!title || !description || tags.length === 0) {
        console.error('Usage: task:create "title" "description" "tag1,tag2" [priority]');
        process.exit(1);
      }
      
      const task = await taskManager.createTask(
        title,
        description,
        tags,
        'cli-user',
        { priority }
      );
      
      console.log('✅ Task created:');
      console.log(JSON.stringify(task, null, 2));
      break;
    }
    
    case 'seed': {
      // Create some example tasks
      console.log('🌱 Creating example tasks...\n');
      
      await taskManager.createTask(
        'Analyze Svelte app performance',
        'Run performance analysis on the Svelte application and identify bottlenecks',
        ['ANALYZE', 'PERFORMANCE', 'AUDIT'],
        'cli-seed',
        { priority: 4, assignedRole: 'auditor' }
      );
      
      await taskManager.createTask(
        'Add dark mode support',
        'Implement a dark mode toggle in the settings page with proper theme switching',
        ['FEATURE', 'IMPLEMENT', 'UI'],
        'cli-seed',
        { priority: 3, assignedRole: 'implementer' }
      );
      
      await taskManager.createTask(
        'Update component tests',
        'Update test suite for recently modified components',
        ['TEST', 'VALIDATE'],
        'cli-seed',
        { priority: 3, assignedRole: 'validator' }
      );
      
      await taskManager.createTask(
        'Fix accessibility issues',
        'Address WCAG compliance issues in form components',
        ['FIX', 'IMPLEMENT', 'ACCESSIBILITY'],
        'cli-seed',
        { priority: 5, assignedRole: 'implementer' }
      );
      
      await taskManager.createTask(
        'Security audit',
        'Perform security audit on API endpoints and authentication flow',
        ['AUDIT', 'SECURITY', 'ANALYZE'],
        'cli-seed',
        { priority: 5, assignedRole: 'auditor' }
      );
      
      console.log('✅ Example tasks created!');
      break;
    }
    
    default:
      console.log('Usage: tsx task-manager.ts [list|create|seed] [options]');
      console.log('  list [--all]  List tasks (include completed with --all)');
      console.log('  create        Create a new task');
      console.log('  seed          Create example tasks');
  }

  await contextManager.shutdown();
  await ragSystem.shutdown();
}

main().catch(console.error);