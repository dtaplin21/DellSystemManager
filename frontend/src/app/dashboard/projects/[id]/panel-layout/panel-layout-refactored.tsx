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
import CreatePanelModal from '@/components/panels/CreatePanelModal';
import { Panel } from '@/types/panel';

// Progressive enhancement: Start simple, enhance on client
export default function PanelLayoutRefactored() {
  console.log('🔍 [PanelLayoutRefactored] ===== COMPONENT RENDERED =====');
  
  const params = useParams();
  const projectId = params.id as string;
  
  console.log('🔍 [PanelLayoutRefactored] Project ID from params:', projectId);

  
  // Client-side hydration state
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Modal state
  const [showCreatePanelModal, setShowCreatePanelModal] = useState(false);
  
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
  const handlePanelPositionUpdate = (panelId: string, updates: Partial<Panel>) => {
    // Extract position data from updates
    const position = {
      x: updates.x!,
      y: updates.y!,
      rotation: updates.rotation
    };
    updatePanelPosition(panelId, position);
  };

  // Panel creation handlers
  const handleAddPanel = () => {
    setShowCreatePanelModal(true);
  };

  const handleCreatePanel = (panelData: any) => {
    console.log('🔍 [PanelLayoutRefactored] Creating panel with data:', panelData);
    const newPanel: Omit<Panel, 'id'> = {
      shape: panelData.shape || 'rectangle',
      x: 100 + (panels.length * 50),
      y: 100 + (panels.length * 30),
      width: panelData.width || 100,
      height: panelData.length || 50,
      rotation: 0,
      fill: '#3b82f6',
      color: '#3b82f6',
      rollNumber: panelData.rollNumber || `ROLL-${panels.length + 1}`,
      panelNumber: panelData.panelNumber || `P${panels.length + 1}`,
      date: panelData.date || new Date().toISOString().slice(0, 10),
      location: panelData.location || '',
      isValid: true,
      meta: {
        repairs: [],
        airTest: { result: 'pending' }
      }
    };
    
    addPanel(newPanel);
    setShowCreatePanelModal(false);
  };

  // Handle adding test panels (for empty state)
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
            {/* Main panel layout component */}
            <PanelLayoutComponent
              panels={panels}
              onPanelClick={(panel) => console.log('Panel clicked:', panel.id)}
              onPanelDoubleClick={(panel) => console.log('Panel double-clicked:', panel.id)}
              onPanelUpdate={handlePanelPositionUpdate}
              onSave={() => console.log('Save clicked')}
              onExport={() => console.log('Export clicked')}
              onImport={() => console.log('Import clicked')}
              onAddPanel={handleAddPanel}
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
        
        {/* Create Panel Modal */}
        {showCreatePanelModal && (
          <CreatePanelModal
            onClose={() => setShowCreatePanelModal(false)}
            onCreatePanel={handleCreatePanel}
          />
        )}
      </div>
    </PanelLayoutErrorBoundary>
  );
}
