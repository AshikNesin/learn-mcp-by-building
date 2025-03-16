/**
 * Simple MCP client using HTTP+SSE transport
 * 
 * This demonstrates how to connect to an MCP server using HTTP with Server-Sent Events,
 * where requests are sent via HTTP POST and responses are received via SSE.
 */
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fetch from 'node-fetch'; // You'll need to install this: npm install node-fetch
import EventSource from 'eventsource'; // You'll need to install this: npm install eventsource
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

class McpSseClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Extract options
    const {
      serverUrl,
      messagePath,
      sessionId = `client-${randomUUID()}`
    } = typeof options === 'string' ? { serverUrl: options } : options;
    
    if (!serverUrl) {
      throw new Error('Server URL is required');
    }
    
    this.serverUrl = serverUrl;
    this.sessionId = sessionId;
    this.messagePath = messagePath || this._deriveMessagePath(serverUrl);
    this.eventSource = null;
    this.initialized = false;
    this.nextId = 1;
    this.pendingRequests = new Map();
  }
  
  // Derive message path from SSE URL
  _deriveMessagePath(sseUrl) {
    try {
      const url = new URL(sseUrl);
      // If path is /mcp, use /message, otherwise derive from sseUrl
      if (url.pathname === '/mcp') {
        url.pathname = '/message';
        return url.toString();
      }
      
      // Replace last path component with 'message'
      const parts = url.pathname.split('/');
      if (parts.length > 1) {
        parts[parts.length - 1] = 'message';
        url.pathname = parts.join('/');
      } else {
        url.pathname = '/message';
      }
      return url.toString();
    } catch (err) {
      // Fallback to appending /message
      return sseUrl.replace(/\/$/, '') + '/message';
    }
  }

  async connect() {
    if (this.eventSource) {
      throw new Error('Already connected');
    }

    // Connect to SSE endpoint
    return new Promise((resolve, reject) => {
      // Create SSE connection with session ID in header
      this.eventSource = new EventSource(this.serverUrl, {
        headers: {
          'X-Session-ID': this.sessionId
        }
      });

      // Handle connection events
      this.eventSource.onopen = () => {
        console.log('SSE connection established');
        
        // Initialize the MCP connection
        this.initialize()
          .then(() => {
            console.log('MCP client initialized');
            resolve();
          })
          .catch(err => {
            console.error('Failed to initialize MCP connection:', err);
            this.close();
            reject(err);
          });
      };

      // Handle SSE messages (JSON-RPC responses)
      this.eventSource.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          this._handleResponse(response);
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      // Handle SSE errors
      this.eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        this.emit('error', err);
        
        if (!this.initialized) {
          reject(err);
        }
      };

      // Set a connection timeout
      const timeout = setTimeout(() => {
        if (!this.initialized) {
          const error = new Error('Connection timeout');
          this.close();
          reject(error);
        }
      }, 10000);

      // Clear timeout once initialized
      this.once('initialized', () => {
        clearTimeout(timeout);
      });
    });
  }

  async close() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.initialized = false;
    
    // Reject all pending requests
    for (const [id, { reject }] of this.pendingRequests.entries()) {
      reject(new Error('Connection closed'));
      this.pendingRequests.delete(id);
    }
    
    this.emit('close');
  }

  async initialize() {
    // Send initialize request with proper format according to MCP spec
    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05'
    });
    
    this.initialized = true;
    this.emit('initialized', result);
    
    return result;
  }

  async request(method, params = {}) {
    if (!this.eventSource && method !== 'initialize') {
      throw new Error('Not connected');
    }

    // Create JSON-RPC request
    const id = this.nextId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    // Track the request
    const responsePromise = new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
    });

    // Send request
    await this._sendRequest(request);

    // Wait for response
    return responsePromise;
  }

  // Send JSON-RPC request via HTTP POST
  async _sendRequest(request) {
    try {
      // Use the message path for POST requests
      const url = new URL(this.messagePath);
      // Add sessionId as query parameter
      url.searchParams.append('sessionId', this.sessionId);
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': this.sessionId
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('Error sending request:', error);
      
      // Fail the pending request
      const { reject } = this.pendingRequests.get(request.id) || {};
      if (reject) {
        reject(error);
        this.pendingRequests.delete(request.id);
      }
      
      throw error;
    }
  }

  // Handle JSON-RPC response received via SSE
  _handleResponse(response) {
    // Check if it's a connection message
    if (response.type === 'connection') {
      console.log(`Connection established with session ID: ${response.sessionId}`);
      // Update our session ID if provided
      if (response.sessionId) {
        this.sessionId = response.sessionId;
      }
      return;
    }
    
    // Check if it's a JSON-RPC response
    if (response.jsonrpc !== '2.0' || !response.id) {
      // Might be a different event
      return;
    }

    // Find the pending request
    const pendingRequest = this.pendingRequests.get(response.id);
    if (!pendingRequest) {
      console.warn(`Received response for unknown request ID: ${response.id}`);
      return;
    }

    // Handle error response
    if (response.error) {
      pendingRequest.reject(new Error(response.error.message || 'Unknown error'));
    } else {
      // Resolve with the result
      pendingRequest.resolve(response.result);
    }
    
    // Clean up
    this.pendingRequests.delete(response.id);
  }
  
  // Helper to get tool list
  async getToolList() {
    return this.request('tools/list');
  }
  
  // Helper to call a tool
  async callTool(name, args) {
    return this.request('tools/call', { name, arguments: args });
  }
}

// Example usage when run directly
async function runTest() {
  try {
    console.log('Starting MCP SSE client test...');
    
    // Parse command line arguments
    const argv = yargs(hideBin(process.argv))
      .option('server', {
        alias: 's',
        type: 'string',
        default: 'http://localhost:5000/sse',
        description: 'MCP server URL'
      })
      .help()
      .argv;
    
    // Create client and connect
    const client = new McpSseClient({
      serverUrl: argv.server
    });
    
    console.log(`Connecting to MCP server at ${argv.server}...`);
    await client.connect();
    
    // Get tool list
    console.log('Getting tool list...');
    const { tools } = await client.getToolList();
    
    console.log('Available tools:');
    for (const tool of tools) {
      console.log(`- ${tool.name}: ${tool.description}`);
    }
    
    // Call the calculator tool
    console.log('\nTesting calculator tool:');
    
    // Test addition
    const addResult = await client.callTool('calculator', {
      operation: 'add',
      a: 5,
      b: 3
    });
    console.log('Addition result:', addResult);
    
    // Test division
    const divResult = await client.callTool('calculator', {
      operation: 'divide',
      a: 10,
      b: 2
    });
    console.log('Division result:', divResult);
    
    // Test division by zero (error case)
    try {
      const errorResult = await client.callTool('calculator', {
        operation: 'divide',
        a: 10,
        b: 0
      });
      console.log('Division by zero result:', errorResult);
    } catch (error) {
      console.log('Division by zero error (as expected):', error.message);
    }
    
    // Close the connection
    await client.close();
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// When run directly, execute the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runTest();
}

export { McpSseClient }; 
