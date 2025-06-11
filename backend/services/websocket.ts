import { WebSocketServer, WebSocket } from 'ws';

export function setupWebSocketServer(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (message: string) => {
      // Handle incoming messages
      console.log('Received:', message);
      
      // Echo back to client
      ws.send(`Server received: ${message}`);
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });
} 