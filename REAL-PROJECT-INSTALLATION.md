# 🚀 Installing MCP/RAG System in Real Projects

## Quick Installation Methods

### Method 1: Clone and Integrate (Recommended)

```bash
# 1. Clone the MCP/RAG system
git clone https://github.com/w3bsuki/MCP-RAG-LAST.git
cd MCP-RAG-LAST

# 2. Install dependencies
npm install

# 3. Set up your existing project as a monitored directory
mkdir -p projects/my-project
cp -r /path/to/your/existing/project/* projects/my-project/

# 4. Configure for your project
cp .env.example .env
# Edit .env with your project-specific settings

# 5. Run setup and start
npm run setup
npm start
```

### Method 2: Add to Existing Project

```bash
# In your existing project directory
cd /path/to/your/project

# Add as a git submodule
git submodule add https://github.com/w3bsuki/MCP-RAG-LAST.git .mcp-rag
cd .mcp-rag

# Install and configure
npm install
cp .env.example .env

# Update the auditor to watch your main project
echo "WORKTREE_PATH=../" >> .env
echo "WATCH_PATTERNS=../**/*.{ts,js,tsx,jsx,py,java}" >> .env

# Start the system
npm start
```

### Method 3: NPX Quick Start (Future)

```bash
# Will be available soon
npx @w3bsuki/mcp-rag-system init
cd mcp-rag-system
npm start
```

## Real Project Integration Examples

### Example 1: React/Next.js Project

```bash
# Your existing React project structure:
my-react-app/
├── src/
├── components/
├── pages/
├── package.json
└── .mcp-rag/          # ← Add MCP/RAG here

cd my-react-app
git submodule add https://github.com/w3bsuki/MCP-RAG-LAST.git .mcp-rag
cd .mcp-rag

# Configure for React
cat > .env << EOF
# React-specific configuration
WATCH_PATTERNS=../**/*.{ts,tsx,js,jsx,json}
IGNORE_PATTERNS=../node_modules/**,../build/**,../.next/**
CONTEXT_UPDATE_INTERVAL=3000
AGENT_REACT_MODE=true
EOF

npm install && npm start
```

### Example 2: Python Django Project

```bash
# Your Django project
my-django-app/
├── myapp/
├── templates/
├── manage.py
└── .mcp-rag/          # ← Add MCP/RAG here

cd my-django-app
git clone https://github.com/w3bsuki/MCP-RAG-LAST.git .mcp-rag
cd .mcp-rag

# Configure for Python
cat > .env << EOF
# Python-specific configuration
WATCH_PATTERNS=../**/*.{py,html,css,js}
IGNORE_PATTERNS=../__pycache__/**,../venv/**,../.venv/**
PYTHON_PROJECT=true
DJANGO_SETTINGS_MODULE=myapp.settings
EOF

npm install && npm start
```

### Example 3: Multi-Language Monorepo

```bash
# Complex monorepo
monorepo/
├── frontend/          # React
├── backend/           # Node.js
├── mobile/            # React Native
├── docs/              # Markdown
└── .mcp-rag/          # ← Central MCP/RAG system

cd monorepo
git clone https://github.com/w3bsuki/MCP-RAG-LAST.git .mcp-rag
cd .mcp-rag

# Configure for monorepo
cat > .env << EOF
# Monorepo configuration
WATCH_PATTERNS=../**/*.{ts,tsx,js,jsx,py,java,md,json,yaml}
IGNORE_PATTERNS=**/node_modules/**,**/build/**,**/dist/**
MONOREPO_MODE=true
CONTEXT_UPDATE_INTERVAL=2000
MAX_CONCURRENT_TASKS=5
EOF

npm install && npm start
```

## Project-Specific Configurations

### For Large Codebases (>10k files)

```env
# Performance optimizations
CONTEXT_UPDATE_INTERVAL=10000
HEALTH_CHECK_INTERVAL=15000
RAG_MAX_RESULTS=5
IGNORE_LARGE_FILES=true
FILE_SIZE_LIMIT=1048576  # 1MB

# Selective watching
WATCH_PATTERNS=src/**/*.{ts,js},tests/**/*.{ts,js}
IGNORE_PATTERNS=node_modules/**,dist/**,build/**,coverage/**
```

### For Teams (Multiple Developers)

```env
# Team coordination
TEAM_MODE=true
SHARED_CONTEXT_REPO=git@github.com:yourteam/mcp-context.git
AGENT_NAMESPACE=dev-team
COLLABORATION_MODE=true

# Conflict resolution
AUTO_MERGE_ENABLED=false
REQUIRE_REVIEW=true
NOTIFICATION_WEBHOOK=https://your-slack-webhook.com
```

### For CI/CD Integration

```yaml
# .github/workflows/mcp-rag.yml
name: MCP/RAG Autonomous Development
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  autonomous-dev:
    runs-on: ubuntu-latest
    services:
      milvus:
        image: milvusdb/milvus:latest
        ports:
          - 19530:19530

    steps:
      - uses: actions/checkout@v3
        with:
          submodules: recursive

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Start MCP/RAG System
        run: |
          cd .mcp-rag
          npm install
          npm run setup
          npm test

      - name: Run Autonomous Analysis
        run: |
          cd .mcp-rag
          timeout 300 npm start &
          # Let it run for 5 minutes
          sleep 300
          npm run generate-report

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: mcp-rag-results
          path: .mcp-rag/reports/
```

