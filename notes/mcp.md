# Model Context Protocol (MCP)

## 1. Introduction to MCP

The Model Context Protocol (MCP) is designed to enable AI assistants to interact with external tools and data sources. It provides a standardized way for AI assistants to:

- Discover available tools
- Call tools with parameters
- Handle errors consistently
- Process tool results in a standardized format

MCP follows a client-server architecture where:
- **Servers**: Expose tools and resources to AI assistants
- **Clients**: Applications that use LLMs and consume MCP servers
- **Host**: Process that manages client instances and coordinates communication

## 2. Protocol Layers

MCP consists of several key layers:

1. **Base Protocol**: Core JSON-RPC message types and formats
2. **Lifecycle Management**: Connection initialization and capability negotiation
3. **Server Features**: Tools, resources, and prompts
4. **Client Features**: Sampling and root directory support
5. **Utilities**: Cross-cutting concerns like logging and completion

Our implementation focuses on the base protocol, lifecycle management, and tools feature.

## 3. Message Types

All messages in MCP MUST follow the JSON-RPC 2.0 specification:

### 3.1 Requests
```javascript
{
  "jsonrpc": "2.0",
  "id": 1,           // MUST be string or number, not null
  "method": "method.name",
  "params": {}       // Optional
}
```

### 3.2 Responses
```javascript
{
  "jsonrpc": "2.0",
  "id": 1,           // MUST match request ID
  "result": {},      // Success case
  // OR
  "error": {         // Error case
    "code": -32000,
    "message": "Error message",
    "data": {}       // Optional
  }
}
```

### 3.3 Notifications
```javascript
{
  "jsonrpc": "2.0",
  "method": "method.name",
  "params": {}       // Optional, no ID for notifications
}
```

## 4. Connection Lifecycle

### 4.1 Initialization Phase
1. Client connects to server
2. Client sends initialize request with capabilities
3. Server responds with supported capabilities
4. Client sends initialized notification
5. Normal operation begins

```javascript
// Initialize Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      // Client capabilities
    }
  }
}

// Initialize Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {
        "listChanged": true
      }
    },
    "serverInfo": {
      "name": "mcp-server-with-tools",
      "version": "0.1.0"
    }
  }
}

// Initialized Notification
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

### 4.2 Operation Phase
- Normal message exchange based on negotiated capabilities
- Both parties must respect protocol version and capabilities
- Requests can flow in both directions

### 4.3 Shutdown Phase
For STDIO transport:
1. Client closes input stream
2. Server detects closure and exits
3. Client handles server termination

## 5. Protocol Utilities

### 5.1 Ping
Used for connection health checks:
```javascript
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "ping"
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {}
}
```

### 5.2 Error Handling
Standard JSON-RPC error codes:
- -32600: Invalid Request
- -32601: Method not found
- -32602: Invalid params
- -32603: Internal error
- -32000 to -32099: Server error

Tool-specific errors use `isError: true` in result:
```javascript
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Error message"
      }
    ],
    "isError": true
  }
}
```

## 6. Implementation Components

### 6.1 StdioTransport
Handles message exchange over STDIO:
- UTF-8 encoded messages
- Newline-delimited JSON
- Stderr for logging
- No embedded newlines in messages
- Proper stream cleanup on close

### 6.2 McpServer
Core protocol implementation:
- Message routing
- Capability negotiation
- Protocol version handling
- Request/response management
- Tool registration and execution

### 6.3 Tool Implementation
Standard tool interface:
- Name and description
- JSON Schema for inputs
- Validation and execution
- Standardized result format
- Error handling

## 7. Security Considerations

Our implementation follows these security practices:
- Input validation for all messages
- Protocol version validation
- Capability enforcement
- Safe error reporting
- Proper stream handling
- Logging for debugging

## 8. Version Management

Protocol versions:
- Current: 2024-11-05
- Supported: [2024-11-05, 2024-10-07]
- Version negotiation during initialization
- Fallback to latest supported version

## Resources

- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/specification/2024-11-05/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
