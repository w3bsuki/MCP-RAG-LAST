import { Task, TaskFilter, TaskStatus, TaskUpdate, TaskPriority } from '../types/tasks.js';
import { ContextManager } from './context-manager.js';
import { RAGSystem } from './rag-system.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class TaskManager {
  private contextManager: ContextManager;
  private ragSystem: RAGSystem;
  private taskCache: Map<string, Task> = new Map();

  constructor(contextManager: ContextManager, ragSystem: RAGSystem) {
    this.contextManager = contextManager;
    this.ragSystem = ragSystem;
  }

  async initialize(): Promise<void> {
    logger.info('TaskManager', 'Initializing task manager');
    
    // Load existing tasks from context
    const context = await this.contextManager.getContext();
    const tasks = context.tasks || {};
    
    // Populate cache
    Object.values(tasks).forEach((task: any) => {
      this.taskCache.set(task.id, task);
    });
    
    logger.info('TaskManager', `Loaded ${this.taskCache.size} existing tasks`);
  }

  async createTask(
    title: string,
    description: string,
    tags: string[],
    createdBy: string,
    options: {
      priority?: TaskPriority;
      assignedRole?: Task['assignedRole'];
      dependencies?: string[];
      context?: string;
    } = {}
  ): Promise<Task> {
    const task: Task = {
      id: `task-${uuidv4()}`,
      title,
      description,
      tags,
      status: 'pending',
      priority: options.priority || 3,
      assignedRole: options.assignedRole,
      dependencies: options.dependencies,
      context: options.context,
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store in cache
    this.taskCache.set(task.id, task);

    // Store in context
    await this.contextManager.updateContext({
      [`tasks.${task.id}`]: task
    });

    // Store task creation in RAG for learning
    await this.ragSystem.store(
      `Task created: ${title}\nDescription: ${description}\nTags: ${tags.join(', ')}`,
      {
        type: 'task_creation',
        taskId: task.id,
        createdBy,
        tags
      }
    );

    logger.info('TaskManager', `Created task ${task.id}: ${title}`);
    return task;
  }

  async updateTask(taskId: string, updates: TaskUpdate, updatedBy: string): Promise<Task> {
    const task = this.taskCache.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Apply updates
    const updatedTask: Task = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Handle status-specific updates
    if (updates.status === 'completed' && !task.completedAt) {
      updatedTask.completedAt = new Date().toISOString();
    }

    // Update cache
    this.taskCache.set(taskId, updatedTask);

    // Update context
    await this.contextManager.updateContext({
      [`tasks.${taskId}`]: updatedTask
    });

    // Store significant updates in RAG
    if (updates.status && updates.status !== task.status) {
      await this.ragSystem.store(
        `Task ${taskId} status changed from ${task.status} to ${updates.status}\nTitle: ${task.title}`,
        {
          type: 'task_update',
          taskId,
          updatedBy,
          previousStatus: task.status,
          newStatus: updates.status
        }
      );
    }

    logger.info('TaskManager', `Updated task ${taskId}`, updates);
    return updatedTask;
  }

  async getTasks(filter: TaskFilter = {}): Promise<Task[]> {
    let tasks = Array.from(this.taskCache.values());

    // Apply filters
    if (filter.tags && filter.tags.length > 0) {
      tasks = tasks.filter(task => 
        filter.tags!.some(tag => task.tags.includes(tag))
      );
    }

    if (filter.excludeTags && filter.excludeTags.length > 0) {
      tasks = tasks.filter(task => 
        !filter.excludeTags!.some(tag => task.tags.includes(tag))
      );
    }

    if (filter.roles && filter.roles.length > 0) {
      tasks = tasks.filter(task => 
        task.assignedRole && filter.roles!.includes(task.assignedRole)
      );
    }

    if (filter.status && filter.status.length > 0) {
      tasks = tasks.filter(task => filter.status!.includes(task.status));
    }

    if (filter.priority && filter.priority.length > 0) {
      tasks = tasks.filter(task => filter.priority!.includes(task.priority));
    }

    if (filter.assignedTo) {
      tasks = tasks.filter(task => task.assignedTo === filter.assignedTo);
    }

    if (!filter.includeCompleted) {
      tasks = tasks.filter(task => task.status !== 'completed');
    }

    // Sort by priority (descending) and creation time (ascending)
    tasks.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });

    return tasks;
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.taskCache.get(taskId) || null;
  }

  async claimTask(taskId: string, claimedBy: string): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.assignedTo && task.assignedTo !== claimedBy) {
      throw new Error(`Task ${taskId} already assigned to ${task.assignedTo}`);
    }

    return this.updateTask(taskId, {
      assignedTo: claimedBy,
      status: 'in_progress'
    }, claimedBy);
  }

  async completeTask(
    taskId: string, 
    completedBy: string,
    results?: Task['results']
  ): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.assignedTo && task.assignedTo !== completedBy) {
      throw new Error(`Task ${taskId} not assigned to ${completedBy}`);
    }

    return this.updateTask(taskId, {
      status: 'completed',
      results
    }, completedBy);
  }

  async blockTask(taskId: string, blockedBy: string, reason: string): Promise<Task> {
    return this.updateTask(taskId, {
      status: 'blocked',
      blockedBy: reason
    }, blockedBy);
  }

  async getTasksForRole(roleName: string, roleConfig: any): Promise<Task[]> {
    const filter: TaskFilter = {
      tags: roleConfig.watchTags,
      excludeTags: roleConfig.ignoreTags,
      status: ['pending', 'blocked'], // Don't include in_progress by default
      priority: roleConfig.priorityThreshold 
        ? [roleConfig.priorityThreshold, 4, 5].filter(p => p >= roleConfig.priorityThreshold) as TaskPriority[]
        : undefined
    };

    const tasks = await this.getTasks(filter);

    // Filter out tasks with unmet dependencies
    return tasks.filter(task => {
      if (!task.dependencies || task.dependencies.length === 0) {
        return true;
      }

      // Check if all dependencies are completed
      return task.dependencies.every(depId => {
        const depTask = this.taskCache.get(depId);
        return depTask && depTask.status === 'completed';
      });
    });
  }

  async getRelatedTasks(taskId: string): Promise<Task[]> {
    const task = await this.getTask(taskId);
    if (!task) {
      return [];
    }

    // Find tasks with overlapping tags or dependencies
    return this.getTasks({
      tags: task.tags,
      includeCompleted: true
    });
  }

  // Helper method to check if a task can be worked on
  canWorkOnTask(task: Task, workerId: string): boolean {
    // Task must be pending or blocked by this worker
    if (task.status !== 'pending' && task.status !== 'blocked') {
      return false;
    }

    // If assigned, must be to this worker
    if (task.assignedTo && task.assignedTo !== workerId) {
      return false;
    }

    // Dependencies must be met
    if (task.dependencies && task.dependencies.length > 0) {
      const unmetDeps = task.dependencies.filter(depId => {
        const depTask = this.taskCache.get(depId);
        return !depTask || depTask.status !== 'completed';
      });
      
      if (unmetDeps.length > 0) {
        return false;
      }
    }

    return true;
  }

  // Get task statistics
  async getStats(): Promise<any> {
    const tasks = Array.from(this.taskCache.values());
    
    return {
      total: tasks.length,
      byStatus: {
        pending: tasks.filter(t => t.status === 'pending').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        blocked: tasks.filter(t => t.status === 'blocked').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length
      },
      byPriority: {
        1: tasks.filter(t => t.priority === 1).length,
        2: tasks.filter(t => t.priority === 2).length,
        3: tasks.filter(t => t.priority === 3).length,
        4: tasks.filter(t => t.priority === 4).length,
        5: tasks.filter(t => t.priority === 5).length
      },
      byRole: {
        auditor: tasks.filter(t => t.assignedRole === 'auditor').length,
        implementer: tasks.filter(t => t.assignedRole === 'implementer').length,
        validator: tasks.filter(t => t.assignedRole === 'validator').length,
        unassigned: tasks.filter(t => !t.assignedRole).length
      }
    };
  }
}