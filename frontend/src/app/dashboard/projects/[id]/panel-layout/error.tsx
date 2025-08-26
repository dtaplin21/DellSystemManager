'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  console.error('🚨 Panel Layout SSR Error:', error);
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Panel Layout Failed to Load</h2>
          <p className="text-gray-600 mb-6">
            There was an error while rendering the panel layout. This is likely due to a backend service issue.
          </p>
          
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6 text-left">
            <h3 className="text-sm font-medium text-red-800 mb-2">Error Details:</h3>
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
          </div>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Reload Page
            </button>
          </div>
          
          <div className="mt-6 text-sm text-gray-500">
            <p>If the problem persists, check:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Backend server status (port 8003)</li>
              <li>Database connectivity</li>
              <li>Network connection to backend</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
