/**
 * MCP Server example using HTTP with Server-Sent Events (SSE) transport
 * 
 * This implements the MCP HTTP+SSE transport specification:
 * https://spec.modelcontextprotocol.io/specification/2024-11-05/basic/transports/#http-with-sse
 */
import { McpServer } from '../core/index.js';
import { HttpSseTransport } from '../transports/index.js';
import { calculatorToolDefinition, handleCalculatorTool } from '../tools/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a server with tool capabilities
const server = new McpServer(
  {
    name: 'mcp-http-sse-server',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {
        listChanged: true
      }
    },
    instructions: 'This server provides a simple calculator tool over HTTP+SSE.'
  }
);

// Track active requests by ID
const activeRequests = new Map();

// Handler for tools/list method
server.setRequestHandler('tools/list', () => {
  return {
    tools: [calculatorToolDefinition]
  };
});

// Handler for tools/call method
server.setRequestHandler('tools/call', async (params) => {
  const { name, arguments: args } = params;
  
  if (name !== 'calculator') {
    throw new Error(`Tool ${name} not found`);
  }
  
  // Use the shared calculator tool handler and return raw result
  return handleCalculatorTool(args);
});

// When run directly, start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse command line arguments
  const argv = yargs(hideBin(process.argv))
    .option('port', {
      type: 'number',
      default: 5000,
      description: 'Port to listen on'
    })
    .option('host', {
      type: 'string',
      default: '0.0.0.0',
      description: 'Host to bind to'
    })
    .option('path', {
      type: 'string',
      default: '/sse',
      description: 'Endpoint path'
    })
    .option('cors', {
      type: 'boolean',
      default: true,
      description: 'Enable CORS'
    })
    .option('serve-static', {
      type: 'boolean',
      default: true,
      description: 'Serve static files'
    })
    .help()
    .argv;
  
  console.error(`Starting MCP server with HTTP+SSE transport on port ${argv.port}...`);
  
  // Create and configure the HTTP+SSE transport
  const transport = new HttpSseTransport({
    port: argv.port,
    host: argv.host,
    endpoint: argv.path,
    cors: argv.cors
  });
  
  // Set up connection handling
  transport.app.on('connection', (socket) => {
    console.error('New SSE connection established');
    
    socket.on('close', () => {
      console.error('SSE connection closed');
      // Clean up any pending requests for this socket
      for (const [id, request] of activeRequests.entries()) {
        if (request.sessionId === socket.id) {
          activeRequests.delete(id);
        }
      }
    });
  });
  
  // Serve static files if enabled
  if (argv.serveStatic) {
    const publicPath = path.join(__dirname, 'public');
    transport.app.use(express.static(publicPath));
    
    // Redirect root to index.html
    transport.app.get('/', (req, res) => {
      res.redirect('/index.html');
    });
  }
  
  // Handle messages from clients
  transport.onmessage = (message, sessionId) => {
    if (!message.id) {
      console.error('Received message without ID:', message);
      return;
    }

    console.error(`Processing message ${message.id} from session ${sessionId}`);

    // Track the request with timestamp
    activeRequests.set(message.id, { 
      sessionId, 
      message,
      timestamp: Date.now()
    });
    
    // Clean up old requests (older than 5 minutes)
    const now = Date.now();
    for (const [id, request] of activeRequests.entries()) {
      if (now - request.timestamp > 5 * 60 * 1000) {
        activeRequests.delete(id);
      }
    }
    
    // Process with the MCP server
    server._onMessage(message);
  };
  
  // Custom handling for responses
  const originalHandleRequest = server._handleRequest.bind(server);
  server._handleRequest = async function(request) {
    try {
      const result = await originalHandleRequest(request);
      
      if (result && request.id) {
        const activeRequest = activeRequests.get(request.id);
        if (!activeRequest) {
          console.error(`No active request found for ID ${request.id}`);
          return null;
        }

        // Send raw result without additional formatting
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result
        };

        await transport.send(response, activeRequest.sessionId);
        activeRequests.delete(request.id);
        return null;
      }
      
      return result;
    } catch (error) {
      if (request.id) {
        const activeRequest = activeRequests.get(request.id);
        if (activeRequest) {
          const errorResponse = {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32603,
              message: error.message || 'Internal error'
            }
          };
          
          await transport.send(errorResponse, activeRequest.sessionId);
          activeRequests.delete(request.id);
        }
      }
      
      return null;
    }
  };
  
  // Start the server
  server.connect(transport)
    .then(() => console.error('Server ready!'))
    .catch(error => console.error('Failed to start server:', error));
} 
