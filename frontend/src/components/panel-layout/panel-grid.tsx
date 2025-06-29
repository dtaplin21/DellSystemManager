'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Stage, Layer, Rect, Group, Transformer, RegularPolygon } from 'react-konva';
import { Text } from 'react-konva/lib/ReactKonvaCore';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import type { Transformer as KonvaTransformer } from 'konva/lib/shapes/Transformer';
import type { Group as GroupType } from 'konva/lib/Group';
import type { Rect as RectType } from 'konva/lib/shapes/Rect';
import type { RegularPolygon as RegularPolygonType } from 'konva/lib/shapes/RegularPolygon';
import Konva from 'konva';

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

// Constants for grid optimization
const GRID_CELL_SIZE = 100; // Size of each grid cell in pixels
const GRID_LINE_WIDTH = 1;
const GRID_LINE_COLOR = '#e5e7eb';
const MIN_GRID_VISIBILITY_SCALE = 0.2; // Hide grid when zoomed out too far
const MIN_PANEL_SIZE = 50; // Minimum panel size
const SNAP_THRESHOLD = 4; // px - even more user-friendly for easier snapping

interface Panel {
  id: string;
  type: 'rectangle' | 'triangle';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string; 
  stroke: string;
  strokeWidth: number;
  rollNumber?: string;
  panelNumber?: string;
  roll_number?: string;
  panel_number?: string;
}

interface PanelGridProps {
  panels: Panel[];
  width: number;
  height: number;
  scale: number;
  onPanelUpdate: (panels: Panel[]) => void;
  selectedPanel?: any;
  onEditPanel?: (panel: any) => void;
}

