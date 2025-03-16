# Model Context Protocol (MCP) Specification Study

This document provides a detailed exploration of the Model Context Protocol (MCP) specification, focusing on the key components needed to implement a server from scratch in JavaScript.

## 1. Introduction to MCP

The Model Context Protocol (MCP) is an open protocol designed to enable AI assistants to interact with external tools and data sources. It bridges the gap between large language models (LLMs) and external systems, providing a standardized way for AI assistants to:

- List available tools
- Call tools with parameters
- Handle errors in a consistent way
- Access resources and external data

MCP follows a client-server architecture:
- **MCP Servers**: Expose tools and resources to AI assistants
- **MCP Clients**: Applications that use LLMs and consume MCP servers
- **MCP Hosts**: Systems that facilitate communication between clients and servers

## 2. Key Specification Components

### 2.1 Transport Protocols

MCP supports two primary transport mechanisms:

#### Standard I/O (STDIO)
- Used for local processes
- Messages prefixed with content length header
- Simple pipe-based communication

Example header format:
```
Content-Length: 123

{"jsonrpc":"2.0",...}
```

#### Server-Sent Events (SSE)
- Used for network-based communication
- HTTP-based protocol for server-to-client pushing
- Supports web-based integration

### 2.2 Message Format

MCP uses JSON-RPC 2.0 as its message format, which includes:

```javascript
// Basic JSON-RPC message structure
{
  "jsonrpc": "2.0",        // Protocol version (always "2.0")
  "id": "unique-id-1234",  // Request ID (string or number)
  "method": "method.name", // Method to call
  "params": {}             // Method parameters
}
```

Responses follow this format:

```javascript
// Successful response
{
  "jsonrpc": "2.0",
  "id": "unique-id-1234",
  "result": {} // Result object
}

// Error response
{
  "jsonrpc": "2.0",
  "id": "unique-id-1234",
  "error": {
    "code": -32000,         // Error code
    "message": "Error message",
    "data": {} // Optional additional error information
  }
}
```

## 3. MCP Methods

### 3.1 List Tools Method

The `tools/list` method allows clients to discover available tools. This operation supports pagination.

#### Request:
```javascript
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/list",
  "params": {
    "cursor": "optional-cursor-value" // Optional pagination cursor
  }
}
```

#### Response:
```javascript
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "tools": [
      {
        "name": "calculator.add",
        "description": "Adds two numbers together",
        "inputSchema": {
          "type": "object",
          "properties": {
            "a": {
              "type": "number",
              "description": "First number"
            },
            "b": {
              "type": "number",
              "description": "Second number"
            }
          },
          "required": ["a", "b"]
        }
      }
    ],
    "nextCursor": "next-page-cursor" // Optional - for pagination
  }
}
```

### 3.2 Call Tool Method

The `tools/call` method executes a specific tool:

#### Request:
```javascript
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/call",
  "params": {
    "name": "calculator.add",
    "arguments": {
      "a": 5,
      "b": 7
    }
  }
}
```

#### Response:
```javascript
{
  "jsonrpc": "2.0",
  "id": "2",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "12"
      }
    ],
    "isError": false
  }
}
```

### 3.3 List Changed Notification

When the list of available tools changes, servers that declared the `listChanged` capability should send a notification:

```javascript
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/list_changed"
}
```

### 3.4 Connection Lifecycle

MCP defines a structured lifecycle for connections between clients and servers:

### 3.4.1 Initialization

1. Client sends `initialize` request with protocol version and capabilities
2. Server responds with its protocol version and capabilities
3. Client sends `initialized` notification as acknowledgment
4. Normal message exchange begins

### 3.4.2 Message Exchange

After initialization, the following patterns are supported:
- **Request-Response**: Client or server sends requests, the other responds
- **Notifications**: Either party sends one-way messages

### 3.4.3 Termination

Either party can terminate the connection:
- Clean shutdown via transport mechanisms
- Transport disconnection
- Error conditions

For stdio transport, the client normally initiates shutdown by closing the input stream to the server.
For HTTP transport, shutdown is indicated by closing the associated HTTP connection.

## 4. Error Handling

MCP defines specific error codes for various scenarios:

| Code Range | Description |
|------------|-------------|
| -32700 | Parse error (invalid JSON) |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| -32000 to -32099 | Server error |
| 100 to 999 | MCP-specific errors |

Common MCP-specific error codes:

| Code | Name | Description |
|------|------|-------------|
| 100 | ToolNotFound | The requested tool was not found |
| 101 | ToolExecutionError | Error during tool execution |
| 102 | InvalidToolParameters | Tool parameters are invalid |
| 103 | Timeout | Operation timed out |
| 104 | Cancelled | Operation was cancelled |

Error response example:
```javascript
{
  "jsonrpc": "2.0",
  "id": "2",
  "error": {
    "code": 100,
    "message": "Tool 'calculator.divide_by_zero' not found",
    "data": {
      "available_tools": ["calculator.add", "calculator.subtract"]
    }
  }
}
```

## 5. Message Validation

To ensure protocol compliance, messages should be validated for:

### 5.1 Structural Validation
- Valid JSON format
- Required fields presence
- Correct field types
- Adherence to JSON-RPC 2.0 spec

### 5.2 Content Validation
- Tool name existence
- Parameter type checking
- Required parameter verification
- Value range checking

