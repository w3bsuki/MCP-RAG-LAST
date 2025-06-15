# Claude-Code Role-Based MCP/RAG System

## Core Concept
Instead of autonomous agents, we use Claude-Code instances with specific roles, coordinating through a shared task system with MCP/RAG providing tools and memory.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Task Manager (MCP)                  │
│  - Creates/updates tasks with tags                   │
│  - Filters tasks by role                            │
│  - Tracks task status and dependencies              │
└──────────────────┬──────────────────────────────────┘
                   │
     ┌─────────────┴─────────────┬─────────────────┐
     │                           │                   │
┌────▼──────┐           ┌───────▼────────┐   ┌─────▼──────┐
│ Claude #1 │           │   Claude #2    │   │ Claude #3  │
│ AUDITOR   │           │  IMPLEMENTER   │   │ VALIDATOR  │
├───────────┤           ├────────────────┤   ├────────────┤
│ Analyzes  │           │ Writes code    │   │ Tests code │
│ Creates   │           │ Implements     │   │ Validates  │
│ tasks     │           │ features       │   │ Deploys    │
└───────────┘           └────────────────┘   └────────────┘
     │                           │                   │
     └─────────────┬─────────────┴─────────────────┘
                   │
            ┌──────▼──────┐
            │  RAG Memory │
            │  (Milvus)   │
            └─────────────┘
```

## Implementation Steps

### Phase 1: Task Management System
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  tags: string[];        // ["IMPLEMENT", "FEATURE", "URGENT"]
  assignedRole?: Role;   // "auditor" | "implementer" | "validator"
  status: TaskStatus;    // "pending" | "in_progress" | "blocked" | "done"
  dependencies?: string[]; // Other task IDs
  context?: string;      // RAG reference for relevant knowledge
  createdBy: string;     // Which Claude instance created this
  priority: number;      // 1-5
}
```

### Phase 2: Role Configuration
```typescript
interface RoleConfig {
  name: string;
  watchTags: string[];
  ignoreTags: string[];
  capabilities: string[];
  rules: string[];
  prompts: {
    initialization: string;
    taskSelection: string;
    taskExecution: string;
  };
}
```

### Phase 3: MCP Tools for Claude-Code

1. **Task Management Tools:**
   - `create_task` - Create new task with tags
   - `update_task` - Update task status/details
   - `get_tasks` - Get tasks filtered by role/tags
   - `claim_task` - Assign task to self
   - `complete_task` - Mark task as done

2. **Code Tools:**
   - `analyze_codebase` - Get project structure
   - `edit_file` - Modify source files
   - `run_command` - Execute terminal commands
   - `commit_changes` - Git operations

3. **Memory Tools:**
   - `store_pattern` - Save code patterns to RAG
   - `query_patterns` - Find similar solutions
   - `store_decision` - Document why something was done
   - `get_context` - Retrieve project context

### Phase 4: Claude-Code Launcher

The launcher will:
1. Start 3 Claude-Code instances in separate terminals
2. Inject role-specific configuration
3. Provide MCP connection details
4. Initialize with role-specific prompts

Example launch command:
```bash
npm run claude:auditor    # Terminal 1
npm run claude:implementer # Terminal 2  
npm run claude:validator   # Terminal 3
```

## Key Differences from Current Implementation

1. **No BaseAgent class** - Replace with RoleConfig
2. **No agent processes** - Claude-Code IS the process
3. **Task-centric** - Everything revolves around tasks
4. **Tag-based routing** - Simple but powerful
5. **Shared context** - All Claudes see the same tasks

## Example Workflow

1. **Human → Claude #1 (Auditor):**
   "Analyze my Svelte app for performance issues"

2. **Claude #1 creates tasks:**
   - Task: "Optimize bundle size" [PERFORMANCE, IMPLEMENT]
   - Task: "Add lazy loading" [PERFORMANCE, FEATURE]
   - Task: "Remove unused deps" [CLEANUP, IMPLEMENT]

3. **Claude #2 (Implementer) sees new tasks:**
   - Claims "Add lazy loading"
   - Implements feature
   - Updates task status
   - Creates "Test lazy loading" [TEST, VALIDATE]

4. **Claude #3 (Validator) sees test task:**
   - Runs test suite
   - Validates implementation
   - Marks task complete or creates fix tasks

## Benefits

1. **Uses Claude's actual intelligence**
2. **Simple coordination via tasks**
3. **Flexible tag system**
4. **Shared learning through RAG**
5. **No fake autonomous behavior**

## Next Steps

1. Refactor current agent system to role configs
2. Build task management MCP tools
3. Create Claude-Code launcher
4. Test with real Svelte project