## Configuration for Different Project Types

### Frontend Projects (React, Vue, Angular)

```typescript
// .mcp-rag/project-config.json
{
  "projectType": "frontend",
  "framework": "react", // or "vue", "angular"
  "agents": {
    "auditor": {
      "focus": ["components", "hooks", "styles", "tests"],
      "patterns": ["unused-imports", "prop-drilling", "state-management"]
    },
    "implementer": {
      "codeStyle": "functional-components",
      "testFramework": "jest",
      "stateManager": "redux" // or "zustand", "context"
    },
    "validator": {
      "e2eFramework": "cypress",
      "accessibilityChecks": true,
      "performanceMetrics": true
    }
  }
}
```

### Backend Projects (Node.js, Python, Java)

```typescript
// .mcp-rag/project-config.json
{
  "projectType": "backend",
  "language": "typescript", // or "python", "java"
  "agents": {
    "auditor": {
      "focus": ["security", "performance", "database", "api-design"],
      "patterns": ["sql-injection", "auth-issues", "rate-limiting"]
    },
    "implementer": {
      "architecture": "microservices", // or "monolith"
      "database": "postgresql",
      "testing": "jest"
    },
    "validator": {
      "securityScans": true,
      "loadTesting": true,
      "apiTesting": "supertest"
    }
  }
}
```

## Advanced Integration Patterns

### Pattern 1: Development Assistant Mode

```bash
# Start in assistant mode (less intrusive)
npm start -- --mode=assistant

# Only suggests improvements, doesn't make changes
# Perfect for initial adoption
```

### Pattern 2: Gradual Automation

```typescript
// .mcp-rag/automation-levels.json
{
  "week1": {
    "auditor": "suggest-only",
    "implementer": "disabled",
    "validator": "report-only"
  },
  "week2": {
    "auditor": "auto-create-tasks",
    "implementer": "simple-fixes-only",
    "validator": "auto-test"
  },
  "week3": {
    "auditor": "full-auto",
    "implementer": "full-auto",
    "validator": "full-auto"
  }
}
```

### Pattern 3: Custom Agent Development

```typescript
// Create project-specific agent
// .mcp-rag/src/agents/custom/my-agent.ts
import { BaseAgent } from '../base-agent.js';

export class MyProjectAgent extends BaseAgent {
  protected async onExecuteTask(task: Task): Promise<any> {
    switch (task.type) {
      case 'optimize-database':
        return await this.optimizeQueries();
      
      case 'update-documentation':
        return await this.generateDocs();
      
      default:
        return super.onExecuteTask(task);
    }
  }
}
```

## Monitoring Your Real Project

### Web Dashboard Setup (5 minutes)

```bash
# In .mcp-rag directory
npm install express socket.io cors

# Create simple dashboard
cat > dashboard.js << 'EOF'
const express = require('express');
const { Monitor } = require('./src/coordination/monitor.js');

const app = express();
const monitor = new Monitor();

app.get('/api/metrics', (req, res) => {
  res.json(monitor.getLatestMetrics());
});

app.get('/dashboard', (req, res) => {
  res.send(`
    <h1>MCP/RAG Dashboard</h1>
    <div id="metrics"></div>
    <script>
      setInterval(async () => {
        const metrics = await fetch('/api/metrics').then(r => r.json());
        document.getElementById('metrics').innerHTML = 
          '<pre>' + JSON.stringify(metrics, null, 2) + '</pre>';
      }, 1000);
    </script>
  `);
});

app.listen(3001, () => console.log('Dashboard: http://localhost:3001/dashboard'));
EOF

node dashboard.js
```

## Troubleshooting Real Projects

### Common Integration Issues

1. **File Permission Errors**
   ```bash
   # Fix permissions
   chmod -R 755 .mcp-rag/
   chown -R $USER:$USER .mcp-rag/
   ```

2. **Port Conflicts**
   ```env
   # Change default ports
   MCP_SERVER_PORT=19531
   MILVUS_PORT=19532
   DASHBOARD_PORT=3002
   ```

3. **Large File Watching**
   ```env
   # Optimize for large projects
   WATCH_DEBOUNCE=5000
   MAX_WATCHED_FILES=10000
   EXCLUDE_LARGE_DIRS=true
   ```

## Success Metrics

After integration, you should see:

✅ **Automated code analysis** within 5 minutes
✅ **Task generation** for improvements
✅ **Automatic implementations** (if enabled)
✅ **Continuous monitoring** in dashboard
✅ **Zero conflicts** with your workflow

## Next Steps

1. **Week 1**: Monitor and observe patterns
2. **Week 2**: Enable gradual automation
3. **Week 3**: Full autonomous development
4. **Ongoing**: Customize agents for your specific needs

---

🎉 **Your project now has autonomous AI development capabilities!**

The system will continuously analyze, improve, and maintain your codebase while you focus on building features.