JavaScript validation example:
```javascript
function validateListToolsRequest(message) {
  // Check if message is a proper JSON-RPC message
  if (message.jsonrpc !== "2.0") {
    return { valid: false, error: "Invalid JSON-RPC version" };
  }
  
  if (typeof message.id !== "string" && typeof message.id !== "number") {
    return { valid: false, error: "Invalid or missing id" };
  }
  
  if (message.method !== "tools/list") {
    return { valid: false, error: "Invalid method name" };
  }
  
  // For list_tools, params should be an empty object
  if (message.params && Object.keys(message.params).length > 0) {
    return { valid: false, error: "tools/list expects empty params" };
  }
  
  return { valid: true };
}

function validateCallToolRequest(message) {
  // Basic JSON-RPC validation
  if (message.jsonrpc !== "2.0") {
    return { valid: false, error: "Invalid JSON-RPC version" };
  }
  
  if (typeof message.id !== "string" && typeof message.id !== "number") {
    return { valid: false, error: "Invalid or missing id" };
  }
  
  if (message.method !== "tools/call") {
    return { valid: false, error: "Invalid method name" };
  }
  
  // Call tool specific validation
  if (!message.params) {
    return { valid: false, error: "Missing params" };
  }
  
  if (typeof message.params.name !== "string" || !message.params.name) {
    return { valid: false, error: "Tool name is required" };
  }
  
  return { valid: true };
}
```

## 6. Implementing a Basic Message Parser (JavaScript)

Here's an implementation of a simple MCP message parser for STDIO transport:

```javascript
const readline = require('readline');

class McpMessageParser {
  constructor() {
    this.contentLength = null;
    this.buffer = '';
    this.headers = {};
    this.messageCallback = null;
  }
  
  setMessageCallback(callback) {
    this.messageCallback = callback;
  }
  
  setupStdioHandling() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: null,
      terminal: false
    });
    
    let headerMode = true;
    let currentData = '';
    
    rl.on('line', (line) => {
      if (headerMode) {
        // Parse headers
        if (line === '') {
          // Empty line indicates end of headers
          headerMode = false;
          
          // If we have a content length, prepare to read the body
          if (this.contentLength !== null) {
            // Now we read the body directly from stdin
            this.readBody();
          }
          return;
        }
        
        // Parse header lines (e.g., Content-Length: 123)
        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          const [_, headerName, headerValue] = match;
          this.headers[headerName] = headerValue;
          
          if (headerName === 'Content-Length') {
            this.contentLength = parseInt(headerValue, 10);
          }
        }
      }
    });
  }
  
  readBody() {
    if (this.contentLength === null) return;
    
    let data = '';
    let bytesRead = 0;
    
    const onData = (chunk) => {
      data += chunk.toString();
      bytesRead += chunk.length;
      
      if (bytesRead >= this.contentLength) {
        // We have the full message
        process.stdin.removeListener('data', onData);
        
        // We might have read more than needed
        const message = data.slice(0, this.contentLength);
        
        try {
          const parsedMessage = JSON.parse(message);
          if (this.messageCallback) {
            this.messageCallback(parsedMessage);
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
        
        // Reset state for next message
        this.headers = {};
        this.contentLength = null;
        
        // Continue parsing headers
        process.stdin.on('data', (chunk) => {
          // Look for headers from the remaining data...
          // Implementation depends on how remaining data is handled
        });
      }
    };
    
    process.stdin.on('data', onData);
  }
  
  sendMessage(message) {
    const messageStr = JSON.stringify(message);
    const contentLength = Buffer.byteLength(messageStr, 'utf-8');
    
    // Write headers
    process.stdout.write(`Content-Length: ${contentLength}\r\n`);
    process.stdout.write('\r\n');
    
    // Write message body
    process.stdout.write(messageStr);
  }
}

// Example usage
const parser = new McpMessageParser();

parser.setMessageCallback((message) => {
  console.error('Received message:', message);
  
  // Handle different message types
  if (message.method === 'tools/list') {
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [
          {
            name: 'echo',
            description: 'Echoes back the input text',
            parameters: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: 'Text to echo back'
                }
              },
              required: ['text']
            }
          }
        ]
      }
    };
    
    parser.sendMessage(response);
  } 
  else if (message.method === 'tools/call') {
    if (message.params.name === 'echo') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          text: message.params.text
        }
      };
      
      parser.sendMessage(response);
    } else {
      // Tool not found
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: 100,
          message: `Tool '${message.params.name}' not found`
        }
      };
      
      parser.sendMessage(errorResponse);
    }
  }
});

parser.setupStdioHandling();
```

## 7. Protocol Flow

The typical flow of MCP communication is:

1. Client connects to server
2. Client sends `tools/list` request
3. Server responds with available tools
4. Client sends `tools/call` request for a specific tool
5. Server executes the tool and returns the result or an error
6. Steps 4-5 repeat as needed

## 8. Next Steps

After understanding the protocol specification:

1. Implement a complete message parser/serializer
2. Create a server class with proper request handling
3. Implement tool registration and execution
4. Add validation for all message types
5. Test with real MCP clients
6. Extend to support SSE transport

## Resources

- [MCP Protocol Specification](https://modelcontextprotocol.io/llms-full.txt)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Node.js Stream Documentation](https://nodejs.org/api/stream.html) 
