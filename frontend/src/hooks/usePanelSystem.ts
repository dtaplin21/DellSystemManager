'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { SITE_CONFIG, DEFAULT_ROLL } from '@/lib/geosynthetic-config';
import { ViewportTransform, ViewportState } from '@/lib/viewport-transform';
import { LinerRoll, LinerSystemState, Panel, CanvasState } from '@/lib/geosynthetic-types';

// GEOSYNTHETIC LINER SYSTEM HOOK - Single source of truth
export function useLinerSystem(projectId: string) {
  const [state, setState] = useState<LinerSystemState>({
    rolls: [],
    viewport: {
      scale: 0.1,
      centerX: SITE_CONFIG.SITE_WIDTH / 2,
      centerY: SITE_CONFIG.SITE_HEIGHT / 2,
      canvasWidth: 800,
      canvasHeight: 600
    },
    selectedRollId: null,
    isDirty: false
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Debounced persistence
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  
  const updateRoll = useCallback((rollId: string, updates: Partial<LinerRoll>) => {
    setState(prev => ({
      ...prev,
      rolls: prev.rolls.map(r => 
        r.id === rollId ? { ...r, ...updates } : r
      ),
      isDirty: true
    }));
    
    // Debounced save to backend
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/panels/${rollId}`, {  // Keep your existing API endpoint
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Convert to your backend format
            x: updates.x,
            y: updates.y,
            width_feet: updates.width,
            height_feet: updates.length,  // Map length to height for backend
            rotation: updates.rotation,
            roll_number: updates.rollNumber,
            panel_number: updates.panelNumber
          })
        });
        setState(prev => ({ ...prev, isDirty: false }));
      } catch (err) {
        console.error('Failed to save roll:', err);
      }
    }, 500);
  }, []);
  
  const updateViewport = useCallback((viewportUpdates: Partial<ViewportState>) => {
    setState(prev => ({
      ...prev,
      viewport: { ...prev.viewport, ...viewportUpdates }
    }));
    
    // Persist viewport to localStorage
    const newViewport = { ...state.viewport, ...viewportUpdates };
    localStorage.setItem(`viewport_${projectId}`, JSON.stringify({
      scale: newViewport.scale,
      centerX: newViewport.centerX,
      centerY: newViewport.centerY
    }));
  }, [state.viewport, projectId]);
  
  const selectRoll = useCallback((rollId: string | null) => {
    setState(prev => ({ ...prev, selectedRollId: rollId }));
  }, []);

  const addRoll = useCallback((rollData: Omit<LinerRoll, 'id'>) => {
    const newRoll: LinerRoll = {
      ...rollData,
      id: `roll-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    setState(prev => ({
      ...prev,
      rolls: [...prev.rolls, newRoll],
      isDirty: true
    }));
    
    console.log('🎯 [useLinerSystem] Added new roll:', newRoll);
  }, []);
  
  // Generate automatic roll layout (for when no positions exist)
  const generateRollLayout = useCallback((rollCount: number): LinerRoll[] => {
    const rolls: LinerRoll[] = [];
    const rollsPerRow = 200; // Your requirement: 200 east-west
    
    for (let i = 0; i < rollCount; i++) {
      const row = Math.floor(i / rollsPerRow);
      const col = i % rollsPerRow;
      
      // Calculate position with proper spacing
      const x = col * SITE_CONFIG.TYPICAL_ROLL_WIDTH;
      const y = row * SITE_CONFIG.TYPICAL_ROLL_LENGTH;
      
      rolls.push({
        id: `roll-${i + 1}`,
        x,
        y,
        width: SITE_CONFIG.TYPICAL_ROLL_WIDTH,
        length: SITE_CONFIG.TYPICAL_ROLL_LENGTH,
        rotation: DEFAULT_ROLL.rotation,
        rollNumber: `R${i + 1}`,
        panelNumber: `P${Math.floor(i / 20) + 1}`, // Group into panels of 20 rolls
        material: DEFAULT_ROLL.material,
        thickness: DEFAULT_ROLL.thickness
      });
    }
    
    return rolls;
  }, []);
  
  const fitToSite = useCallback(() => {
    const transform = new ViewportTransform(state.viewport);
    const updates = transform.fitToSite(
      SITE_CONFIG.SITE_WIDTH, 
      SITE_CONFIG.SITE_HEIGHT, 
      SITE_CONFIG.MIN_SCALE, 
      SITE_CONFIG.MAX_SCALE
    );
    updateViewport(updates);
  }, [state.viewport, updateViewport]);
  
  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        
        // Load rolls from backend (using your existing API)
        const response = await fetch(`/api/panel-layout/ssr-layout/${projectId}`);
        const backendData = await response.json();
        
        let rolls: LinerRoll[] = [];
        
        if (backendData.success && backendData.layout?.panels?.length > 0) {
          // Convert backend panel data to liner rolls
          rolls = backendData.layout.panels.map((p: any, index: number) => ({
            id: p.id || `roll-${index + 1}`,
            x: p.x || 0,
            y: p.y || 0,
            width: p.width_feet || p.width || SITE_CONFIG.TYPICAL_ROLL_WIDTH,
            length: p.height_feet || p.height || SITE_CONFIG.TYPICAL_ROLL_LENGTH,
            rotation: p.rotation || 0,
            rollNumber: p.roll_number || p.rollNumber || `R${index + 1}`,
            panelNumber: p.panel_number || p.panelNumber || `P${Math.floor(index / 20) + 1}`,
            material: p.material || 'HDPE',
            thickness: p.thickness || 60
          }));
        } else {
          // Generate default layout if no backend data
          rolls = generateRollLayout(1000); // Generate 1000 rolls as example
        }
        
        // Load viewport from localStorage
        const savedViewport = localStorage.getItem(`viewport_${projectId}`);
        let viewport = state.viewport;
        
        if (savedViewport) {
          const parsed = JSON.parse(savedViewport);
          viewport = {
            ...viewport,
            scale: parsed.scale || 0.1,
            centerX: parsed.centerX || SITE_CONFIG.SITE_WIDTH / 2,
            centerY: parsed.centerY || SITE_CONFIG.SITE_HEIGHT / 2
          };
        }
        
        setState({
          rolls,
          viewport,
          selectedRollId: null,
          isDirty: false
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load liner data');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [projectId, generateRollLayout]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);
  
  // Memoized backward compatibility mappings to prevent unnecessary re-renders
  const panels = useMemo(() => 
    state.rolls.map(roll => ({
      id: roll.id,
      x: roll.x,
      y: roll.y,
      width: roll.width,
      height: roll.length, // Map length to height for compatibility
      rotation: roll.rotation,
      panelNumber: roll.panelNumber,
      rollNumber: roll.rollNumber
    })), 
    [state.rolls]
  );

  const canvas = useMemo(() => ({
    scale: state.viewport.scale,
    offsetX: state.viewport.centerX,
    offsetY: state.viewport.centerY
  }), [state.viewport.scale, state.viewport.centerX, state.viewport.centerY]);

  return {
    state,
    isLoading,
    error,
    updateRoll,
    updateViewport,
    selectRoll,
    addRoll,
    fitToSite,
    generateRollLayout,
    // Backward compatibility aliases
    updatePanel: updateRoll,
    updateCanvas: updateViewport,
    selectPanel: selectRoll,
    addPanel: addRoll,
    // Memoized backward compatibility state aliases
    panels,
    canvas,
    selectedPanelId: state.selectedRollId
  };
}

// Backward compatibility - export the old function name
export const usePanelSystem = useLinerSystem;
