import { Suspense } from 'react';
import Loading from './loading';
import Error from './error';
import PanelLayoutRefactored from './panel-layout-refactored';
import TestPanelData from './test-panel-data';
import DebugData from './debug-data';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PanelLayoutPage({ params }: PageProps) {
  const { id } = await params;
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">🔍 Simple Test Page</h1>
      <div className="bg-green-100 p-4 rounded">
        <p className="text-green-800">
          <strong>Status:</strong> Page is rendering successfully!
        </p>
        <p className="text-green-800 mt-2">
          <strong>Project ID:</strong> {id}
        </p>
      </div>
    </div>
  );
}
