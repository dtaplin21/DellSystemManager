'use client';

import React, { Component, ReactNode } from 'react';
import { WORLD_CONSTANTS } from '@/lib/world-coordinates';

interface TransformErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallback?: ReactNode;
  resetOnError?: boolean;
}

interface TransformErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  resetCount: number;
}

/**
 * Error boundary specifically for transform-related errors
 * Provides graceful degradation and recovery for coordinate system issues
 */
export class TransformErrorBoundary extends Component<
  TransformErrorBoundaryProps,
  TransformErrorBoundaryState
> {
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: TransformErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      resetCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<TransformErrorBoundaryState> {
    // Check if this is a transform-related error
    const isTransformError = 
      error.message.includes('transform') ||
      error.message.includes('coordinate') ||
      error.message.includes('scale') ||
      error.message.includes('NaN') ||
      error.message.includes('Infinity');

    if (isTransformError) {
      return {
        hasError: true,
        error
      };
    }

    // Re-throw non-transform errors
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Transform Error Boundary caught an error:', error, errorInfo);
    
    // Log error details for debugging
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      resetCount: this.state.resetCount
    });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo
    });

    // Auto-reset after a delay if enabled
    if (this.props.resetOnError !== false) {
      this.scheduleReset();
    }
  }

  private scheduleReset = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      this.resetError();
    }, 2000); // Reset after 2 seconds
  };

  private resetError = () => {
    console.log('Transform Error Boundary: Resetting to safe state');
    
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      resetCount: prevState.resetCount + 1
    }));

    // Clear any pending reset
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
  };

  private handleManualReset = () => {
    this.resetError();
  };

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8">
          <div className="text-center max-w-md">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Transform Error
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              A coordinate system error occurred. The view will reset automatically.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error Details
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-800 overflow-auto max-h-32">
                  <div><strong>Message:</strong> {this.state.error.message}</div>
                  {this.state.error.stack && (
                    <div><strong>Stack:</strong> {this.state.error.stack}</div>
                  )}
                </div>
              </details>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={this.handleManualReset}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Reset Now
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Reload Page
              </button>
            </div>
            
            {this.state.resetCount > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Reset count: {this.state.resetCount}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for accessing transform error boundary state
 * Useful for components that need to know about transform errors
 */
export function useTransformErrorBoundary() {
  const [errorCount, setErrorCount] = React.useState(0);
  const [lastError, setLastError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    setErrorCount(prev => prev + 1);
    setLastError(error);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Transform error:', error, errorInfo);
    }
  }, []);

  const clearError = React.useCallback(() => {
    setLastError(null);
  }, []);

  return {
    errorCount,
    lastError,
    handleError,
    clearError,
    hasError: errorCount > 0
  };
}

export default TransformErrorBoundary;
