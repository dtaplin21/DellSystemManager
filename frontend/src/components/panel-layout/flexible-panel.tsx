import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Group } from 'react-konva';
import { Text } from 'react-konva/lib/ReactKonvaCore';
import { Line } from 'react-konva/lib/ReactKonvaCore';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Panel } from '../../types/panel';
import { useFlexibleResize } from '../../hooks/use-flexible-resize';
import { ResizeConstraints } from '../../lib/resize-utils';
import { getPanelLabelLayout } from '../../lib/panel-label-utils';
import { useTooltip } from '@/components/ui/tooltip';

interface FlexiblePanelProps {
  panel: Panel;
  isSelected: boolean;
  onSelect: (panelId: string) => void;
  onUpdate: (updatedPanel: Panel) => void;
  onDragEnd: (panelId: string, x: number, y: number) => void;
  constraints?: Partial<ResizeConstraints>;
  containerBounds?: { width: number; height: number };
  enableVisualFeedback?: boolean;
  enableSnapping?: boolean;
  scale?: number;
  showResizeHandles?: boolean;
}

interface ResizeHandleProps {
  x: number;
  y: number;
  width: number;
  height: number;
  handleId: string;
  cursor: string;
  onMouseDown: (handleId: string, e: KonvaEventObject<MouseEvent>) => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({
  x,
  y,
  width,
  height,
  handleId,
  cursor,
  onMouseDown
}) => {
  const getHandlePosition = () => {
    switch (handleId) {
      case 'top-left':
        return { x: x - 4, y: y - 4 };
      case 'top-center':
        return { x: x + width / 2 - 4, y: y - 4 };
      case 'top-right':
        return { x: x + width - 4, y: y - 4 };
      case 'middle-left':
        return { x: x - 4, y: y + height / 2 - 4 };
      case 'middle-right':
        return { x: x + width - 4, y: y + height / 2 - 4 };
      case 'bottom-left':
        return { x: x - 4, y: y + height - 4 };
      case 'bottom-center':
        return { x: x + width / 2 - 4, y: y + height - 4 };
      case 'bottom-right':
        return { x: x + width - 4, y: y + height - 4 };
      default:
        return { x: 0, y: 0 };
    }
  };

  const position = getHandlePosition();

  return (
    <Rect
      x={position.x}
      y={position.y}
      width={8}
      height={8}
      fill="#ffffff"
      stroke="#3b82f6"
      strokeWidth={1}
      cornerRadius={2}
      listening={true}
      onMouseDown={(e: KonvaEventObject<MouseEvent>) => onMouseDown(handleId, e)}
      style={{ cursor }}
    />
  );
};

export const FlexiblePanel: React.FC<FlexiblePanelProps> = ({
  panel,
  isSelected,
  onSelect,
  onUpdate,
  onDragEnd,
  constraints = {},
  containerBounds,
  enableVisualFeedback = true,
  enableSnapping = true,
  scale = 1,
  showResizeHandles = true
}) => {
  const stageRef = useRef<any>(null);
  const nodeRef = useRef<any>(null);
  const dragRAFRef = useRef<number | null>(null);
  const targetPosition = useRef<{ x: number; y: number }>({ x: panel.x, y: panel.y });
  const actualPosition = useRef<{ x: number; y: number }>({ x: panel.x, y: panel.y });
  const isDraggingRef = useRef(false);
  
  // Use the flexible resize hook
  const {
    isResizing,
    resizeResult,
    visualFeedback,
    startResize,
    updateResize,
    endResize,
    cancelResize,
    getResizeCursor
  } = useFlexibleResize({
    panels: [panel], // Single panel for this component
    onPanelUpdate: (panels) => {
      if (panels[0]) {
        onUpdate(panels[0]);
      }
    },
    constraints,
    containerBounds,
    enableVisualFeedback,
    enableSnapping
  });

  // Lerp helper
  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  // Animation loop for gliding
  const animateGlide = useCallback(() => {
    if (!nodeRef.current) return;
    const { x: tx, y: ty } = targetPosition.current;
    let { x: ax, y: ay } = actualPosition.current;
    // Lerp toward target
    const speed = 0.18; // 0 < speed < 1, higher = faster
    ax = lerp(ax, tx, speed);
    ay = lerp(ay, ty, speed);
    // If close enough, snap to target
    if (Math.abs(ax - tx) < 0.5 && Math.abs(ay - ty) < 0.5) {
      ax = tx;
      ay = ty;
    }
    actualPosition.current = { x: ax, y: ay };
    nodeRef.current.position({ x: ax, y: ay });
    nodeRef.current.getLayer()?.batchDraw();
    // Continue animating if not at target or still dragging
    if (isDraggingRef.current || Math.abs(ax - tx) > 0.5 || Math.abs(ay - ty) > 0.5) {
      dragRAFRef.current = requestAnimationFrame(animateGlide);
    } else {
      dragRAFRef.current = null;
    }
  }, []);

  // On drag start, set both positions
  const handlePanelDragStart = useCallback((e: KonvaEventObject<DragEvent>) => {
    isDraggingRef.current = true;
    const { x, y } = e.target.position();
    targetPosition.current = { x, y };
    actualPosition.current = { x, y };
    if (!nodeRef.current) nodeRef.current = e.target;
    if (!dragRAFRef.current) dragRAFRef.current = requestAnimationFrame(animateGlide);
  }, [animateGlide]);

  // On drag move, update only targetPosition
  const handlePanelDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    if (!isSelected) return;
    const { x, y } = e.target.position();
    targetPosition.current = { x, y };
    if (!dragRAFRef.current) dragRAFRef.current = requestAnimationFrame(animateGlide);
  }, [isSelected, animateGlide]);

  // On drag end, set both positions and update React state
  const handlePanelDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    isDraggingRef.current = false;
    const { x, y } = e.target.position();
    targetPosition.current = { x, y };
    actualPosition.current = { x, y };
    if (dragRAFRef.current) {
      cancelAnimationFrame(dragRAFRef.current);
      dragRAFRef.current = null;
    }
    onDragEnd(panel.id, x, y);
  }, [onDragEnd, panel.id]);

  // Keep actual/target position in sync with panel.x/y if not dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      targetPosition.current = { x: panel.x, y: panel.y };
      actualPosition.current = { x: panel.x, y: panel.y };
      if (nodeRef.current) {
        nodeRef.current.position({ x: panel.x, y: panel.y });
        nodeRef.current.getLayer()?.batchDraw();
      }
    }
  }, [panel.x, panel.y]);

  // Handle resize start
  const handleResizeStart = useCallback((handleId: string, e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    
    const stage = stageRef.current;
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    startResize(handleId, panel.id, pointerPos.x, pointerPos.y);
  }, [startResize, panel.id]);

  // Handle mouse move for resize
  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!isResizing) return;
    
    const stage = stageRef.current;
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    updateResize(pointerPos.x, pointerPos.y);
  }, [isResizing, updateResize]);

  // Handle mouse up for resize end
  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      endResize();
    }
  }, [isResizing, endResize]);

  // Remove hover state and add tooltip
  const { showTooltip, hideTooltip, TooltipComponent } = useTooltip();

  // Get current panel dimensions (use resize result if resizing)
  const currentPanel = resizeResult ? {
    ...panel,
    x: resizeResult.x,
    y: resizeResult.y,
    width: resizeResult.width,
    length: resizeResult.height
  } : panel;

  // Responsive label layout
  const labelLayout = getPanelLabelLayout(currentPanel.width, currentPanel.length);

  // Helper to determine if currently dragging
  const isDragging = isDraggingRef.current;

  // Render resize handles
  const renderResizeHandles = () => {
    if (!isSelected || !showResizeHandles || isResizing) return null;

    const handles = [
      'top-left', 'top-center', 'top-right',
      'middle-left', 'middle-right',
      'bottom-left', 'bottom-center', 'bottom-right'
    ];

    return handles.map(handleId => (
      <ResizeHandle
        key={handleId}
        x={currentPanel.x}
        y={currentPanel.y}
        width={currentPanel.width}
        height={currentPanel.length}
        handleId={handleId}
        cursor={getResizeCursor(handleId)}
        onMouseDown={handleResizeStart}
      />
    ));
  };

  // Render snap lines
  const renderSnapLines = () => {
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
  };

  // Render constraint indicator
  const renderConstraintIndicator = () => {
    if (!visualFeedback.showConstraintIndicator) return null;

    return (
      <Text
        x={currentPanel.x + currentPanel.width / 2}
        y={currentPanel.y - 30}
        text={visualFeedback.constraintMessage}
        fontSize={12}
        fill="#ff6b6b"
        align="center"
        listening={false}
      />
    );
  };

  // Panel label values - only show panel number
  const panelNumber = panel.panelNumber || '';

  // Handle panel click
  const handlePanelClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onSelect(panel.id);
  }, [onSelect, panel.id]);

  // Handle mouse enter for tooltip
  const handleMouseEnter = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const tooltipContent = `Panel: ${panel.panelNumber || 'N/A'}\nRoll: ${panel.rollNumber || 'N/A'}`;
    showTooltip(tooltipContent, e.evt.clientX, e.evt.clientY);
  }, [showTooltip, panel.panelNumber, panel.rollNumber]);

  // Handle mouse leave for tooltip
  const handleMouseLeave = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  return (
    <>
      <Group>
        {/* Snap lines (rendered on top layer) */}
        {renderSnapLines()}
        
        {/* Constraint indicator */}
        {renderConstraintIndicator()}
        
        {/* Panel selection border */}
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
        
        {/* Main panel */}
        <Rect
          ref={nodeRef}
          {...(!isDragging ? { x: currentPanel.x, y: currentPanel.y } : {})}
          width={currentPanel.width}
          height={currentPanel.length}
          fill={currentPanel.fill}
          stroke={isSelected ? "#3b82f6" : "#000000"}
          strokeWidth={isSelected ? 2 : 1}
          rotation={currentPanel.rotation}
          draggable={!isResizing}
          onClick={handlePanelClick}
          onDragStart={handlePanelDragStart}
          onDragMove={handlePanelDragMove}
          onDragEnd={handlePanelDragEnd}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
        
        {/* Top label: Panel Number only */}
        <Text
          x={currentPanel.x + labelLayout.topLabel.x}
          y={currentPanel.y + labelLayout.topLabel.y}
          width={labelLayout.topLabel.width}
          height={labelLayout.topLabel.height}
          text={panelNumber}
          fontSize={labelLayout.fontSize}
          fontFamily="Arial"
          fontStyle="bold"
          fill="#111"
          align={labelLayout.topLabel.align}
          verticalAlign={labelLayout.topLabel.verticalAlign}
          listening={false}
          ellipsis={true}
        />
        
        {/* Resize handles */}
        {renderResizeHandles()}
      </Group>
      
      {/* Tooltip component */}
      <TooltipComponent />
    </>
  );
};

export default FlexiblePanel; 