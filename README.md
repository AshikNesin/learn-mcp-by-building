# Learn Model Context Protocol by Building

This repository contains a simple MCP (Model Context Protocol) server implementation built from scratch in Node.js. The purpose is to learn how the MCP protocol works internally without relying on the official SDK (but heavily inspired by it 😅).

## What is Model Context Protocol (MCP)?

The Model Context Protocol (MCP) is an open protocol that enables AI assistants to interact with external tools and data sources. It provides a standardized way for AI assistants to:

- List available tools and their capabilities
- Call tools with parameters
- Handle errors in a consistent way
- Process tool results in a standardized format

For a detailed overview of the protocol and its implementation, see [MCP Protocol Study](notes/mcp.md).

## Features

This implementation includes:

- A fully compliant MCP server with JSON-RPC 2.0 message handling
- Protocol initialization and capability negotiation
- Tools registration and invocation with JSON Schema validation
- Proper error handling according to MCP spec
- STDIO transport support
- Comprehensive test client for verification

## Available Implementations

This repository includes:

1. **src/lib/mcp-server.js**: Core MCP server implementation
2. **src/mcp-server-with-tools.js**: Extended server with calculator tool
3. **src/test/mcp-test-client.js**: Test client for verification
4. **src/test/mcp-test-tool-client.js**: Tool-specific test client

## Getting Started

### Prerequisites

- Node.js v18+ (for ESM support)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd learn-mcp-by-building

# Install dependencies
pnpm install
```

### Usage

#### Running the Test Client

```bash
node src/test/mcp-test-client.js
```

This will start the MCP server and run a series of test requests to verify functionality.

#### Running the Server

```bash
node src/mcp-server-with-tools.js
```

This will start the MCP server, ready to accept tool requests.

## Implementation Details

### Protocol Support

The implementation supports:

- Protocol version: `2024-11-05`
- JSON-RPC 2.0 over STDIO transport
- Standard MCP methods:
  - `initialize` - Protocol initialization and capability negotiation
  - `tools/list` - Tool discovery with JSON Schema
  - `tools/call` - Tool invocation and execution

### Included Tools

1. **calculator**
   - Description: Performs basic math operations
   - Operations: add, subtract, multiply, divide
   - Parameters:
     - `operation` (string): Type of operation to perform
     - `a` (number): First operand
     - `b` (number): Second operand
   - Error Handling:
     - Division by zero
     - Invalid operations
     - Type validation
     - Missing parameters

## Protocol Features

The implementation demonstrates key MCP features:

- Capability negotiation during initialization
- Tool list change notifications
- Standardized error handling
- JSON Schema validation
- Structured tool results
- Transport layer abstraction

## External Resources

- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/specification/2024-11-05/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
