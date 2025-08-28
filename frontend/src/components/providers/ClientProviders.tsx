'use client';

import React, { useEffect } from 'react';
import { WebSocketProvider } from '@/contexts/websocket-context';
import { ProjectsProvider } from '@/contexts/ProjectsProvider';
import { ToastProvider } from '@/components/ui/toast';
import { getSupabaseClient, ensureValidSession } from '@/lib/supabase';

interface ClientProvidersProps {
  children: React.ReactNode;
}

// Component to initialize session on app start
function SessionInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const initializeSession = async () => {
      try {
        console.log('Initializing session...');
        const session = await ensureValidSession();
        
        if (session) {
          console.log('Session initialized successfully:', session.user?.id);
        } else {
          console.log('No valid session found');
        }
      } catch (error) {
        console.error('Error initializing session:', error);
      }
    };

    initializeSession();
  }, []);

  return <>{children}</>;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <WebSocketProvider>
      <ProjectsProvider>
        <ToastProvider>
          <SessionInitializer>
            {children}
          </SessionInitializer>
        </ToastProvider>
      </ProjectsProvider>
    </WebSocketProvider>
  );
} 