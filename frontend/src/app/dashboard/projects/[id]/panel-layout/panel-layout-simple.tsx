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
import { PanelLayoutRefactored } from '@/components/panels/PanelLayoutRefactored';
import { Panel } from '@/types/panel';

// Simple, clean implementation using the new architecture
export default function PanelLayoutSimple() {
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

  // Handle panel position updates
  const handlePanelPositionUpdate = (panelId: string, position: { x: number; y: number; rotation?: number }) => {
    updatePanelPosition(panelId, {
      x: position.x,
      y: position.y,
      rotation: position.rotation ?? 0
    });
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
          <PanelLayoutRefactored
            panels={panels}
            projectId={Array.isArray(params.id) ? params.id[0] || 'unknown' : params.id || 'unknown'}
            featureFlags={{
              ENABLE_PERSISTENCE: true,
              ENABLE_DRAGGING: true,
              ENABLE_LOCAL_STORAGE: true,
              ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development',
              ENABLE_WEBSOCKET_UPDATES: false,
            }}
          />
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
