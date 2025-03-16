/**
 * Simple MCP Client for testing the MCP server
 */
import { spawn } from 'child_process';

// Constants
const JSONRPC_VERSION = '2.0';
const LATEST_PROTOCOL_VERSION = '2024-11-05';

/**
 * Simple transport for communicating with a child process
 */
class ProcessTransport {
  constructor(command, args = []) {
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this._buffer = '';
    this._child = null;
    this._command = command;
    this._args = args;
  }

  async start() {
    // Start the child process
    this._child = spawn(this._command, this._args, {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    // Set up event handlers
    this._child.stdout.on('data', this._onData);
    this._child.on('error', this._onError);
    this._child.on('close', this._onClose);

    return Promise.resolve();
  }

  async close() {
    if (this._child && !this._child.killed) {
      this._child.stdin.end();
      this._child.kill();
    }
    return Promise.resolve();
  }

  async send(message) {
    if (!this._child || this._child.killed) {
      throw new Error('Process not running');
    }

    return new Promise((resolve, reject) => {
      const json = JSON.stringify(message) + '\n';
      if (this._child.stdin.write(json)) {
        resolve();
      } else {
        this._child.stdin.once('drain', resolve);
      }
    });
  }

  _onData = (chunk) => {
    this._buffer += chunk.toString();
    this._processBuffer();
  }

  _onError = (error) => {
    if (this.onerror) {
      this.onerror(error);
    }
  }

  _onClose = (code) => {
    console.log(`Child process exited with code ${code}`);
    if (this.onclose) {
      this.onclose();
    }
  }

  _processBuffer() {
    const lines = this._buffer.split('\n');
    
    // Keep the last line (potentially incomplete) in the buffer
    this._buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim() === '') continue;
      
      try {
        const message = JSON.parse(line);
        if (this.onmessage) {
          this.onmessage(message);
        }
      } catch (error) {
        console.error('Failed to parse JSON:', error);
      }
    }
  }
}

/**
 * Simple MCP Client
 */
class McpClient {
  constructor(clientInfo = {
    name: 'mcp-test-client',
    version: '0.1.0'
  }) {
    this.clientInfo = clientInfo;
    this.transport = null;
    this.requestId = 0;
    this._responseHandlers = new Map();
    this._serverCapabilities = null;
    this._serverInfo = null;
    this._initialized = false;
  }

  async connect(transport) {
    this.transport = transport;
    
    // Set up transport event handlers
    transport.onmessage = (message) => this._onMessage(message);
    transport.onclose = () => this._onClose();
    transport.onerror = (error) => this._onError(error);
    
    await transport.start();
    
    // Initialize the connection
    await this._initialize();
    
    return this;
  }

  async close() {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }

  async _initialize() {
    console.log('Initializing connection to server...');
    
    const result = await this.request('initialize', {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {
        // Add capabilities as needed
        sampling: {},
        resources: {}
      },
      clientInfo: this.clientInfo
    });
    
    this._serverCapabilities = result.capabilities;
    this._serverInfo = result.serverInfo;
    console.log(`Connected to server: ${result.serverInfo.name} v${result.serverInfo.version}`);
    console.log(`Protocol version: ${result.protocolVersion}`);
    
    // Send initialized notification
    await this.notification('notifications/initialized');
    this._initialized = true;
    
    return result;
  }

  async request(method, params = {}) {
    if (!this.transport) {
      throw new Error('Not connected');
    }
    
    const id = this.requestId++;
    const request = {
      jsonrpc: JSONRPC_VERSION,
      id,
      method,
      params
    };
    
    return new Promise((resolve, reject) => {
      // Set up a timeout
      const timeout = setTimeout(() => {
        this._responseHandlers.delete(id);
        reject(new Error('Request timed out'));
      }, 60000);
      
      // Store the handler
      this._responseHandlers.set(id, (response) => {
        clearTimeout(timeout);
        if ('error' in response) {
          reject(new Error(`Error ${response.error.code}: ${response.error.message}`));
        } else {
          resolve(response.result);
        }
      });
      
      // Send the request
      this.transport.send(request).catch(reject);
    });
  }

  async notification(method, params = {}) {
    if (!this.transport) {
      throw new Error('Not connected');
    }
    
    const notification = {
      jsonrpc: JSONRPC_VERSION,
      method,
      params
    };
    
    await this.transport.send(notification);
  }

  _onMessage(message) {
    // Log the message for debugging
    console.log('Received message:', JSON.stringify(message, null, 2));
    
    // Handle different message types
    if (message.jsonrpc !== JSONRPC_VERSION) {
      console.error('Invalid message: Not a valid JSON-RPC 2.0 message');
      return;
    }
    
    if ('id' in message && 'method' in message) {
      // It's a request from the server
      this._handleRequest(message);
    } else if (!('id' in message) && 'method' in message) {
      // It's a notification from the server
      this._handleNotification(message);
    } else if ('id' in message && ('result' in message || 'error' in message)) {
      // It's a response to one of our requests
      this._handleResponse(message);
    } else {
      // It's an invalid message
      console.error('Invalid message format');
    }
  }

  _handleRequest(request) {
    // For simplicity, we'll just respond with an error
    this.transport.send({
      jsonrpc: JSONRPC_VERSION,
      id: request.id,
      error: {
        code: -32601,
        message: 'Method not implemented in this client'
      }
    }).catch(console.error);
  }

  _handleNotification(notification) {
    console.log(`Received notification: ${notification.method}`);
    // Handle specific notifications here
  }

  _handleResponse(response) {
    const handler = this._responseHandlers.get(response.id);
    if (handler) {
      this._responseHandlers.delete(response.id);
      handler(response);
    } else {
      console.warn(`Received response for unknown request ID: ${response.id}`);
    }
  }

  _onClose() {
    console.log('Connection closed');
  }

  _onError(error) {
    console.error('Transport error:', error);
  }

  // Helper methods
  isInitialized() {
    return this._initialized;
  }

  getServerCapabilities() {
    return this._serverCapabilities;
  }

  getServerInfo() {
    return this._serverInfo;
  }
}

// Run this as a script
if (import.meta.url === `file://${process.argv[1]}`) {
  const client = new McpClient();
  const transport = new ProcessTransport('node', ['mcp-server-with-tools.js']);
  
  console.log('Starting MCP client...');
  
  client.connect(transport)
    .then(async () => {
      console.log('Client connected and initialized');
      
      // Add your test requests here
      try {
        // Example ping request
        console.log('Sending ping request...');
        const pingResult = await client.request('ping');
        console.log('Ping result:', pingResult);
      } catch (error) {
        console.error('Error during testing:', error);
      }
      
      // Close the connection
      await client.close();
    })
    .catch(error => {
      console.error('Failed to connect:', error);
    });
}

export { McpClient, ProcessTransport }; 
