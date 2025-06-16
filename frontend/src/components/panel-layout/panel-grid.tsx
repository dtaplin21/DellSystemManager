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
      onClick: handlePanelClick,
      onDragEnd: handlePanelDragEnd,
      onTransformEnd: handlePanelTransformEnd
    };

    if (panel.type === 'triangle') {
      return (
        <Group
          key={panel.id}
          {...commonProps}
        >
          <RegularPolygon
            sides={3}
            radius={panel.width / 2}
            fill={panel.fill}
            stroke={panel.stroke}
            strokeWidth={panel.strokeWidth}
          />
        </Group>
      );
    }

    return <Rect key={panel.id} {...commonProps} />;
  }, [handlePanelClick, handlePanelDragEnd, handlePanelTransformEnd]);

  return (
    <Stage
      ref={stageRef}
      width={width * scale}
      height={height * scale}
      scale={{ x: scale, y: scale }}
      onClick={handleStageClick}
      className="bg-white"
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
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          keepRatio={false}
        />
      </Layer>
    </Stage>
  );
}
