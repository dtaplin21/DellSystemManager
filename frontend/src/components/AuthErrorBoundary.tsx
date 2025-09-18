'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onAuthError?: () => void;
}

interface State {
  hasAuthError: boolean;
  error?: Error;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasAuthError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Check if it's an auth-related error
    const isAuthError = error.message.includes('authentication') || 
                       error.message.includes('token') ||
                       error.message.includes('login') ||
                       (error as any).isAuthError;

    return { 
      hasAuthError: isAuthError,
      error: isAuthError ? error : undefined
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    if (this.state.hasAuthError) {
      console.error('Auth error caught:', error, errorInfo);
      this.props.onAuthError?.();
    }
  }

  render() {
    if (this.state.hasAuthError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] bg-amber-50 border border-amber-200 rounded-lg">
          <div className="text-center p-6 max-w-md">
            <div className="text-amber-600 text-lg mb-2">🔒</div>
            <h3 className="text-lg font-semibold text-amber-800 mb-2">
              Authentication Required
            </h3>
            <p className="text-amber-700 text-sm mb-4">
              {this.state.error?.message || 'Please log in to save your changes to the server.'}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.href = '/login'}
                className="w-full px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
              >
                Log In
              </button>
              <button
                onClick={() => this.setState({ hasAuthError: false })}
                className="w-full px-4 py-2 border border-amber-300 text-amber-700 rounded hover:bg-amber-100"
              >
                Continue Without Saving
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
