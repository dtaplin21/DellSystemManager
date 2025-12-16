'use client';

import React, { useEffect } from 'react';
import { PanelProvider, useFullscreenState } from '@/contexts/PanelContext';
import { PanelCanvas } from './PanelCanvas';
import { PanelToolbar } from './PanelToolbar';
import { PanelLayoutErrorBoundary } from './PanelLayoutErrorBoundary';
import FullscreenLayout from './FullscreenLayout';
import { Panel } from '@/types/panel';
import { Patch } from '@/types/patch';
import { DestructiveTest } from '@/types/destructiveTest';

interface PanelLayoutRefactoredProps {
  panels: Panel[];
  projectId: string;
  patches?: Patch[];
  destructiveTests?: DestructiveTest[];
  visibleTypes?: {
    panels: boolean;
    patches: boolean;
    destructs: boolean;
  };
  onPanelUpdate?: (panelId: string, updates: Partial<Panel>) => Promise<void>;
  onPatchUpdate?: (patchId: string, updates: Partial<Patch>) => Promise<void>;
  onDestructiveTestUpdate?: (testId: string, updates: Partial<DestructiveTest>) => Promise<void>;
  onPanelDelete?: (panelId: string) => void;
  onAddPanel?: () => void;
  onCreatePanel?: (panelData: any) => Promise<void>;
  onAddPatch?: (patch: Omit<Patch, 'id'>) => Promise<void>;
  onAddDestructiveTest?: (test: Omit<DestructiveTest, 'id'>) => Promise<void>;
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
  patches = [],
  destructiveTests = [],
  visibleTypes = { panels: true, patches: false, destructs: false },
  onPanelUpdate,
  onPatchUpdate,
  onDestructiveTestUpdate,
  onPanelDelete,
  onAddPanel,
  onCreatePanel,
  onAddPatch,
  onAddDestructiveTest,
  onPanelSelect,
  onViewFullDetails,
  isFullscreen,
  featureFlags = {},
}: PanelLayoutRefactoredProps) {
  // Internal event handlers
  const handlePanelClick = (panel: Panel) => {
    if (onPanelSelect) {
      onPanelSelect(panel);
    }
  };

  const handlePanelDoubleClick = (panel: Panel) => {
  };

  const handlePanelUpdate = async (panelId: string, updates: Partial<Panel>) => {
    await onPanelUpdate?.(panelId, updates);
  };

  const handlePatchUpdate = async (patchId: string, updates: Partial<Patch>) => {
    await onPatchUpdate?.(patchId, updates);
  };

  const handleDestructiveTestUpdate = async (testId: string, updates: Partial<DestructiveTest>) => {
    await onDestructiveTestUpdate?.(testId, updates);
  };

  const handleAddPanel = () => {
    onAddPanel?.();
  };

  const handleSave = () => {
  };

  const handleExport = () => {
  };

  const handleImport = () => {
  };
  const { fullscreen } = useFullscreenState();

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

  return (
    <>
      <div className="flex flex-col h-full w-full min-h-0">
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
        <div className="flex-1 relative canvas-container min-h-0">
          <PanelCanvas
            panels={panels}
            patches={patches}
            destructiveTests={destructiveTests}
            visibleTypes={visibleTypes}
            onPanelClick={handlePanelClick}
            onPanelDoubleClick={handlePanelDoubleClick}
            onPanelUpdate={handlePanelUpdate}
            onPatchUpdate={handlePatchUpdate}
            onDestructiveTestUpdate={handleDestructiveTestUpdate}
            enableDebugLogging={featureFlags.ENABLE_DEBUG_LOGGING}
          />
        </div>
      </div>

      {/* Fullscreen Layout */}
              <FullscreenLayout
                panels={panels}
                patches={patches}
                destructiveTests={destructiveTests}
                projectId={projectId}
                visibleTypes={visibleTypes}
                onPanelClick={handlePanelClick}
                onPanelDoubleClick={handlePanelDoubleClick}
                onPanelUpdate={handlePanelUpdate}
                onPatchUpdate={handlePatchUpdate}
                onDestructiveTestUpdate={handleDestructiveTestUpdate}
                onPanelDelete={onPanelDelete}
                onAddPanel={onAddPanel}
                onCreatePanel={onCreatePanel}
                onAddPatch={onAddPatch}
                onAddDestructiveTest={onAddDestructiveTest}
                enableDebugLogging={featureFlags.ENABLE_DEBUG_LOGGING}
              />
    </>
  );
}

export function PanelLayoutRefactored({
  panels,
  projectId,
  patches = [],
  destructiveTests = [],
  visibleTypes = { panels: true, patches: false, destructs: false },
  onPanelUpdate,
  onPatchUpdate,
  onDestructiveTestUpdate,
  onPanelDelete,
  onAddPanel,
  onCreatePanel,
  onAddPatch,
  onAddDestructiveTest,
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
          patches={patches}
          destructiveTests={destructiveTests}
          visibleTypes={visibleTypes}
          onPanelUpdate={onPanelUpdate}
          onPatchUpdate={onPatchUpdate}
          onDestructiveTestUpdate={onDestructiveTestUpdate}
          onPanelDelete={onPanelDelete}
          onAddPanel={onAddPanel}
          onCreatePanel={onCreatePanel}
          onAddPatch={onAddPatch}
          onAddDestructiveTest={onAddDestructiveTest}
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
