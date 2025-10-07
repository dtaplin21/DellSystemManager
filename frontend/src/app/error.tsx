'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('🚨 GLOBAL ERROR BOUNDARY TRIGGERED:', error);
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Something went wrong!</h1>
          <p className="text-gray-600 mb-6">
            An unexpected error occurred. This might be due to a backend service issue or network problem.
          </p>
          
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6 text-left">
            <h2 className="text-sm font-medium text-red-800 mb-2">Error Details:</h2>
            <pre className="text-sm text-red-700 whitespace-pre-wrap font-mono">
              {error.message}
            </pre>
            {error.stack && (
              <details className="mt-2">
                <summary className="text-sm font-medium text-red-800 cursor-pointer">
                  Show Stack Trace
                </summary>
                <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono mt-2">
                  {error.stack}
                </pre>
              </details>
            )}
            {error.digest && (
              <div className="mt-2 text-xs text-red-600">
                Error ID: {error.digest}
              </div>
            )}
          </div>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Go Home
            </button>
          </div>
          
          <div className="mt-6 text-sm text-gray-500">
            <p>If the problem persists, try:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Refreshing the page</li>
              <li>Checking your internet connection</li>
              <li>Clearing your browser cache</li>
              <li>Contacting support if the issue continues</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 