import { useCallback, useRef } from 'react';
import { captureError, type ErrorContext as TelemetryErrorContext } from '../lib/telemetry';

interface ErrorContext {
  component: string;
  operation: string;
  data?: any;
}

interface UseErrorHandlerOptions {
  enableLogging?: boolean;
  onError?: (error: Error, context: ErrorContext) => void;
  showToast?: boolean;
}

/**
 * Centralized error handling hook
 * Provides consistent error handling across all components
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { enableLogging = true, onError, showToast = true } = options;
  const errorCountRef = useRef(0);

  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.log(`[ErrorHandler] ${message}`, data);
    }
  }, [enableLogging]);

  const handleError = useCallback((
    error: Error, 
    context: ErrorContext,
    showUserMessage = true
  ) => {
    errorCountRef.current += 1;
    
    log(`Error in ${context.component}.${context.operation}`, {
      error: error.message,
      stack: error.stack,
      context,
      errorCount: errorCountRef.current,
    });

    // Send to telemetry service
    try {
      const telemetryContext: TelemetryErrorContext = {
        component: context.component,
        operation: context.operation,
        metadata: {
          ...context.data,
          errorCount: errorCountRef.current,
        },
      };
      captureError(error, telemetryContext);
    } catch (telemetryError) {
      // Silently fail - telemetry shouldn't break error handling
      console.warn('[ErrorHandler] Failed to send to telemetry:', telemetryError);
    }

    // Call custom error handler
    onError?.(error, context);

    // Show user-friendly message if requested
    if (showUserMessage && showToast) {
      // This would integrate with your toast system
      console.warn(`Panel Layout Error: ${error.message}`);
    }

    // In development, also log to console for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${context.component}] ${context.operation}:`, error);
    }
  }, [log, onError, showToast]);

  // Wrapper for async operations
  const withErrorHandling = useCallback(<T extends any[], R>(
    fn: (...args: T) => R | Promise<R>,
    context: ErrorContext
  ) => {
    return async (...args: T): Promise<R | null> => {
      try {
        return await fn(...args);
      } catch (error) {
        handleError(error as Error, context);
        return null;
      }
    };
  }, [handleError]);

  // Wrapper for sync operations
  const withSyncErrorHandling = useCallback(<T extends any[], R>(
    fn: (...args: T) => R,
    context: ErrorContext
  ) => {
    return (...args: T): R | null => {
      try {
        return fn(...args);
      } catch (error) {
        handleError(error as Error, context);
        return null;
      }
    };
  }, [handleError]);

  // Specific error handlers for common operations
  const handleLocalStorageError = useCallback((error: Error, operation: string) => {
    handleError(error, {
      component: 'localStorage',
      operation,
    }, false); // Don't show toast for localStorage errors
  }, [handleError]);

  const handleCanvasError = useCallback((error: Error, operation: string) => {
    handleError(error, {
      component: 'canvas',
      operation,
    });
  }, [handleError]);

  const handlePanelError = useCallback((error: Error, operation: string, panelId?: string) => {
    handleError(error, {
      component: 'panel',
      operation,
      data: { panelId },
    });
  }, [handleError]);

  const handleApiError = useCallback((error: Error, operation: string, endpoint?: string) => {
    handleError(error, {
      component: 'api',
      operation,
      data: { endpoint },
    });
  }, [handleError]);

  return {
    handleError,
    withErrorHandling,
    withSyncErrorHandling,
    handleLocalStorageError,
    handleCanvasError,
    handlePanelError,
    handleApiError,
    errorCount: errorCountRef.current,
  };
}

/**
 * Hook for component-specific error handling
 */
export function useComponentErrorHandler(componentName: string) {
  const { handleError, withErrorHandling, withSyncErrorHandling } = useErrorHandler();

  const createContext = useCallback((operation: string, data?: any): ErrorContext => ({
    component: componentName,
    operation,
    data,
  }), [componentName]);

  const handleComponentError = useCallback((error: Error, operation: string, data?: any) => {
    handleError(error, createContext(operation, data));
  }, [handleError, createContext]);

  const withComponentErrorHandling = useCallback(<T extends any[], R>(
    fn: (...args: T) => R | Promise<R>,
    operation: string
  ) => {
    return withErrorHandling(fn, createContext(operation));
  }, [withErrorHandling, createContext]);

  const withComponentSyncErrorHandling = useCallback(<T extends any[], R>(
    fn: (...args: T) => R,
    operation: string
  ) => {
    return withSyncErrorHandling(fn, createContext(operation));
  }, [withSyncErrorHandling, createContext]);

  return {
    handleComponentError,
    withComponentErrorHandling,
    withComponentSyncErrorHandling,
    createContext,
  };
}
