export type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

export interface WebSocketHandler {
  onOpen?: () => void;
  onMessage?: (message: WebSocketMessage) => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 2000; // Start with 2s, will increase with each attempt
  private handlers: WebSocketHandler[] = [];
  private isConnecting = false;

  constructor(private url: string) {}

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.handlers.forEach(handler => handler.onOpen?.());
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handlers.forEach(handler => handler.onMessage?.(message));
        } catch (error) {
          console.error('Failed to parse WebSocket message', error);
        }
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this.isConnecting = false;
        this.handlers.forEach(handler => handler.onClose?.());
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.handlers.forEach(handler => handler.onError?.(error));
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const timeout = this.reconnectTimeout * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${timeout / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => this.connect(), timeout);
  }

  send(message: WebSocketMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('Attempted to send message but WebSocket is not connected');
    }
  }

  addHandler(handler: WebSocketHandler) {
    this.handlers.push(handler);
  }

  removeHandler(handler: WebSocketHandler) {
    this.handlers = this.handlers.filter(h => h !== handler);
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

let wsClient: WebSocketClient | null = null;

export const getWebSocketClient = () => {
  if (!wsClient && typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    wsClient = new WebSocketClient(wsUrl);
  }
  return wsClient;
};
