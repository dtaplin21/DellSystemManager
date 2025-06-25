'use client';

import React from 'react';
import { WebSocketProvider } from '@/contexts/websocket-context';
import { ProjectsProvider } from '@/contexts/ProjectsProvider';
import { ToastProvider } from '@/components/ui/toast';

interface ClientProvidersProps {
  children: React.ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <WebSocketProvider>
      <ProjectsProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </ProjectsProvider>
    </WebSocketProvider>
  );
} 