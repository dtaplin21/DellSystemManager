'use client';

import React from 'react';
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
  featureFlags = {},
}: PanelLayoutRefactoredProps) {
  // Internal event handlers
  const handlePanelClick = (panel: Panel) => {
    console.log('Panel clicked:', panel.id);
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
                onPanelDelete={removePanel}
                enableDebugLogging={featureFlags.ENABLE_DEBUG_LOGGING}
              />
    </>
  );
}

export function PanelLayoutRefactored({
  panels,
  projectId,
  onPanelUpdate,
  onAddPanel,
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
          onAddPanel={onAddPanel}
          featureFlags={featureFlags}
        />
      </PanelProvider>
    </PanelLayoutErrorBoundary>
  );
}

export default PanelLayoutRefactored;
