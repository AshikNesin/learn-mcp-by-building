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
  
  // Use the shared calculator tool handler
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
      default: 'localhost',
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
    console.error(`Received message from session ${sessionId}:`, message);
    
    // Ensure sessionId is properly attached
    if (!message._sessionId && sessionId) {
      message._sessionId = sessionId;
    }
    
    // Log for debugging
    console.error(`Processing message with _sessionId: ${message._sessionId}, method: ${message.method}`);
    
    // Special handling for initialize requests
    if (message.method === 'initialize') {
      console.error('Received initialize request, setting up session...');
    }
    
    // Process with the MCP server
    server._onMessage(message);
  };
  
  // Custom handling for responses to ensure they go to the right client
  const originalHandleRequest = server._handleRequest.bind(server);
  server._handleRequest = async function(request) {
    // Extract the session ID from the request and store it
    const sessionId = request._sessionId;
    console.error(`Handling request with session ID: ${sessionId}`, request);
    
    try {
      // Process the request
      const result = await originalHandleRequest(request);
      
      // Send response to the client
      if (result && request.id) {
        console.error(`Sending response for request ${request.id} to session ${sessionId}`);
        
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result
        };
        
        await transport.send(response, sessionId);
        return null; // Prevent double sending
      }
      
      return result;
    } catch (error) {
      // Handle errors
      console.error(`Error handling request ${request.id}:`, error);
      
      if (request.id) {
        const errorResponse = {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32603,
            message: error.message || 'Internal error'
          }
        };
        
        await transport.send(errorResponse, sessionId);
      }
      
      return null;
    }
  };
  
  // Start the server
  server.connect(transport)
    .then(() => console.error('Server ready!'))
    .catch(error => console.error('Failed to start server:', error));
} 