export default function PanelGrid({ 
  panels, 
  width, 
  height, 
  scale, 
  onPanelUpdate,
  selectedPanel,
  onEditPanel
}: PanelGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snappedPairs, setSnappedPairs] = useState<Set<string>>(new Set());
  const [preSnapPairs, setPreSnapPairs] = useState<Set<string>>(new Set());
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const { toast } = useToast();
  
  // Log scale changes for debugging
  useEffect(() => {
    console.log('PanelGrid scale changed:', scale);
  }, [scale]);
  
  // Memoize grid lines calculation
  const gridLines = useMemo(() => {
    if (scale < MIN_GRID_VISIBILITY_SCALE) return [];

    const verticalLines = Array.from({ length: Math.ceil(width / GRID_CELL_SIZE) }).map((_, i) => ({
      key: `grid-v-${i}`,
      x: i * GRID_CELL_SIZE,
      y: 0,
      width: GRID_LINE_WIDTH,
      height: height,
    }));

    const horizontalLines = Array.from({ length: Math.ceil(height / GRID_CELL_SIZE) }).map((_, i) => ({
      key: `grid-h-${i}`,
      x: 0,
      y: i * GRID_CELL_SIZE,
      width: width,
      height: GRID_LINE_WIDTH,
    }));

    return [...verticalLines, ...horizontalLines];
  }, [width, height, scale]);

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

  // Add snap to grid helper
  const snapToGrid = useCallback((value: number) => {
    return Math.round(value / GRID_CELL_SIZE) * GRID_CELL_SIZE;
  }, []);

  // Helper function to check if two panels are snapped together
  const arePanelsSnapped = useCallback((id1: string, id2: string) => {
    const pairKey1 = `${id1}-${id2}`;
    const pairKey2 = `${id2}-${id1}`;
    return snappedPairs.has(pairKey1) || snappedPairs.has(pairKey2);
  }, [snappedPairs]);

  // Optimize panel drag end handler with enhanced sticky snapping
  const handlePanelDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    const id = e.target.id();
    const node = e.target;
    const x = node.x();
    const y = node.y();
    
    // Build bounding boxes for all other panels
    const others = panels
      .filter(p => p.id !== id)
      .map(p => ({
        id: p.id,
        left:   p.x,
        right:  p.x + p.width,
        top:    p.y,
        bottom: p.y + p.height
      }));

    let newX = x;
    let newY = y;
    let snappedToId: string | null = null;

    // Current moving panel bounds
    const w = panels.find(p => p.id === id)!.width;
    const h = panels.find(p => p.id === id)!.height;
    const left   = x;
    const right  = x + w;
    const top    = y;
    const bottom = y + h;

    // Check each other panel for edge proximity with sticky snapping
    others.forEach(o => {
      // Snap left edge to other's right
      if (Math.abs(left - o.right) <= SNAP_THRESHOLD) {
        newX = o.right;
        snappedToId = o.id;
      }
      // Snap right edge to other's left
      if (Math.abs(right - o.left) <= SNAP_THRESHOLD) {
        newX = o.left - w;
        snappedToId = o.id;
      }
      // Snap top edge to other's bottom
      if (Math.abs(top - o.bottom) <= SNAP_THRESHOLD) {
        newY = o.bottom;
        snappedToId = o.id;
      }
      // Snap bottom edge to other's top
      if (Math.abs(bottom - o.top) <= SNAP_THRESHOLD) {
        newY = o.top - h;
        snappedToId = o.id;
      }
    });

    // Update snapped pairs for visual feedback
    if (snappedToId) {
      const pairKey = `${id}-${snappedToId}`;
      setSnappedPairs(prev => new Set([...Array.from(prev), pairKey]));
    }

    // Clear pre-snap pairs when drag ends
    setPreSnapPairs(new Set());

    // Finally, snap to grid as a fallback
    newX = snapToGrid(newX);
    newY = snapToGrid(newY);
    
    // Update the panel position with sticky snapping
    const newPanels = panels.map(panel => {
      if (panel.id === id) {
        if (panel.type === 'triangle') {
          // For triangles, snap the center position
          const snappedX = snapToGrid(newX);
          const snappedY = snapToGrid(newY);
          return {
            ...panel,
            x: snappedX - panel.width / 2,
            y: snappedY - panel.height / 2
          };
        }
        return {
          ...panel,
          x: newX,
          y: newY
        };
      }
      return panel;
    });
    
    onPanelUpdate(newPanels);
  }, [panels, onPanelUpdate, snapToGrid]);

  // Optimize panel transform end handler
  const handlePanelTransformEnd = useCallback((e: KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    const updatedPanels = panels.map(panel => {
      if (panel.id === node.id()) {
        if (panel.type === 'triangle') {
          // Get the current radius before resetting scale
          const oldRadius = (node as Konva.RegularPolygon).radius() ?? (panel.width / 2);
          // Use both scaleX and scaleY for non-uniform scaling
          const newRadiusX = oldRadius * scaleX;
          const newRadiusY = oldRadius * scaleY;
          
          // Reset scale after getting the radius
          node.scaleX(1);
          node.scaleY(1);
          
          // Snap the center position
          const snappedX = snapToGrid(node.x());
          const snappedY = snapToGrid(node.y());
          
          return {
            ...panel,
            // Keep center position by adjusting x/y based on new radius
            x: snappedX - newRadiusX,
            y: snappedY - newRadiusY,
            width: newRadiusX * 2,
            height: newRadiusY * 2,
            rotation: node.rotation()
          };
        }
        
        // For rectangles, work with width/height
        const newWidth = node.width() * scaleX;
        const newHeight = node.height() * scaleY;
        
        // Reset scale after getting dimensions
        node.scaleX(1);
        node.scaleY(1);
        
        // Snap position and dimensions to grid
        const snappedX = snapToGrid(node.x());
        const snappedY = snapToGrid(node.y());
        const snappedWidth = snapToGrid(newWidth);
        const snappedHeight = snapToGrid(newHeight);
        
        return {
          ...panel,
          x: snappedX,
          y: snappedY,
          width: snappedWidth,
          height: snappedHeight,
          rotation: node.rotation()
        };
      }
      return panel;
    });
    
    onPanelUpdate(updatedPanels);
  }, [panels, onPanelUpdate, snapToGrid]);

  // Add drag move handler for live snapping with improved panel-to-panel snapping
  const handlePanelDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const movingId = node.id();
    const x = node.x();
    const y = node.y();

    // Build bounding boxes for all other panels
    const others = panels
      .filter(p => p.id !== movingId)
      .map(p => ({
        id: p.id,
        left:   p.x,
        right:  p.x + p.width,
        top:    p.y,
        bottom: p.y + p.height
      }));

    let newX = x;
    let newY = y;
    let isSnappedToAny = false;

    // Current moving panel bounds
    const w = panels.find(p => p.id === movingId)!.width;
    const h = panels.find(p => p.id === movingId)!.height;
    const left   = x;
    const right  = x + w;
    const top    = y;
    const bottom = y + h;

    // Check each other panel for edge proximity
    others.forEach(o => {
      // Snap left edge to other's right
      if (Math.abs(left - o.right) <= SNAP_THRESHOLD) {
        newX = o.right;
        isSnappedToAny = true;
        setPreSnapPairs(prev => new Set([...Array.from(prev), `${movingId}-${o.id}`]));
      }
      // Snap right edge to other's left
      if (Math.abs(right - o.left) <= SNAP_THRESHOLD) {
        newX = o.left - w;
        isSnappedToAny = true;
        setPreSnapPairs(prev => new Set([...Array.from(prev), `${movingId}-${o.id}`]));
      }
      // Snap top edge to other's bottom
      if (Math.abs(top - o.bottom) <= SNAP_THRESHOLD) {
        newY = o.bottom;
        isSnappedToAny = true;
        setPreSnapPairs(prev => new Set([...Array.from(prev), `${movingId}-${o.id}`]));
      }
      // Snap bottom edge to other's top
      if (Math.abs(bottom - o.top) <= SNAP_THRESHOLD) {
        newY = o.top - h;
        isSnappedToAny = true;
        setPreSnapPairs(prev => new Set([...Array.from(prev), `${movingId}-${o.id}`]));
      }
    });

    // Clear snapped pairs if not snapped to any panel
    if (!isSnappedToAny) {
      setSnappedPairs(prev => {
        const newSet = new Set(Array.from(prev));
        // Remove all pairs involving the moving panel
        Array.from(newSet).forEach(pairKey => {
          if (pairKey.includes(movingId)) {
            newSet.delete(pairKey);
          }
        });
        return newSet;
      });
      setPreSnapPairs(prev => {
        const newSet = new Set(Array.from(prev));
        // Remove all pairs involving the moving panel
        Array.from(newSet).forEach(pairKey => {
          if (pairKey.includes(movingId)) {
            newSet.delete(pairKey);
          }
        });
        return newSet;
      });
    }

    // Finally, snap to grid as a fallback
    newX = snapToGrid(newX);
    newY = snapToGrid(newY);

    node.position({ x: newX, y: newY });
  }, [panels, snapToGrid]);

  // Optimize panel click handler
  const handlePanelClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const id = e.target.id();
    setSelectedId(id);
  }, []);

  // Optimize stage click handler
  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  }, []);

  // ADDED:
  const handleEditPanel = () => {
    if (!selectedPanel) {
      alert('Please select a panel to edit');
      return;
    }
    
    if (onEditPanel) {
      onEditPanel(selectedPanel);
    }
  };

  // Memoize panel rendering
  const renderPanel = useCallback((panel: Panel) => {
    console.log('🔍 [DEBUG] Rendering panel:', panel);
    const isSelected = selectedId === panel.id;
    
    // Check if this panel is snapped to any other panel for visual feedback
    const isSnapped = panels.some(otherPanel => 
      otherPanel.id !== panel.id && arePanelsSnapped(panel.id, otherPanel.id)
    );
    
    // Check if this panel is about to snap (during dragging)
    const isPreSnap = panels.some(otherPanel => {
      if (otherPanel.id === panel.id) return false;
      const pairKey1 = `${panel.id}-${otherPanel.id}`;
      const pairKey2 = `${otherPanel.id}-${panel.id}`;
      return preSnapPairs.has(pairKey1) || preSnapPairs.has(pairKey2);
    });
    
    // Compute shape center
    const centerX = panel.x + panel.width / 2;
    const centerY = panel.y + panel.height / 2;

    // Build a single "label" string
    const label = `${panel.rollNumber || panel.roll_number || ''} / ${panel.panelNumber || panel.panel_number || ''}`;

    // Determine stroke color and width based on snap state
    let strokeColor = "black";
    let strokeWidth = 100;
    
    if (isSnapped) {
      strokeColor = "#00ff00"; // Green for snapped
      strokeWidth = 200;
    } else if (isPreSnap) {
      strokeColor = "#ffff00"; // Yellow for about to snap
      strokeWidth = 150;
    }

    if (panel.type === 'triangle') {
      // For triangle, use radius as the primary property
      const radiusX = panel.width / 2;
      const radiusY = panel.height / 2;
      
      // Pick a base radius so the polygon "fits"
      const baseRadius = Math.min(radiusX, radiusY);
      
      // Compute how much we need to stretch along each axis
      const scaleX = radiusX / baseRadius;
      const scaleY = radiusY / baseRadius;
    
    return (
        <Group key={panel.id}>
          <RegularPolygon
            id={panel.id}
            x={centerX}
            y={centerY}
            sides={3}
            radius={baseRadius}
            scaleX={scaleX}
            scaleY={scaleY}
            rotation={panel.rotation}
            fill={panel.fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            draggable={true}
            onClick={(e: KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              setSelectedId(panel.id);
              if (onEditPanel) {
                onEditPanel(panel);
              }
            }}
            onDragMove={handlePanelDragMove}
            onDragEnd={handlePanelDragEnd}
            onTransformEnd={handlePanelTransformEnd}
          />
          <Text
            text={label}
            x={centerX}
            y={centerY}
            fontSize={100}
            fontFamily="Arial"
            fill="#000000"
            align="center"
            verticalAlign="middle"
            offsetX={0}
            offsetY={15}
          />
        </Group>
      );
    }

    return (
      <Group key={panel.id}>
        <Rect
          id={panel.id}
          x={panel.x}
          y={panel.y}
          width={panel.width}
          height={panel.height}
          rotation={panel.rotation}
          fill={panel.fill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          draggable={true}
          onClick={(e: KonvaEventObject<MouseEvent>) => {
            e.cancelBubble = true;
            setSelectedId(panel.id);
            if (onEditPanel) {
              onEditPanel(panel);
            }
          }}
          onDragMove={handlePanelDragMove}
          onDragEnd={handlePanelDragEnd}
          onTransformEnd={handlePanelTransformEnd}
        />
        <Text
          text={label}
          x={centerX}
          y={centerY}
          fontSize={100}
          fontFamily="Arial"
          fill="#000000"
          align="center"
          verticalAlign="middle"
          offsetX={0}
          offsetY={15}
        />
      </Group>
    );
  }, [selectedId, handlePanelDragEnd, handlePanelTransformEnd, handlePanelDragMove, onEditPanel]);

    return (
    <div className="w-full h-full overflow-hidden">
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={scale}
        scaleY={scale}
        onClick={handleStageClick}
        className="bg-white"
        style={{
          touchAction: 'none'
        }}
      >
        <Layer>
          {/* Grid lines */}
          {gridLines.map(line => (
            <Rect
              key={line.key}
              x={line.x}
              y={line.y}
              width={line.width}
              height={line.height}
              fill={GRID_LINE_COLOR}
            />
          ))}
          
          {/* Panels */}
          {panels.map(renderPanel)}
          
          {/* Transformer */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox: { width: number; height: number }, newBox: { width: number; height: number }) => {
              // Limit resize
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
  );
}
