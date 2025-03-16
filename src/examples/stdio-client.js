/**
 * Simple test client for STDIO transport
 * 
 * This is a basic client that connects to an MCP server via STDIO
 * and tests the calculator tool.
 */
import { randomUUID } from 'node:crypto';

// JSON-RPC request ID counter
let requestId = 1;

// Send a JSON-RPC request to the server
function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params
  };
  
  console.log(JSON.stringify(request));
}

// Handle responses from the server
function handleResponse(line) {
  try {
    const response = JSON.parse(line);
    
    if (!response.jsonrpc || response.jsonrpc !== '2.0') {
      console.error('Invalid JSON-RPC response:', response);
      return;
    }
    
    // Print response in a nicely formatted way
    console.error('\nReceived response:');
    if (response.result) {
      console.error('Result:', JSON.stringify(response.result, null, 2));
    } else if (response.error) {
      console.error('Error:', response.error.code, response.error.message);
    }
    console.error();
  } catch (error) {
    console.error('Error parsing response:', error);
  }
}

// Main test sequence
async function runTests() {
  // Set up stdin to handle responses
  process.stdin.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        handleResponse(line);
      }
    }
  });
  
  // Give the server a moment to start
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Initialize connection
  console.error('Sending initialize request...');
  sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    clientInfo: {
      name: 'mcp-stdio-test-client',
      version: '0.1.0'
    }
  });
  
  // Wait a bit between requests
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Get the list of available tools
  console.error('Getting tool list...');
  sendRequest('tools/list');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test addition
  console.error('Testing calculator addition...');
  sendRequest('tools/call', {
    name: 'calculator',
    arguments: {
      operation: 'add',
      a: 5,
      b: 3
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test division
  console.error('Testing calculator division...');
  sendRequest('tools/call', {
    name: 'calculator',
    arguments: {
      operation: 'divide',
      a: 10,
      b: 2
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test division by zero (should return error)
  console.error('Testing calculator division by zero (should fail)...');
  sendRequest('tools/call', {
    name: 'calculator',
    arguments: {
      operation: 'divide',
      a: 10,
      b: 0
    }
  });
}

// Run the tests
runTests(); 
