'use client';

import * as React from 'react';

// Types for toast components
export type ToastProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'success';
};

// Simple implementation for now (would normally use a toast library)
const toastContext = React.createContext<{
  toast: (props: ToastProps) => void;
}>({
  toast: () => {},
});

export const useToast = () => {
  const context = React.useContext(toastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  // For now, this will just log the toast message to the console
  // In a production app, we would use a proper toast component
  const toast = React.useCallback((props: ToastProps) => {
    console.log('Toast:', props);
    alert(`${props.title}: ${props.description}`);
  }, []);

  return { toast };
};