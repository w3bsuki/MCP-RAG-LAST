# Autonomous MCP/RAG Multi-Agent Development System

A self-sustaining 3-agent system using the Model Context Protocol (MCP) with RAG (Retrieval-Augmented Generation) memory that eliminates the "agent stopping" problem through proper coordination, shared memory, and isolation patterns.

## 🚀 Features

- **3 Specialized Autonomous Agents**
  - **Auditor**: Analyzes code and creates implementation plans
  - **Implementer**: Executes tasks and writes code
  - **Validator**: Tests implementations and ensures quality

- **MCP Server with 4 Core Tools**
  - `update_context`: Share state between agents
  - `get_context`: Retrieve coordination state
  - `rag_store`: Store knowledge in vector DB
  - `rag_query`: Retrieve relevant context

- **Advanced Capabilities**
  - Git worktree isolation for conflict-free development
  - RAG memory system for persistent knowledge
  - Automatic recovery and health monitoring
  - Real-time shared context synchronization
  - Performance monitoring dashboard

## 📋 Prerequisites

- Node.js 18+ LTS
- Git
- TypeScript knowledge (for customization)

## 🛠️ Installation

```bash
# Clone the repository
git clone <repository-url>
cd autonomous-mcp-system

# Install dependencies
npm install

# Run setup
npm run setup
```

## 🚀 Quick Start

```bash
# Launch the entire system
npm start

# Monitor system health (in another terminal)
npm run monitor

# Run tests
npm test
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