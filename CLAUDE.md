# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Autonomous MCP/RAG Multi-Agent Development System that creates a self-sustaining 3-agent system using the Model Context Protocol (MCP) with RAG (Retrieval-Augmented Generation) memory. The system eliminates the "agent stopping" problem through proper coordination, shared memory, and isolation patterns.

## Development Commands

### Setup and Build
```bash
npm install           # Install all dependencies
npm run setup         # Initialize git worktrees and directories
npm run build         # Compile TypeScript to JavaScript
npm run typecheck     # Check TypeScript types without building
```

### Running the System
```bash
npm start             # Launch entire system (MCP server + all agents)
npm run monitor       # Real-time monitoring dashboard
npm run recover       # Run recovery system standalone
npm run debug         # Debug system state
```

### Development
```bash
npm run dev           # Run with auto-reload
npm run lint          # Run ESLint
npm run format        # Format code with Prettier
npm test              # Run all system tests
```

### Individual Components
```bash
# Start components individually (for debugging)
tsx src/coordination/mcp-server.ts
tsx src/agents/auditor/auditor-agent.ts
tsx src/agents/implementer/implementer-agent.ts
tsx src/agents/validator/validator-agent.ts
```

## Architecture

### System Flow
1. **MCP Server** starts and initializes shared context and RAG system
2. **Recovery System** monitors all agents and restarts failed ones
3. **Auditor Agent** watches files, analyzes code, generates tasks
4. **Implementer Agent** picks up tasks, writes code in isolated worktree
5. **Validator Agent** tests implementations, ensures quality
6. All agents communicate through shared context via MCP tools

### Core Components

1. **MCP Server** (`src/coordination/mcp-server.ts`)
   - Implements 4 MCP tools for agent coordination
   - Manages shared context and RAG operations
   - All agents connect to this server via stdio transport

2. **Agent System** (`src/agents/`)
   - `BaseAgent` class provides lifecycle, health monitoring, MCP client
   - Each agent extends BaseAgent with specific capabilities
   - Agents work in isolated git worktrees to prevent conflicts

3. **Context Management** (`src/coordination/context/context-manager.ts`)
   - Atomic file operations with backup support
   - Debounced updates (5-10 second intervals)
   - Version tracking and conflict resolution

4. **RAG System** (`src/coordination/rag-system.ts`)
   - Uses Milvus vector database (requires local instance)
   - Stores code analysis, implementation patterns, validation results
   - Placeholder embeddings (production needs real embedding model)

5. **Recovery System** (`src/coordination/recovery/recovery-system.ts`)
   - Health checks every 10 seconds
   - Auto-restart with exponential backoff (max 3 attempts)
   - Monitors task queue and agent states

### Key Design Patterns

- **Event-Driven**: Components use EventEmitter for loose coupling
- **Fail-Safe**: All operations have error handling and recovery
- **Atomic Operations**: Context updates are atomic with file locking
- **Isolation**: Each agent works in separate git worktree
- **Monitoring**: Built-in performance tracking and alerting

### Configuration

System configured via environment variables (see `.env.example`):
- `CONTEXT_UPDATE_INTERVAL`: How often to sync context (default: 5000ms)
- `RECOVERY_ENABLED`: Enable/disable auto-recovery (default: true)
- `LOG_LEVEL`: Logging verbosity (debug|info|warn|error)
- `RAG_COLLECTION_NAME`: Milvus collection name

### Performance Targets
- Context sync latency: < 10 seconds
- RAG retrieval time: < 2 seconds
- Agent response time: < 5 seconds
- Memory usage: < 1GB baseline
- Task completion rate: > 90%

### Important Notes

1. **Milvus Dependency**: RAG system expects Milvus running on localhost:19530
2. **Git Requirement**: System uses git worktrees, requires initialized git repo
3. **Node Version**: Requires Node.js 18+ for native fetch and other features
4. **TypeScript**: All source in TypeScript, use `tsx` for direct execution