/**
 * Test client for the MCP Server with tools
 */
import { McpClient, ProcessTransport } from './test/mcp-test-client.js';

// Run as a script
if (import.meta.url === `file://${process.argv[1]}`) {
  const client = new McpClient();
  const transport = new ProcessTransport('node', ['../mcp-server-with-tools.js']);
  
  console.log('Starting MCP client to test tools...');
  
  client.connect(transport)
    .then(async () => {
      console.log('Client connected and initialized');
      
      try {
        // List available tools
        console.log('Listing available tools...');
        const tools = await client.request('tools/list');
        console.log('Available tools:', JSON.stringify(tools, null, 2));
        
        // Test calculator tool with addition
        console.log('\nTesting calculator tool with addition...');
        const addResult = await client.request('tools/call', {
          name: 'calculator',
          arguments: {
            operation: 'add',
            a: 5,
            b: 3
          }
        });
        console.log('Addition result:', JSON.stringify(addResult, null, 2));
        
        // Test calculator tool with division
        console.log('\nTesting calculator tool with division...');
        const divideResult = await client.request('tools/call', {
          name: 'calculator',
          arguments: {
            operation: 'divide',
            a: 10,
            b: 2
          }
        });
        console.log('Division result:', JSON.stringify(divideResult, null, 2));
        
        // Test calculator tool with an error case (division by zero)
        console.log('\nTesting calculator tool with division by zero...');
        try {
          const errorResult = await client.request('tools/call', {
            name: 'calculator',
            arguments: {
              operation: 'divide',
              a: 10,
              b: 0
            }
          });
          console.log('Error case result:', JSON.stringify(errorResult, null, 2));
        } catch (error) {
          console.log('Error received as expected:', error.message);
        }
        
        // Test calculator tool with invalid operation
        console.log('\nTesting calculator tool with invalid operation...');
        try {
          const invalidResult = await client.request('tools/call', {
            name: 'calculator',
            arguments: {
              operation: 'power',
              a: 2,
              b: 3
            }
          });
          console.log('Invalid operation result:', JSON.stringify(invalidResult, null, 2));
        } catch (error) {
          console.log('Error received as expected:', error.message);
        }
        
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
