import { z } from 'zod';

export const AgentStateSchema = z.enum(['idle', 'working', 'error', 'offline']);
export type AgentState = z.infer<typeof AgentStateSchema>;

export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string(),
  priority: z.number().min(0).max(10),
  status: TaskStatusSchema,
  assignedTo: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  result: z.any().optional(),
  error: z.string().optional()
});
export type Task = z.infer<typeof TaskSchema>;

export const AgentInfoSchema = z.object({
  id: z.string(),
  type: z.enum(['auditor', 'implementer', 'validator']),
  state: AgentStateSchema,
  currentTask: z.string().optional(),
  lastHeartbeat: z.string(),
  metrics: z.object({
    tasksCompleted: z.number(),
    tasksFailed: z.number(),
    uptime: z.number(),
    averageTaskTime: z.number()
  })
});
export type AgentInfo = z.infer<typeof AgentInfoSchema>;

export const SharedContextSchema = z.object({
  version: z.number(),
  currentTask: TaskSchema.optional(),
  taskQueue: z.array(TaskSchema),
  agentStates: z.record(z.string(), AgentInfoSchema),
  globalState: z.record(z.string(), z.any()),
  lastUpdated: z.string()
});
export type SharedContext = z.infer<typeof SharedContextSchema>;

export const RAGDocumentSchema = z.object({
  id: z.string(),
  content: z.string(),
  metadata: z.record(z.string(), z.any()),
  embedding: z.array(z.number()).optional(),
  timestamp: z.string()
});
export type RAGDocument = z.infer<typeof RAGDocumentSchema>;

export const RAGQueryResultSchema = z.object({
  documents: z.array(RAGDocumentSchema),
  scores: z.array(z.number()),
  query: z.string(),
  timestamp: z.string()
});
export type RAGQueryResult = z.infer<typeof RAGQueryResultSchema>;