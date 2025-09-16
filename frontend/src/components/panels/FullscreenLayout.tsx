'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { X, Minimize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFullscreenState, useCanvasState } from '@/contexts/PanelContext';
import { Panel } from '@/types/panel';
import { PanelCanvas } from './PanelCanvas';

interface FullscreenLayoutProps {
  panels: Panel[];
  onPanelClick?: (panel: Panel) => void;
  onPanelDoubleClick?: (panel: Panel) => void;
  onPanelUpdate?: (panelId: string, updates: Partial<Panel>) => void;
  enableDebugLogging?: boolean;
}

/**
 * Fullscreen layout component for panel canvas
 * Provides immersive fullscreen experience with dedicated controls
 */
export function FullscreenLayout({
  panels,
  onPanelClick,
  onPanelDoubleClick,
  onPanelUpdate,
  enableDebugLogging = false,
}: FullscreenLayoutProps) {
  const { fullscreen, dispatchFullscreen } = useFullscreenState();
  const { canvas, dispatchCanvas } = useCanvasState();
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && fullscreen.isFullscreen) {
        dispatchFullscreen({ type: 'SET_FULLSCREEN', payload: false });
      }
      // Fullscreen-specific keyboard shortcuts
      if (fullscreen.isFullscreen) {
        if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          handleZoomIn();
        } else if (event.key === '-') {
          event.preventDefault();
          handleZoomOut();
        } else if (event.key === '0') {
          event.preventDefault();
          handleResetZoom();
        } else if (event.key === 'f' || event.key === 'F') {
          event.preventDefault();
          handleFitToScreen();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [fullscreen.isFullscreen, dispatchFullscreen]);

  // Update zoom level display when canvas state changes
  useEffect(() => {
    const newZoomLevel = Math.round(canvas.worldScale * 100);
    setZoomLevel(newZoomLevel);
  }, [canvas.worldScale]);

  // Memoize panel bounds calculation for performance
  const panelBounds = useMemo(() => {
    if (panels.length === 0) return null;
    
    return panels.reduce((acc, panel) => {
      return {
        minX: Math.min(acc.minX, panel.x),
        minY: Math.min(acc.minY, panel.y),
        maxX: Math.max(acc.maxX, panel.x + panel.width),
        maxY: Math.max(acc.maxY, panel.y + panel.height),
      };
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  }, [panels]);

  // Memoize panel count for performance
  const panelCount = useMemo(() => panels.length, [panels.length]);

  // Optimized zoom handlers with useCallback
  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(5, canvas.worldScale * 1.2);
    dispatchCanvas({ type: 'SET_WORLD_SCALE', payload: newScale });
  }, [canvas.worldScale, dispatchCanvas]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(0.1, canvas.worldScale * 0.8);
    dispatchCanvas({ type: 'SET_WORLD_SCALE', payload: newScale });
  }, [canvas.worldScale, dispatchCanvas]);

  const handleResetZoom = useCallback(() => {
    dispatchCanvas({ type: 'SET_WORLD_SCALE', payload: 1 });
    dispatchCanvas({ type: 'SET_WORLD_OFFSET', payload: { x: 0, y: 0 } });
  }, [dispatchCanvas]);

  const handleFitToScreen = useCallback(() => {
    if (!panelBounds) return;
    
    const panelWidth = panelBounds.maxX - panelBounds.minX;
    const panelHeight = panelBounds.maxY - panelBounds.minY;
    
    if (panelWidth === 0 || panelHeight === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const scaleX = (containerRect.width * 0.9) / panelWidth;
    const scaleY = (containerRect.height * 0.9) / panelHeight;
    const scale = Math.min(scaleX, scaleY, 2); // Cap at 2x zoom

    dispatchCanvas({ type: 'SET_WORLD_SCALE', payload: scale });
    
    // Center the panels
    const centerX = (containerRect.width - panelWidth * scale) / 2;
    const centerY = (containerRect.height - panelHeight * scale) / 2;
    dispatchCanvas({ type: 'SET_WORLD_OFFSET', payload: { x: centerX, y: centerY } });
  }, [panelBounds, dispatchCanvas]);

  const handleExitFullscreen = () => {
    dispatchFullscreen({ type: 'SET_FULLSCREEN', payload: false });
  };

  const handlePanelClick = (panel: Panel) => {
    // Update selected panel in fullscreen state
    dispatchFullscreen({ type: 'SET_SELECTED_PANEL', payload: panel });
    onPanelClick?.(panel);
  };

  if (!fullscreen.isFullscreen) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-gray-900 flex flex-col transition-all duration-300 ease-in-out"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        opacity: fullscreen.isFullscreen ? 1 : 0,
        transform: fullscreen.isFullscreen ? 'scale(1)' : 'scale(0.95)',
      }}
    >
      {/* Fullscreen Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 transition-all duration-200 ease-in-out">
        <div className="flex items-center space-x-4">
          <h2 className="text-white text-lg font-semibold">Panel Layout - Fullscreen</h2>
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 text-sm">
              {panelCount} panels
            </span>
            {panelCount > 100 && (
              <span className="text-yellow-400 text-xs bg-yellow-900 bg-opacity-50 px-2 py-1 rounded">
                Large Dataset
              </span>
            )}
            {panelCount > 500 && (
              <span className="text-red-400 text-xs bg-red-900 bg-opacity-50 px-2 py-1 rounded">
                Performance Mode
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Zoom controls */}
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 transition-all duration-150 ease-in-out hover:scale-105 group"
              title="Zoom Out (-)"
            >
              <ZoomOut className="h-4 w-4 group-hover:text-blue-300" />
            </Button>
            <span className="text-white text-sm px-2 min-w-[60px] text-center transition-all duration-200 ease-in-out font-mono">
              {zoomLevel}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 transition-all duration-150 ease-in-out hover:scale-105 group"
              title="Zoom In (+)"
            >
              <ZoomIn className="h-4 w-4 group-hover:text-blue-300" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetZoom}
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 transition-all duration-150 ease-in-out hover:scale-105 group"
              title="Reset Zoom (0)"
            >
              <RotateCcw className="h-4 w-4 group-hover:text-yellow-300" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFitToScreen}
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 transition-all duration-150 ease-in-out hover:scale-105 group"
              title="Fit to Screen (F)"
            >
              <Minimize2 className="h-4 w-4 group-hover:text-green-300" />
            </Button>
          </div>
          
          <div className="w-px h-6 bg-gray-600" />
          
          {/* Exit fullscreen */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExitFullscreen}
            className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            title="Exit Fullscreen (ESC)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative">
        <PanelCanvas
          panels={panels}
          onPanelClick={(panel) => {
            // Set selected panel for mini-sidebar (automatically shows mini-sidebar)
            dispatchFullscreen({ type: 'SET_SELECTED_PANEL', payload: panel });
            onPanelClick?.(panel);
          }}
          onPanelDoubleClick={onPanelDoubleClick}
          onPanelUpdate={onPanelUpdate}
          enableDebugLogging={enableDebugLogging}
        />
        
        {/* Enhanced Mini Sidebar */}
        {fullscreen.miniSidebarVisible && fullscreen.selectedPanel && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-xl p-4 max-w-sm border border-gray-200 transition-all duration-300 ease-in-out transform animate-in slide-in-from-right-5 fade-in-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-lg">
                Panel {fullscreen.selectedPanel.panelNumber || fullscreen.selectedPanel.id}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatchFullscreen({ type: 'SET_SELECTED_PANEL', payload: null })}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3 text-sm">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-gray-500 text-xs">Type</div>
                  <div className="font-medium">{fullscreen.selectedPanel.type}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-gray-500 text-xs">Shape</div>
                  <div className="font-medium">{fullscreen.selectedPanel.shape || 'rectangle'}</div>
                </div>
              </div>

              {/* Dimensions */}
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Dimensions</div>
                <div className="font-medium">
                  {fullscreen.selectedPanel.width} × {fullscreen.selectedPanel.height} px
                </div>
              </div>

              {/* Position */}
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500 text-xs mb-1">Position</div>
                <div className="font-medium">
                  X: {Math.round(fullscreen.selectedPanel.x)}, Y: {Math.round(fullscreen.selectedPanel.y)}
                </div>
              </div>

              {/* Roll Number */}
              {fullscreen.selectedPanel.rollNumber && (
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-gray-500 text-xs mb-1">Roll Number</div>
                  <div className="font-medium text-blue-600">
                    {fullscreen.selectedPanel.rollNumber}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 border-t border-gray-200">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs transition-all duration-150 ease-in-out hover:scale-105 hover:bg-blue-50 hover:border-blue-300"
                    onClick={() => {
                      // Center view on this panel
                      const centerX = fullscreen.selectedPanel!.x + fullscreen.selectedPanel!.width / 2;
                      const centerY = fullscreen.selectedPanel!.y + fullscreen.selectedPanel!.height / 2;
                      dispatchCanvas({ 
                        type: 'SET_WORLD_OFFSET', 
                        payload: { 
                          x: -centerX * canvas.worldScale + window.innerWidth / 2, 
                          y: -centerY * canvas.worldScale + window.innerHeight / 2 
                        } 
                      });
                    }}
                  >
                    Center View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs transition-all duration-150 ease-in-out hover:scale-105 hover:bg-green-50 hover:border-green-300"
                    onClick={() => {
                      // Zoom to fit this panel
                      const scale = Math.min(2, Math.min(window.innerWidth / fullscreen.selectedPanel!.width, window.innerHeight / fullscreen.selectedPanel!.height));
                      dispatchCanvas({ type: 'SET_WORLD_SCALE', payload: scale });
                    }}
                  >
                    Zoom to Fit
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded text-xs max-w-xs">
        <div className="font-semibold mb-2">Keyboard Shortcuts</div>
        <div className="space-y-1">
          <div><kbd className="bg-gray-700 px-1 rounded">ESC</kbd> Exit fullscreen</div>
          <div><kbd className="bg-gray-700 px-1 rounded">+</kbd> Zoom in</div>
          <div><kbd className="bg-gray-700 px-1 rounded">-</kbd> Zoom out</div>
          <div><kbd className="bg-gray-700 px-1 rounded">0</kbd> Reset zoom</div>
          <div><kbd className="bg-gray-700 px-1 rounded">F</kbd> Fit to screen</div>
        </div>
      </div>

      {/* Debug Info (Development Only) */}
      {enableDebugLogging && (
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-75 text-white p-2 rounded text-xs max-w-sm">
          <div>Fullscreen: {fullscreen.isFullscreen ? 'Yes' : 'No'}</div>
          <div>Mini Sidebar: {fullscreen.miniSidebarVisible ? 'Visible' : 'Hidden'}</div>
          <div>Selected Panel: {fullscreen.selectedPanel?.id || 'None'}</div>
          <div>Zoom: {zoomLevel}%</div>
        </div>
      )}
    </div>
  );
}

export default FullscreenLayout;
