'use client';

import { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { getWebSocketClient, WebSocketMessage, WebSocketHandler } from '@/lib/websocket';
import { useAuth } from '@/hooks/use-auth';

interface WebSocketContextType {
  socket: WebSocket | null;
  isConnected: boolean;
  send: (message: WebSocketMessage) => void;
  lastMessage: WebSocketMessage | null;
}

export const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const wsClient = getWebSocketClient();

  useEffect(() => {
    if (!user) {
      // Don't connect if user is not authenticated
      return;
    }

    const handler: WebSocketHandler = {
      onOpen: () => {
        setIsConnected(true);
        
        // Send authentication message
        wsClient?.send({
          type: 'AUTH',
          userId: user.id,
        });
      },
      onMessage: (message) => {
        setLastMessage(message);
      },
      onClose: () => {
        setIsConnected(false);
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      }
    };

    // Register handler
    wsClient?.addHandler(handler);
    
    // Connect to WebSocket
    wsClient?.connect();

    // Update socket reference
    socketRef.current = wsClient?.isConnected() ? (wsClient as any).socket : null;

    // Cleanup
    return () => {
      wsClient?.removeHandler(handler);
    };
  }, [user, wsClient]);

  const send = (message: WebSocketMessage) => {
    wsClient?.send(message);
  };

  return (
    <WebSocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        send,
        lastMessage
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
