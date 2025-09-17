import { Suspense } from 'react';
import { SimplePanelLayoutDebug } from '@/components/panels/SimplePanelLayoutDebug';

export default function PanelLayoutDebugPage() {
  // Use a test project ID
  const testProjectId = "69fc302b-166d-4543-9990-89c4b1e0ed59";
  
  return (
    <div className="h-screen w-full">
      <div className="h-12 bg-gray-100 border-b flex items-center px-4">
        <h1 className="text-lg font-semibold">Simplified Panel Layout Debug</h1>
        <div className="ml-4 text-sm text-gray-600">
          Test Project ID: {testProjectId}
        </div>
        <div className="ml-4 text-xs text-gray-500">
          Debug mode with real-time state info
        </div>
      </div>
      
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading simplified panel system...</p>
          </div>
        </div>
      }>
        <SimplePanelLayoutDebug projectId={testProjectId} />
      </Suspense>
    </div>
  );
}
