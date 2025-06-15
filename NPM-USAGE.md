# 📦 NPM Package Usage

## 🚀 Installation Methods

### Method 1: Interactive Installer (Recommended)

```bash
npx @w3bsuki/mcp-rag-system@latest create

# Or using npm init
npm init @w3bsuki/mcp-rag-system
```

This will:
- ✅ Ask configuration questions interactively
- ✅ Set up project structure
- ✅ Configure agents based on your project type
- ✅ Install dependencies automatically
- ✅ Create git repository
- ✅ Set up Milvus if needed

### Method 2: Global Installation

```bash
# Install globally
npm install -g @w3bsuki/mcp-rag-system

# Create new project
create-mcp-rag

# Use CLI commands anywhere
mcp-rag start
mcp-rag monitor
mcp-rag config
```

### Method 3: Add to Existing Project

```bash
# In your project directory
npm install @w3bsuki/mcp-rag-system

# Initialize
npx mcp-rag init

# Start
npx mcp-rag start
```

## 🎮 Interactive Installer Features

When you run `npx @w3bsuki/mcp-rag-system create`, you'll be asked:

### 1. Project Configuration
```
? What is your project name? (mcp-rag-system)
? What type of project are you building?
  ❯ Full Stack (React + Node.js)
    Frontend (React/Vue/Angular)
    Backend (Node.js/Python/Java)
    Monorepo (Multiple projects)
    Custom Configuration
```

### 2. Database Setup
```
? How do you want to set up Milvus (Vector DB)?
  ❯ Docker (Recommended)
    Milvus Lite (Embedded)
    Existing Milvus Server
    Skip for now
```

### 3. Feature Selection
```
? Enable web dashboard? (Y/n)
? Which agents do you want to enable?
  ◉ Auditor (Code Analysis)
  ◉ Implementer (Code Generation)
  ◉ Validator (Testing)
```

### 4. Automation Level
```
? Select automation level:
  ❯ Observer Mode (Just watch and suggest)
    Assistant Mode (Suggest and create tasks)
    Semi-Auto (Implement simple fixes)
    Full Auto (Complete autonomy)
```

## 🖥️ CLI Commands

After installation, use the `mcp-rag` CLI:

```bash
# Start system with options
mcp-rag start --mode full-auto --dashboard

# Configure interactively
mcp-rag config

# Check system health
mcp-rag status

# Monitor in real-time
mcp-rag monitor

# View logs
mcp-rag logs           # All logs
mcp-rag logs auditor   # Specific agent

# Stop system
mcp-rag stop
```

## 📋 Configuration File

The installer creates `mcp-rag.config.json`:

```json
{
  "name": "my-project",
  "type": "fullstack",
  "agents": ["auditor", "implementer", "validator"],
  "automationLevel": "assistant",
  "dashboard": true,
  "framework": "React"
}
```

## 🔧 Environment Variables

The installer creates `.env` with:

```env
# Project Configuration
PROJECT_NAME=my-project
PROJECT_TYPE=fullstack
AUTOMATION_LEVEL=assistant

# Milvus Configuration
MILVUS_ADDRESS=localhost:19530

# Agent Configuration
ENABLED_AGENTS=auditor,implementer,validator
CONTEXT_UPDATE_INTERVAL=5000
HEALTH_CHECK_INTERVAL=10000

# Watch Patterns
WATCH_PATTERNS=src/**/*.{js,jsx,ts,tsx}
IGNORE_PATTERNS=node_modules/**,build/**
```

## 🎯 Usage Examples

### Example 1: React Project

```bash
npx @w3bsuki/mcp-rag-system create

# Answer: Frontend, React, Docker, Full agents, Assistant mode

cd my-react-app
./start-milvus.sh   # Start Milvus
npm start           # Start agents
npm run dashboard   # Open http://localhost:3001
```

### Example 2: Backend API

```bash
npx @w3bsuki/mcp-rag-system create

# Answer: Backend, Node.js, Milvus Lite, Auditor+Validator, Observer mode

cd my-api
npm start --mode observer
```

### Example 3: Existing Project

```bash
cd my-existing-project
npm install @w3bsuki/mcp-rag-system

# Initialize with current directory
npx mcp-rag init --here

# Start monitoring
npx mcp-rag start --agents auditor
```

## 🚨 Common Issues

### 1. Permission Denied
```bash
# Fix executable permissions
chmod +x node_modules/.bin/mcp-rag
chmod +x node_modules/.bin/create-mcp-rag
```

### 2. Port Already in Use
```bash
# Change ports in .env
MCP_SERVER_PORT=19531
DASHBOARD_PORT=3002
```

### 3. Milvus Connection Failed
```bash
# Use embedded mode
echo "MILVUS_ADDRESS=./milvus.db" >> .env
```

## 📦 Publishing to NPM

To publish this package:

```bash
# Build TypeScript
npm run build

# Test locally
npm link
create-mcp-rag test-project

# Publish
npm login
npm publish --access public
```

## 🎉 Benefits of NPM Distribution

1. **One Command Setup**: `npx @w3bsuki/mcp-rag-system create`
2. **Interactive Configuration**: No manual file editing
3. **Automatic Updates**: Always get latest version with npx
4. **Global CLI**: Use `mcp-rag` commands anywhere
5. **Version Control**: Specify exact versions in package.json
6. **Easy Integration**: Add to any project with npm install

## 🔗 Links

- NPM Package: https://www.npmjs.com/package/@w3bsuki/mcp-rag-system
- GitHub: https://github.com/w3bsuki/MCP-RAG-LAST
- Documentation: https://github.com/w3bsuki/MCP-RAG-LAST/docs

---

Now anyone can install your MCP/RAG system with a single command! 🚀