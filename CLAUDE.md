# CLAUDE.md - Claude-Code MCP/RAG Task System

This file provides guidance to Claude Code when working with this task-based coordination system.

## Project Overview

This is a Claude-Code based task coordination system where multiple Claude instances work together through shared tasks, MCP tools, and RAG memory.

**IMPORTANT**: This is NOT an autonomous agent system. YOU (Claude) are the intelligence. The system provides:
- Role configurations (Auditor, Implementer, Validator)
- Task management with tags
- MCP tools for coordination
- RAG memory for patterns

## Quick Start

### For Humans
```bash
# 1. Start Milvus (required for RAG)
docker run -d --name milvus-standalone -p 19530:19530 -p 9091:9091 milvusdb/milvus:v2.3.3 milvus run standalone

# 2. Install dependencies
npm install

# 3. Start MCP server
npm run start:mcp

# 4. In separate terminals, start Claude instances
npm run claude:auditor      # Terminal 1
npm run claude:implementer   # Terminal 2  
npm run claude:validator     # Terminal 3
```

### For Claude Instances

When you start, you'll receive:
1. Your role (Auditor, Implementer, or Validator)
2. Tags to watch for
3. Available MCP tools
4. Rules and guidelines

Start by running:
```javascript
// See what tasks are available for your role
get_tasks({ 
  tags: ["YOUR_WATCH_TAGS"], 
  status: ["pending"] 
})
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Task Manager (MCP)                  │
│  - Shared task list with tags                       │
│  - Task status tracking                              │
│  - Role-based filtering                             │
└──────────────────┬──────────────────────────────────┘
                   │
     ┌─────────────┴─────────────┬─────────────────┐
     │                           │                   │
┌────▼──────┐           ┌───────▼────────┐   ┌─────▼──────┐
│ Claude #1 │           │   Claude #2    │   │ Claude #3  │
│ AUDITOR   │           │  IMPLEMENTER   │   │ VALIDATOR  │
└───────────┘           └────────────────┘   └────────────┘
     │                           │                   │
     └─────────────┬─────────────┴─────────────────┘
                   │
            ┌──────▼──────┐
            │  RAG Memory │
            └─────────────┘
```

## Available MCP Tools

### Task Management
- `create_task(title, description, tags, priority?)` - Create new task
- `get_tasks(filter?)` - Get filtered task list
- `claim_task(taskId)` - Assign task to yourself
- `update_task(taskId, updates)` - Update task details
- `complete_task(taskId, results?)` - Mark task complete

### Context & Memory
- `update_context(updates)` - Share information
- `get_context(paths?)` - Read shared context
- `rag_store(content, metadata)` - Save patterns
- `rag_query(query)` - Find similar solutions

## Role Guidelines

### Auditor Role
**Purpose**: Analyze code and create improvement tasks

**Watch Tags**: `ANALYZE`, `AUDIT`, `REVIEW`, `SECURITY`, `PERFORMANCE`

**Workflow**:
1. Analyze codebase for issues
2. Create detailed tasks with proper tags
3. Store patterns in RAG for future reference

**Example**:
```javascript
// After analyzing
create_task({
  title: "Optimize bundle size",
  description: "Current bundle is 2.3MB, can be reduced by code splitting",
  tags: ["IMPLEMENT", "PERFORMANCE"],
  priority: 4
})
```

### Implementer Role
**Purpose**: Write code and implement features

**Watch Tags**: `IMPLEMENT`, `FEATURE`, `FIX`, `REFACTOR`, `UPDATE`

**Workflow**:
1. Claim tasks matching your tags
2. Query RAG for similar implementations
3. Write code following patterns
4. Create test tasks when done

**Example**:
```javascript
// Before implementing
const similar = await rag_query("dark mode implementation svelte")

// After implementing
complete_task(taskId, {
  files: ["src/lib/theme.ts", "src/App.svelte"],
  commands: ["npm run build"]
})

create_task({
  title: "Test dark mode feature",
  description: "Validate dark mode works across all components",
  tags: ["TEST", "VALIDATE"]
})
```

### Validator Role
**Purpose**: Test and validate implementations

**Watch Tags**: `TEST`, `VALIDATE`, `DEPLOY`, `RELEASE`, `CHECK`

**Workflow**:
1. Run tests on completed features
2. Validate builds and deployments
3. Create fix tasks for failures

**Example**:
```javascript
// After testing
if (testsFailed) {
  create_task({
    title: "Fix failing dark mode tests",
    description: "Tests fail on mobile viewport",
    tags: ["FIX", "IMPLEMENT"],
    priority: 5
  })
}
```

## Task Tag Reference

### Action Tags
- `IMPLEMENT` - Write new code
- `FIX` - Fix bugs
- `REFACTOR` - Improve existing code
- `TEST` - Write/run tests
- `ANALYZE` - Analyze for issues
- `REVIEW` - Code review needed

### Category Tags
- `FEATURE` - New functionality
- `BUG` - Something broken
- `PERFORMANCE` - Speed/efficiency
- `SECURITY` - Security issues
- `UI` - User interface
- `API` - Backend/API work

### Priority Levels
- 5: Critical (security, breaking bugs)
- 4: High (important features, performance)
- 3: Normal (standard tasks)
- 2: Low (nice to have)
- 1: Trivial (cleanup, minor issues)

## Best Practices

1. **One Task at a Time**: Focus on single tasks to completion
2. **Use RAG**: Always query for similar patterns before implementing
3. **Tag Properly**: This is how tasks route between roles
4. **Create Follow-ups**: When done, create tasks for the next role
5. **Document Decisions**: Store important patterns in RAG

## Common Workflows

### Feature Development
1. Human → Auditor: "Add user authentication"
2. Auditor creates: "Implement auth system" [FEATURE, IMPLEMENT]
3. Implementer claims, builds feature
4. Implementer creates: "Test auth system" [TEST]
5. Validator tests, creates fixes if needed

### Bug Fix Flow
1. Validator finds: "Tests failing on Safari"
2. Creates: "Fix Safari compatibility" [BUG, FIX]
3. Implementer fixes issue
4. Creates: "Verify Safari fix" [TEST]
5. Validator confirms fix

## Troubleshooting

### Can't find tasks?
```javascript
// Check all pending tasks
get_tasks({ status: ["pending"], includeCompleted: false })
```

### Task blocked?
```javascript
update_task(taskId, { 
  status: "blocked", 
  blockedBy: "Waiting for API credentials" 
})
```

### Need context?
```javascript
// Get all context
const ctx = await get_context()

// Get specific context
const tasks = await get_context(["tasks"])
```

Remember: You're Claude with a specific role. Use your intelligence to solve problems, don't just follow scripts!