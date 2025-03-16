/**
 * Simple MCP (Model Context Protocol) Server implementation
 * 
 * This is a basic implementation focusing on server connection,
 * without using the official SDK.
 * 
 * This server follows the MCP specification for server-side implementation
 * See: https://spec.modelcontextprotocol.io/specification/2024-11-05/
 */

import { StdioTransport } from './stdio-transport.js';

// Protocol and version constants
const JSONRPC_VERSION = '2.0';  // MCP uses JSON-RPC 2.0 as its base protocol
const LATEST_PROTOCOL_VERSION = '2024-11-05';  // Current MCP protocol version
const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, '2024-10-07'];  // For backwards compatibility
const SERVER_INFO = {
  name: 'simple-mcp-server',
  version: '0.1.0'
};

/**
 * MCP Server implementation
 */
class McpServer {
  constructor(serverInfo = SERVER_INFO, options = {}) {
    // Server identity and configuration
    this.serverInfo = serverInfo;
    this.options = options;
    
    // Transport layer - handles raw message exchange
    this.transport = null;
    
    // Server capabilities - advertised during initialization
    // Capabilities determine which protocol features are available
    this.capabilities = options.capabilities || {};
    
    // Request handlers map method names to their implementations
    this.requestHandlers = new Map();
    
    // Track pending responses to outgoing requests
    this._responseHandlers = new Map();
    this.requestId = 0;  // Auto-incrementing request ID counter
    
    // Client information received during initialization
    this._clientCapabilities = null;  // Features supported by the client
    this._clientVersion = null;       // Client protocol version
    
    // Register core protocol handlers
    
    // Initialize handler - Required by MCP spec for capability negotiation
    this.setRequestHandler('initialize', this._handleInitialize.bind(this));
    
    // Ping handler - Basic protocol utility for connection health checks
    this.setRequestHandler('ping', () => ({}));
  }

  // Connect to a transport layer (e.g., stdio, HTTP+SSE)
  // The transport handles raw message exchange
  async connect(transport) {
    this.transport = transport;
    
    // Set up transport event handlers for the MCP message lifecycle
    transport.onmessage = this._onMessage.bind(this);  // Incoming messages
    transport.onclose = () => console.error('Connection closed');  // Connection termination
    transport.onerror = (error) => console.error('Transport error:', error);  // Transport errors
    
    // Start the transport and begin accepting messages
    await transport.start();
    return this;
  }

  // Gracefully close the connection
  async close() {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }

  // Handle incoming messages according to JSON-RPC and MCP specs
  _onMessage(message) {
    // Log for debugging (MCP allows logging on stderr)
    console.error('Received message:', JSON.stringify(message, null, 2));
    
    // Validate JSON-RPC version as required by spec
    if (message.jsonrpc !== JSONRPC_VERSION) {
      return this._sendError(message.id, -32600, 'Invalid Request: Not a valid JSON-RPC 2.0 message');
    }
    
    // Route message based on JSON-RPC message type:
    if ('id' in message && 'method' in message) {
      // Request: Has ID and method, expects response
      this._handleRequest(message);
    } else if (!('id' in message) && 'method' in message) {
      // Notification: Has method but no ID, no response expected
      this._handleNotification(message);
    } else if ('id' in message && ('result' in message || 'error' in message)) {
      // Response: Has ID and result/error, matches a previous request
      this._handleResponse(message);
    } else {
      // Invalid message format
      if ('id' in message) {
        this._sendError(message.id, -32600, 'Invalid Request');
      }
    }
  }

  // Register a handler for a specific method
  // This is how the server implements its capabilities
  setRequestHandler(method, handler) {
    this.requestHandlers.set(method, handler);
  }

  // Send a request to the client
  // Used for features like sampling where server needs client input
  async request(method, params = {}) {
    if (!this.transport) {
      throw new Error('Not connected');
    }
    
    // Create unique ID for this request
    const id = this.requestId++;
    const request = {
      jsonrpc: JSONRPC_VERSION,
      id,
      method,
      params
    };
    
    return new Promise((resolve, reject) => {
      // Set up timeout as required by spec (60s is common)
      const timeout = setTimeout(() => {
        this._responseHandlers.delete(id);
        reject(new Error('Request timed out'));
      }, 60000);
      
      // Store handler to be called when response arrives
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

  // Send a notification to the client
  // Used for events that don't require responses (e.g., resource updates)
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

  // Handle incoming requests from the client
  async _handleRequest(request) {
    const { id, method, params } = request;
    const handler = this.requestHandlers.get(method);
    
    // Method not found - required by JSON-RPC spec
    if (!handler) {
      return this._sendError(id, -32601, `Method not found: ${method}`);
    }
    
    try {
      // Execute handler and send successful result
      const result = await handler(params || {});
      await this._sendResponse(id, result);
    } catch (error) {
      // Handle errors during execution
      console.error(`Error handling request ${method}:`, error);
      await this._sendError(id, -32603, error.message || 'Internal error');
    }
  }

  // Handle incoming notifications (no response required)
  async _handleNotification(notification) {
    const { method } = notification;
    
    // Special handling for initialization completion
    if (method === 'notifications/initialized') {
      console.error('Initialization completed');
      return;
    }
    
    // Log other notifications for debugging
    console.error(`Received notification: ${method}`);
  }

  // Handle responses to our outgoing requests
  _handleResponse(response) {
    const handler = this._responseHandlers.get(response.id);
    if (handler) {
      this._responseHandlers.delete(response.id);
      handler(response);
    }
  }

  // Send a successful response
  async _sendResponse(id, result) {
    await this.transport.send({
      jsonrpc: JSONRPC_VERSION,
      id,
      result
    });
  }

  // Send an error response following JSON-RPC error codes
  async _sendError(id, code, message, data) {
    await this.transport.send({
      jsonrpc: JSONRPC_VERSION,
      id,
      error: { code, message, data }
    });
  }

  // Handle initialization request from client
  // This is where capability negotiation happens
  async _handleInitialize(params) {
    // Store client information for future use
    this._clientCapabilities = params.capabilities;
    this._clientVersion = params.clientInfo;
    
    // Negotiate protocol version
    const requestedVersion = params.protocolVersion;
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
      ? requestedVersion
      : LATEST_PROTOCOL_VERSION;
    
    // Return server capabilities and info
    return {
      protocolVersion,
      capabilities: this.capabilities,
      serverInfo: this.serverInfo,
      ...(this.options.instructions && { instructions: this.options.instructions })
    };
  }

  // Utility methods to access client info
  getClientCapabilities() {
    return this._clientCapabilities;
  }

  getClientVersion() {
    return this._clientVersion;
  }
}

// Export classes
export { McpServer, StdioTransport };

// When run directly, start a basic server
if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('Starting MCP server...');
  
  const server = new McpServer();
  const transport = new StdioTransport();
  
  server.connect(transport)
    .then(() => console.error('Server ready!'))
    .catch(error => console.error('Failed to start server:', error));
} 
