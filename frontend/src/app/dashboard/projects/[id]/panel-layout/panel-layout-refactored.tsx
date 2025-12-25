'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { usePanelData } from '@/hooks/usePanelData';
import { PanelLayoutErrorBoundary } from '@/components/panels/PanelLayoutErrorBoundary';
import { logTelemetry } from '@/lib/telemetry';
import { 
  LoadingFallback, 
  ErrorFallback, 
  EmptyStateFallback, 
  HydrationFallback 
} from '@/components/panels/PanelLayoutFallbacks';
import { PanelLayoutRefactored as PanelLayoutComponent } from '@/components/panels/PanelLayoutRefactored';
import CreatePanelModal from '@/components/panels/CreatePanelModal';
import PanelSidebar from '@/components/panel-layout/panel-sidebar';
import PatchSidebar from '@/components/panel-layout/patch-sidebar';
import DestructSidebar from '@/components/panel-layout/destruct-sidebar';
import { AsbuiltDataProvider } from '@/contexts/AsbuiltDataContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { usePatchData } from '@/hooks/usePatchData';
import CreatePatchModal from '@/components/patches/CreatePatchModal';
import { useDestructiveTestData } from '@/hooks/useDestructiveTestData';
import CreateDestructiveTestModal from '@/components/destructive-tests/CreateDestructiveTestModal';
// FullscreenLayout is now handled inside PanelLayoutComponent
// Removed useFullscreenState import - will be handled inside PanelLayoutComponent
import { Panel } from '@/types/panel';
import { Patch, PATCH_CONFIG } from '@/types/patch';
import { DestructiveTest } from '@/types/destructiveTest';

