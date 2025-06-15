# Claude-Code MCP/RAG Task Coordination System

> **✅ Real Implementation: Claude-Code instances working together via tasks!**

A task-based coordination system where multiple Claude-Code instances collaborate through MCP tools, shared task management, and RAG memory. This is NOT an autonomous agent system - Claude provides the intelligence.

## 🚀 Features

- **3 Claude-Code Roles**
  - **Auditor**: Analyzes code and creates improvement tasks
  - **Implementer**: Claims tasks and writes code
  - **Validator**: Tests implementations and ensures quality

- **Task-Based Coordination**
  - Tasks with tags route work between roles
  - Priority-based task queue
  - Dependency tracking
  - Status workflows

- **MCP Server with 9 Tools**
  - `create_task`, `get_tasks`, `claim_task`, `update_task`, `complete_task`
  - `update_context`, `get_context`
  - `rag_store`, `rag_query`

- **Advanced Capabilities**
  - Real vector search with Milvus
  - Shared context and memory
  - Role-specific configurations
  - Tag-based task routing

## 📋 Prerequisites

- Node.js 18+ LTS
- Git
- Docker Desktop (for Milvus vector database)
- TypeScript knowledge (for customization)

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/w3bsuki/MCP-RAG-LAST.git
cd MCP-RAG-LAST

# Install dependencies
npm install

# Start Milvus (required for RAG)
docker run -d --name milvus-standalone \
  -p 19530:19530 -p 9091:9091 \
  milvusdb/milvus:v2.3.3 milvus run standalone
```

## 🚀 Quick Start

```bash
# 1. Start the MCP server
npm run start:mcp

# 2. In separate terminals, launch Claude instances
npm run claude:auditor      # Terminal 1
npm run claude:implementer   # Terminal 2
npm run claude:validator     # Terminal 3

# 3. Create some example tasks
npm run task:seed

# 4. Watch the Claudes work!
npm run task:list
```

## 📁 Project Structure

```
autonomous-mcp-system/
├── src/
│   ├── agents/           # Agent implementations
│   │   ├── auditor/     # Code analysis agent
│   │   ├── implementer/ # Implementation agent
│   │   └── validator/   # Validation agent
│   ├── coordination/    # Core coordination systems
│   │   ├── context/     # Shared context management
│   │   ├── recovery/    # Recovery and monitoring
│   │   └── mcp-server.ts # MCP server implementation
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── agents/              # Agent configurations
├── scripts/             # Launch and utility scripts
├── worktrees/          # Git worktrees for agents
├── rag-store/          # Vector database storage
└── logs/               # System logs
```

## 🔧 Configuration

The system can be configured through environment variables or by modifying `src/config/index.ts`:

```env
# .env example
NODE_ENV=production
LOG_LEVEL=info
CONTEXT_UPDATE_INTERVAL=5000
RAG_COLLECTION_NAME=mcp_knowledge
RECOVERY_ENABLED=true
```

## 📊 Performance Metrics

- **Context sync latency**: < 10 seconds
- **RAG retrieval time**: < 2 seconds  
- **Agent response time**: < 5 seconds
- **System startup time**: < 30 seconds
- **Memory usage**: < 1GB baseline
- **Task completion rate**: > 90%

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:performance
```

## 📈 Monitoring

The system includes a real-time monitoring dashboard:

```bash
npm run monitor
```

Features:
- Agent health status
- Task queue metrics
- Performance indicators
- Memory usage tracking
- Alert notifications

## 🔄 Recovery System

The recovery system automatically:
- Monitors agent health via heartbeats
- Restarts failed agents (max 3 attempts)
- Maintains system stability
- Logs all recovery actions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Troubleshooting

### Common Issues

1. **Agents not starting**
   - Check if ports are available
   - Verify Node.js version (18+)
   - Run `npm run setup` again

2. **High memory usage**
   - Check task queue size
   - Review RAG storage size
   - Restart the system

3. **Context sync delays**
   - Check network connectivity
   - Review system load
   - Increase update intervals

### Debug Mode

```bash
npm run debug
```

## 📚 Documentation

- [Architecture Overview](docs/architecture.md)
- [Agent Development Guide](docs/agents.md)
- [MCP Protocol Reference](https://modelcontextprotocol.io)
- [Performance Tuning](docs/performance.md)

## 🎯 Roadmap

- [ ] Web UI for monitoring
- [ ] Agent plugin system
- [ ] Cloud deployment support
- [ ] Multi-project orchestration
- [ ] Advanced learning capabilities

## 💬 Support

- GitHub Issues: [Report bugs or request features]
- Documentation: [Read the docs]
- Community: [Join our Discord]

---

Built with ❤️ for autonomous development