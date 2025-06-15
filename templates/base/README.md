# MCP/RAG Autonomous Agent System

This project was bootstrapped with [create-mcp-rag](https://github.com/w3bsuki/MCP-RAG-LAST).

## 🚀 Quick Start

```bash
# Start the system
npm start

# Open monitor
npm run monitor

# View dashboard (if enabled)
npm run dashboard
```

## 🤖 Available Commands

```bash
mcp-rag start           # Start the system
mcp-rag monitor         # Open system monitor
mcp-rag config          # Configure agents
mcp-rag status          # Check system health
mcp-rag logs [agent]    # View logs
mcp-rag stop            # Stop all agents
```

## 📁 Project Structure

```
.
├── agents/            # Agent configurations
├── src/               # System source code
├── worktrees/         # Git isolation for agents
├── rag-store/         # Vector database storage
├── logs/              # System logs
└── mcp-rag.config.json # Your configuration
```

## ⚙️ Configuration

Edit `mcp-rag.config.json` or run:

```bash
mcp-rag config
```

### Automation Levels

- **Observer**: Just watches and suggests
- **Assistant**: Creates tasks but doesn't implement
- **Semi-Auto**: Implements simple fixes
- **Full Auto**: Complete autonomous development

## 📚 Documentation

- [Full Documentation](https://github.com/w3bsuki/MCP-RAG-LAST)
- [API Reference](https://github.com/w3bsuki/MCP-RAG-LAST/docs)
- [Examples](https://github.com/w3bsuki/MCP-RAG-LAST/examples)

## 🆘 Troubleshooting

### Milvus not connecting?
```bash
# Check if Milvus is running
docker ps | grep milvus

# Or use embedded mode
echo "MILVUS_ADDRESS=./milvus.db" >> .env
```

### Agents not starting?
```bash
# Check status
mcp-rag status

# View logs
mcp-rag logs auditor
```

## 🤝 Support

- [GitHub Issues](https://github.com/w3bsuki/MCP-RAG-LAST/issues)
- [Discord Community](https://discord.gg/mcp-rag)

---

Built with ❤️ by the MCP/RAG Team