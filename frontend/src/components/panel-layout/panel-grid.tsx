'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useZoomPan } from '@/hooks/use-zoom-pan';
import { Stage, Layer, Rect, Group, Transformer, RegularPolygon } from 'react-konva';
import { Line } from 'react-konva/lib/ReactKonvaCore';
import { Text } from 'react-konva/lib/ReactKonvaCore';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import type { Transformer as KonvaTransformer } from 'konva/lib/shapes/Transformer';
import type { Group as GroupType } from 'konva/lib/Group';
import type { Rect as RectType } from 'konva/lib/shapes/Rect';
import type { RegularPolygon as RegularPolygonType } from 'konva/lib/shapes/RegularPolygon';
import Konva from 'konva';
import type { Panel } from '../../types/panel';
import { useTooltip } from '@/components/ui/tooltip';
import { applyPanelSnapping } from '@/lib/resize-utils';

// === World/acre config ===
export const FEET_PER_ACRE = 43560;
// Toggle which interpretation you want
export const GRID_MODE: 'FIVE_BY_FIVE_ACRES' | 'TOTAL_FIVE_ACRES' = 'FIVE_BY_FIVE_ACRES';

const sideFeetFor5AcreSquare = Math.sqrt(5 * FEET_PER_ACRE); // ≈ 466.69 ft
export const WORLD_WIDTH_FT = GRID_MODE === 'FIVE_BY_FIVE_ACRES' ? 5 * sideFeetFor5AcreSquare : sideFeetFor5AcreSquare;
export const WORLD_HEIGHT_FT = GRID_MODE === 'FIVE_BY_FIVE_ACRES' ? 5 * sideFeetFor5AcreSquare : sideFeetFor5AcreSquare;

export const GRID_CELL_SIZE_FT = 5; // small cells for precise snap (tune as needed)
export const SNAP_THRESHOLD_FT = 1; // snap threshold in feet

interface TextProps {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align: string;
  verticalAlign: string;
  offsetX: number;
  offsetY: number;
}

// Optimized constants
const GRID_CELL_SIZE = 100;
const GRID_LINE_WIDTH = 1;
const GRID_LINE_COLOR = '#e5e7eb';
const MIN_GRID_VISIBILITY_SCALE = 0.2;
const MIN_PANEL_SIZE = 50;
const SNAP_THRESHOLD = 4;
const SPATIAL_INDEX_CELL_SIZE = 200; // Larger cells for better performance
const DRAG_THROTTLE_MS = 16; // ~60fps

interface PanelGridProps {
  panels: Panel[];
  width: number;
  height: number;
  onPanelUpdate: (panels: Panel[]) => void;
  selectedPanel?: any;
  onEditPanel?: (panel: any) => void;
  onScaleChange?: (scale: number) => void;
  onPositionChange?: (position: { x: number; y: number }) => void;
}

// Spatial index for efficient panel proximity queries
class SpatialIndex {
  private cells: Map<string, Set<string>> = new Map();
  private cellSize: number;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  private getCellsForBounds(x: number, y: number, width: number, height: number): string[] {
    const startX = Math.floor(x / this.cellSize);
    const endX = Math.floor((x + width) / this.cellSize);
    const startY = Math.floor(y / this.cellSize);
    const endY = Math.floor((y + height) / this.cellSize);
    
    const cells: string[] = [];
    for (let cx = startX; cx <= endX; cx++) {
      for (let cy = startY; cy <= endY; cy++) {
        cells.push(`${cx},${cy}`);
      }
    }
    return cells;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(panelId: string, x: number, y: number, width: number, height: number): void {
    const cellKeys = this.getCellsForBounds(x, y, width, height);
    cellKeys.forEach(key => {
      if (!this.cells.has(key)) {
        this.cells.set(key, new Set());
      }
      this.cells.get(key)!.add(panelId);
    });
  }

  query(x: number, y: number, width: number, height: number): Set<string> {
    const cellKeys = this.getCellsForBounds(x, y, width, height);
    const result = new Set<string>();
    cellKeys.forEach(key => {
      const cell = this.cells.get(key);
      if (cell) {
        cell.forEach(panelId => result.add(panelId));
      }
    });
    return result;
  }
}

export default function PanelGrid({ 
  panels, 
  width, 
  height, 
  onPanelUpdate,
  selectedPanel,
  onEditPanel,
  onScaleChange,
  onPositionChange
}: PanelGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snappedPairs, setSnappedPairs] = useState<Set<string>>(new Set());
  const [preSnapPairs, setPreSnapPairs] = useState<Set<string>>(new Set());
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spatialIndexRef = useRef<SpatialIndex>(new SpatialIndex(SPATIAL_INDEX_CELL_SIZE));
  const lastDragTimeRef = useRef<number>(0);
  const { toast } = useToast();
  
