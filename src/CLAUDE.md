# MCP Codebase Guidelines

## Commands
- Test basic MCP server: `node test/mcp-test-client.js`
- Test MCP server with tools: `node test/mcp-test-tool-client.js`
- Run basic server: `node lib/mcp-server.js`
- Run server with tools: `node mcp-server-with-tools.js`

## Code Style Guidelines
- **Imports**: ES modules with explicit file extensions (`import { X } from './lib/stdio-transport.js'`)
- **Formatting**: 2-space indentation, semicolons, single quotes for strings
- **Naming**:
  - Classes: PascalCase (e.g., `McpServer`)
  - Methods/Variables: camelCase
  - Private properties/methods: Prefix with underscore (e.g., `_onData`)
- **Error Handling**: Use try/catch blocks, follow JSON-RPC error codes
- **Documentation**: Use JSDoc-style comments for classes and methods
- **Architecture**: Follow modular design with separation between server, transport, and tools
- **Protocol**: Adhere to JSON-RPC 2.0 and MCP protocol specifications

This implementation provides a Node.js-based MCP server with optional tools support and stdio transport.