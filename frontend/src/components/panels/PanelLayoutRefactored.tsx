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
  onPanelClick?: (panel: Panel) => void;
  onPanelDoubleClick?: (panel: Panel) => void;
  onPanelUpdate?: (panelId: string, updates: Partial<Panel>) => void;
  onSave?: () => void;
  onExport?: () => void;
  onImport?: () => void;
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
  onPanelClick,
  onPanelDoubleClick,
  onPanelUpdate,
  onSave,
  onExport,
  onImport,
  onAddPanel,
  featureFlags = {},
}: PanelLayoutRefactoredProps) {
  const { fullscreen } = useFullscreenState();

  return (
    <>
      <div className="flex flex-col h-full w-full">
        {/* Toolbar */}
        <PanelToolbar
          onSave={onSave}
          onExport={onExport}
          onImport={onImport}
          onAddPanel={onAddPanel}
          hasUnsavedChanges={false} // This would come from context
          isFullscreen={fullscreen.isFullscreen}
          showFullscreenToggle={true}
        />
        
        {/* Main Canvas Area */}
        <div className="flex-1 relative canvas-container">
          <PanelCanvas
            panels={panels}
            onPanelClick={onPanelClick}
            onPanelDoubleClick={onPanelDoubleClick}
            onPanelUpdate={onPanelUpdate}
            enableDebugLogging={featureFlags.ENABLE_DEBUG_LOGGING}
          />
        </div>
      </div>

      {/* Fullscreen Layout */}
      <FullscreenLayout
        panels={panels}
        onPanelClick={onPanelClick}
        onPanelDoubleClick={onPanelDoubleClick}
        onPanelUpdate={onPanelUpdate}
        enableDebugLogging={featureFlags.ENABLE_DEBUG_LOGGING}
      />
    </>
  );
}

export function PanelLayoutRefactored({
  panels,
  onPanelClick,
  onPanelDoubleClick,
  onPanelUpdate,
  onSave,
  onExport,
  onImport,
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
          onPanelClick={onPanelClick}
          onPanelDoubleClick={onPanelDoubleClick}
          onPanelUpdate={onPanelUpdate}
          onSave={onSave}
          onExport={onExport}
          onImport={onImport}
          onAddPanel={onAddPanel}
          featureFlags={featureFlags}
        />
      </PanelProvider>
    </PanelLayoutErrorBoundary>
  );
}

export default PanelLayoutRefactored;
