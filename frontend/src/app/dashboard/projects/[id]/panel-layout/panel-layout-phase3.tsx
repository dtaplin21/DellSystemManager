'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { PanelProvider } from '@/contexts/PanelContextV2';
import { usePanelData } from '@/hooks/usePanelDataV2';
import PanelCanvasV3 from '@/components/panels/PanelCanvasV3';
import TransformErrorBoundary from '@/components/panels/TransformErrorBoundary';
import { WORLD_CONSTANTS } from '@/lib/world-coordinates';

/**
 * Phase 3 Panel Layout Component
 * Integrates all Phase 1, 2, and 3 components
 */
function PanelLayoutPhase3Content({ projectId }: { projectId: string }) {
  // Panel data management (world units)
  const { 
    dataState, 
    updatePanel, 
    addTestPanel, 
    clearStorage, 
    loadData, 
    saveData,
    isLoading,
    hasUnsavedChanges 
  } = usePanelData({
    projectId,
    featureFlags: {
      ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development',
      ENABLE_PERSISTENCE: true,
      ENABLE_DRAGGING: true,
      ENABLE_LOCAL_STORAGE: true,
      ENABLE_WEBSOCKET_UPDATES: false
    }
  });

  // Load data on mount
  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle panel updates
  const handlePanelUpdate = React.useCallback((panelId: string, updates: Partial<any>) => {
    updatePanel(panelId, updates);
  }, [updatePanel]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading panel layout...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (dataState.state === 'error') {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error Loading Layout</div>
          <div className="text-gray-600 mb-4">{dataState.error}</div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (dataState.state === 'empty' || dataState.panels.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-gray-600 text-xl mb-4">No panels found</div>
            <div className="text-gray-500 mb-6">This project doesn&apos;t have any panels yet.</div>
          <button
            onClick={addTestPanel}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-4"
          >
            Add Test Panel
          </button>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {/* Main canvas */}
      <PanelCanvasV3
        panels={dataState.panels}
        onPanelUpdate={handlePanelUpdate}
        enableDebugLogging={process.env.NODE_ENV === 'development'}
      />
      
      {/* Status bar */}
      <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-75 text-white text-sm p-2 flex justify-between items-center">
        <div className="flex space-x-4">
          <span>Project: {projectId}</span>
          <span>Panels: {dataState.panels.length}</span>
          <span>World: {WORLD_CONSTANTS.WIDTH_FT}ft × {WORLD_CONSTANTS.HEIGHT_FT}ft</span>
        </div>
        
        <div className="flex space-x-2">
          {hasUnsavedChanges && (
            <span className="text-yellow-400">● Unsaved changes</span>
          )}
          <button
            onClick={addTestPanel}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            Add Panel
          </button>
          <button
            onClick={saveData}
            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
          >
            Save
          </button>
          <button
            onClick={clearStorage}
            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Phase 3 Panel Layout with Error Boundary
 */
export default function PanelLayoutPhase3() {
  const params = useParams();
  const projectId = params.id as string;

  if (!projectId) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Invalid Project ID</div>
          <div className="text-gray-600">No project ID provided.</div>
        </div>
      </div>
    );
  }

  return (
    <TransformErrorBoundary>
      <PanelProvider>
        <Suspense fallback={
          <div className="h-full w-full flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div className="text-gray-600">Loading...</div>
            </div>
          </div>
        }>
          <PanelLayoutPhase3Content projectId={projectId} />
        </Suspense>
      </PanelProvider>
    </TransformErrorBoundary>
  );
}
