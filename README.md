# Learn Model Context Protocol by Building

This repository contains a simple MCP (Model Context Protocol) server implementation built from scratch in Node.js. The purpose is to learn how the MCP protocol works internally without relying on the official SDK.

---

## 🔍 What is Model Context Protocol (MCP)?

The Model Context Protocol (MCP) is an open protocol that enables AI assistants to interact with external tools and data sources.

<details>
<summary><b>Key Features</b></summary>

- List available tools and their capabilities
- Call tools with parameters
- Handle errors in a consistent way
- Process tool results in a standardized format
</details>

📚 For a detailed overview, see [MCP Notes](notes/mcp.md).

---

## ✨ Features

| Category | Features |
|----------|----------|
| **Protocol** | ✅ JSON-RPC 2.0 message handling<br>✅ Protocol initialization<br>✅ Capability negotiation |
| **Tools** | ✅ Tool registration with JSON Schema<br>✅ Tool invocation and validation<br>✅ Standardized error handling |
| **Transport** | ✅ STDIO support<br>🚧 SSE Support |
| **Testing** | ✅ Test clients |

---

## 📁 Project Structure

```
src/
├── lib/
│   └── mcp-server.js         # Core MCP implementation
├── mcp-server-with-tools.js  # Server with calculator tool
└── test/
    ├── mcp-test-client.js    # Full test client
    └── mcp-test-tool-client.js # Tool-specific tests
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+ (for ESM support)

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd learn-mcp-by-building

# Install dependencies
pnpm install

# Run the test client
node src/test/mcp-test-client.js

# Start the server
node src/mcp-server-with-tools.js
```

---

## 🔧 Implementation Details

### Protocol Support

- **Version**: `2024-11-05`
- **Transport**: JSON-RPC 2.0 over STDIO
- **Methods**:
  - `initialize` - Capability negotiation
  - `tools/list` - Tool discovery
  - `tools/call` - Tool execution

### 🧮 Calculator Tool

<table>
<tr>
<td>

**Operations**
- ➕ add
- ➖ subtract
- ✖️ multiply
- ➗ divide

</td>
<td>

**Parameters**
- `operation` - Operation type
- `a` - First operand
- `b` - Second operand

</td>
<td>

**Error Handling**
- Division by zero
- Invalid operations
- Type validation
- Missing parameters

</td>
</tr>
</table>

---

## 🛠️ Protocol Features

- ✅ Capability negotiation
- ✅ Tool list change notifications
- ✅ Standardized error handling
- ✅ JSON Schema validation
- ✅ Structured tool results
- ✅ Transport layer abstraction

---

## 📚 External Resources

- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/specification/2024-11-05/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [MCP GitHub Repository](https://github.com/modelcontextprotocol)
