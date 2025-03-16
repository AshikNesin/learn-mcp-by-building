/**
 * Extended MCP Server example implementing the Tools feature
 * See: https://spec.modelcontextprotocol.io/specification/2024-11-05/server/tools/
 *
 * Tools in MCP allow language models to:
 * 1. Discover available tools and their capabilities
 * 2. Invoke tools to interact with external systems
 * 3. Process tool results in a standardized format
 * 4. Handle errors appropriately
 */
import { McpServer, StdioTransport } from './lib/mcp-server.js';

// Create a server with tool capabilities
const server = new McpServer(
  {
    name: 'mcp-server-with-tools',
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
    tools: [
      {
        // Tool definition following MCP spec:
        name: 'calculator',  // Unique identifier
        description: 'Performs basic math operations',  // Human-readable description
        // JSON Schema defining expected parameters
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['add', 'subtract', 'multiply', 'divide']
            },
            a: {
              type: 'number'
            },
            b: {
              type: 'number'
            }
          },
          required: ['operation', 'a', 'b']
        }
      }
    ]
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
  
  // Validate required arguments
  // As per spec, we should validate all inputs
  if (!args || !args.operation || typeof args.a !== 'number' || typeof args.b !== 'number') {
    return {
      content: [
        {
          type: 'text',
          text: 'Invalid arguments. Please provide operation, a, and b.'
        }
      ],
      isError: true  // Indicate this is an error result
    };
  }
  
  // Execute the tool operation
  let result;
  try {
    switch (args.operation) {
      case 'add':
        result = args.a + args.b;
        break;
      case 'subtract':
        result = args.a - args.b;
        break;
      case 'multiply':
        result = args.a * args.b;
        break;
      case 'divide':
        // Handle division by zero error
        if (args.b === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'Cannot divide by zero'
              }
            ],
            isError: true
          };
        }
        result = args.a / args.b;
        break;
      default:
        // Handle unsupported operation
        return {
          content: [
            {
              type: 'text',
              text: `Unsupported operation: ${args.operation}`
            }
          ],
          isError: true
        };
    }
    
    // Return successful result following the Tool Result format
    return {
      content: [
        {
          type: 'text',
          text: `Result of ${args.a} ${args.operation} ${args.b} = ${result}`
        }
      ]
    };
  } catch (error) {
    // Handle unexpected errors during execution
    return {
      content: [
        {
          type: 'text',
          text: `Error executing calculator: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// When run directly, start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('Starting MCP server with tools...');
  
  const transport = new StdioTransport();
  
  // Connect and start serving tool requests
  server.connect(transport)
    .then(() => console.error('Server ready!'))
    .catch(error => console.error('Failed to start server:', error));
}

export { server }; 