  // Use the optimized zoom/pan hook
  const {
    scale: hookScale,
    position: hookPosition,
    viewport,
    setScale: hookSetScale,
    setPosition: hookSetPosition,
    zoomIn: hookZoomIn,
    zoomOut: hookZoomOut,
    fitToContent: hookFitToContent,
    handleWheel: hookHandleWheel,
    onMouseMove: hookOnMouseMove,
    reset: hookReset,
    isInViewport,
  } = useZoomPan();

  // Remove hover state and add tooltip
  const { showTooltip, hideTooltip, TooltipComponent } = useTooltip();

  // Update spatial index when panels change
  useEffect(() => {
    const index = spatialIndexRef.current;
    index.clear();
    panels.forEach(panel => {
      index.insert(panel.id, panel.x, panel.y, panel.width, panel.length);
    });
  }, [panels]);

  // Optimized grid lines with viewport culling
  const gridLines = useMemo(() => {
    if (hookScale < MIN_GRID_VISIBILITY_SCALE) return [];

    const startX = Math.floor(viewport.x / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    const endX = Math.ceil((viewport.x + viewport.width) / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    const startY = Math.floor(viewport.y / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    const endY = Math.ceil((viewport.y + viewport.height) / GRID_CELL_SIZE) * GRID_CELL_SIZE;

    const lines: Array<{key: string, x: number, y: number, width: number, height: number}> = [];

    // Vertical lines
    for (let x = startX; x <= endX; x += GRID_CELL_SIZE) {
      lines.push({
        key: `grid-v-${x}`,
        x: x,
        y: startY,
        width: GRID_LINE_WIDTH,
        height: endY - startY,
      });
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += GRID_CELL_SIZE) {
      lines.push({
        key: `grid-h-${y}`,
        x: startX,
        y: y,
        width: endX - startX,
        height: GRID_LINE_WIDTH,
      });
    }

    return lines;
  }, [viewport, hookScale]);

  // Optimized snap to grid
  const snapToGrid = useCallback((value: number) => {
    return Math.round(value / GRID_CELL_SIZE) * GRID_CELL_SIZE;
  }, []);

  // Optimized panel proximity check using spatial index
  const findNearbyPanels = useCallback((x: number, y: number, width: number, height: number, excludeId?: string) => {
    const nearbyIds = spatialIndexRef.current.query(x - SNAP_THRESHOLD, y - SNAP_THRESHOLD, width + SNAP_THRESHOLD * 2, height + SNAP_THRESHOLD * 2);
    return panels.filter(p => p.id !== excludeId && nearbyIds.has(p.id));
  }, [panels]);

  // Remove grid snapping and state updates from drag move
  const handlePanelDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    // Let Konva handle the drag visually; do not snap or update state here
    // Optionally, you can add visual feedback or constraints, but do not set position or call onPanelUpdate
  }, []);

  // Only update state on drag end
  const handlePanelDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    const id = e.target.id();
    const node = e.target;
    const x = node.x();
    const y = node.y();
    // Find the panel being dragged
    const draggedPanel = panels.find(panel => panel.id === id);
    if (!draggedPanel) return;
    // Find other panels for snapping
    const otherPanels = panels.filter(panel => panel.id !== id).map(panel => ({
      id: panel.id,
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.length
    }));
    // Use shape-specific snapping
    let snapResult;
    if (draggedPanel.shape === 'right-triangle') {
      snapResult = applyPanelSnapping(x, y, draggedPanel.width, draggedPanel.length, otherPanels, SNAP_THRESHOLD, 'right-triangle');
    } else {
      snapResult = applyPanelSnapping(x, y, draggedPanel.width, draggedPanel.length, otherPanels, SNAP_THRESHOLD, 'rectangle');
    }
    // Update panel position in state
    const newPanels = panels.map(panel =>
      panel.id === id ? { ...panel, x: snapResult.x, y: snapResult.y } : panel
    );
    onPanelUpdate(newPanels);
  }, [panels, onPanelUpdate]);

  // Optimized panel transform end handler
  const handlePanelTransformEnd = useCallback((e: KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    const updatedPanels = panels.map(panel => {
      if (panel.id === node.id()) {
        if (panel.shape === 'triangle') {
          const oldRadius = (node as Konva.RegularPolygon).radius() ?? (panel.width / 2);
          const newRadiusX = oldRadius * scaleX;
          const newRadiusY = oldRadius * scaleY;
          
          node.scaleX(1);
          node.scaleY(1);
          
          const snappedX = snapToGrid(node.x());
          const snappedY = snapToGrid(node.y());
          
          return {
            ...panel,
            x: snappedX - newRadiusX,
            y: snappedY - newRadiusY,
            width: newRadiusX * 2,
            length: newRadiusY * 2,
            rotation: node.rotation()
          };
        } else if (panel.shape === 'right-triangle') {
          // Handle right triangle transform - Line nodes don't have standard width/height
          // Use the scale factors to calculate new dimensions
          const newWidth = panel.width * scaleX;
          const newLength = panel.length * scaleY;
          
          // Reset the node's scale
          node.scaleX(1);
          node.scaleY(1);
          
          // Get the new position from the node
          const snappedX = snapToGrid(node.x());
          const snappedY = snapToGrid(node.y());
          const snappedWidth = snapToGrid(newWidth);
          const snappedLength = snapToGrid(newLength);
          
          return {
            ...panel,
            x: snappedX,
            y: snappedY,
            width: snappedWidth,
            length: snappedLength,
            rotation: node.rotation()
          };
        }
        
        const newWidth = node.width() * scaleX;
        const newLength = node.height() * scaleY;
        
        node.scaleX(1);
        node.scaleY(1);
        
        const snappedX = snapToGrid(node.x());
        const snappedY = snapToGrid(node.y());
        const snappedWidth = snapToGrid(newWidth);
        const snappedLength = snapToGrid(newLength);
        
        return {
          ...panel,
          x: snappedX,
          y: snappedY,
          width: snappedWidth,
          length: snappedLength,
          rotation: node.rotation()
        };
      }
      return panel;
    });
    
    onPanelUpdate(updatedPanels);
  }, [panels, onPanelUpdate, snapToGrid]);

  // Optimized panel click handler
  const handlePanelClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const id = e.target.id();
    setSelectedId(id);
  }, []);

  // Optimized stage click handler
  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  }, []);

  // Handle mouse events for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !selectedId) {
      e.preventDefault();
      const stage = stageRef.current;
      if (stage) {
        stage.draggable(true);
      }
    }
  }, [selectedId]);

  const handleMouseUp = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.draggable(false);
    }
  }, []);

  // Update transformer when selection changes
  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const node = stageRef.current?.findOne(`#${selectedId}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId]);

  // Helper function to check if two panels are snapped together
  const arePanelsSnapped = useCallback((id1: string, id2: string) => {
    const pairKey1 = `${id1}-${id2}`;
    const pairKey2 = `${id2}-${id1}`;
    return snappedPairs.has(pairKey1) || snappedPairs.has(pairKey2);
  }, [snappedPairs]);

  // Memoized panel rendering with viewport culling
  const visiblePanels = useMemo(() => {
    return panels.filter(panel => 
      isInViewport({
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.length
      })
    );
  }, [panels, isInViewport]);

  const renderPanel = useCallback((panel: Panel) => {
    const isSelected = selectedId === panel.id;
    const isSnapped = panels.some(otherPanel => 
      otherPanel.id !== panel.id && arePanelsSnapped(panel.id, otherPanel.id)
    );
    const isPreSnap = panels.some(otherPanel => {
      if (otherPanel.id === panel.id) return false;
      const pairKey1 = `${panel.id}-${otherPanel.id}`;
      const pairKey2 = `${otherPanel.id}-${panel.id}`;
      return preSnapPairs.has(pairKey1) || preSnapPairs.has(pairKey2);
    });

    const centerX = panel.x + panel.width / 2;
    const centerY = panel.y + panel.length / 2;
    const roll = panel.rollNumber || '';
    const panelNum = panel.panelNumber || '';
    
    // Only show panel number on the panel
    const label = panelNum;
    
    let strokeColor = "#000000";
    let strokeWidth = 4;
    
    if (isSnapped) {
      strokeColor = "#00ff00";
      strokeWidth = 5;
    } else if (isPreSnap) {
      strokeColor = "#ffff00";
      strokeWidth = 5;
    }
    
    // Handle mouse enter for tooltip
    const handleMouseEnter = (e: KonvaEventObject<MouseEvent>) => {
      const tooltipContent = `Panel: ${panelNum}\nRoll: ${roll}`;
      showTooltip(tooltipContent, e.evt.clientX, e.evt.clientY);
    };

    // Handle mouse leave for tooltip
    const handleMouseLeave = () => {
      hideTooltip();
    };
    
    if (panel.shape === 'triangle') {
      const radiusX = panel.width / 2;
      const radiusY = panel.length / 2;
      const baseRadius = Math.min(radiusX, radiusY);
      const fontSize = baseRadius * 1.2;
      
      return (
        <Group key={panel.id}>
          {/* Debug bounding box */}
          <Rect
            x={panel.x}
            y={panel.y}
            width={panel.width}
            height={panel.length}
            stroke="#ff0000"
            strokeWidth={2}
            dash={[8, 4]}
            fill="transparent"
            listening={false}
          />
          {isSelected && (
            <RegularPolygon
              x={centerX}
              y={centerY}
              sides={3}
              radius={baseRadius}
              scaleX={radiusX / baseRadius}
              scaleY={radiusY / baseRadius}
              rotation={panel.rotation}
              fill="transparent"
              stroke="#000000"
              strokeWidth={2}
              listening={false}
            />
          )}
          {(isSnapped || isPreSnap) && (
            <RegularPolygon
              x={centerX}
              y={centerY}
              sides={3}
              radius={baseRadius}
              scaleX={radiusX / baseRadius}
              scaleY={radiusY / baseRadius}
              rotation={panel.rotation}
              fill="transparent"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              listening={false}
            />
          )}
          <RegularPolygon
            id={panel.id}
            x={centerX}
            y={centerY}
            sides={3}
            radius={baseRadius}
            scaleX={radiusX / baseRadius}
            scaleY={radiusY / baseRadius}
            rotation={panel.rotation}
            fill={panel.fill}
            stroke="#000000"
            strokeWidth={1}
            draggable={true}
            onClick={(e: KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              setSelectedId(panel.id);
              if (onEditPanel) {
                onEditPanel(panel);
              }
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onDragMove={handlePanelDragMove}
            onDragEnd={handlePanelDragEnd}
            onTransformEnd={handlePanelTransformEnd}
          />
          <Text
            text={label}
            x={centerX - baseRadius}
            y={centerY - fontSize}
            width={baseRadius * 2}
            height={fontSize * 2}
            fontSize={fontSize}
            fontFamily="Arial"
            fontStyle="bold"
            fill="#000000"
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      );
    } else if (panel.shape === 'right-triangle') {
      // Draw right triangle (90-degree at bottom-left)
      // Use x, y, width, length directly (no scaling)
      const points = [
        panel.x, panel.y, // Top-left
        panel.x + panel.width, panel.y, // Top-right
        panel.x, panel.y + panel.length // Bottom-left (right angle)
      ];
      const fontSize = Math.max(12, Math.min(panel.width, panel.length) * 0.4);
      return (
        <Group key={panel.id}>
          {/* Debug bounding box */}
          <Rect
            x={panel.x}
            y={panel.y}
            width={panel.width}
            height={panel.length}
            stroke="#ff0000"
            strokeWidth={2}
            dash={[8, 4]}
            fill="transparent"
            listening={false}
          />
          {isSelected && (
            <Line
              points={points}
              fill="transparent"
              stroke="#000000"
              strokeWidth={2}
              closed={true}
              listening={false}
            />
          )}
          {(isSnapped || isPreSnap) && (
            <Line
              points={points}
              fill="transparent"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              closed={true}
              listening={false}
            />
          )}
          <Line
            id={panel.id}
            points={points}
            fill={panel.fill}
            stroke="#000000"
            strokeWidth={1}
            closed={true}
            draggable={true}
            onClick={(e: KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              setSelectedId(panel.id);
              if (onEditPanel) onEditPanel(panel);
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onDragMove={handlePanelDragMove}
            onDragEnd={handlePanelDragEnd}
            onTransformEnd={handlePanelTransformEnd}
          />
          <Text
            text={label}
            // Centroid for right triangle (x + width/3, y + length/3)
            // Center the label bounding box on the centroid, and keep it within the triangle
            x={panel.x + panel.width / 3 - Math.min(panel.width, panel.length) / 4}
            y={panel.y + panel.length / 3 - Math.min(panel.width, panel.length) / 4}
            width={Math.min(panel.width, panel.length) / 2}
            height={Math.min(panel.width, panel.length) / 2}
            fontSize={fontSize}
            fontFamily="Arial"
            fontStyle="bold"
            fill="#000000"
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      );
    }

    const fontSize = panel.width * 0.6;
    return (
      <Group key={panel.id}>
        {/* Debug bounding box */}
        <Rect
          x={panel.x}
          y={panel.y}
          width={panel.width}
          height={panel.length}
          stroke="#ff0000"
          strokeWidth={2}
          dash={[8, 4]}
          fill="transparent"
          listening={false}
        />
        {isSelected && (
          <Rect
            x={panel.x}
            y={panel.y}
            width={panel.width}
            height={panel.length}
            rotation={panel.rotation}
            fill="transparent"
            stroke="#000000"
            strokeWidth={2}
            listening={false}
          />
        )}
        {(isSnapped || isPreSnap) && (
          <Rect
            x={panel.x}
            y={panel.y}
            width={panel.width}
            height={panel.length}
            rotation={panel.rotation}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            listening={false}
          />
        )}
        <Rect
          id={panel.id}
          x={panel.x}
          y={panel.y}
          width={panel.width}
          height={panel.length}
          rotation={panel.rotation}
          fill={panel.fill}
          stroke="#000000"
          strokeWidth={1}
          draggable={true}
          onClick={(e: KonvaEventObject<MouseEvent>) => {
            e.cancelBubble = true;
            setSelectedId(panel.id);
            if (onEditPanel) {
              onEditPanel(panel);
            }
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onDragMove={handlePanelDragMove}
          onDragEnd={handlePanelDragEnd}
          onTransformEnd={handlePanelTransformEnd}
        />
        <Text
          text={label}
          x={panel.x}
          y={panel.y + panel.length / 2 - fontSize}
          width={panel.width}
          height={fontSize * 2}
          fontSize={fontSize}
          fontFamily="Arial"
          fontStyle="bold"
          fill="#000000"
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      </Group>
    );
  }, [selectedId, handlePanelDragEnd, handlePanelTransformEnd, handlePanelDragMove, onEditPanel, panels, arePanelsSnapped, preSnapPairs, showTooltip, hideTooltip]);

  return (
    <>
      <div 
        ref={containerRef}
        className="w-full h-full overflow-hidden"
        onWheel={e => hookHandleWheel(e.nativeEvent)}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={hookOnMouseMove}
        style={{
          cursor: selectedId ? 'default' : 'grab'
        }}
      >
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          scaleX={hookScale}
          scaleY={hookScale}
          x={hookPosition.x}
          y={hookPosition.y}
          draggable={false}
          onClick={handleStageClick}
          className="bg-white"
          style={{
            touchAction: 'none'
          }}
        >
          <Layer>
            {/* Optimized grid lines */}
            {gridLines.map(line => (
              <Rect
                key={line.key}
                x={line.x}
                y={line.y}
                width={line.width}
                height={line.height}
                fill="transparent"
                stroke="#e5e7eb"
                strokeWidth={1}
                listening={false}
              />
            ))}
            
            {/* Only render visible panels */}
            {visiblePanels.map(renderPanel)}
            
            {/* Transformer */}
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox: { width: number; height: number }, newBox: { width: number; height: number }) => {
                const minSize = 50;
                if (newBox.width < minSize || newBox.height < minSize) {
                  return oldBox;
                }
                return newBox;
              }}
              enabledAnchors={[
                'top-left',
                'top-center',
                'top-right',
                'middle-right',
                'bottom-right',
                'bottom-center',
                'bottom-left',
                'middle-left'
              ]}
              keepRatio={false}
              rotateEnabled={true}
              borderStroke="#3b82f6"
              borderStrokeWidth={2}
              anchorStroke="#3b82f6"
              anchorFill="#ffffff"
              anchorSize={8}
              anchorCornerRadius={4}
            />
          </Layer>
        </Stage>
      </div>
      
      {/* Tooltip component */}
      <TooltipComponent />
    </>
  );
}
