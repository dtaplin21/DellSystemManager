'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface Panel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

interface CanvasState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface PanelSystemState {
  panels: Panel[];
  canvas: CanvasState;
  selectedPanelId: string | null;
  isDirty: boolean;
}

// SIMPLIFIED STATE HOOK - Single source of truth
export function usePanelSystem(projectId: string) {
  const [state, setState] = useState<PanelSystemState>({
    panels: [],
    canvas: { scale: 1, offsetX: 0, offsetY: 0 },
    selectedPanelId: null,
    isDirty: false
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Debounced persistence
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  
  const updatePanel = useCallback((panelId: string, updates: Partial<Panel>) => {
    setState(prev => ({
      ...prev,
      panels: prev.panels.map(p => 
        p.id === panelId ? { ...p, ...updates } : p
      ),
      isDirty: true
    }));
    
    // Debounced save to backend
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/panel-layout/move-panel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            panelId,
            newPosition: updates
          })
        });
        setState(prev => ({ ...prev, isDirty: false }));
      } catch (err) {
        console.error('Failed to save panel:', err);
      }
    }, 500);
  }, []);
  
  const updateCanvas = useCallback((canvasUpdates: Partial<CanvasState>) => {
    setState(prev => ({
      ...prev,
      canvas: { ...prev.canvas, ...canvasUpdates }
    }));
    
    // Persist canvas state to localStorage immediately
    localStorage.setItem('canvasState', JSON.stringify({
      ...state.canvas,
      ...canvasUpdates
    }));
  }, [state.canvas]);
  
  const selectPanel = useCallback((panelId: string | null) => {
    setState(prev => ({ ...prev, selectedPanelId: panelId }));
  }, []);
  
  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        
        // Load panels from backend using existing API
        const response = await fetch(`/api/panel-layout?projectId=${projectId}`);
        const data = await response.json();
        
        // Convert backend data to our format
        const panels = data.layout?.panels?.map((backendPanel: any) => {
          const PIXELS_PER_FOOT = 10; // Match current system
          return {
            id: backendPanel.id,
            x: (backendPanel.x || 0) * PIXELS_PER_FOOT,
            y: (backendPanel.y || 0) * PIXELS_PER_FOOT,
            width: (backendPanel.width_feet || backendPanel.width || 1) * PIXELS_PER_FOOT,
            height: (backendPanel.height_feet || backendPanel.height || 1) * PIXELS_PER_FOOT,
            rotation: backendPanel.rotation || 0
          };
        }) || [];
        
        // Load canvas state from localStorage
        const savedCanvas = localStorage.getItem('canvasState');
        const canvas = savedCanvas ? JSON.parse(savedCanvas) : { scale: 1, offsetX: 0, offsetY: 0 };
        
        setState({
          panels,
          canvas,
          selectedPanelId: null,
          isDirty: false
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [projectId]);
  
  return {
    state,
    isLoading,
    error,
    updatePanel,
    updateCanvas,
    selectPanel
  };
}
