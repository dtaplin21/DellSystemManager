'use client';

import React from 'react';
import { PanelProvider } from '@/contexts/PanelContext';
import { PanelCanvas } from './PanelCanvas';
import { PanelToolbar } from './PanelToolbar';
import { PanelLayoutErrorBoundary } from './PanelLayoutErrorBoundary';
import { Panel } from '@/types/panel';

interface PanelLayoutRefactoredProps {
  panels: Panel[];
  onPanelClick?: (panel: Panel) => void;
  onPanelDoubleClick?: (panel: Panel) => void;
  onPanelUpdate?: (panels: Panel[]) => void;
  onSave?: () => void;
  onExport?: () => void;
  onImport?: () => void;
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
export function PanelLayoutRefactored({
  panels,
  onPanelClick,
  onPanelDoubleClick,
  onPanelUpdate,
  onSave,
  onExport,
  onImport,
  featureFlags = {},
}: PanelLayoutRefactoredProps) {
  return (
    <PanelLayoutErrorBoundary>
      <PanelProvider 
        initialPanels={panels} 
        featureFlags={featureFlags}
      >
        <div className="flex flex-col h-full w-full">
          {/* Toolbar */}
          <PanelToolbar
            onSave={onSave}
            onExport={onExport}
            onImport={onImport}
            hasUnsavedChanges={false} // This would come from context
            isFullscreen={false} // This would come from context
            showFullscreenToggle={true}
          />
          
          {/* Main Canvas Area */}
          <div className="flex-1 relative">
            <PanelCanvas
              panels={panels}
              onPanelClick={onPanelClick}
              onPanelDoubleClick={onPanelDoubleClick}
              enableDebugLogging={featureFlags.ENABLE_DEBUG_LOGGING}
            />
          </div>
        </div>
      </PanelProvider>
    </PanelLayoutErrorBoundary>
  );
}

export default PanelLayoutRefactored;
