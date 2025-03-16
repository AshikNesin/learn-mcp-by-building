/**
 * Simple calculator tool for MCP examples
 * 
 * This implements a basic math calculator that can be used with any MCP server
 */

// Tool definition that can be returned by tools/list
export const calculatorToolDefinition = {
  name: 'calculator',
  description: 'Performs basic math operations',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide']
      },
      a: {
        type: 'number'
      },
      b: {
        type: 'number'
      }
    },
    required: ['operation', 'a', 'b']
  }
};

// Handler function for tools/call method
export async function handleCalculatorTool(args) {
  // Validate required arguments
  if (!args || !args.operation || typeof args.a !== 'number' || typeof args.b !== 'number') {
    return {
      content: [
        {
          type: 'text',
          text: 'Invalid arguments. Please provide operation, a, and b.'
        }
      ],
      isError: true
    };
  }
  
  // Execute the tool operation
  let result;
  try {
    switch (args.operation) {
      case 'add':
        result = args.a + args.b;
        break;
      case 'subtract':
        result = args.a - args.b;
        break;
      case 'multiply':
        result = args.a * args.b;
        break;
      case 'divide':
        // Handle division by zero error
        if (args.b === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'Cannot divide by zero'
              }
            ],
            isError: true
          };
        }
        result = args.a / args.b;
        break;
      default:
        // Handle unsupported operation
        return {
          content: [
            {
              type: 'text',
              text: `Unsupported operation: ${args.operation}`
            }
          ],
          isError: true
        };
    }
    
    // Return successful result following the Tool Result format
    return {
      content: [
        {
          type: 'text',
          text: `Result of ${args.a} ${args.operation} ${args.b} = ${result}`
        }
      ]
    };
  } catch (error) {
    // Handle unexpected errors during execution
    return {
      content: [
        {
          type: 'text',
          text: `Error executing calculator: ${error.message}`
        }
      ],
      isError: true
    };
  }
} 
