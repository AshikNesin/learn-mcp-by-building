/**
 * HttpSseTransport implements the MCP HTTP+SSE transport specification
 * See: https://spec.modelcontextprotocol.io/specification/2024-11-05/basic/transports/#http-with-sse
 *
 * Key features:
 * 1. Client connects via HTTP GET for SSE
 * 2. Client sends JSON-RPC requests via HTTP POST to the same endpoint
 * 3. Server sends JSON-RPC responses via SSE events
 */
import express from 'express';
import http from 'node:http';
import { v4 as uuidv4 } from 'uuid';

class HttpSseTransport {
  constructor(options = {}) {
    // Default options
    this.options = {
      port: options.port || 5000,
      host: options.host || 'localhost',
      endpoint: options.endpoint || '/sse',
      cors: options.cors !== false,
      ...options
    };
    
    // Initialize Express app
    this.app = express();
    this._server = null;
    this._started = false;
    
    // Session management - single endpoint approach
    this._sessions = {};
    
    // Event handlers
    this.onmessage = null;  // (message, sessionId) => void
    this.onclose = null;    // () => void
    this.onerror = null;    // (error) => void
    
    // Configure Express
    this._configureExpress();
  }

  _configureExpress() {
    // Parse JSON bodies
    this.app.use(express.json());
    
    // Add CORS middleware if enabled
    if (this.options.cors) {
      this.app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');
        
        if (req.method === 'OPTIONS') {
          res.status(204).end();
          return;
        }
        
        next();
      });
    }

    // Set up health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).send('ok');
    });
    
    // Status endpoint
    this.app.get('/status', (req, res) => {
      res.json({
        status: 'ok',
        sessions: Object.keys(this._sessions).length,
        uptime: process.uptime()
      });
    });
    
    // Main MCP endpoint - handles both SSE and JSON-RPC
    this.app.all(this.options.endpoint, (req, res) => {
      if (req.method === 'GET') {
        // SSE connection
        this._handleSseConnection(req, res);
      } else if (req.method === 'POST') {
        // JSON-RPC request
        this._handleJsonRpcRequest(req, res);
      } else {
        res.status(405).send('Method Not Allowed');
      }
    });
  }

  async start() {
    if (this._started) throw new Error('HttpSseTransport already started!');
    
    return new Promise((resolve, reject) => {
      this._server = http.createServer(this.app);
      
      this._server.on('error', (err) => {
        console.error('HTTP server error:', err);
        if (this.onerror) this.onerror(err);
        reject(err);
      });
      
      this._server.listen(this.options.port, this.options.host, () => {
        this._started = true;
        console.error(`HTTP+SSE transport started at http://${this.options.host}:${this.options.port}${this.options.endpoint}`);
        resolve();
      });
    });
  }

  async close() {
    if (!this._started) {
      console.error('HttpSseTransport: Already closed');
      return;
    }
    
    return new Promise((resolve, reject) => {
      // Close all SSE connections
      for (const sessionId in this._sessions) {
        try {
          const session = this._sessions[sessionId];
          session.res.end();
          delete this._sessions[sessionId];
        } catch (err) {
          console.error(`Error closing session ${sessionId}:`, err);
        }
      }
      
      // Close the HTTP server
      this._server.close((err) => {
        if (err) {
          console.error('Error closing HTTP server:', err);
          reject(err);
          return;
        }
        
        this._started = false;
        console.error('HttpSseTransport: Server closed');
        
        if (this.onclose) this.onclose();
        resolve();
      });
    });
  }

  // Send a message to a specific session
  async send(message, sessionId) {
    if (!this._started) {
      throw new Error('HttpSseTransport not started');
    }
    
    // Log the message being sent for debugging
    console.error(`Sending message to session ${sessionId}:`, message);
    
    if (!sessionId) {
      console.error(`No session ID provided for message:`, message);
      throw new Error('No session ID provided');
    }
    
    const session = this._sessions[sessionId];
    if (!session) {
      console.error(`Session ${sessionId} not found. Available: ${Object.keys(this._sessions).join(', ')}`);
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      // Send with event name "message" per MCP spec
      const data = JSON.stringify(message);
      session.res.write(`event: message\ndata: ${data}\n\n`);
      return true;
    } catch (error) {
      console.error(`Error sending to session ${sessionId}:`, error);
      // Remove dead sessions
      if (error.code === 'ERR_STREAM_WRITE_AFTER_END') {
        console.error(`Removing dead session ${sessionId}`);
        delete this._sessions[sessionId];
      }
      throw error;
    }
  }

  // Handle SSE connection
  _handleSseConnection(req, res) {
    // Use the sessionId from the query parameter if provided, otherwise generate a new one
    const sessionId = req.query.sessionId || uuidv4();
    
    console.error(`New SSE connection established, sessionId: ${sessionId}`);
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // Following the official SDK, send an "endpoint" event with the URL to post to
    const endpointUrl = `${this.options.endpoint}?sessionId=${sessionId}`;
    res.write(`event: endpoint\ndata: ${encodeURI(endpointUrl)}\n\n`);
    
    // Store the session
    this._sessions[sessionId] = {
      res: res,
      createdAt: new Date()
    };
    
    // Handle disconnection
    req.on('close', () => {
      console.error(`SSE connection closed, sessionId: ${sessionId}`);
      delete this._sessions[sessionId];
      
      if (this.onclose) {
        this.onclose();
      }
    });
    
    // Keep-alive by sending a comment every 30 seconds
    const keepAliveInterval = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch (error) {
        clearInterval(keepAliveInterval);
        delete this._sessions[sessionId];
      }
    }, 30000);
  }

  // Handle JSON-RPC request
  _handleJsonRpcRequest(req, res) {
    try {
      const message = req.body;
      
      // Basic validation
      if (!message || !message.jsonrpc || message.jsonrpc !== '2.0') {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request',
            data: 'Not a valid JSON-RPC 2.0 request'
          },
          id: null
        });
      }
      
      // Get sessionId from query parameter or header
      const sessionId = req.query.sessionId || req.headers['x-session-id'];
      
      // For MCP Inspector, if no session ID is provided but there's only one session,
      // use that session (this is for backward compatibility)
      let autoSelectedSession = null;
      if (!sessionId) {
        const sessions = Object.keys(this._sessions);
        if (sessions.length === 1) {
          autoSelectedSession = sessions[0];
          console.error(`No session ID provided, auto-selecting ${autoSelectedSession}`);
        } else {
          return res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'No session ID provided'
            },
            id: message.id || null
          });
        }
      }
      
      // Store sessionId in the message for processing
      message._sessionId = sessionId || autoSelectedSession;
      
      console.error(`Received message from session ${message._sessionId}:`, message);
      
      // Pass message to the onmessage handler
      if (this.onmessage) {
        try {
          this.onmessage(message, message._sessionId);
        } catch (error) {
          console.error('Error in onmessage handler:', error);
        }
      }
      
      // Send an immediate 202 Accepted response
      res.status(202).json({ status: 'accepted' });
    } catch (error) {
      console.error('Error handling JSON-RPC request:', error);
      
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message
        },
        id: req.body?.id || null
      });
      
      if (this.onerror) {
        this.onerror(error);
      }
    }
  }
}

export { HttpSseTransport }; 
