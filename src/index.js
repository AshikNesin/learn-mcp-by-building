/**
 * Model Context Protocol (MCP) Implementation
 * 
 * This package implements a basic version of the MCP specification for building AI tools:
 * https://spec.modelcontextprotocol.io/
 * 
 * Main modules:
 * - core: Core MCP server implementation
 * - transports: Implementations of different transport layers
 * - tools: Tool definitions and handlers
 * - examples: Example applications using the MCP library
 */

// Re-export core modules
export * from './core/index.js';

// Re-export transports
export * from './transports/index.js';

// Re-export tools
export * from './tools/index.js';

// Export client for convenience
export { McpSseClient } from './examples/http-sse-client.js'; 
