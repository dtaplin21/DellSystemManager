'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { usePanelData } from '@/hooks/usePanelData';
import { PanelLayoutErrorBoundary } from '@/components/panels/PanelLayoutErrorBoundary';
import { 
  LoadingFallback, 
  ErrorFallback, 
  EmptyStateFallback, 
  HydrationFallback 
} from '@/components/panels/PanelLayoutFallbacks';

// Debug version with minimal complexity
export default function PanelLayoutDebug() {
  const params = useParams();
  const projectId = params.id as string;
  
  // Use our custom hook for data management
  const {
    dataState,
    isLoading,
    error,
    panels,
    updatePanelPosition,
    addPanel,
    removePanel,
    refreshData,
    clearLocalStorage
  } = usePanelData({ projectId });

  // Handle adding test panels
  const handleAddTestPanel = () => {
    const testPanel = {
      id: `test-panel-${Date.now()}`,
      width: 2,
      height: 1,
      x: Math.random() * 20,
      y: Math.random() * 20,
      rotation: 0,
      isValid: true,
      shape: 'rectangle' as const,
      type: 'test',
      model: 'Test Panel',
      manufacturer: 'Test Co',
      power: 400,
      efficiency: 0.22
    };
    addPanel(testPanel);
  };

  // Handle clearing localStorage and retrying
  const handleClearStorageAndRetry = async () => {
    clearLocalStorage();
    await refreshData();
  };

  return (
    <PanelLayoutErrorBoundary>
      <div className="h-full w-full">
        {/* Loading state */}
        {isLoading && <LoadingFallback />}
        
        {/* Error state */}
        {error && (
          <ErrorFallback 
            error={error}
            onRetry={refreshData}
            onClearStorage={handleClearStorageAndRetry}
          />
        )}
        
        {/* Empty state */}
        {dataState.state === 'empty' && (
          <EmptyStateFallback 
            onAddPanel={handleAddTestPanel}
            onImportLayout={() => console.log('Import layout clicked')}
          />
        )}
        
        {/* Loaded state with panels */}
        {dataState.state === 'loaded' && panels.length > 0 && (
          <div className="h-full w-full p-4">
            <h2 className="text-xl font-bold mb-4">Panels Loaded Successfully!</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {panels.map((panel) => (
                <div key={panel.id} className="border rounded p-4 bg-gray-50">
                  <h3 className="font-semibold">Panel {panel.id}</h3>
                  <p>Position: ({panel.x}, {panel.y})</p>
                  <p>Size: {panel.width} x {panel.height}</p>
                  <p>Shape: {panel.shape}</p>
                  <p>Valid: {panel.isValid ? 'Yes' : 'No'}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-x-2">
              <button 
                onClick={handleAddTestPanel}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Add Test Panel
              </button>
              <button 
                onClick={refreshData}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Refresh Data
              </button>
              <button 
                onClick={clearLocalStorage}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Clear Storage
              </button>
            </div>
          </div>
        )}
        
        {/* Loaded state but no panels */}
        {dataState.state === 'loaded' && panels.length === 0 && (
          <EmptyStateFallback 
            onAddPanel={handleAddTestPanel}
            onImportLayout={() => console.log('Import layout clicked')}
          />
        )}
      </div>
    </PanelLayoutErrorBoundary>
  );
}
