/**
 * MCP Server example using StdioTransport
 * 
 * This implements a simple MCP server with calculator tool
 * that communicates via stdin/stdout
 */
import { McpServer } from '../core/index.js';
import { StdioTransport } from '../transports/index.js';
import { calculatorToolDefinition, handleCalculatorTool } from '../tools/index.js';

// Create a server with tool capabilities
const server = new McpServer(
  {
    name: 'mcp-stdio-server',
    version: '0.1.0'
  },
  {
    // Declare tools capability as required by spec
    capabilities: {
      tools: {
        // Support for tool list change notifications
        listChanged: true
      }
    },
    instructions: 'This server provides a simple calculator tool for basic math operations.'
  }
);

// Handler for tools/list method
// Clients use this to discover available tools and their schemas
server.setRequestHandler('tools/list', () => {
  return {
    tools: [calculatorToolDefinition]
  };
});

// Handler for tools/call method
// This is where tool invocation and execution happens
server.setRequestHandler('tools/call', async (params) => {
  const { name, arguments: args } = params;
  
  // Validate tool exists
  if (name !== 'calculator') {
    throw new Error(`Tool ${name} not found`);
  }
  
  // Use the shared calculator tool handler
  return handleCalculatorTool(args);
});

// When run directly, start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('Starting MCP server with STDIO transport...');
  
  const transport = new StdioTransport();
  
  // Connect and start serving tool requests
  server.connect(transport)
    .then(() => console.error('Server ready!'))
    .catch(error => console.error('Failed to start server:', error));
}

export { server }; 
