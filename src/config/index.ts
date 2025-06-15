import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const ConfigSchema = z.object({
  server: z.object({
    name: z.string().default('autonomous-mcp-system'),
    version: z.string().default('1.0.0'),
    port: z.number().default(3000)
  }),
  context: z.object({
    filePath: z.string().default('.mcp-context.json'),
    updateInterval: z.number().default(5000), // 5 seconds
    backupEnabled: z.boolean().default(true)
  }),
  rag: z.object({
    collectionName: z.string().default('mcp_knowledge'),
    embeddingDimension: z.number().default(384),
    maxResults: z.number().default(10),
    similarityThreshold: z.number().default(0.7)
  }),
  recovery: z.object({
    enabled: z.boolean().default(true),
    healthCheckInterval: z.number().default(10000), // 10 seconds
    maxRestartAttempts: z.number().default(3),
    restartDelay: z.number().default(5000) // 5 seconds
  }),
  performance: z.object({
    contextSyncMaxLatency: z.number().default(10000), // 10 seconds
    ragRetrievalMaxTime: z.number().default(2000), // 2 seconds
    agentResponseMaxTime: z.number().default(5000), // 5 seconds
    maxMemoryUsage: z.number().default(1024 * 1024 * 1024), // 1GB
    taskCompletionTarget: z.number().default(0.9) // 90%
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    directory: z.string().default('./logs'),
    maxFileSize: z.number().default(10 * 1024 * 1024), // 10MB
    maxFiles: z.number().default(10)
  })
});

export type Config = z.infer<typeof ConfigSchema>;

export const config: Config = ConfigSchema.parse({
  server: {
    name: process.env.SERVER_NAME,
    version: process.env.SERVER_VERSION,
    port: process.env.PORT ? parseInt(process.env.PORT) : undefined
  },
  context: {
    filePath: process.env.CONTEXT_FILE_PATH,
    updateInterval: process.env.CONTEXT_UPDATE_INTERVAL ? parseInt(process.env.CONTEXT_UPDATE_INTERVAL) : undefined,
    backupEnabled: process.env.CONTEXT_BACKUP_ENABLED === 'true'
  },
  rag: {
    collectionName: process.env.RAG_COLLECTION_NAME,
    embeddingDimension: process.env.RAG_EMBEDDING_DIMENSION ? parseInt(process.env.RAG_EMBEDDING_DIMENSION) : undefined,
    maxResults: process.env.RAG_MAX_RESULTS ? parseInt(process.env.RAG_MAX_RESULTS) : undefined,
    similarityThreshold: process.env.RAG_SIMILARITY_THRESHOLD ? parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) : undefined
  },
  recovery: {
    enabled: process.env.RECOVERY_ENABLED !== 'false',
    healthCheckInterval: process.env.HEALTH_CHECK_INTERVAL ? parseInt(process.env.HEALTH_CHECK_INTERVAL) : undefined,
    maxRestartAttempts: process.env.MAX_RESTART_ATTEMPTS ? parseInt(process.env.MAX_RESTART_ATTEMPTS) : undefined,
    restartDelay: process.env.RESTART_DELAY ? parseInt(process.env.RESTART_DELAY) : undefined
  },
  performance: {
    contextSyncMaxLatency: process.env.CONTEXT_SYNC_MAX_LATENCY ? parseInt(process.env.CONTEXT_SYNC_MAX_LATENCY) : undefined,
    ragRetrievalMaxTime: process.env.RAG_RETRIEVAL_MAX_TIME ? parseInt(process.env.RAG_RETRIEVAL_MAX_TIME) : undefined,
    agentResponseMaxTime: process.env.AGENT_RESPONSE_MAX_TIME ? parseInt(process.env.AGENT_RESPONSE_MAX_TIME) : undefined,
    maxMemoryUsage: process.env.MAX_MEMORY_USAGE ? parseInt(process.env.MAX_MEMORY_USAGE) : undefined,
    taskCompletionTarget: process.env.TASK_COMPLETION_TARGET ? parseFloat(process.env.TASK_COMPLETION_TARGET) : undefined
  },
  logging: {
    level: (process.env.LOG_LEVEL as any) || 'info',
    directory: process.env.LOG_DIRECTORY,
    maxFileSize: process.env.LOG_MAX_FILE_SIZE ? parseInt(process.env.LOG_MAX_FILE_SIZE) : undefined,
    maxFiles: process.env.LOG_MAX_FILES ? parseInt(process.env.LOG_MAX_FILES) : undefined
  }
});