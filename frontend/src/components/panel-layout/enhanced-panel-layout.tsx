import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Group } from 'react-konva';
import { Text } from 'react-konva/lib/ReactKonvaCore';
import { Line } from 'react-konva/lib/ReactKonvaCore';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Panel } from '../../types/panel';
import { useZoomPan } from '../../hooks/use-zoom-pan';
import { useFlexibleResize } from '../../hooks/use-flexible-resize';
import { ResizeConstraints, createCustomResizeHandles } from '../../lib/resize-utils';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { assignRollNumbersWestToEast } from '../../lib/panel-label-utils';

interface EnhancedPanelLayoutProps {
  mode?: 'view' | 'edit';
  projectInfo?: any;
}

interface ResizeSettings {
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
  lockAspectRatio: boolean;
  aspectRatio: number;
  snapToGrid: boolean;
  gridSize: number;
  snapToOtherPanels: boolean;
  snapThreshold: number;
  enableVisualFeedback: boolean;
  enableSnapping: boolean;
}

export default function EnhancedPanelLayout({ mode = 'edit', projectInfo }: EnhancedPanelLayoutProps) {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [resizeSettings, setResizeSettings] = useState<ResizeSettings>({
    minWidth: 50,
    minHeight: 50,
    maxWidth: 1000,
    maxHeight: 1000,
    lockAspectRatio: false,
    aspectRatio: 2.5, // Standard panel ratio
    snapToGrid: true,
    gridSize: 100,
    snapToOtherPanels: true,
    snapThreshold: 4,
    enableVisualFeedback: true,
    enableSnapping: true
  });

  const [panelsWithRollNumbers, setPanelsWithRollNumbers] = useState<Panel[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  // Use zoom/pan hook
  const {
    scale,
    position,
    viewport,
    setScale,
    setPosition,
    zoomIn,
    zoomOut,
    fitToContent,
    handleWheel,
    onMouseMove,
    reset,
    isInViewport,
  } = useZoomPan();

  // Use flexible resize hook
  const {
    isResizing,
    resizeResult,
    visualFeedback,
    startResize,
    updateResize,
    endResize,
    cancelResize,
    getResizeCursor,
    getResizeHandles
  } = useFlexibleResize({
    panels,
    onPanelUpdate: setPanels,
    constraints: {
      minWidth: resizeSettings.minWidth,
      minHeight: resizeSettings.minHeight,
      maxWidth: resizeSettings.maxWidth,
      maxHeight: resizeSettings.maxHeight,
      lockAspectRatio: resizeSettings.lockAspectRatio,
      aspectRatio: resizeSettings.aspectRatio,
      snapToGrid: resizeSettings.snapToGrid,
      gridSize: resizeSettings.gridSize,
      snapToOtherPanels: resizeSettings.snapToOtherPanels,
      snapThreshold: resizeSettings.snapThreshold
    },
    containerBounds: dimensions,
    enableVisualFeedback: resizeSettings.enableVisualFeedback,
    enableSnapping: resizeSettings.enableSnapping
  });

  // Automatically assign roll numbers west to east on every panel update
  useEffect(() => {
    setPanelsWithRollNumbers(assignRollNumbersWestToEast(panels));
  }, [panels]);

  // Update container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Add new panel
  const addPanel = useCallback(() => {
    const centerX = (dimensions.width / 2 - position.x) / scale;
    const centerY = (dimensions.height / 2 - position.y) / scale;
    
    const newPanel: Panel = {
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10),
      panelNumber: `P${panels.length + 1}`,
      length: 200,
      width: 80,
      rollNumber: `R-${100 + panels.length + 1}`,
      location: 'Auto-generated',
      x: centerX - 40,
      y: centerY - 100,
      shape: 'rectangle',
      rotation: 0,
      fill: '#E3F2FD',
      color: '#E3F2FD'
    };
    
    setPanels(prev => [...prev, newPanel]);
    setSelectedPanelId(newPanel.id);
  }, [panels.length, dimensions, position, scale]);

  // Delete selected panel
  const deleteSelectedPanel = useCallback(() => {
    if (selectedPanelId) {
      setPanels(prev => prev.filter(p => p.id !== selectedPanelId));
      setSelectedPanelId(null);
    }
  }, [selectedPanelId]);

  // Handle panel selection
  const handlePanelSelect = useCallback((panelId: string) => {
    setSelectedPanelId(panelId);
  }, []);

  // Handle panel drag end
  const handlePanelDragEnd = useCallback((panelId: string, x: number, y: number) => {
    setPanels(prev => prev.map(panel => 
      panel.id === panelId ? { ...panel, x, y } : panel
    ));
  }, []);

  // Handle panel update
  const handlePanelUpdate = useCallback((updatedPanel: Panel) => {
    setPanels(prev => prev.map(panel => 
      panel.id === updatedPanel.id ? updatedPanel : panel
    ));
  }, []);

  // Handle resize start
  const handleResizeStart = useCallback((handleId: string, panelId: string, mouseX: number, mouseY: number) => {
    startResize(handleId, panelId, mouseX, mouseY);
  }, [startResize]);

  // Handle resize update
  const handleResizeUpdate = useCallback((mouseX: number, mouseY: number) => {
    updateResize(mouseX, mouseY);
  }, [updateResize]);

  // Handle resize end
  const handleResizeEnd = useCallback(() => {
    endResize();
  }, [endResize]);

  // Generate grid lines
  const generateGridLines = useCallback(() => {
    if (!resizeSettings.snapToGrid) return [];
    
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const gridSize = resizeSettings.gridSize;
    
    // Calculate visible grid range
    const startX = Math.floor((position.x / scale) / gridSize) * gridSize;
    const endX = Math.ceil(((position.x + dimensions.width) / scale) / gridSize) * gridSize;
    const startY = Math.floor((position.y / scale) / gridSize) * gridSize;
    const endY = Math.ceil(((position.y + dimensions.height) / scale) / gridSize) * gridSize;
    
    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      lines.push({ x1: x, y1: startY, x2: x, y2: endY });
    }
    
    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      lines.push({ x1: startX, y1: y, x2: endX, y2: y });
    }
    
    return lines;
  }, [resizeSettings.snapToGrid, resizeSettings.gridSize, position, scale, dimensions]);

  // Render resize handles for a panel
  const renderResizeHandles = useCallback((panel: Panel) => {
    if (!selectedPanelId || selectedPanelId !== panel.id || isResizing) return null;

    const handles = getResizeHandles();
    
    return handles.map(handle => {
      let x = panel.x;
      let y = panel.y;
      
      // Calculate handle position
      switch (handle.position) {
        case 'top-left':
          x = panel.x - 4;
          y = panel.y - 4;
          break;
        case 'top-center':
          x = panel.x + panel.width / 2 - 4;
          y = panel.y - 4;
          break;
        case 'top-right':
          x = panel.x + panel.width - 4;
          y = panel.y - 4;
          break;
        case 'middle-left':
          x = panel.x - 4;
          y = panel.y + panel.length / 2 - 4;
          break;
        case 'middle-right':
          x = panel.x + panel.width - 4;
          y = panel.y + panel.length / 2 - 4;
          break;
        case 'bottom-left':
          x = panel.x - 4;
          y = panel.y + panel.length - 4;
          break;
        case 'bottom-center':
          x = panel.x + panel.width / 2 - 4;
          y = panel.y + panel.length - 4;
          break;
        case 'bottom-right':
          x = panel.x + panel.width - 4;
          y = panel.y + panel.length - 4;
          break;
      }

      return (
        <Rect
          key={handle.id}
          x={x}
          y={y}
          width={8}
          height={8}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={1}
          cornerRadius={2}
          listening={true}
          onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
            e.cancelBubble = true;
            const stage = stageRef.current;
            if (stage) {
              const pointerPos = stage.getPointerPosition();
              if (pointerPos) {
                handleResizeStart(handle.id, panel.id, pointerPos.x, pointerPos.y);
              }
            }
          }}
        />
      );
    });
  }, [selectedPanelId, isResizing, getResizeHandles, handleResizeStart]);

  // Render snap lines
  const renderSnapLines = useCallback(() => {
    if (!visualFeedback.showSnapLines) return null;

    return visualFeedback.snapLines.map((line, index) => (
      <Line
        key={index}
        points={[line.x1, line.y1, line.x2, line.y2]}
        stroke={line.color}
        strokeWidth={2}
        dash={[5, 5]}
        listening={false}
      />
    ));
  }, [visualFeedback]);

  // Render constraint indicator
  const renderConstraintIndicator = useCallback(() => {
    if (!visualFeedback.showConstraintIndicator) return null;

    return (
      <Text
        x={10}
        y={10}
        text={visualFeedback.constraintMessage}
        fontSize={14}
        fill="#ff6b6b"
        listening={false}
      />
    );
  }, [visualFeedback]);

  const gridLines = generateGridLines();

  return (
    <div className="flex h-full">
      {/* Control Panel */}
      <div className="w-80 p-4 border-r bg-gray-50 overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle>Resize Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Controls */}
            <div className="space-y-2">
              <Button onClick={addPanel} className="w-full">Add Panel</Button>
              <Button 
                onClick={deleteSelectedPanel} 
                variant="destructive" 
                disabled={!selectedPanelId}
                className="w-full"
              >
                Delete Selected
              </Button>
            </div>

            {/* Size Constraints */}
            <div className="space-y-2">
              <Label>Minimum Width</Label>
              <Input
                type="number"
                value={resizeSettings.minWidth}
                onChange={(e) => setResizeSettings(prev => ({ 
                  ...prev, 
                  minWidth: parseInt(e.target.value) || 50 
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Minimum Height</Label>
              <Input
                type="number"
                value={resizeSettings.minHeight}
                onChange={(e) => setResizeSettings(prev => ({ 
                  ...prev, 
                  minHeight: parseInt(e.target.value) || 50 
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Maximum Width</Label>
              <Input
                type="number"
                value={resizeSettings.maxWidth || ''}
                onChange={(e) => setResizeSettings(prev => ({ 
                  ...prev, 
                  maxWidth: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
                placeholder="No limit"
              />
            </div>

            <div className="space-y-2">
              <Label>Maximum Height</Label>
              <Input
                type="number"
                value={resizeSettings.maxHeight || ''}
                onChange={(e) => setResizeSettings(prev => ({ 
                  ...prev, 
                  maxHeight: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
                placeholder="No limit"
              />
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={resizeSettings.lockAspectRatio}
                  onCheckedChange={(checked) => setResizeSettings(prev => ({ 
                    ...prev, 
                    lockAspectRatio: checked 
                  }))}
                />
                <Label>Lock Aspect Ratio</Label>
              </div>
              {resizeSettings.lockAspectRatio && (
                <div className="space-y-2">
                  <Label>Aspect Ratio (W/H)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={resizeSettings.aspectRatio}
                    onChange={(e) => setResizeSettings(prev => ({ 
                      ...prev, 
                      aspectRatio: parseFloat(e.target.value) || 1 
                    }))}
                  />
                </div>
              )}
            </div>

            {/* Grid Settings */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={resizeSettings.snapToGrid}
                  onCheckedChange={(checked) => setResizeSettings(prev => ({ 
                    ...prev, 
                    snapToGrid: checked 
                  }))}
                />
                <Label>Snap to Grid</Label>
              </div>
              {resizeSettings.snapToGrid && (
                <div className="space-y-2">
                  <Label>Grid Size</Label>
                  <Input
                    type="number"
                    value={resizeSettings.gridSize}
                    onChange={(e) => setResizeSettings(prev => ({ 
                      ...prev, 
                      gridSize: parseInt(e.target.value) || 100 
                    }))}
                  />
                </div>
              )}
            </div>

            {/* Panel Snapping */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={resizeSettings.snapToOtherPanels}
                  onCheckedChange={(checked) => setResizeSettings(prev => ({ 
                    ...prev, 
                    snapToOtherPanels: checked 
                  }))}
                />
                <Label>Snap to Other Panels</Label>
              </div>
              {resizeSettings.snapToOtherPanels && (
                <div className="space-y-2">
                  <Label>Snap Threshold</Label>
                  <Input
                    type="number"
                    value={resizeSettings.snapThreshold}
                    onChange={(e) => setResizeSettings(prev => ({ 
                      ...prev, 
                      snapThreshold: parseInt(e.target.value) || 4 
                    }))}
                  />
                </div>
              )}
            </div>

            {/* Visual Feedback */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={resizeSettings.enableVisualFeedback}
                  onCheckedChange={(checked) => setResizeSettings(prev => ({ 
                    ...prev, 
                    enableVisualFeedback: checked 
                  }))}
                />
                <Label>Visual Feedback</Label>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="space-y-2">
              <Label>Zoom: {(scale * 100).toFixed(0)}%</Label>
              <div className="flex space-x-2">
                <Button onClick={zoomIn} size="sm">+</Button>
                <Button onClick={zoomOut} size="sm">-</Button>
                <Button onClick={fitToContent} size="sm">Fit</Button>
                <Button onClick={reset} size="sm">Reset</Button>
              </div>
            </div>

            {/* Info */}
            <div className="text-sm text-gray-600">
              <p>Selected: {selectedPanelId || 'None'}</p>
              <p>Panels: {panels.length}</p>
              <p>Resizing: {isResizing ? 'Yes' : 'No'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <div 
          ref={containerRef}
          className="w-full h-full overflow-hidden"
          onWheel={(e) => handleWheel(e.nativeEvent)}
          onMouseMove={onMouseMove}
        >
          <Stage
            ref={stageRef}
            width={dimensions.width}
            height={dimensions.height}
            scaleX={scale}
            scaleY={scale}
            x={position.x}
            y={position.y}
            draggable={!selectedPanelId}
            onMouseMove={(e) => {
              if (isResizing) {
                const pointerPos = e.target.getStage()?.getPointerPosition();
                if (pointerPos) {
                  handleResizeUpdate(pointerPos.x, pointerPos.y);
                }
              }
            }}
            onMouseUp={() => {
              if (isResizing) {
                handleResizeEnd();
              }
            }}
            onClick={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedPanelId(null);
              }
            }}
            style={{ cursor: selectedPanelId ? 'default' : 'grab' }}
          >
            <Layer>
              {/* Grid Lines */}
              {gridLines.map((line, index) => (
                <Line
                  key={index}
                  points={[line.x1, line.y1, line.x2, line.y2]}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                  listening={false}
                />
              ))}

              {/* Snap Lines */}
              {renderSnapLines()}

              {/* Constraint Indicator */}
              {renderConstraintIndicator()}

              {/* Panels */}
              {panelsWithRollNumbers.map(panel => {
                const isSelected = panel.id === selectedPanelId;
                const currentPanel = resizeResult && resizeResult.snappedToPanel === panel.id ? {
                  ...panel,
                  x: resizeResult.x,
                  y: resizeResult.y,
                  width: resizeResult.width,
                  length: resizeResult.height
                } : panel;

                return (
                  <Group key={panel.id}>
                    {/* Selection border */}
                    {isSelected && (
                      <Rect
                        x={currentPanel.x - 2}
                        y={currentPanel.y - 2}
                        width={currentPanel.width + 4}
                        height={currentPanel.length + 4}
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dash={[5, 5]}
                        listening={false}
                      />
                    )}

                    {/* Panel */}
                    <Rect
                      x={currentPanel.x}
                      y={currentPanel.y}
                      width={currentPanel.width}
                      height={currentPanel.length}
                      fill={currentPanel.fill}
                      stroke={isSelected ? "#3b82f6" : "#666"}
                      strokeWidth={isSelected ? 2 : 1}
                      rotation={currentPanel.rotation}
                      draggable={!isResizing}
                      onClick={() => handlePanelSelect(panel.id)}
                      onDragEnd={(e) => handlePanelDragEnd(panel.id, e.target.x(), e.target.y())}
                    />

                    {/* Panel label */}
                    <Text
                      x={currentPanel.x}
                      y={currentPanel.y + currentPanel.length / 2 - 10}
                      width={currentPanel.width}
                      height={20}
                      text={`${panel.rollNumber}\n${panel.panelNumber}`}
                      fontSize={12}
                      fontFamily="Arial"
                      fontStyle="bold"
                      fill="#000000"
                      align="center"
                      verticalAlign="middle"
                      listening={false}
                    />

                    {/* Resize handles */}
                    {renderResizeHandles(panel)}
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
} 