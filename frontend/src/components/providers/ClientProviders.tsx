'use client';

import React from 'react';
import { AuthProvider } from '@/contexts/auth-context';
import { WebSocketProvider } from '@/contexts/websocket-context';
import { ProjectsProvider } from '@/contexts/ProjectsProvider';
import { ToastProvider } from '@/components/ui/toast';

interface ClientProvidersProps {
  children: React.ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <ProjectsProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ProjectsProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
} 