'use client';

import React, { useEffect } from 'react';
import { PanelProvider, useFullscreenState } from '@/contexts/PanelContext';
import { PanelCanvas } from './PanelCanvas';
import { PanelToolbar } from './PanelToolbar';
import { PanelLayoutErrorBoundary } from './PanelLayoutErrorBoundary';
import FullscreenLayout from './FullscreenLayout';
import { Panel } from '@/types/panel';

interface PanelLayoutRefactoredProps {
  panels: Panel[];
  projectId: string;
  onPanelUpdate?: (panelId: string, updates: Partial<Panel>) => Promise<void>;
  onPanelDelete?: (panelId: string) => void;
  onAddPanel?: () => void;
  onPanelSelect?: (panel: Panel) => void;
  onViewFullDetails?: () => void;
  isFullscreen?: boolean;
  featureFlags?: {
    ENABLE_PERSISTENCE?: boolean;
    ENABLE_DRAGGING?: boolean;
    ENABLE_LOCAL_STORAGE?: boolean;
    ENABLE_DEBUG_LOGGING?: boolean;
    ENABLE_WEBSOCKET_UPDATES?: boolean;
  };
}

/**
 * Refactored PanelLayout component using the new architecture
 * 
 * Key improvements:
 * - Single responsibility principle: Each component has one clear purpose
 * - Context-based state management: Centralized state with reducers
 * - Custom hooks: Reusable logic extracted into focused hooks
 * - Error boundaries: Proper error handling and recovery
 * - Type safety: Full TypeScript coverage with validation
 * - Performance: Debounced operations and optimized rendering
 */
// Internal component that uses the fullscreen state
function PanelLayoutContent({
  panels,
  projectId,
  onPanelUpdate,
  onPanelDelete,
  onAddPanel,
  onPanelSelect,
  onViewFullDetails,
  isFullscreen,
  featureFlags = {},
}: PanelLayoutRefactoredProps) {
  // Internal event handlers
  const handlePanelClick = (panel: Panel) => {
    console.log('Panel clicked:', panel.id);
    if (onPanelSelect) {
      onPanelSelect(panel);
    }
  };

  const handlePanelDoubleClick = (panel: Panel) => {
    console.log('Panel double-clicked:', panel.id);
  };

  const handlePanelUpdate = async (panelId: string, updates: Partial<Panel>) => {
    console.log('Panel updated:', panelId, updates);
    await onPanelUpdate?.(panelId, updates);
  };

  const handleAddPanel = () => {
    console.log('Add panel requested');
    onAddPanel?.();
  };

  const handleSave = () => {
    console.log('Save clicked');
  };

  const handleExport = () => {
    console.log('Export clicked');
  };

  const handleImport = () => {
    console.log('Import clicked');
  };
  const { fullscreen } = useFullscreenState();

  // Expose panel data to window object for AI extraction
  useEffect(() => {
    if (panels && panels.length > 0) {
      // Expose panels to window for AI extraction
      (window as any).__PANEL_DATA__ = {
        panels: panels.map(p => ({
          id: p.id,
          panelNumber: p.panel_number,
          rollNumber: p.roll_number,
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

  return (
    <>
      <div className="flex flex-col h-full w-full">
        {/* Toolbar */}
        <PanelToolbar
          onSave={handleSave}
          onExport={handleExport}
          onImport={handleImport}
          onAddPanel={handleAddPanel}
          hasUnsavedChanges={false} // This would come from context
          isFullscreen={fullscreen.isFullscreen}
          showFullscreenToggle={true}
        />
        
        {/* Main Canvas Area */}
        <div className="flex-1 relative canvas-container">
          <PanelCanvas
            panels={panels}
            onPanelClick={handlePanelClick}
            onPanelDoubleClick={handlePanelDoubleClick}
            onPanelUpdate={handlePanelUpdate}
            enableDebugLogging={featureFlags.ENABLE_DEBUG_LOGGING}
          />
        </div>
      </div>

      {/* Fullscreen Layout */}
              <FullscreenLayout
                panels={panels}
                projectId={projectId}
                onPanelClick={handlePanelClick}
                onPanelDoubleClick={handlePanelDoubleClick}
                onPanelUpdate={handlePanelUpdate}
                onPanelDelete={onPanelDelete}
                enableDebugLogging={featureFlags.ENABLE_DEBUG_LOGGING}
              />
    </>
  );
}

export function PanelLayoutRefactored({
  panels,
  projectId,
  onPanelUpdate,
  onPanelDelete,
  onAddPanel,
  onPanelSelect,
  onViewFullDetails,
  isFullscreen,
  featureFlags = {},
}: PanelLayoutRefactoredProps) {
  return (
    <PanelLayoutErrorBoundary>
      <PanelProvider 
        initialPanels={panels} 
        featureFlags={featureFlags}
      >
        <PanelLayoutContent
          panels={panels}
          projectId={projectId}
          onPanelUpdate={onPanelUpdate}
          onPanelDelete={onPanelDelete}
          onAddPanel={onAddPanel}
          onPanelSelect={onPanelSelect}
          onViewFullDetails={onViewFullDetails}
          isFullscreen={isFullscreen}
          featureFlags={featureFlags}
        />
      </PanelProvider>
    </PanelLayoutErrorBoundary>
  );
}

export default PanelLayoutRefactored;
