declare module '../backend/services/websocket' {
    import { WebSocketServer } from 'ws'
    export function setupWebSocketServer(server: WebSocketServer): void
    // add any other exports here…
  }
  