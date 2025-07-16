'use client';

import * as React from 'react';
import { useToast as useToastContext } from '@/components/ui/toast';

// Types for toast components
export type ToastProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'success';
};

export const useToast = () => {
  const { showToast } = useToastContext();

  const toast = React.useCallback((props: ToastProps) => {
    const message = props.title && props.description 
      ? `${props.title}: ${props.description}`
      : props.title || props.description || 'Notification';
    
    const type = props.variant === 'destructive' ? 'error' : 
                 props.variant === 'success' ? 'success' : 'info';
    
    showToast(message, type);
  }, [showToast]);

  return { toast };
};