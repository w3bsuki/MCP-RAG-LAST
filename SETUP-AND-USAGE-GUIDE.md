# 🚀 MCP/RAG System - Complete Setup & Usage Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Detailed Setup](#detailed-setup)
3. [Usage Guide](#usage-guide)
4. [Testing & Validation](#testing--validation)
5. [Troubleshooting](#troubleshooting)
6. [Dashboard Options](#dashboard-options)

## Quick Start

Get the system running in under 5 minutes:

```bash
# 1. Prerequisites check
node --version  # Must show v18 or higher
git --version   # Must be installed

# 2. Clone and setup
git clone <repository>
cd autonomous-mcp-system
npm install

# 3. Quick Milvus setup (using Docker)
docker run -d --name milvus \
  -p 19530:19530 \
  -p 9091:9091 \
  milvusdb/milvus:latest

# 4. Configure
cp .env.example .env

# 5. Initialize and run
npm run setup
npm start
```

## Detailed Setup

### Step 1: System Requirements

Verify all prerequisites:

```bash
# Check Node.js version (must be 18+)
node --version

# Check npm version
npm --version

# Check Git
git --version

# Check available memory (need ~2GB free)
free -h  # Linux/WSL
# or
sysctl hw.memsize  # macOS
```

### Step 2: Milvus Installation Options

#### Option A: Docker (Recommended)
```bash
# Pull and run Milvus
docker run -d \
  --name milvus-standalone \
  -p 19530:19530 \
  -p 9091:9091 \
  -v milvus_data:/var/lib/milvus \
  milvusdb/milvus:latest

# Verify it's running
docker ps | grep milvus
curl http://localhost:9091/healthz
```

#### Option B: Milvus Lite (Embedded - Simpler)
```bash
# Install Milvus Lite
pip install milvus

# No separate server needed - it runs embedded
```

If using Milvus Lite, update `.env`:
```env
MILVUS_ADDRESS=./milvus.db  # Local file instead of server
```

### Step 3: Project Setup

```bash
# 1. Install dependencies
npm install

# 2. Create environment configuration
cp .env.example .env

# 3. Edit .env file with your settings
nano .env  # or use your preferred editor
```

Key `.env` settings:
```env
# Adjust these based on your needs
LOG_LEVEL=info                    # debug for troubleshooting
CONTEXT_UPDATE_INTERVAL=5000       # How often to sync (ms)
HEALTH_CHECK_INTERVAL=10000        # Agent health checks (ms)
MAX_RESTART_ATTEMPTS=3             # Before giving up

# If using authentication
MILVUS_TOKEN=your-token-here       # If Milvus has auth enabled
```

### Step 4: Initialize System

```bash
# Run setup script
npm run setup

# This will:
# - Create necessary directories
# - Initialize git repository
# - Set up worktree structure
# - Validate configuration
```

## Usage Guide

### Starting the System

#### Full System Launch
```bash
npm start

# You'll see:
# ✅ MCP Server starting...
# ✅ Recovery System online
# ✅ Auditor Agent ready
# ✅ Implementer Agent ready
# ✅ Validator Agent ready
```

#### Monitor System Health
```bash
# In a new terminal
npm run monitor

# Shows real-time:
# - Agent status (🟢 idle, 🔵 working, 🔴 error)
# - Task queue metrics
# - Performance stats
# - Memory usage
```

### Working with Agents

#### Manual Task Creation
```typescript
// Create a task via the context
npm run debug

// In debug console:
> context.addTask({
    id: 'task-001',
    type: 'implement_feature',
    description: 'Add user authentication',
    priority: 8,
    status: 'pending'
  })
```

#### Viewing Logs
```bash
# All logs
tail -f logs/mcp-*.log

# Specific agent logs
tail -f logs/mcp-*.log | grep "Auditor"
tail -f logs/mcp-*.log | grep "Implementer"
tail -f logs/mcp-*.log | grep "Validator"
```

### Development Workflow

1. **Add Code to Analyze**
   ```bash
   # Copy your project into a subdirectory
   cp -r ~/my-project ./projects/my-project
   
   # The Auditor will automatically detect and analyze
   ```

2. **Watch Task Flow**
   ```bash
   # Monitor shows tasks moving through states:
   # pending → in_progress → completed
   ```

3. **Check Agent Work**
   ```bash
   # Each agent works in isolation
   cd worktrees/agent-implementer
   git status  # See what the implementer changed
   ```

4. **Merge Changes**
   ```bash
   # Changes are automatically merged back
   # Or manually:
   git merge agent-implementer/main
   ```

## Testing & Validation

### Run System Tests
```bash
npm test

# Output:
# ✅ Context Manager - Initialize
# ✅ Context Manager - Update and Get
# ✅ Worktree Manager - Initialize
# ✅ Logger - All Levels
# ... more tests
```

### Verify MCP Tools
```bash
# Test individual tools
npm run test:mcp-tools

# Should show:
# ✅ update_context
# ✅ get_context
# ✅ rag_store
# ✅ rag_query
```

### Performance Validation
```bash
# Check if meeting targets
npm run test:performance

# Validates:
# - Context sync < 10s
# - RAG query < 2s
# - Memory < 1GB
```

## Troubleshooting

### Common Issues & Solutions

#### 1. Milvus Connection Failed
```
Error: Failed to connect to Milvus at localhost:19530
```

**Solution:**
```bash
# Check if Milvus is running
docker ps | grep milvus

# Check logs
docker logs milvus-standalone

# Restart if needed
docker restart milvus-standalone
```

#### 2. Agent Keeps Restarting
```
Warning: Agent auditor restarted 3 times
```

**Solution:**
```bash
# Check agent logs
grep "ERROR" logs/mcp-*.log | grep auditor

# Common fixes:
# - Increase memory limits
# - Check file permissions
# - Verify git worktree access
```

#### 3. High Memory Usage
```
Warning: Memory usage exceeds threshold
```

**Solution:**
```bash
# 1. Clear old logs
find logs -name "*.log" -mtime +7 -delete

# 2. Reduce RAG cache
echo "RAG_MAX_RESULTS=5" >> .env

# 3. Restart system
npm run restart
```

#### 4. Context Sync Delays
```
Warning: Context sync latency high: 15000ms
```

**Solution:**
```bash
# Increase update interval
echo "CONTEXT_UPDATE_INTERVAL=10000" >> .env

# Check disk I/O
iostat -x 1
```

### Debug Mode

For deep troubleshooting:
```bash
# 1. Enable debug logging
export LOG_LEVEL=debug

# 2. Run single component
tsx src/coordination/mcp-server.ts

# 3. Use debug REPL
npm run debug
> context.getContext()
> ragSystem.query("error")
```

## Dashboard Options

### Current Console Dashboard
The built-in monitor shows:
- Real-time agent status
- Task metrics
- Performance indicators
- System health

### Web Dashboard (Future)
The system is **ready** for a web dashboard:

```typescript
// The monitoring data structure exists
// Just needs a web server:

import express from 'express';
const app = express();

app.get('/api/metrics', (req, res) => {
  res.json(monitor.getLatestMetrics());
});

app.get('/api/agents', (req, res) => {
  res.json(monitor.getAgentStatuses());
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  monitor.on('metricsUpdated', (data) => {
    socket.emit('metrics', data);
  });
});
```

You could use:
- **React/Vue/Svelte** for frontend
- **Chart.js** for metrics visualization
- **WebSockets** for real-time updates
- **Tailwind** for quick styling

## Best Practices

1. **Regular Monitoring**
   - Keep monitor running during development
   - Check logs for warnings/errors
   - Watch task completion rates

2. **Resource Management**
   - Restart system daily for long runs
   - Clear logs weekly
   - Monitor disk space for RAG data

3. **Development Tips**
   - Test with small projects first
   - Use debug mode for troubleshooting
   - Keep tasks focused and specific

4. **Production Considerations**
   - Use environment-specific configs
   - Enable authentication for Milvus
   - Set up log rotation
   - Configure alerts for failures

## Next Steps

1. **Customize Agents**
   - Modify agent behaviors in `src/agents/*/`
   - Add new task types
   - Tune performance thresholds

2. **Extend RAG System**
   - Integrate real embeddings (Sentence-Transformers)
   - Add semantic search features
   - Implement caching layer

3. **Build Dashboard**
   - Create web interface
   - Add metrics visualization
   - Enable remote monitoring

4. **Scale Up**
   - Deploy to cloud (AWS/GCP/Azure)
   - Add more agents
   - Implement distributed coordination

---

🎉 **Congratulations!** Your autonomous MCP/RAG system is ready. The agents will now work continuously to analyze, implement, and validate code changes automatically.