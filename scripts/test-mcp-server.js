import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { logger } from '../src/utils/logger.js';
async function testMCPServer() {
    logger.info('TestMCPServer', 'Starting MCP server test');
    try {
        // Spawn the MCP server
        const serverProcess = spawn('tsx', ['src/coordination/mcp-server.ts'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
        });
        // Create client
        const client = new Client({
            name: 'test-client',
            version: '1.0.0'
        }, {
            capabilities: {}
        });
        // Connect to server
        const transport = new StdioClientTransport({
            command: 'tsx',
            args: ['src/coordination/mcp-server.ts']
        });
        await client.connect(transport);
        logger.info('TestMCPServer', 'Connected to MCP server');
        // Test listing tools
        const tools = await client.listTools();
        logger.info('TestMCPServer', 'Available tools:', tools);
        // Test update_context
        const updateResult = await client.callTool('update_context', {
            updates: {
                testKey: 'testValue',
                timestamp: new Date().toISOString()
            },
            agentId: 'test-agent'
        });
        logger.info('TestMCPServer', 'Update context result:', updateResult);
        // Test get_context
        const getResult = await client.callTool('get_context', {});
        logger.info('TestMCPServer', 'Get context result:', getResult);
        // Test rag_store
        const storeResult = await client.callTool('rag_store', {
            content: 'This is a test document for the RAG system',
            metadata: {
                type: 'test',
                source: 'test-script'
            }
        });
        logger.info('TestMCPServer', 'RAG store result:', storeResult);
        // Test rag_query
        const queryResult = await client.callTool('rag_query', {
            query: 'test document',
            maxResults: 5
        });
        logger.info('TestMCPServer', 'RAG query result:', queryResult);
        // Cleanup
        await client.close();
        serverProcess.kill();
        logger.info('TestMCPServer', 'All tests passed!');
    }
    catch (error) {
        logger.error('TestMCPServer', 'Test failed', error);
        process.exit(1);
    }
}
// Run the test
testMCPServer().catch(console.error);
//# sourceMappingURL=test-mcp-server.js.map