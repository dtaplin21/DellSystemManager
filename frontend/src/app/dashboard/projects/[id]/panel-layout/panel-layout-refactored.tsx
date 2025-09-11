'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { usePanelData } from '@/hooks/usePanelData';
import { PanelLayoutErrorBoundary } from '@/components/panels/PanelLayoutErrorBoundary';
import { 
  LoadingFallback, 
  ErrorFallback, 
  EmptyStateFallback, 
  HydrationFallback 
} from '@/components/panels/PanelLayoutFallbacks';
import PanelLayoutComponent from '@/components/panels/PanelLayoutRefactored';
import { Panel } from '@/types/panel';

// Progressive enhancement: Start simple, enhance on client
export default function PanelLayoutRefactored() {
  console.log('🔍 [PanelLayoutRefactored] ===== COMPONENT RENDERED =====');
  
  const params = useParams();
  const projectId = params.id as string;
  
  console.log('🔍 [PanelLayoutRefactored] Project ID from params:', projectId);

  
  // Client-side hydration state
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Feature flags for debugging/development
  const featureFlags = {
    ENABLE_PERSISTENCE: true,
    ENABLE_DRAGGING: true,
    ENABLE_LOCAL_STORAGE: true,
    ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development',
    ENABLE_WEBSOCKET_UPDATES: false // Disabled for now to simplify
  };

  // Use our custom hook for data management
  console.log('🔍 [PanelLayoutRefactored] About to call usePanelData with:', { projectId, featureFlags });
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
  } = usePanelData({ projectId, featureFlags });
  
  // Prevent server-side rendering issues
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  
  // Don't render anything on server side to prevent SSR issues
  if (!isHydrated) {
    return <HydrationFallback />;
  }
  
  console.log('🔍 [PanelLayoutRefactored] Hook returned:', {
    dataState: dataState.state,
    isLoading,
    error,
    panelsCount: panels.length
  });
  
  // Add more detailed logging
  console.log('🔍 [PanelLayoutRefactored] Full dataState:', dataState);
  console.log('🔍 [PanelLayoutRefactored] Panels array:', panels);
  console.log('🔍 [PanelLayoutRefactored] Error details:', error);


  // Handle panel position updates
  const handlePanelPositionUpdate = (panelId: string, position: { x: number; y: number; rotation?: number }) => {
    updatePanelPosition(panelId, position);
  };

  // Handle adding test panels
  const handleAddTestPanel = () => {
    const testPanel: Omit<Panel, 'id'> = {
      width: 2,
      height: 1,
      x: Math.random() * 20,
      y: Math.random() * 20,
      rotation: 0,
      isValid: true,
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

  // Server-side rendering: Show loading state
  if (!isHydrated) {
    return <HydrationFallback />;
  }

  // Debug information
  console.log('🔍 [PanelLayoutRefactored] RENDER DEBUG:', {
    isHydrated,
    isLoading,
    dataState: dataState.state,
    panelsCount: panels.length,
    error
  });

  // Error boundary wrapper
  return (
    <PanelLayoutErrorBoundary>
      <div className="h-full w-full flex flex-col">
        {/* Debug info */}
        <div className="bg-yellow-100 p-4 mb-4">
          <h3 className="font-bold">Debug Info:</h3>
          <p>isHydrated: {isHydrated ? 'true' : 'false'}</p>
          <p>isLoading: {isLoading ? 'true' : 'false'}</p>
          <p>dataState: {dataState.state}</p>
          <p>panelsCount: {panels.length}</p>
          <p>error: {error || 'none'}</p>
        </div>
        
        {/* Loading state */}
        {isLoading && (
          <div>
            <div className="text-center p-4 bg-yellow-100">
              <p>Debug: isLoading = {isLoading.toString()}</p>
              <p>Debug: dataState.state = {dataState.state}</p>
              <p>Debug: panels.length = {panels.length}</p>
            </div>
            <LoadingFallback />
          </div>
        )}
        
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
          <div className="flex-1 w-full relative">
            {/* Debug panel for development */}
            {featureFlags.ENABLE_DEBUG_LOGGING && (
              <div className="absolute top-4 right-4 z-50 bg-yellow-100 border border-yellow-300 rounded-lg p-3 max-w-xs">
                <h3 className="font-semibold text-yellow-800 mb-2">Debug Info</h3>
                <div className="text-xs text-yellow-700 space-y-1">
                  <div>State: {dataState.state}</div>
                  <div>Panels: {panels.length}</div>
                  <div>Last Updated: {new Date(dataState.lastUpdated || 0).toLocaleTimeString()}</div>
                </div>
                <div className="mt-2 space-y-1">
                  <button
                    onClick={handleAddTestPanel}
                    className="w-full px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-xs"
                  >
                    Add Test Panel
                  </button>
                  <button
                    onClick={refreshData}
                    className="w-full px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-xs"
                  >
                    Refresh Data
                  </button>
                  <button
                    onClick={clearLocalStorage}
                    className="w-full px-2 py-1 bg-red-200 hover:bg-red-300 rounded text-xs"
                  >
                    Clear Storage
                  </button>
                </div>
              </div>
            )}
            
            {/* Main panel layout component */}
            <PanelLayoutComponent
              panels={panels}
              onPanelClick={(panel) => console.log('Panel clicked:', panel.id)}
              onPanelDoubleClick={(panel) => console.log('Panel double-clicked:', panel.id)}
              onPanelUpdate={(updatedPanels) => console.log('Panels updated:', updatedPanels.length)}
              onSave={() => console.log('Save clicked')}
              onExport={() => console.log('Export clicked')}
              onImport={() => console.log('Import clicked')}
              featureFlags={featureFlags}
            />
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
