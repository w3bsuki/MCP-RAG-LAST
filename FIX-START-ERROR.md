# 🔧 Fix for "Missing script: start" Error

The error occurs because the MCP/RAG system needs to be initialized first. Here's how to fix it:

## Solution 1: Initialize First (Recommended)

```bash
# In your svelte-threadly-1 directory:

# 1. First initialize the MCP/RAG system
npx mcp-rag init --type frontend --framework svelte

# 2. This creates the necessary configuration files
# 3. Then start the system
npx mcp-rag start
```

## Solution 2: Manual Setup

If the init command doesn't work, create these files manually:

### 1. Create `mcp-rag.config.json`:
```json
{
  "name": "svelte-threadly",
  "type": "frontend",
  "framework": "svelte",
  "agents": ["auditor", "implementer", "validator"],
  "automationLevel": "assistant",
  "dashboard": true
}
```

### 2. Create `.env`:
```env
PROJECT_TYPE=frontend
FRAMEWORK=svelte
MILVUS_ADDRESS=./milvus.db
AUTOMATION_LEVEL=assistant
WATCH_PATTERNS=src/**/*.{svelte,js,ts,css}
IGNORE_PATTERNS=node_modules/**,build/**,.svelte-kit/**
```

### 3. Then run:
```bash
npx mcp-rag start
```

## Solution 3: Use the Submodule Approach

Since the NPM package isn't published yet, the most reliable method is:

```bash
# In your svelte-threadly-1 directory:
git submodule add https://github.com/w3bsuki/MCP-RAG-LAST.git .mcp-rag
cd .mcp-rag
npm install

# Configure for Svelte
cat > .env << 'EOF'
PROJECT_NAME=svelte-threadly
PROJECT_TYPE=frontend
FRONTEND_FRAMEWORK=svelte
WATCH_PATTERNS=../src/**/*.{svelte,js,ts,css}
IGNORE_PATTERNS=../node_modules/**,../.svelte-kit/**
AUTOMATION_LEVEL=full-auto
MILVUS_ADDRESS=./milvus.db
EOF

# Start directly
npm start
```

## Why This Error Happens

The `mcp-rag start` command tries to run `npm start` in your current directory, but your Svelte project doesn't have a `start` script for the MCP/RAG system. The initialization step creates the necessary configuration and scripts.

## Quick Debug

To see what's in your current directory:
```bash
ls -la
cat package.json | grep scripts -A 5
```

This will show if MCP/RAG is properly installed and configured.