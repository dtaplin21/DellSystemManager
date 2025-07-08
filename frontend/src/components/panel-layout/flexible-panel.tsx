import React, { useCallback, useRef } from 'react';
import { Stage, Layer, Rect, Group } from 'react-konva';
import { Text } from 'react-konva/lib/ReactKonvaCore';
import { Line } from 'react-konva/lib/ReactKonvaCore';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Panel } from '../../types/panel';
import { useFlexibleResize } from '../../hooks/use-flexible-resize';
import { ResizeConstraints } from '../../lib/resize-utils';
import { getPanelLabelLayout } from '../../lib/panel-label-utils';

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

  // Handle panel click
  const handlePanelClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onSelect(panel.id);
  }, [onSelect, panel.id]);

  // Handle panel drag end
  const handlePanelDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd(panel.id, node.x(), node.y());
  }, [onDragEnd, panel.id]);

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

  // Panel label values
  const panelNumber = panel.panelNumber || '';
  const rollNumber = panel.rollNumber || '';

  return (
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
        x={currentPanel.x}
        y={currentPanel.y}
        width={currentPanel.width}
        height={currentPanel.length}
        fill={currentPanel.fill}
        stroke={isSelected ? "#3b82f6" : "#666"}
        strokeWidth={isSelected ? 2 : 1}
        rotation={currentPanel.rotation}
        draggable={!isResizing}
        onClick={handlePanelClick}
        onDragEnd={handlePanelDragEnd}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      
      {/* Top label: Panel Number */}
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
      {/* Bottom label: Roll Number */}
      <Text
        x={currentPanel.x + labelLayout.bottomLabel.x}
        y={currentPanel.y + labelLayout.bottomLabel.y}
        width={labelLayout.bottomLabel.width}
        height={labelLayout.bottomLabel.height}
        text={rollNumber}
        fontSize={labelLayout.fontSize}
        fontFamily="Arial"
        fontStyle="bold"
        fill="#111"
        align={labelLayout.bottomLabel.align}
        verticalAlign={labelLayout.bottomLabel.verticalAlign}
        listening={false}
        ellipsis={true}
      />
      
      {/* Resize handles */}
      {renderResizeHandles()}
    </Group>
  );
};

export default FlexiblePanel; 