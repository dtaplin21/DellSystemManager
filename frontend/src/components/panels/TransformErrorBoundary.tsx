'use client';

import React from 'react';

interface TransformErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error) => void;
  fallback?: React.ReactNode;
}

interface TransformErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class TransformErrorBoundary extends React.Component<
  TransformErrorBoundaryProps,
  TransformErrorBoundaryState
> {
  constructor(props: TransformErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): TransformErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('TransformErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="h-full w-full flex items-center justify-center bg-gray-100">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Transform Error Detected
            </h2>
            <p className="text-gray-600 mb-6">
              Something went wrong with the canvas transformations. 
              The view has been reset to a safe state.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error Details
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default TransformErrorBoundary;