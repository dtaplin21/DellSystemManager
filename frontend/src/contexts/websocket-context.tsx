'use client';

import { createContext, useState, useEffect, ReactNode } from 'react';

interface WebSocketMessage {
  type: string;
  payload: any;
}

interface WebSocketHandler {
  onOpen?: () => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
}

interface WebSocketContextType {
  socket: WebSocket | null;
  isConnected: boolean;
  send: (message: WebSocketMessage) => void;
  lastMessage: WebSocketMessage | null;
}

export const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  useEffect(() => {
    // Initialize WebSocket connection when component mounts
    // We'll implement this later when we need real-time features
    // For now, we'll just set up the context with placeholders
    
    return () => {
      // Clean up the WebSocket connection on unmount
      if (socket) {
        socket.close();
      }
    };
  }, []);
  
  const send = (message: WebSocketMessage) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected. Message not sent:', message);
    }
  };
  
  return (
    <WebSocketContext.Provider
      value={{
        socket,
        isConnected,
        send,
        lastMessage,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};