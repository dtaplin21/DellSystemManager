import { Suspense } from 'react';
import { SimplePanelLayout } from '@/components/panels/SimplePanelLayout';
import PanelLayoutRefactored from '../panel-layout/panel-layout-refactored';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PanelLayoutComparisonPage({ params }: PageProps) {
  const { id } = await params;
  
  return (
    <div className="h-screen w-full">
      <div className="h-12 bg-gray-100 border-b flex items-center px-4">
        <h1 className="text-lg font-semibold">Panel Layout Comparison</h1>
        <div className="ml-4 text-sm text-gray-600">
          Project ID: {id}
        </div>
      </div>
      
      <div className="flex h-full">
        {/* Current System */}
        <div className="flex-1 border-r">
          <div className="h-8 bg-blue-50 border-b flex items-center px-3">
            <h2 className="text-sm font-medium text-blue-800">Current System (Complex)</h2>
          </div>
          <div className="h-full">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm">Loading current system...</p>
                </div>
              </div>
            }>
              <PanelLayoutRefactored />
            </Suspense>
          </div>
        </div>
        
        {/* New Simplified System */}
        <div className="flex-1">
          <div className="h-8 bg-green-50 border-b flex items-center px-3">
            <h2 className="text-sm font-medium text-green-800">New System (Simplified)</h2>
          </div>
          <div className="h-full">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto mb-2"></div>
                  <p className="text-sm">Loading simplified system...</p>
                </div>
              </div>
            }>
              <SimplePanelLayout projectId={id} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
