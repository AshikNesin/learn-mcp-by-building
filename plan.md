# Learning Plan: Building an MCP Server from Scratch in TypeScript (1-Day Version)

This condensed learning plan focuses on understanding the essential components of the Model Context Protocol (MCP) by implementing a basic server from scratch in a single day.

## Morning Session: Understanding the Protocol (2-3 hours)

### Hour 1: Protocol Specification Study
- Read the core sections of the [MCP specification](https://modelcontextprotocol.io/llms-full.txt)
- Focus on understanding:
  - JSON-RPC message format used by MCP
  - ListTools request/response flow
  - CallTool request/response flow
  - Error handling mechanisms
  - Message validation requirements

### Hour 2-3: Basic Communication Layer
- Implement stdio handling for MCP:
  - Set up Node.js process.stdin/stdout readers/writers
  - Create content-length based message parsing
  - Implement JSON parsing/serialization
- Quick reference code for stdin reader:
  ```typescript
  // Basic stdin reader example
  import { createInterface } from 'readline';
  
  const contentLengthPrefix = 'Content-Length: ';
  let buffer = '';
  let contentLength: number | null = null;
  
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });
  
  rl.on('line', (line) => {
    // Handle content-length header
    if (line.startsWith(contentLengthPrefix)) {
      contentLength = parseInt(line.substring(contentLengthPrefix.length), 10);
      return;
    }
    
    // Empty line means headers are done
    if (line === '' && contentLength !== null) {
      // Now read the message body
      // Implementation depends on how you want to buffer the input
    }
    
    // Handle actual message parsing once complete message is received
  });
  ```

## Midday Session: Core Implementation (3-4 hours)

### Hour 4-5: Protocol Message Implementation
- Create TypeScript interfaces for core message types:
  ```typescript
  // Core message types example
  interface JsonRpcMessage {
    jsonrpc: "2.0";
    id: string | number;
  }
  
  interface ListToolsRequest extends JsonRpcMessage {
    method: "mcp.list_tools";
    params: Record<string, never>;
  }
  
  interface Tool {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  }
  
  interface ListToolsResponse extends JsonRpcMessage {
    result: {
      tools: Tool[];
    };
  }
  
  interface CallToolRequest extends JsonRpcMessage {
    method: "mcp.call_tool";
    params: {
      name: string;
      [key: string]: any;
    };
  }
  
  interface CallToolResponse extends JsonRpcMessage {
    result: Record<string, any>;
  }
  
  interface ErrorResponse extends JsonRpcMessage {
    error: {
      code: number;
      message: string;
      data?: any;
    };
  }
  ```
- Implement message validation logic

### Hour 6-7: Server Implementation
- Create a basic server class:
  ```typescript
  class McpServer {
    private tools: Map<string, Tool> = new Map();
    
    constructor() {
      this.setupStdioHandling();
    }
    
    private setupStdioHandling() {
      // Set up stdin/stdout handlers
    }
    
    // Register a tool with the server
    registerTool(tool: Tool, handler: (params: any) => Promise<any>) {
      this.tools.set(tool.name, {
        definition: tool,
        handler
      });
    }
    
    // Handle incoming requests
    private async handleRequest(request: any) {
      if (request.method === "mcp.list_tools") {
        return this.handleListTools(request);
      } else if (request.method === "mcp.call_tool") {
        return this.handleCallTool(request);
      } else {
        return this.createErrorResponse(request.id, -32601, "Method not found");
      }
    }
    
    private handleListTools(request: ListToolsRequest): ListToolsResponse {
      // Implementation
    }
    
    private async handleCallTool(request: CallToolRequest): Promise<CallToolResponse | ErrorResponse> {
      // Implementation
    }
    
    private createErrorResponse(id: string | number, code: number, message: string): ErrorResponse {
      // Implementation
    }
  }
  ```
- Implement two basic tools:
  - Calculator tool (add, subtract, multiply, divide)
  - Echo tool (returns the input text)

## Evening Session: Testing and Advanced Concepts (2-3 hours)

### Hour 8-9: Testing with Real Clients
- Create a simple test script to launch your server
- Test with Claude Desktop or another MCP client
- Debug and fix communication issues
- Test all tools and handle edge cases

### Hour 10: Advanced Concepts Overview
- Study SSE implementation requirements for future development
- Understand streaming response mechanisms
- Review authentication options
- Plan next steps for enhancing your implementation

## Key Implementation Milestones (Single Day)

1. **Milestone 1** (Morning): Working stdio message parser/serializer
2. **Milestone 2** (Midday): Server responding to ListTools requests
3. **Milestone 3** (Afternoon): Server executing basic tools
4. **Milestone 4** (Evening): Working with real MCP clients

## Essential Resources

- [MCP Protocol Specification](https://modelcontextprotocol.io/llms-full.txt)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Node.js Stream Documentation](https://nodejs.org/api/stream.html)

## Simplified Project Structure

```
mcp-from-scratch/
├── src/
│   ├── index.ts              # Main entry point and server class
│   ├── types.ts              # Type definitions for messages
│   ├── tools/                # Tool implementations
│   │   ├── calculator.ts     # Calculator tool
│   │   └── echo.ts           # Echo tool
│   └── transport/
│       └── stdio.ts          # STDIO implementation
└── tests/
    └── manual-test.ts        # Test script
```

After completing this one-day intensive, you'll understand the core concepts of MCP and have a working basic implementation that you can expand on later with more advanced features like SSE transport, streaming responses, and authentication.
