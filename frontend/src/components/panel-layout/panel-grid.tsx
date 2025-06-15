'use client';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Stage, Layer, Rect, Group, Transformer, RegularPolygon } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import type { Transformer as KonvaTransformer } from 'konva/lib/shapes/Transformer';
import type { Group as GroupType } from 'konva/lib/Group';
import type { Rect as RectType } from 'konva/lib/shapes/Rect';
import type { RegularPolygon as RegularPolygonType } from 'konva/lib/shapes/RegularPolygon';
import Konva from 'konva';

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
  
  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const node = stageRef.current?.findOne(`#${selectedId}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedId]);

  const handlePanelDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const id = e.target.id();
    const newPanels = panels.map(panel => {
      if (panel.id === id) {
        return {
          ...panel,
          x: e.target.x(),
          y: e.target.y()
        };
      }
      return panel;
    });
    onPanelUpdate(newPanels);
  };

  const handlePanelTransformEnd = (e: KonvaEventObject<Event>) => {
    const id = e.target.id();
    const node = stageRef.current?.findOne(`#${id}`);
    if (!node) return;

    const newPanels = panels.map(panel => {
      if (panel.id === id) {
        return {
          ...panel,
          x: node.x(),
          y: node.y(),
          width: node.width() * node.scaleX(),
          height: node.height() * node.scaleY(),
          rotation: node.rotation()
        };
      }
      return panel;
    });
    onPanelUpdate(newPanels);
  };

  const handlePanelClick = (e: KonvaEventObject<MouseEvent>) => {
    const id = e.target.id();
    setSelectedId(id);
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  };

  const renderPanel = (panel: Panel) => {
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
          onTransformEnd={handlePanelTransformEnd}
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
  };

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
        {Array.from({ length: Math.ceil(width / 100) }).map((_, i) => (
          <Rect
            key={`grid-v-${i}`}
            x={i * 100}
            y={0}
            width={1}
            height={height}
            fill="#e5e7eb"
          />
        ))}
        {Array.from({ length: Math.ceil(height / 100) }).map((_, i) => (
          <Rect
            key={`grid-h-${i}`}
            x={0}
            y={i * 100}
            width={width}
            height={1}
            fill="#e5e7eb"
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
        />
      </Layer>
    </Stage>
  );
}
