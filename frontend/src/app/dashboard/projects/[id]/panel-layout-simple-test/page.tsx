import { Suspense } from 'react';
import { SimplePanelLayout } from '@/components/panels/SimplePanelLayout';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SimplePanelLayoutTestPage({ params }: PageProps) {
  const { id } = await params;
  
  return (
    <div className="h-screen w-full">
      <div className="h-12 bg-gray-100 border-b flex items-center px-4">
        <h1 className="text-lg font-semibold">Simplified Panel Layout Test</h1>
        <div className="ml-4 text-sm text-gray-600">
          Project ID: {id}
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
        <SimplePanelLayout projectId={id} />
      </Suspense>
    </div>
  );
}
