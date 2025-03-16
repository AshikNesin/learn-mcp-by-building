// StdioTransport implements the MCP stdio transport specification
// See: https://spec.modelcontextprotocol.io/specification/2024-11-05/basic/transports/#stdio
//
// Key requirements:
// 1. Messages are sent/received over stdin/stdout as JSON-RPC
// 2. Each message MUST be on a single line (no embedded newlines)
// 3. Only valid MCP messages can be written to stdout
// 4. Logging is allowed on stderr
// 5. Messages are UTF-8 encoded

class StdioTransport {
  constructor(stdin = process.stdin, stdout = process.stdout, stderr = process.stderr) {
    // Store references to standard streams
    this._stdin = stdin;
    this._stdout = stdout;
    this._stderr = stderr;
    
    // Buffer to store incomplete incoming data
    // This is needed because data may arrive in chunks that don't align with message boundaries
    this._buffer = '';
    
    // Flag to prevent multiple start calls
    this._started = false;
    
    // Event handlers that can be set by the server
    this.onmessage = null;  // (message: object) => void - Called when a valid JSON-RPC message is received
    this.onclose = null;    // () => void - Called when the transport is closed
    this.onerror = null;    // (error: Error) => void - Called when an error occurs
    
    // Ensure streams are in correct mode
    this._stdin.setEncoding('utf8');  // Ensure UTF-8 encoding for input
  }

  async start() {
    // Prevent multiple starts as per MCP spec - each transport instance should only be started once
    if (this._started) throw new Error('StdioTransport already started!');
    
    this._started = true;
    
    // Set up event listeners for incoming data and errors
    this._stdin.on('data', this._onData);
    this._stdin.on('error', this._onError);
    
    // Log transport start (allowed on stderr)
    this._stderr.write('StdioTransport: Started listening for messages\n');
  }

  async close() {
    if (!this._started) {
      this._stderr.write('StdioTransport: Already closed\n');
      return;
    }
    
    // Remove our event listeners
    this._stdin.off('data', this._onData);
    this._stdin.off('error', this._onError);
    
    // Check if there are any other listeners for the 'data' event
    const remainingListeners = this._stdin.listenerCount('data');
    
    // Only pause stdin if we were the last listener
    if (remainingListeners === 0) {
      this._stdin.pause();
    }
    
    this._started = false;
    
    // Notify that we're closing if someone is listening
    this.onclose?.();
    
    // Log transport closure (allowed on stderr)
    this._stderr.write('StdioTransport: Closed\n');
  }

  async send(message) {
    if (!this._started) {
      throw new Error('Cannot send message: transport not started');
    }

    // Validate that the message doesn't contain newlines as per MCP spec
    const messageStr = JSON.stringify(message);
    if (messageStr.includes('\n')) {
      throw new Error('Invalid message: MCP messages must not contain newlines');
    }
    
    // Add the required newline delimiter
    const json = messageStr + '\n';
    
    return new Promise((resolve, reject) => {
      try {
        // Try to write to stdout
        if (this._stdout.write(json)) {
          // If write was successful, resolve immediately
          resolve();
        } else {
          // If buffer is full, wait for 'drain' event
          this._stdout.once('drain', resolve);
        }
      } catch (error) {
        reject(new Error(`Failed to send message: ${error.message}`));
      }
    });
  }

  // Arrow function to preserve 'this' context
  _onData = (chunk) => {
    // Add new data to our buffer
    this._buffer += chunk;
    
    // Split buffer into lines
    const lines = this._buffer.split('\n');
    
    // Last line might be incomplete, keep it in buffer
    this._buffer = lines.pop() || '';
    
    // Process each complete line
    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) continue;
      
      try {
        // Try to parse line as JSON
        const message = JSON.parse(line);
        
        // Log received message for debugging (allowed on stderr)
        this._stderr.write(`StdioTransport: Received message: ${line}\n`);
        
        // Notify listeners about the message
        this.onmessage?.(message);
      } catch (error) {
        // If parsing fails, notify error listeners
        const parseError = new Error(`Failed to parse JSON: ${error.message}`);
        this._stderr.write(`StdioTransport: ${parseError.message}\n`);
        this.onerror?.(parseError);
      }
    }
  }

  // Arrow function to preserve 'this' context
  _onError = (error) => {
    // Log error (allowed on stderr)
    this._stderr.write(`StdioTransport: Error: ${error.message}\n`);
    
    // Forward stdin errors to error listeners
    this.onerror?.(error);
  }
}

export { StdioTransport }; 
