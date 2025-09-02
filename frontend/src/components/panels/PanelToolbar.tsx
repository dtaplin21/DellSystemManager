'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Save, 
  Download, 
  Upload,
  Grid3X3,
  Maximize,
  Minimize
} from 'lucide-react';
import { useCanvasState, useFullscreenState, useFeatureFlags } from '@/contexts/PanelContext';

interface PanelToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
  onSave?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onToggleGrid?: () => void;
  onToggleFullscreen?: () => void;
  hasUnsavedChanges?: boolean;
  isFullscreen?: boolean;
  showFullscreenToggle?: boolean;
}

/**
 * Focused component for panel layout toolbar
 * Handles only toolbar-specific concerns
 */
export function PanelToolbar({
  onZoomIn,
  onZoomOut,
  onResetView,
  onSave,
  onExport,
  onImport,
  onToggleGrid,
  onToggleFullscreen,
  hasUnsavedChanges = false,
  isFullscreen = false,
  showFullscreenToggle = true,
}: PanelToolbarProps) {
  const { canvas } = useCanvasState();
  const { fullscreen } = useFullscreenState();
  const featureFlags = useFeatureFlags();

  const handleZoomIn = () => {
    const newScale = Math.min(10, canvas.worldScale * 1.2);
    // This would need to be connected to the canvas context
    onZoomIn?.();
  };

  const handleZoomOut = () => {
    const newScale = Math.max(0.1, canvas.worldScale * 0.8);
    // This would need to be connected to the canvas context
    onZoomOut?.();
  };

  const handleResetView = () => {
    // Reset to default view
    onResetView?.();
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-white border-b border-gray-200 shadow-sm">
      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomOut}
          disabled={canvas.worldScale <= 0.1}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        
        <span className="text-sm text-gray-600 min-w-[60px] text-center">
          {Math.round(canvas.worldScale * 100)}%
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomIn}
          disabled={canvas.worldScale >= 10}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* View Controls */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleResetView}
        title="Reset View"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onToggleGrid}
        title="Toggle Grid"
      >
        <Grid3X3 className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300" />

      {/* File Operations */}
      <Button
        variant="outline"
        size="sm"
        onClick={onSave}
        disabled={!hasUnsavedChanges}
        title="Save Layout"
      >
        <Save className="h-4 w-4" />
        {hasUnsavedChanges && <span className="ml-1 text-xs text-orange-600">*</span>}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
        title="Export Layout"
      >
        <Download className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onImport}
        title="Import Layout"
      >
        <Upload className="h-4 w-4" />
      </Button>

      {/* Fullscreen Toggle */}
      {showFullscreenToggle && (
        <>
          <div className="w-px h-6 bg-gray-300" />
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </Button>
        </>
      )}

      {/* Debug Info (Development Only) */}
      {featureFlags.ENABLE_DEBUG_LOGGING && (
        <>
          <div className="w-px h-6 bg-gray-300" />
          <div className="text-xs text-gray-500">
            Debug Mode
          </div>
        </>
      )}
    </div>
  );
}
