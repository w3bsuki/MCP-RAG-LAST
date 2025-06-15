export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

export type TaskPriority = 1 | 2 | 3 | 4 | 5; // 1 = lowest, 5 = highest

export type RoleName = 'auditor' | 'implementer' | 'validator';

export interface Task {
  id: string;
  title: string;
  description: string;
  tags: string[];
  assignedRole?: RoleName;
  assignedTo?: string; // Claude instance ID
  status: TaskStatus;
  priority: TaskPriority;
  dependencies?: string[]; // Other task IDs that must complete first
  blockedBy?: string; // What's blocking this task
  
  // Context and history
  context?: string; // RAG reference for relevant knowledge
  ragDocumentIds?: string[]; // Related documents in RAG
  
  // Metadata
  createdBy: string; // Which Claude instance created this
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  
  // Results and artifacts
  results?: {
    files?: string[]; // Files created/modified
    commands?: string[]; // Commands executed
    tests?: string[]; // Tests run
    metrics?: Record<string, any>; // Performance metrics, etc.
  };
}

export interface TaskFilter {
  tags?: string[];
  excludeTags?: string[];
  roles?: RoleName[];
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assignedTo?: string;
  includeCompleted?: boolean;
}

export interface TaskUpdate {
  status?: TaskStatus;
  assignedTo?: string;
  blockedBy?: string;
  results?: Task['results'];
  ragDocumentIds?: string[];
}