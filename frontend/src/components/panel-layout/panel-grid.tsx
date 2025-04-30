'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Panel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color?: string;
  qcStatus?: string;
}

interface PanelGridProps {
  panels: Panel[];
  width: number;
  height: number;
  scale: number;
  onPanelUpdate: (panels: Panel[]) => void;
}

export default function PanelGrid({ panels, width, height, scale, onPanelUpdate }: PanelGridProps) {
  const [localPanels, setLocalPanels] = useState<Panel[]>(panels);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [dragInfo, setDragInfo] = useState<{
    isDragging: boolean;
    startX: number;
    startY: number;
    panelId: string | null;
    isResizing: boolean;
    resizeHandle: string | null;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    panelId: null,
    isResizing: false,
    resizeHandle: null,
  });
  
  const gridRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Update local panels when prop changes
  useEffect(() => {
    setLocalPanels(panels);
  }, [panels]);
  
  // Apply visual grid for scale
  const gridSize = 10 * scale; // 10px base grid size
  
  const handleMouseDown = (e: React.MouseEvent, panelId: string, isResizeHandle = false, handle: string | null = null) => {
    e.preventDefault();
    
    // Get the current target element and its bounding rect
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect) return;
    
    // Calculate mouse position relative to grid
    const mouseX = e.clientX - gridRect.left;
    const mouseY = e.clientY - gridRect.top;
    
    setSelectedPanelId(panelId);
    setDragInfo({
      isDragging: true,
      startX: mouseX,
      startY: mouseY,
      panelId,
      isResizing: isResizeHandle,
      resizeHandle: handle,
    });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragInfo.isDragging || !dragInfo.panelId) return;
    
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect) return;
    
    // Calculate mouse position relative to grid
    const mouseX = e.clientX - gridRect.left;
    const mouseY = e.clientY - gridRect.top;
    
    // Calculate movement delta
    const deltaX = mouseX - dragInfo.startX;
    const deltaY = mouseY - dragInfo.startY;
    
    setLocalPanels(prevPanels => {
      // Create a copy of the panels array
      const newPanels = [...prevPanels];
      
      // Find the panel being modified
      const panelIndex = newPanels.findIndex(p => p.id === dragInfo.panelId);
      if (panelIndex === -1) return prevPanels;
      
      const panel = { ...newPanels[panelIndex] };
      
      if (dragInfo.isResizing && dragInfo.resizeHandle) {
        // Handle resizing based on the handle being dragged
        switch (dragInfo.resizeHandle) {
          case 'nw':
            panel.x += deltaX;
            panel.y += deltaY;
            panel.width -= deltaX;
            panel.height -= deltaY;
            break;
          case 'ne':
            panel.y += deltaY;
            panel.width += deltaX;
            panel.height -= deltaY;
            break;
          case 'sw':
            panel.x += deltaX;
            panel.width -= deltaX;
            panel.height += deltaY;
            break;
          case 'se':
            panel.width += deltaX;
            panel.height += deltaY;
            break;
        }
        
        // Ensure minimum dimensions
        if (panel.width < 50) panel.width = 50;
        if (panel.height < 50) panel.height = 50;
      } else {
        // Handle moving (dragging)
        panel.x += deltaX;
        panel.y += deltaY;
        
        // Ensure panel stays within grid boundaries
        if (panel.x < 0) panel.x = 0;
        if (panel.y < 0) panel.y = 0;
        if (panel.x + panel.width > width * scale) {
          panel.x = width * scale - panel.width;
        }
        if (panel.y + panel.height > height * scale) {
          panel.y = height * scale - panel.height;
        }
      }
      
      newPanels[panelIndex] = panel;
      
      return newPanels;
    });
    
    // Update drag start position for next move
    setDragInfo(prev => ({
      ...prev,
      startX: mouseX,
      startY: mouseY,
    }));
  };
  
  const handleMouseUp = () => {
    if (dragInfo.isDragging) {
      // Notify parent of panel updates
      onPanelUpdate(localPanels);
      
      // Reset drag state
      setDragInfo({
        isDragging: false,
        startX: 0,
        startY: 0,
        panelId: null,
        isResizing: false,
        resizeHandle: null,
      });
    }
  };
  
  const handleDoubleClick = (e: React.MouseEvent, panel: Panel) => {
    // Get new label from user
    const newLabel = prompt('Enter panel label:', panel.label);
    if (newLabel !== null) {
      const updatedPanels = localPanels.map(p => 
        p.id === panel.id ? { ...p, label: newLabel } : p
      );
      setLocalPanels(updatedPanels);
      onPanelUpdate(updatedPanels);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' && selectedPanelId) {
      if (confirm('Are you sure you want to delete this panel?')) {
        const updatedPanels = localPanels.filter(p => p.id !== selectedPanelId);
        setLocalPanels(updatedPanels);
        onPanelUpdate(updatedPanels);
        setSelectedPanelId(null);
      }
    }
  };
  
  const getPanelStatusColor = (status?: string) => {
    if (!status) return '';
    
    switch (status.toLowerCase()) {
      case 'pass':
        return 'bg-green-100 border-green-500';
      case 'fail':
        return 'bg-red-100 border-red-500';
      case 'pending':
        return 'bg-yellow-100 border-yellow-500';
      default:
        return '';
    }
  };
  
  return (
    <div 
      ref={gridRef}
      className="panel-grid border border-gray-300 relative"
      style={{ 
        width: '100%', 
        height: '70vh',
        backgroundSize: `${gridSize}px ${gridSize}px`,
        maxWidth: `${width * scale}px`,
        maxHeight: `${height * scale}px`,
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={0} // Make div focusable for keyboard events
    >
      {localPanels.map(panel => (
        <div
          key={panel.id}
          className={`panel ${selectedPanelId === panel.id ? 'selected' : ''} ${getPanelStatusColor(panel.qcStatus)}`}
          style={{
            left: `${panel.x}px`,
            top: `${panel.y}px`,
            width: `${panel.width}px`,
            height: `${panel.height}px`,
            backgroundColor: panel.color ? panel.color : undefined,
          }}
          onMouseDown={(e) => handleMouseDown(e, panel.id)}
          onDoubleClick={(e) => handleDoubleClick(e, panel)}
        >
          <span>{panel.label}</span>
          
          {/* Resize handles */}
          <div 
            className="panel-resize-handle nw" 
            onMouseDown={(e) => handleMouseDown(e, panel.id, true, 'nw')}
          />
          <div 
            className="panel-resize-handle ne" 
            onMouseDown={(e) => handleMouseDown(e, panel.id, true, 'ne')}
          />
          <div 
            className="panel-resize-handle sw" 
            onMouseDown={(e) => handleMouseDown(e, panel.id, true, 'sw')}
          />
          <div 
            className="panel-resize-handle se" 
            onMouseDown={(e) => handleMouseDown(e, panel.id, true, 'se')}
          />
        </div>
      ))}
    </div>
  );
}
