import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onAuthSuccess?: () => void;
  onAuthFailure?: (error: string) => void;
  userId?: string | null;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onAuthSuccess,
    onAuthFailure,
    userId,
    reconnectAttempts = 2,
    reconnectDelay = 1000
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.hostname}:8003/ws`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setReconnectCount(0);
        onConnect?.();
        
        // Try to authenticate if we have a userId
        if (userId) {
          authenticate();
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle authentication response
          if (message.type === 'AUTH_SUCCESS') {
            setIsAuthenticated(true);
            onAuthSuccess?.();
            console.log('WebSocket authentication successful');
          } else if (message.type === 'AUTH_FAILURE') {
            setIsAuthenticated(false);
            onAuthFailure?.(message.data?.error || 'Authentication failed');
            console.error('WebSocket authentication failed:', message.data?.error);
          } else {
            onMessage?.(message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        setIsAuthenticated(false);
        onDisconnect?.();

        // Clear any pending auth retry
        if (authRetryTimeoutRef.current) {
          clearTimeout(authRetryTimeoutRef.current);
        }

        // Only attempt to reconnect if we haven't exceeded attempts
        if (reconnectCount < reconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectCount(prev => prev + 1);
            connect();
          }, reconnectDelay);
        } else {
          console.log('WebSocket reconnection attempts exhausted. Continuing without WebSocket.');
        }
      };

      wsRef.current.onerror = (error) => {
        console.warn('WebSocket connection failed. This is not critical - the app will work without real-time updates.');
        // Don't log as error since WebSocket is optional
      };

    } catch (error) {
      console.warn('WebSocket connection failed. This is not critical - the app will work without real-time updates.');
    }
  };

  const authenticate = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot authenticate: WebSocket not connected');
      return;
    }

    if (!userId) {
      console.warn('Cannot authenticate: No user ID available');
      return;
    }

    console.log('Attempting WebSocket authentication with user ID:', userId);
    sendMessage('AUTH', { userId });
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (authRetryTimeoutRef.current) {
      clearTimeout(authRetryTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const sendMessage = (type: string, data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: Date.now()
      };
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  };

  // Retry authentication when userId becomes available
  useEffect(() => {
    if (userId && isConnected && !isAuthenticated) {
      // Clear any existing retry timeout
      if (authRetryTimeoutRef.current) {
        clearTimeout(authRetryTimeoutRef.current);
      }
      
      // Retry authentication after a short delay
      authRetryTimeoutRef.current = setTimeout(() => {
        authenticate();
      }, 100);
    }
  }, [userId, isConnected, isAuthenticated]);

  useEffect(() => {
    // Temporarily disable WebSocket to prevent excessive connections
    // connect();
    console.log('WebSocket temporarily disabled to prevent excessive connections');
    return () => disconnect();
  }, [reconnectCount]);

  return {
    isConnected,
    isAuthenticated,
    sendMessage,
    disconnect,
    reconnect: connect,
    authenticate
  };
}