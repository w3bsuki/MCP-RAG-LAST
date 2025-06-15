# 🚀 Install MCP/RAG System from GitHub

Since the package isn't published to NPM yet, you can install directly from GitHub:

## Method 1: Install as Git Dependency

```bash
# In your project directory (svelte-threadly-1)
npm install git+https://github.com/w3bsuki/MCP-RAG-LAST.git

# Then use the CLI
npx mcp-rag init
npx mcp-rag start
```

## Method 2: Clone and Link Locally

```bash
# Clone the repository
git clone https://github.com/w3bsuki/MCP-RAG-LAST.git
cd MCP-RAG-LAST

# Install dependencies
npm install

# Link globally
npm link

# Go to your project
cd ~/svelte-threadly-1

# Link the package
npm link @w3bsuki/mcp-rag-system

# Now you can use it
mcp-rag init
mcp-rag start
```

## Method 3: Use as Submodule (Recommended for now)

```bash
# In your svelte-threadly-1 directory
git submodule add https://github.com/w3bsuki/MCP-RAG-LAST.git .mcp-rag
cd .mcp-rag
npm install

# Configure for your Svelte project
cat > .env << EOF
PROJECT_NAME=svelte-threadly
PROJECT_TYPE=frontend
FRONTEND_FRAMEWORK=svelte
WATCH_PATTERNS=../src/**/*.{svelte,js,ts}
IGNORE_PATTERNS=../node_modules/**,../build/**
AUTOMATION_LEVEL=assistant
EOF

# Start the system
npm start
```

## Method 4: Direct NPX from GitHub

```bash
# Run directly from GitHub
npx github:w3bsuki/MCP-RAG-LAST create
```

## For Your Svelte Project

Since you're in `svelte-threadly-1`, here's the quickest setup:

```bash
# Option A: Quick submodule setup
git submodule add https://github.com/w3bsuki/MCP-RAG-LAST.git .mcp-rag
cd .mcp-rag && npm install && npm start

# Option B: Install from GitHub
npm install github:w3bsuki/MCP-RAG-LAST
npx mcp-rag init --type frontend --framework svelte
```

## Publishing to NPM (For Package Owner)

To publish the package to NPM:

```bash
# In the MCP-RAG-LAST directory
npm login
# Enter your NPM credentials

# Publish
npm publish --access public
```

Once published, everyone can use:
```bash
npm install @w3bsuki/mcp-rag-system
```