// Progressive enhancement: Start simple, enhance on client
export default function PanelLayoutRefactored() {
  
  const params = useParams();
  const projectId = params.id as string;
  
  
  // Client-side hydration state
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'panels' | 'patches' | 'destructs'>('panels');
  
  // Visibility state - controls what types are visible on the canvas
  // All types are always visible on the unified canvas
  const [visibleTypes] = useState({
    panels: true,
    patches: true,
    destructs: true
  });
  
  // Modal state
  const [showCreatePanelModal, setShowCreatePanelModal] = useState(false);
  const [showCreatePatchModal, setShowCreatePatchModal] = useState(false);
  const [showCreateDestructiveTestModal, setShowCreateDestructiveTestModal] = useState(false);
  
  // Patch data
  const {
    patches,
    isLoading: patchesLoading,
    error: patchesError,
    addPatch,
    updatePatch,
    removePatch,
    refreshData: refreshPatches
  } = usePatchData({ projectId });
  
  // Destructive test data
  const {
    destructiveTests,
    isLoading: destructsLoading,
    error: destructsError,
    addDestructiveTest,
    updateDestructiveTest,
    removeDestructiveTest,
    refreshData: refreshDestructs
  } = useDestructiveTestData({ projectId });
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null);
  const [selectedPatch, setSelectedPatch] = useState<Patch | null>(null);
  const [selectedDestructiveTest, setSelectedDestructiveTest] = useState<DestructiveTest | null>(null);
  
  // Fullscreen state detection
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Cardinal direction state
  const [cardinalDirection, setCardinalDirection] = useState<'north' | 'south' | 'east' | 'west'>('north');
  
  // Feature flags for debugging/development
  const featureFlags = {
    ENABLE_PERSISTENCE: true,
    ENABLE_DRAGGING: true,
    ENABLE_LOCAL_STORAGE: true,
    ENABLE_DEBUG_LOGGING: false,
    ENABLE_WEBSOCKET_UPDATES: false // Disabled for now to simplify
  };

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
  } = usePanelData({ projectId, featureFlags });
  
  // Prevent server-side rendering issues
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    // Check initial fullscreen state
    handleFullscreenChange();
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Expose panel data to window object for AI extraction
  useEffect(() => {
    if (panels && panels.length > 0) {
      // Expose panels to window for AI extraction
      (window as any).__PANEL_DATA__ = {
        panels: panels.map(p => ({
          id: p.id,
          panelNumber: (p as any).panelNumber || (p as any).panel_number,
          rollNumber: (p as any).rollNumber || (p as any).roll_number,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          rotation: p.rotation || 0
        })),
        source: 'react_state',
        timestamp: Date.now(),
        projectId: projectId
      };
    } else {
      // Clear if no panels
      if ((window as any).__PANEL_DATA__) {
        delete (window as any).__PANEL_DATA__;
      }
    }
  }, [panels, projectId]);
  
  // Don't render anything on server side to prevent SSR issues
  if (!isHydrated) {
    return <HydrationFallback />;
  }
  
  


  // Handle panel position updates
  const handlePanelPositionUpdate = async (panelId: string, updates: Partial<Panel>) => {
    // Validate position data before sending
    // Allow rotation-only updates, but require x,y for position updates
    const hasPositionData = updates.x !== undefined && updates.y !== undefined;
    const hasRotationData = updates.rotation !== undefined;
    
    if (!hasPositionData && !hasRotationData) {
      console.error('❌ [handlePanelPositionUpdate] Missing position or rotation data:', { updates });
      return;
    }
    
    if (hasPositionData && (typeof updates.x !== 'number' || typeof updates.y !== 'number')) {
      console.error('❌ [handlePanelPositionUpdate] Invalid position data types:', {
        x: updates.x,
        y: updates.y,
        xType: typeof updates.x,
        yType: typeof updates.y
      });
      return;
    }


    // For rotation-only updates, we need to get the current panel position
    // For position updates, we can use the provided coordinates
    let position;
    
    if (updates.x !== undefined && updates.y !== undefined) {
      // Position update - use provided coordinates
      position = {
        x: Number(updates.x),
        y: Number(updates.y),
        rotation: updates.rotation !== undefined ? Number(updates.rotation) : 0
      };
    } else if (updates.rotation !== undefined) {
      // Rotation-only update - get current panel position first
      const currentPanel = panels.find(p => p.id === panelId);
      if (!currentPanel) {
        console.error('❌ [handlePanelPositionUpdate] Panel not found for rotation update:', panelId);
        return;
      }
      
      position = {
        x: currentPanel.x,
        y: currentPanel.y,
        rotation: Number(updates.rotation)
      };
    } else {
      console.error('❌ [handlePanelPositionUpdate] No valid updates provided:', updates);
      return;
    }

    await updatePanelPosition(panelId, position);
  };

  // Handle panel deletion
  const handlePanelDelete = async (panelId: string) => {
    try {
      await removePanel(panelId);
    } catch (error) {
      console.error('🗑️ [PanelLayoutRefactored] Error deleting panel:', error);
    }
  };

  // Handle patch deletion
  const handlePatchDelete = async (patchId: string) => {
    try {
      await removePatch(patchId);
      // Clear selection if deleted patch was selected
      if (selectedPatch?.id === patchId) {
        setSelectedPatch(null);
      }
    } catch (error) {
      console.error('🗑️ [PanelLayoutRefactored] Error deleting patch:', error);
      throw error; // Re-throw so confirmation dialog can handle it
    }
  };

  // Handle destructive test deletion
  const handleDestructiveTestDelete = async (testId: string) => {
    try {
      await removeDestructiveTest(testId);
      // Clear selection if deleted test was selected
      if (selectedDestructiveTest?.id === testId) {
        setSelectedDestructiveTest(null);
      }
    } catch (error) {
      console.error('🗑️ [PanelLayoutRefactored] Error deleting destructive test:', error);
      throw error; // Re-throw so confirmation dialog can handle it
    }
  };

  // Handle panel selection for sidebar
  const handlePanelSelect = (panel: Panel) => {
    setSelectedPanel(panel);
    // setSidebarOpen(true); // Removed - no auto-open, user must click "View Full Details"
  };

  // Handle sidebar close
  const handleSidebarClose = () => {
    setSidebarOpen(false);
    setSelectedPanel(null);
    setSelectedPatch(null);
    setSelectedDestructiveTest(null);
  };

  // Handle patch click
  const handlePatchClick = (patch: Patch) => {
    setSelectedPatch(patch);
    setSelectedPanel(null);
    setSelectedDestructiveTest(null);
    setSidebarOpen(true);
  };

  // Handle destructive test click
  const handleDestructiveTestClick = (destructiveTest: DestructiveTest) => {
    setSelectedDestructiveTest(destructiveTest);
    setSelectedPanel(null);
    setSelectedPatch(null);
    setSidebarOpen(true);
  };

  // Handle panel click (existing)
  const handlePanelClick = (panel: Panel) => {
    setSelectedPanel(panel);
    setSelectedPatch(null);
    setSelectedDestructiveTest(null);
    setSidebarOpen(true);
  };

  // Handle "View Full Details" button click
  const handleViewFullDetails = () => {
    if (selectedPanel) {
      setSidebarOpen(true);
    }
  };

  // Panel creation handlers
  const handleAddPanel = () => {
    setShowCreatePanelModal(true);
  };

  const handleCreatePanel = async (panelData: any) => {
    // Set dimensions based on shape
      // Rectangle and right-triangle panels: use user dimensions
    const panelWidth = panelData.width || 100;
    const panelHeight = panelData.length || 50;
    
    const newPanel: Omit<Panel, 'id'> = {
      shape: panelData.shape || 'rectangle',
      x: 100 + (panels.length * 50),
      y: 100 + (panels.length * 30),
      width: panelWidth,
      height: panelHeight,
      rotation: 0,
      fill: '#87CEEB',
      color: '#87CEEB',
      rollNumber: panelData.rollNumber || `ROLL-${panels.length + 1}`,
      panelNumber: panelData.panelNumber || `${panels.length + 1}`,
      date: panelData.date || new Date().toISOString().slice(0, 10),
      location: panelData.location || '',
      isValid: true,
      meta: {
        repairs: [],
        airTest: { result: 'pending' }
      }
    };
    
    try {
      await addPanel(newPanel);
      setShowCreatePanelModal(false);
    } catch (error) {
      console.error('❌ Failed to create panel:', error);
      // Keep modal open on error so user can retry
    }
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

  // Fullscreen handlers - will be handled by PanelLayoutComponent
  const handleToggleFullscreen = () => {
    // This will be handled by the PanelLayoutComponent
  };

  const handleFullscreenPanelClick = (panel: Panel) => {
    // The fullscreen layout will handle panel selection
  };

  const handleFullscreenPanelDoubleClick = (panel: Panel) => {
    // The fullscreen layout will handle panel interactions
  };

  const handleFullscreenPanelUpdate = (panelId: string, updates: Partial<Panel>) => {
    handlePanelPositionUpdate(panelId, updates);
  };

  // Server-side rendering: Show loading state
  if (!isHydrated) {
    return <HydrationFallback />;
  }

  // Error boundary wrapper
  return (
    <AsbuiltDataProvider projectId={projectId}>
      <PanelLayoutErrorBoundary>
        <div className="h-full w-full flex flex-col min-h-0">
        
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
        
        {/* Tabs Navigation */}
        {!isLoading && !error && (
          <Tabs 
            value={activeTab} 
            onValueChange={(value) => {
              const tab = value as 'panels' | 'patches' | 'destructs';
              setActiveTab(tab);
              // Tabs control which creation modal opens, not visibility
              // All types remain visible on the unified canvas
            }} 
            className="h-full flex flex-col min-h-0"
          >
            <TabsList className="w-full border-b rounded-none">
              <TabsTrigger value="panels">Panels</TabsTrigger>
              <TabsTrigger value="patches">Patches</TabsTrigger>
              <TabsTrigger value="destructs">Destructive Tests</TabsTrigger>
            </TabsList>
            
            {/* Unified Canvas - All tabs use the same component with visibility control */}
            <TabsContent value={activeTab} className="flex-1 mt-0 flex flex-col min-h-0 overflow-hidden">
              {/* Empty state for panels tab - only show if truly no panels AND canvas is not rendering */}
              {/* Note: We show the canvas even when empty (like fullscreen), so empty state is only for initial load */}
              {activeTab === 'panels' && !isLoading && !error && panels.length === 0 && dataState.state === 'empty' && (
          <EmptyStateFallback 
            onAddPanel={handleAddTestPanel}
            onImportLayout={() => {}}
          />
        )}
        
              {/* Empty state for patches tab */}
              {activeTab === 'patches' && !patchesLoading && !patchesError && patches.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">No patches yet</p>
                    <button
                      onClick={() => setShowCreatePatchModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Create First Patch
                    </button>
                  </div>
                </div>
              )}
              
              {/* Empty state for destructive tests tab */}
              {activeTab === 'destructs' && !destructsLoading && !destructsError && destructiveTests.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">No destructive tests yet</p>
                    <button
                      onClick={() => setShowCreateDestructiveTestModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Create First Destructive Test
                    </button>
                  </div>
                </div>
              )}
              
              {/* Unified Panel Layout Component - renders all types based on visibility */}
              {/* Render canvas whenever we're not loading and no error - similar to fullscreen behavior */}
              {(() => {
                // Render if we're on the panels tab and not loading/error (even if no panels yet)
                const shouldRenderPanels = activeTab === 'panels' && !isLoading && !error;
                // Render patches/destructs only if they exist (to show empty state otherwise)
                const shouldRenderPatches = activeTab === 'patches' && !patchesLoading && !patchesError && patches.length > 0;
                const shouldRenderDestructs = activeTab === 'destructs' && !destructsLoading && !destructsError && destructiveTests.length > 0;
                const shouldRender = shouldRenderPanels || shouldRenderPatches || shouldRenderDestructs;
                
                return shouldRender;
              })() && (
                <div className="flex-1 w-full relative min-h-0">
            <PanelLayoutComponent
              panels={panels}
                    patches={patches}
                    destructiveTests={destructiveTests}
                    visibleTypes={visibleTypes}
                    cardinalDirection={cardinalDirection}
              projectId={Array.isArray(params.id) ? params.id[0] || 'unknown' : params.id || 'unknown'}
              onPanelSelect={handlePanelClick}
              onPatchClick={handlePatchClick}
              onDestructiveTestClick={handleDestructiveTestClick}
              onPanelUpdate={handlePanelPositionUpdate}
              onPatchUpdate={async (patchId, updates) => {
                try {
                  await updatePatch(patchId, updates);
                } catch (error) {
                  console.error('Error updating patch:', error);
                }
              }}
              onDestructiveTestUpdate={async (testId, updates) => {
                logTelemetry({
                  location: 'panel-layout-refactored.tsx:530',
                  message: 'onDestructiveTestUpdate callback called',
                  data: { testId, updates, x: updates.x, y: updates.y },
                  sessionId: 'debug-session',
                  runId: 'run1',
                  hypothesisId: 'D'
                });
                try {
                  await updateDestructiveTest(testId, updates);
                  logTelemetry({
                    location: 'panel-layout-refactored.tsx:535',
                    message: 'updateDestructiveTest succeeded',
                    data: { testId },
                    sessionId: 'debug-session',
                    runId: 'run1',
                    hypothesisId: 'D'
                  });
                } catch (error) {
                  logTelemetry({
                    location: 'panel-layout-refactored.tsx:538',
                    message: 'Error in onDestructiveTestUpdate callback',
                    data: {
                      testId,
                      error: error instanceof Error ? error.message : String(error)
                    },
                    sessionId: 'debug-session',
                    runId: 'run1',
                    hypothesisId: 'D'
                  });
                  console.error('Error updating destructive test:', error);
                }
              }}
              onPanelDelete={handlePanelDelete}
              onPatchDelete={handlePatchDelete}
              onDestructiveTestDelete={handleDestructiveTestDelete}
                    onAddPanel={activeTab === 'panels' ? handleAddPanel : undefined}
                    onCreatePanel={handleCreatePanel}
                    onAddPatch={async (patchData) => {
                      try {
                        await addPatch({
                          ...patchData,
                          radius: PATCH_CONFIG.RADIUS,
                          rotation: 0,
                          isValid: true,
                          fill: '#ef4444',
                          color: '#b91c1c'
                        });
                      } catch (error) {
                        console.error('Error creating patch:', error);
                        throw error;
                      }
                    }}
                    onAddDestructiveTest={async (testData) => {
                      try {
                        await addDestructiveTest({
                          ...testData,
                          rotation: 0,
                          isValid: true,
                          fill: '#f59e0b',
                          color: '#d97706'
                        });
                      } catch (error) {
                        console.error('Error creating destructive test:', error);
                        throw error;
                      }
                    }}
              onPanelSelect={handlePanelSelect}
              onViewFullDetails={handleViewFullDetails}
              isFullscreen={isFullscreen}
              featureFlags={featureFlags}
            />
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
        
        {/* Action buttons for patches and destructive tests - shown when respective tab is active */}
        {!isLoading && !error && activeTab === 'patches' && (
          <div className="absolute top-20 right-4 z-10">
            <button
              onClick={() => setShowCreatePatchModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-lg"
            >
              Add Patch
            </button>
          </div>
        )}
        
        {!isLoading && !error && activeTab === 'destructs' && (
          <div className="absolute top-20 right-4 z-10">
            <button
              onClick={() => setShowCreateDestructiveTestModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-lg"
            >
              Add Destructive Test
            </button>
          </div>
        )}
        
        {/* Create Panel Modal */}
        {showCreatePanelModal && (
          <CreatePanelModal
            onClose={() => setShowCreatePanelModal(false)}
            onCreatePanel={handleCreatePanel}
          />
        )}

        {/* Create Patch Modal */}
        {showCreatePatchModal && (
          <CreatePatchModal
            onClose={() => setShowCreatePatchModal(false)}
            onCreatePatch={async (patchData) => {
              try {
                await addPatch({
                  ...patchData,
                  radius: PATCH_CONFIG.RADIUS,
                  rotation: 0,
                  isValid: true,
                  fill: '#ef4444',
                  color: '#b91c1c'
                });
                setShowCreatePatchModal(false);
              } catch (error) {
                console.error('Error creating patch:', error);
              }
            }}
          />
        )}

        {/* Create Destructive Test Modal */}
        {showCreateDestructiveTestModal && (
          <CreateDestructiveTestModal
            onClose={() => setShowCreateDestructiveTestModal(false)}
            onCreateTest={async (testData) => {
              try {
                await addDestructiveTest({
                  ...testData,
                  rotation: 0,
                  isValid: true,
                  fill: '#f59e0b',
                  color: '#d97706'
                });
                setShowCreateDestructiveTestModal(false);
              } catch (error) {
                console.error('Error creating destructive test:', error);
              }
            }}
          />
        )}

        {/* Panel Sidebar - Only show in fullscreen mode */}
        {selectedPanel && isFullscreen && (
          <PanelSidebar
            isOpen={sidebarOpen}
            onToggle={handleSidebarClose}
            projectId={Array.isArray(params.id) ? params.id[0] || 'unknown' : params.id || 'unknown'}
            panelId={selectedPanel.id}
            panelNumber={selectedPanel.panelNumber || selectedPanel.id}
            onClose={handleSidebarClose}
          />
        )}

        {/* Patch Sidebar */}
        {selectedPatch && isFullscreen && (
          <PatchSidebar
            isOpen={sidebarOpen}
            onToggle={handleSidebarClose}
            projectId={Array.isArray(params.id) ? params.id[0] || 'unknown' : params.id || 'unknown'}
            patch={selectedPatch}
            onClose={handleSidebarClose}
          />
        )}

        {/* Destructive Test Sidebar */}
        {selectedDestructiveTest && isFullscreen && (
          <DestructSidebar
            isOpen={sidebarOpen}
            onToggle={handleSidebarClose}
            projectId={Array.isArray(params.id) ? params.id[0] || 'unknown' : params.id || 'unknown'}
            destructiveTest={selectedDestructiveTest}
            onClose={handleSidebarClose}
          />
        )}
        
        {/* Fullscreen Layout is now handled inside PanelLayoutComponent */}
        </div>
      </PanelLayoutErrorBoundary>
    </AsbuiltDataProvider>
  );
}
