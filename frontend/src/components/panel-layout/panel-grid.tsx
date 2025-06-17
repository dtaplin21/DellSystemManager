'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Stage, Layer, Rect, Group, Transformer, RegularPolygon } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import type { Transformer as KonvaTransformer } from 'konva/lib/shapes/Transformer';
import type { Group as GroupType } from 'konva/lib/Group';
import type { Rect as RectType } from 'konva/lib/shapes/Rect';
import type { RegularPolygon as RegularPolygonType } from 'konva/lib/shapes/RegularPolygon';
import Konva from 'konva';

// Constants for grid optimization
const GRID_CELL_SIZE = 100; // Size of each grid cell in pixels
const GRID_LINE_WIDTH = 1;
const GRID_LINE_COLOR = '#e5e7eb';
const MIN_GRID_VISIBILITY_SCALE = 0.2; // Hide grid when zoomed out too far

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
  rollNumber: string;
  panelNumber: string;
}

interface PanelGridProps {
  panels: Panel[];
  width: number;
  height: number;
  scale: number;
  onPanelUpdate: (panels: Panel[]) => void;
}

export default function PanelGrid({ panels, width, height, scale, onPanelUpdate }: PanelGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  // Optimize panel drag end handler
  const handlePanelDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    const id = e.target.id();
    const node = e.target;
    
    // Update the panel position
    const newPanels = panels.map(panel => {
      if (panel.id === id) {
        return {
          ...panel,
          x: node.x(),
          y: node.y()
        };
      }
      return panel;
    });
    
    onPanelUpdate(newPanels);
  }, [panels, onPanelUpdate]);

  // Optimize panel transform end handler
  const handlePanelTransformEnd = useCallback((e: KonvaEventObject<Event>) => {
    const id = e.target.id();
    const node = e.target;
    
    // Get the current scale
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    // Reset scale to 1 and update width/height
    node.scaleX(1);
    node.scaleY(1);
    
    const newPanels = panels.map(panel => {
      if (panel.id === id) {
        return {
          ...panel,
          x: node.x(),
          y: node.y(),
          width: node.width() * scaleX,
          height: node.height() * scaleY,
          rotation: node.rotation()
        };
      }
      return panel;
    });
    
    onPanelUpdate(newPanels);
  }, [panels, onPanelUpdate]);

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

  // Memoize panel rendering
  const renderPanel = useCallback((panel: Panel) => {
    const isSelected = selectedId === panel.id;
    const commonProps = {
      id: panel.id,
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.height,
      rotation: panel.rotation,
      fill: panel.fill,
      stroke: panel.stroke,
      strokeWidth: panel.strokeWidth,
      draggable: true,
      onClick: (e: KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        setSelectedId(panel.id);
      },
      onDragEnd: (e: KonvaEventObject<DragEvent>) => {
        const node = e.target;
        const newX = Math.round(node.x() / GRID_CELL_SIZE) * GRID_CELL_SIZE;
        const newY = Math.round(node.y() / GRID_CELL_SIZE) * GRID_CELL_SIZE;
        node.position({ x: newX, y: newY });
        onPanelUpdate(panels.map(p =>
          p.id === panel.id ? { ...p, x: newX, y: newY } : p
        ));
      },
      onTransformEnd: (e: KonvaEventObject<Event>) => {
        const node = e.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const rotation = node.rotation();
        
        // Reset scale
        node.scaleX(1);
        node.scaleY(1);
        
        // Calculate new dimensions
        const newWidth = Math.round((panel.width * scaleX) / GRID_CELL_SIZE) * GRID_CELL_SIZE;
        const newHeight = Math.round((panel.height * scaleY) / GRID_CELL_SIZE) * GRID_CELL_SIZE;
        
        // Update panel
        onPanelUpdate(panels.map(p =>
          p.id === panel.id ? { ...p, width: newWidth, height: newHeight, rotation: rotation } : p
        ));
      }
    };

    if (panel.type === 'triangle') {
      return (
        <RegularPolygon
          key={panel.id}
          {...commonProps}
          sides={3}
          radius={panel.width / 2}
          offsetX={panel.width / 2}
          offsetY={panel.height / 2}
        />
      );
    }

    return (
      <Rect
        key={panel.id}
        {...commonProps}
      />
    );
  }, [selectedId, panels, onPanelUpdate]);

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
          maxWidth: '100%',
          maxHeight: '100%',
          overflow: 'hidden',
          transformOrigin: '0 0',
          position: 'relative'
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
          
          {/* Transformer for selected panel */}
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
