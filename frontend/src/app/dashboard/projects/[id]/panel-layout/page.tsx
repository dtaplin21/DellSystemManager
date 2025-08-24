'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { fetchProjectById, fetchPanelLayout, updatePanelLayout } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PanelLayout from '@/components/panels/PanelLayout';
import ControlToolbar from '@/components/panel-layout/control-toolbar';
import ExportDialog from '@/components/panel-layout/export-dialog';
import EditPanelDialog from '@/components/panel-layout/edit-panel-dialog';
import AIExecutionOverlay from '@/components/panel-layout/ai-execution-overlay';
import { generateId } from '@/lib/utils';
import { useCanvasActionExecutor, AILayoutAction } from '@/services/canvasActionExecutor';
import { Panel } from '@/types/panel';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  client?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  area?: number;
  progress: number;
  created_at: string;
  updated_at: string;
  scale?: number;
  layoutWidth?: number;
  layoutHeight?: number;
  panels?: any[];
}

interface PanelLayout {
  id: string;
  projectId: string;
  panels: any[];
  width: number;
  height: number;
  scale: number;
  lastUpdated: string;
}

// Default layout dimensions (15000ft x 15000ft)
const DEFAULT_LAYOUT_WIDTH = 15000;
const DEFAULT_LAYOUT_HEIGHT = 15000;
const DEFAULT_SCALE = 1.0; // Reasonable default scale - 1.0 means 1 unit = 1 pixel (no scaling)

const BACKEND_URL = 'http://localhost:8003';

export default function PanelLayoutPage({ params }: { params: Promise<{ id: string }> }) {
  console.log('🔍 [COMPONENT] === PanelLayoutPage INITIALIZING ===');
  
  const [project, setProject] = useState<Project | null>(null);
  const [layout, setLayout] = useState<PanelLayout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [id, setId] = useState<string>('');
  console.log('[DEBUG] Initial id:', id);
  const [selectedPanel, setSelectedPanel] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  // AI Layout Execution State
  const [aiActions, setAiActions] = useState<AILayoutAction[]>([]);
  const [isExecutingAI, setIsExecutingAI] = useState(false);
  const [aiExecutionProgress, setAiExecutionProgress] = useState({ current: 0, total: 0 });
  const [aiExecutionResults, setAiExecutionResults] = useState<any[]>([]);
  const [showAIExecutionOverlay, setShowAIExecutionOverlay] = useState(false);
  
  // Window dimensions state
  const [windowDimensions, setWindowDimensions] = useState({ width: 800, height: 600 });
  
  // Get AI actions from session storage
  const { executeActions } = useCanvasActionExecutor(id);
  
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  // Refs for stable references
  const layoutRef = useRef<PanelLayout | null>(null);
  const toastRef = useRef<any>(null);
  const worldDimensionsRef = useRef<{ worldScale: number }>({ worldScale: 1 });
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  
  // Log state changes
  useEffect(() => {
    console.log('🔍 [COMPONENT] Layout state changed:', {
      hasLayout: !!layout,
      panelCount: layout?.panels?.length || 0,
      width: layout?.width,
      height: layout?.height,
      scale: layout?.scale
    });
  }, [layout]);
  
  useEffect(() => {
    console.log('🔍 [COMPONENT] Project state changed:', {
      hasProject: !!project,
      projectId: project?.id,
      projectName: project?.name
    });
  }, [project]);
  
  useEffect(() => {
    console.log('🔍 [COMPONENT] ID state changed:', id);
  }, [id]);

  // State for preventing unnecessary reloads after panel operations
  const [isPanelOperationInProgress, setIsPanelOperationInProgress] = useState(false);
  
  // State for tracking unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Handle adding new panels
  const handleAddPanel = useCallback(async (newPanel: any) => {
    try {
      setIsPanelOperationInProgress(true); // Prevent automatic reloads
      console.log('🔍 [ADD] === ADD PANEL START ===');
      console.log('🔍 [ADD] New panel data:', newPanel);
      console.log('🔍 [ADD] Current layout state:', {
        hasLayout: !!layout,
        currentPanelCount: layout?.panels?.length || 0
      });
      
      // Safety check: ensure layout is properly initialized
      if (!layout) {
        console.error('❌ [ADD] Layout not initialized yet');
        toastRef.current({
          title: 'Error',
          description: 'Layout not ready. Please wait for the page to load completely.',
          variant: 'destructive',
        });
        return;
      }
      
      // Safety check: ensure panels array exists
      if (!Array.isArray(layout.panels)) {
        console.error('❌ [ADD] Layout panels array is not properly initialized:', layout.panels);
        toastRef.current({
          title: 'Error',
          description: 'Layout panels not properly initialized. Please refresh the page.',
          variant: 'destructive',
        });
        return;
      }
      
      // Transform the panel data to match the Panel interface
      const transformedPanel = {
        id: newPanel.id,
        shape: newPanel.shape,
        x: newPanel.x,
        y: newPanel.y,
        width: newPanel.width,
        height: newPanel.height,
        length: newPanel.length || newPanel.height || 100, // Default to height if length not provided
        rotation: newPanel.rotation || 0,
        fill: newPanel.fill,
        color: newPanel.color,
        rollNumber: newPanel.rollNumber,
        panelNumber: newPanel.panelNumber,
        date: newPanel.date,
        location: newPanel.location,
        meta: {
          repairs: [],
          location: { x: newPanel.x, y: newPanel.y, gridCell: { row: 0, col: 0 } }
        }
      };
      
      console.log('🔍 [ADD] Transformed panel:', transformedPanel);
      
      // Add to layout state
      if (layout) {
        console.log('🔍 [ADD] Current layout before update:', {
          hasLayout: !!layout,
          panels: layout.panels,
          panelCount: layout.panels?.length || 0,
          layoutKeys: Object.keys(layout)
        });
        
        const updatedLayout = {
          ...layout,
          panels: [...(layout.panels || []), transformedPanel]
        };
        
        console.log('🔍 [ADD] Updated layout:', {
          oldPanelCount: layout.panels?.length || 0,
          newPanelCount: updatedLayout.panels.length,
          newPanelId: transformedPanel.id,
          updatedLayoutKeys: Object.keys(updatedLayout)
        });
        
        setLayout(updatedLayout);
        
        // Mark that there are unsaved changes
        setHasUnsavedChanges(true);
        
        // No automatic save - user must manually save when ready
        console.log('✅ [ADD] Panel added to local state - use Save button to persist changes');
        
      } else {
        console.warn('⚠️ [ADD] No layout available for new panel');
        console.warn('⚠️ [ADD] Layout state is null or undefined');
      }
      
      console.log('🔍 [ADD] === ADD PANEL END ===');
      
    } catch (error) {
      console.error('❌ [ADD] Error adding panel:', error);
      toastRef.current({
        title: 'Error',
        description: 'Failed to add panel. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPanelOperationInProgress(false); // Re-enable automatic reloads
    }
  }, [layout, project]);

  // Monitor id changes
  useEffect(() => {
    if (id !== '') {
      console.log('[DEBUG] id state changed to:', id);
    }
  }, [id]);
  
  // Monitor layout state changes
  useEffect(() => {
    console.log('🟣 [LAYOUT-CHANGE] === Layout state changed ===');
    console.log('🟣 [LAYOUT-CHANGE] New layout:', {
      hasLayout: !!layout,
      panelCount: layout?.panels?.length || 0,
      layoutDimensions: layout ? { width: layout.width, height: layout.height } : null,
      firstPanel: layout?.panels?.[0] ? {
        id: layout.panels[0].id,
        x: layout.panels[0].x,
        y: layout.panels[0].y,
        width: layout.panels[0].width,
        length: layout.panels[0].length,
        shape: layout.panels[0].shape
      } : null
    });
    
    if (layout && layout.panels && layout.panels.length !== (layoutRef.current?.panels?.length || 0)) {
      console.log('🟣 [LAYOUT-CHANGE] Panel count changed from', layoutRef.current?.panels?.length || 0, 'to', layout.panels.length);
      console.log('🟣 [LAYOUT-CHANGE] Previous first panel:', layoutRef.current?.panels?.[0]);
      console.log('🟣 [LAYOUT-CHANGE] New first panel:', layout.panels[0]);
    }
    
    // Update the ref to track changes
    if (layout) {
      layoutRef.current = layout;
    }
    
    console.log('🟣 [LAYOUT-CHANGE] === END Layout state changed ===');
  }, [layout]);

  // Save function now takes layout and project as arguments
  const saveProjectToSupabase = async (currentLayout: PanelLayout, project: Project) => {
    try {
      console.log('🟢 [SAVE] === SAVE PROJECT START ===');
      console.log('🟢 [SAVE] Input parameters:', { currentLayout, project });
      
      if (!project || !currentLayout) {
        console.error('❌ [SAVE] Missing project or layout:', { project, currentLayout });
        return;
      }

      console.log('🟢 [SAVE] Current layout state:', {
        currentLayout: currentLayout,
        layoutType: typeof currentLayout,
        hasPanels: !!currentLayout.panels,
        panelsType: typeof currentLayout.panels,
        isArray: Array.isArray(currentLayout.panels),
        panelsLength: currentLayout.panels?.length,
        panelsKeys: currentLayout.panels ? Object.keys(currentLayout.panels) : 'No panels object'
      });
      console.log('🔍 [SAVE] Layout panels property:', {
        panels: currentLayout?.panels,
        panelsType: typeof currentLayout?.panels,
        isArray: Array.isArray(currentLayout?.panels),
        length: currentLayout?.panels?.length
      });
      console.log('🔍 [SAVE] Project object:', {
        project: project,
        projectId: project?.id,
        projectIdType: typeof project?.id,
        projectKeys: project ? Object.keys(project) : 'No project'
      });
      console.log('🔍 [SAVE] First few panels:', currentLayout?.panels?.slice(0, 3));
      
      // Safety check: ensure panels array exists
      if (!currentLayout.panels || !Array.isArray(currentLayout.panels)) {
        console.error('❌ [SAVE] No valid panels array found:', currentLayout.panels);
        throw new Error('No valid panels array found in layout');
      }
      
      // Convert panels back to Supabase format, DO NOT divide by PIXELS_PER_FEET
      const supabasePanels = currentLayout.panels.map((panel, index) => {
        console.log(`🔍 [SAVE] Transforming panel ${index}:`, {
          originalPanel: panel,
          panelKeys: Object.keys(panel),
          hasRequiredFields: {
            shape: !!panel.shape,
            x: typeof panel.x === 'number',
            y: typeof panel.y === 'number',
            width: typeof panel.width === 'number',
            length: typeof panel.length === 'number'
          }
        });
        
        const transformedPanel = {
          project_id: project.id,
          type: panel.shape || 'rectangle', // Use shape instead of type
          x: panel.x, // already in feet
          y: panel.y, // already in feet
          width_feet: panel.width, // Use width directly
          height_feet: panel.length, // Use length for height_feet (frontend uses 'length', backend expects 'height_feet')
          roll_number: panel.rollNumber || '',
          panel_number: panel.panelNumber || '',
          fill: panel.fill || '#3b82f6',
          stroke: panel.color || '#000000', // Use color as stroke
          stroke_width: 1, // Default stroke width
          rotation: panel.rotation || 0
        };
        
        console.log(`🔍 [SAVE] Transformed panel ${index}:`, transformedPanel);
        return transformedPanel;
      });
      
      console.log('🔍 [SAVE] Transformed panels for backend:', {
        count: supabasePanels.length,
        firstPanel: supabasePanels[0],
        lastPanel: supabasePanels[supabasePanels.length - 1]
      });
      
      const width = typeof currentLayout.width === 'number' ? currentLayout.width : DEFAULT_LAYOUT_WIDTH;
      const height = typeof currentLayout.height === 'number' ? currentLayout.height : DEFAULT_LAYOUT_HEIGHT;
      const scale = typeof currentLayout.scale === 'number' ? currentLayout.scale : DEFAULT_SCALE;
      const requestBody = { panels: supabasePanels, width, height, scale };
      
      console.log('🔍 [SAVE] Sending panel update to backend:', {
        projectId: project.id,
        panelsCount: supabasePanels.length,
        requestBody
      });
      
      // Use the updatePanelLayout function from the API helper
      const result = await updatePanelLayout(project.id, requestBody);
      
      console.log('✅ [SAVE] Backend response received:', result);
      
      // Verify the save was successful
      if (result && result.panels) {
        console.log('✅ [SAVE] Panel save successful:', {
          savedPanelsCount: result.panels.length,
          savedWidth: result.width,
          savedHeight: result.height,
          savedScale: result.scale
        });
        
        // CRITICAL FIX: Don't overwrite local state with backend response
        // This prevents newly added panels from disappearing
        // The local state already has the panel, just confirm the save was successful
        console.log('✅ [SAVE] Keeping local state intact, save confirmed');
        
        toastRef.current({
          title: 'Project Saved',
          description: `Successfully saved ${result.panels.length} panels to the database.`,
        });
      } else {
        console.error('❌ [SAVE] Backend returned invalid response:', result);
        throw new Error('Backend returned invalid response format');
      }
      
      console.log('🟢 [SAVE] === SAVE FUNCTION END ===');
      
    } catch (error) {
      console.error('❌ [SAVE] Error saving project:', error);
      toastRef.current({
        title: 'Error',
        description: `Failed to save project data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };



  // Mapping function to normalize panel fields - moved up so it can be used in useEffect
  function mapPanelFields(panel: any, index: number = 0) {
    console.log(`🟠 [MAP] === Mapping panel ${index} ===`);
    console.log(`🟠 [MAP] Input panel:`, panel);
    console.log(`🟠 [MAP] Panel keys:`, Object.keys(panel || {}));
    
    // Map backend field names to frontend field names
    // Backend sends: width_feet, height_feet, type
    // Frontend expects: width, length, shape
    const width = Number(panel.width_feet || panel.width || 100);
    const length = Number(panel.height_feet || panel.length || 100);
    const x = Number(panel.x || 0);
    const y = Number(panel.y || 0);
    const shape = panel.type || panel.shape || 'rectangle';
    
    console.log(`🟠 [MAP] Field mapping details:`, {
      'panel.width_feet': panel.width_feet,
      'panel.width': panel.width,
      'width_feet -> width': `${panel.width_feet} -> ${width}`,
      'panel.height_feet': panel.height_feet,
      'panel.length': panel.length,
      'height_feet -> length': `${panel.height_feet} -> ${length}`,
      'panel.type': panel.type,
      'panel.shape': panel.shape,
      'type -> shape': `${panel.type} -> ${shape}`,
      'panel.x': panel.x,
      'x': x,
      'panel.y': panel.y,
      'y': y
    });
    
    // Don't apply scaling here - let the canvas handle all transformations
    // This prevents double scaling issues between mapPanelFields and canvas rendering
    console.log(`🟠 [MAP] Final mapped values: x=${x}, y=${y}, w=${width}, l=${length}, shape=${shape}`);
    
    const mapped = {
      id: panel.id || `panel-${index}`,
      shape: shape, // Use mapped shape from type
      x: x, // Use original coordinates
      y: y, // Use original coordinates
      width: width, // Use mapped width from width_feet
      height: length, // Map length to height for Panel type compatibility
      length: length, // Keep length for backward compatibility
      rotation: Number(panel.rotation || 0),
      fill: panel.fill || '#3b82f6',
      color: panel.color || panel.fill || '#3b82f6',
      rollNumber: panel.roll_number || panel.rollNumber || '',
      panelNumber: panel.panel_number || panel.panelNumber || '',
      date: panel.date || '',
      location: panel.location || '',
      meta: {
        repairs: [],
        location: { x: x, y: y, gridCell: { row: 0, col: 0 } }
      }
    };
    console.log(`🟠 [MAP] Final mapped panel ${index}:`, mapped);
    console.log(`🟠 [MAP] === END Mapping panel ${index} ===`);
    return mapped;
  }

  // Load project and layout data - Consolidated function
  const loadProjectAndLayout = useCallback(async () => {
    try {
      console.log('🟡 [LOAD] === loadProjectAndLayout START ===');
      console.log('🟡 [LOAD] Loading project with ID:', id);
      
      setIsLoading(true);
      const projectData = await fetchProjectById(id);
      console.log('🟡 [LOAD] Project data received:', projectData);
      console.log('🟡 [LOAD] Project name:', projectData?.name);
      console.log('🟡 [LOAD] Project object keys:', projectData ? Object.keys(projectData) : 'No project data');
      
      setProject(projectData);
      console.log('🟡 [LOAD] Project state set');
      
      const layoutData = await fetchPanelLayout(id);
      console.log('🟡 [LOAD] Layout data received from backend:', layoutData);
      console.log('🟡 [LOAD] Raw panels from backend:', layoutData?.panels);
      console.log('🟡 [LOAD] Layout data type:', typeof layoutData);
      console.log('🟡 [LOAD] Panels array type:', Array.isArray(layoutData?.panels));
      console.log('🟡 [LOAD] Layout data keys:', layoutData ? Object.keys(layoutData) : 'No data');
      console.log('🟡 [LOAD] Layout data full object:', JSON.stringify(layoutData, null, 2));
      
      // Check if we're getting the expected data structure
      if (layoutData) {
        console.log('🟡 [LOAD] Data structure analysis:', {
          hasId: !!layoutData.id,
          hasProjectId: !!layoutData.projectId,
          hasPanels: !!layoutData.panels,
          panelsIsArray: Array.isArray(layoutData.panels),
          panelsLength: layoutData.panels?.length || 0,
          hasWidth: typeof layoutData.width === 'number',
          hasHeight: typeof layoutData.height === 'number',
          hasScale: typeof layoutData.scale === 'number'
        });
      }
      
      // Check if we're getting mock data vs real data
      if (layoutData?.panels?.length > 0) {
        console.log('🟡 [LOAD] First panel sample:', layoutData.panels[0]);
        console.log('🟡 [LOAD] Panel has expected fields:', {
          hasId: !!layoutData.panels[0].id,
          hasX: typeof layoutData.panels[0].x === 'number',
          hasY: typeof layoutData.panels[0].y === 'number',
          hasWidth: typeof layoutData.panels[0].width === 'number',
          hasHeight: typeof layoutData.panels[0].height === 'number'
        });
      }
      
      // Process panels properly
      let processedPanels: any[] = [];
      if (layoutData && Array.isArray(layoutData.panels)) {
        console.log('🟡 [LOAD] Processing', layoutData.panels.length, 'panels');
        processedPanels = layoutData.panels.map((panel: any, idx: number) => {
          console.log(`🟡 [LOAD] Processing panel ${idx}:`, panel);
          const mappedPanel = mapPanelFields(panel, idx);
          console.log(`🟡 [LOAD] Panel ${idx} mapped result:`, mappedPanel);
          return mappedPanel;
        });
      } else {
        console.warn('🟡 [LOAD] No panels array found in backend response:', layoutData);
        console.warn('🟡 [LOAD] Layout data keys:', layoutData ? Object.keys(layoutData) : 'No data');
        console.warn('🟡 [LOAD] Panels value:', layoutData?.panels);
        console.warn('🟡 [LOAD] Panels type:', typeof layoutData?.panels);
        console.warn('🟡 [LOAD] Is panels array?', Array.isArray(layoutData?.panels));
      }
      
      console.log('🟡 [LOAD] Processed panels:', processedPanels);
      
      if (!layoutData || layoutData.width < DEFAULT_LAYOUT_WIDTH || layoutData.height < DEFAULT_LAYOUT_HEIGHT) {
        console.log('🟡 [LOAD] Using default layout dimensions');
        const newLayout = {
          ...layoutData,
          width: DEFAULT_LAYOUT_WIDTH,
          height: DEFAULT_LAYOUT_HEIGHT,
          scale: DEFAULT_SCALE,
          panels: processedPanels || [] // Ensure panels is always an array
        };
        console.log('🟡 [LOAD] Setting layout with default dimensions:', newLayout);
        console.log('🟡 [LOAD] New layout panels array:', {
          panels: newLayout.panels,
          isArray: Array.isArray(newLayout.panels),
          length: newLayout.panels.length
        });
        console.log('🟡 [LOAD] About to call setLayout with:', newLayout);
        setLayout(newLayout);
        console.log('🟡 [LOAD] setLayout called');
      } else {
        console.log('🟡 [LOAD] Using existing layout data');
        const newLayout = {
          ...layoutData,
          panels: processedPanels || [] // Ensure panels is always an array
        };
        console.log('🟡 [LOAD] Setting layout with existing data:', newLayout);
        console.log('🟡 [LOAD] New layout panels array:', {
          panels: newLayout.panels,
          isArray: Array.isArray(newLayout.panels),
          length: newLayout.panels.length
        });
        console.log('🟡 [LOAD] About to call setLayout with:', newLayout);
        setLayout(newLayout);
        console.log('🟡 [LOAD] setLayout called');
      }
    } catch (error) {
      console.error('🟡 [LOAD] Error loading project and layout:', error);
      toastRef.current({
        title: 'Error',
        description: 'Failed to load panel layout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      console.log('🟡 [LOAD] Setting isLoading to false');
      setIsLoading(false);
      console.log('🟡 [LOAD] === loadProjectAndLayout END ===');
    }
  }, [id]); // Only depend on id, not toast

  // Memoize projectInfo to prevent infinite re-renders
  const projectInfo = useMemo(() => {
    if (!project) return {
      projectName: '',
      location: '',
      description: '',
      manager: '',
      material: ''
    };
    
    return {
      projectName: project.name || '',
      location: project.location || '',
      description: project.description || '',
      manager: '',
      material: ''
    };
  }, [project?.name, project?.location, project?.description]) // These are primitive values, stable

  // Memoize mapped panels to prevent infinite re-renders
  const lastMappedPanelsRef = useRef<string>('');
  
  const mappedPanels = useMemo(() => {
    console.log('[DEBUG] mappedPanels recalculating with layout.panels:', layout?.panels);
    console.log('[DEBUG] Layout state:', {
      hasLayout: !!layout,
      layoutType: typeof layout,
      hasPanels: !!layout?.panels,
      panelsType: typeof layout?.panels,
      isArray: Array.isArray(layout?.panels),
      panelCount: layout?.panels?.length || 0
    });
    
    if (!layout?.panels || !Array.isArray(layout.panels)) {
      console.log('[DEBUG] No layout panels, returning empty array');
      return [];
    }
    
    try {
      const mapped = layout.panels.map((panel: any, idx: number) => {
        console.log(`[DEBUG] Mapping panel ${idx}:`, panel);
        const mappedPanel = mapPanelFields(panel, idx);
        console.log(`[DEBUG] Mapped panel ${idx} result:`, mappedPanel);
        return mappedPanel;
      });
      
      console.log('[DEBUG] Mapped panels result:', mapped);
      
      // Create a stable reference for comparison
      const mappedString = JSON.stringify(mapped);
      
      // Only return new array if there's a real change
      if (lastMappedPanelsRef.current !== mappedString) {
        console.log('[DEBUG] Panels changed, updating cache');
        lastMappedPanelsRef.current = mappedString;
        return mapped;
      } else {
        console.log('[DEBUG] Using cached panels (no change detected)');
        // Return the cached result to prevent unnecessary re-renders
        try {
          return JSON.parse(lastMappedPanelsRef.current) as Panel[];
        } catch {
          return [];
        }
      }
    } catch (error) {
      console.error('[DEBUG] Error mapping panels:', error);
      return [];
    }
  }, [layout?.panels]) // Keep the original dependency but use ref-based caching

  // Panel update handler - Manual save only
  const handlePanelUpdate = useCallback(async (updatedPanels: Panel[]) => {
    console.log('[DEBUG] handlePanelUpdate called with panels:', updatedPanels);
    console.log('[DEBUG] Current layout state:', {
      hasLayout: !!layout,
      hasProject: !!project,
      currentPanelCount: layout?.panels?.length || 0,
      newPanelCount: updatedPanels.length
    });
    
    if (!layout || !project) {
      console.warn('[DEBUG] Cannot update panels - missing layout or project');
      return;
    }
    
    try {
      // Update local layout state only - no auto-save
      const updatedLayout = {
        ...layout,
        panels: updatedPanels,
        lastUpdated: new Date().toISOString()
      };
      
      console.log('[DEBUG] Updating layout state with:', {
        oldPanelCount: layout.panels?.length || 0,
        newPanelCount: updatedPanels.length,
        firstNewPanel: updatedPanels[0] ? {
          id: updatedPanels[0].id,
          x: updatedPanels[0].x,
          y: updatedPanels[0].y,
          shape: updatedPanels[0].shape
        } : null
      });
      
      setLayout(updatedLayout);
      
      // Mark that there are unsaved changes
      setHasUnsavedChanges(true);
      
      // No auto-save - user must manually save when ready
      console.log('[DEBUG] Layout updated locally - use Save button to persist changes');
      
    } catch (error) {
      console.error('[DEBUG] Error updating panels:', error);
      toastRef.current({
        title: 'Error',
        description: 'Failed to update panels. Please try again.',
        variant: 'destructive',
      });
    }
  }, [layout, project]);

  // Add test panels function
  const createTestPanels = useCallback(() => {
    console.log('Creating test panels...');
    
    setLayout(prev => {
      if (!prev) return prev;
      
      // First, reset scale to a reasonable value
      const newScale = 1.0; // Full scale to make panels clearly visible
      
      const testPanels: Panel[] = [
        {
          id: 'test-panel-1',
          shape: 'rectangle',
          x: 50,
          y: 50,
          width: 100,
          height: 80,
          length: 80, // Keep length for backward compatibility
          rotation: 0,
          fill: '#ff0000', // Bright red to make it very visible
          color: '#000000',
          rollNumber: 'R001',
          panelNumber: 'P001',
          meta: {
            repairs: [],
            location: { x: 50, y: 50, gridCell: { row: 0, col: 0 } }
          }
        },
        {
          id: 'test-panel-2',
          shape: 'rectangle',
          x: 200,
          y: 50,
          width: 120,
          height: 90,
          length: 90, // Keep length for backward compatibility
          rotation: 0,
          fill: '#00ff00', // Bright green to make it very visible
          color: '#000000',
          rollNumber: 'R002',
          panelNumber: 'P002',
          meta: {
            repairs: [],
            location: { x: 200, y: 50, gridCell: { row: 0, col: 0 } }
          }
        }
      ];
      
      console.log('Test panels to add:', testPanels);
      
      return {
        ...prev,
        scale: newScale,
        panels: testPanels
      };
    });
  }, []); // No dependencies needed since we use functional update

  // Zoom to fit function
  const handleZoomToFit = useCallback(() => {
    setLayout(prev => {
      if (!prev || !prev.panels.length) return prev;
      
      // Calculate bounds of all panels
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      prev.panels.forEach(panel => {
        minX = Math.min(minX, panel.x);
        minY = Math.min(minY, panel.y);
        maxX = Math.max(maxX, panel.x + panel.width);
        maxY = Math.max(maxY, panel.y + panel.height);
      });
      
      // Calculate required scale to fit all panels
      const panelWidth = maxX - minX;
      const panelHeight = maxY - minY;
      const containerWidth = windowDimensions.width - 100; // Account for padding
      const containerHeight = windowDimensions.height - 300; // Account for header/toolbar
      
      const scaleX = containerWidth / panelWidth;
      const scaleY = containerHeight / panelHeight;
      const newScale = Math.min(scaleX, scaleY, 2.0); // Cap at 2x zoom
      
      return {
        ...prev,
        scale: newScale
      };
    });
  }, [windowDimensions]); // Only depend on windowDimensions

  // Reset view function
  const handleResetView = useCallback(() => {
    setLayout(prev => {
      if (!prev) return null;
      return { ...prev, scale: DEFAULT_SCALE };
    });
    setPosition({ x: 0, y: 0 });
  }, []);

  // Project load handler
  const handleProjectLoad = useCallback(async (projectData: any) => {
    console.log('[DEBUG] Project load handler called with:', projectData);
    try {
      setProject(projectData);
      
      // Load the panel layout for this project
      const layoutData = await fetchPanelLayout(projectData.id);
      console.log('[DEBUG] Layout data loaded:', layoutData);
      
      let processedPanels: any[] = [];
      if (layoutData && Array.isArray(layoutData.panels)) {
        processedPanels = layoutData.panels.map((panel: any, idx: number) => mapPanelFields(panel, idx));
      }
      
      setLayout({
        ...layoutData,
        width: layoutData?.width || DEFAULT_LAYOUT_WIDTH,
        height: layoutData?.height || DEFAULT_LAYOUT_HEIGHT,
        scale: layoutData?.scale || DEFAULT_SCALE,
        panels: processedPanels
      });
    } catch (error) {
      console.error('[DEBUG] Error in handleProjectLoad:', error);
      toastRef.current({
        title: 'Error',
        description: 'Failed to load project data.',
        variant: 'destructive',
      });
    }
  }, []); // No dependencies needed since we use toastRef.current

  // Panel management functions
  const handleEditPanel = useCallback((panel: any) => {
    console.log('[DEBUG] Edit panel called for:', panel);
    setSelectedPanel(panel);
    setEditDialogOpen(true);
  }, []);

  const handleSavePanel = useCallback((updatedPanel: any) => {
    console.log('[DEBUG] Save panel called for:', updatedPanel);
    
    setLayout(prev => {
      if (!prev) return prev;
      
      const updatedPanels = prev.panels.map(panel => 
        panel.id === updatedPanel.id ? updatedPanel : panel
      );
      
      return {
        ...prev,
        panels: updatedPanels
      };
    });
    
    setEditDialogOpen(false);
    setSelectedPanel(null);
  }, []); // No dependencies needed since we use functional update

  const handleDeletePanel = useCallback((panelId: string) => {
    console.log('[DEBUG] Delete panel called for:', panelId);
    
    setLayout(prev => {
      if (!prev) return prev;
      
      const updatedPanels = prev.panels.filter(panel => panel.id !== panelId);
      
      return {
        ...prev,
        panels: updatedPanels
      };
    });
    
    setEditDialogOpen(false);
    setSelectedPanel(null);
  }, []); // No dependencies needed since we use functional update

  // Panel selection handler
  const handlePanelSelect = useCallback((panel: any) => {
    console.log('[DEBUG] Panel selected:', panel);
    setSelectedPanel(panel);
  }, []);

  // Scale change handler
  const handleScaleChange = useCallback((newScale: number) => {
    console.log('[DEBUG] Scale change in parent:', newScale);
    setLayout(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scale: newScale
      };
    });
  }, []);

  // Position change handler
  const handlePositionChange = useCallback((newPosition: { x: number; y: number }) => {
    console.log('[DEBUG] Position change in parent:', newPosition);
    setPosition(newPosition);
  }, []);

  // Manual save handler
  const handleManualSave = useCallback(async () => {
    if (!layout || !project) return;
    
    try {
      console.log('[DEBUG] Manual save triggered');
      await saveProjectToSupabase(layout, project);
      toastRef.current({
        title: 'Success',
        description: 'Panel layout saved successfully.',
      });
    } catch (error) {
      console.error('[DEBUG] Manual save failed:', error);
      toastRef.current({
        title: 'Error',
        description: 'Failed to save panel layout.',
        variant: 'destructive',
      });
    }
  }, [layout, project]);

  // Store current id in ref to avoid stale closures in WebSocket
  const currentIdRef = useRef(id);
  
  // Update ref when id changes
  useEffect(() => {
    currentIdRef.current = id;
  }, [id]);

  const { isConnected, isAuthenticated, sendMessage } = useWebSocket({
    userId: user?.id || null,
    onMessage: (message: any) => {
      // Support both formats: message.data.projectId and message.projectId
      const projectId = message.data?.projectId ?? message.projectId;
      if (message.type === 'PANEL_UPDATE' && projectId === currentIdRef.current) {
        setLayout((prev) => {
          if (!prev) return prev;
          const panels = message.data?.panels ?? message.panels ?? prev.panels;
          const lastUpdated = message.data?.timestamp ?? message.timestamp ?? new Date().toISOString();
          return {
            ...prev,
            panels,
            lastUpdated
          };
        });
      }
    },
    onConnect: () => {
      console.log('WebSocket connected, user ID:', user?.id);
    },
    onAuthSuccess: () => {
      console.log('WebSocket authenticated, joining room:', `panel_layout_${id}`);
      sendMessage('JOIN_ROOM', { room: `panel_layout_${id}` });
    },
    onAuthFailure: (error) => {
      console.error('WebSocket authentication failed:', error);
    }
  });

  // Note: WebSocket is temporarily disabled to prevent excessive network requests
  // To re-enable: uncomment the connect() call in use-websocket.ts

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      console.log('[DEBUG] Params resolved:', resolvedParams);
      console.log('[DEBUG] Setting id to:', resolvedParams.id);
      setId(resolvedParams.id);
    };
    resolveParams();
  }, [params]);

  // Handle window dimensions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateDimensions = () => {
        setWindowDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
      };
      
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, []);

  // Check for AI-generated actions when component mounts
  useEffect(() => {
    if (!id) return;
    
    try {
      // Check if we came from AI generation
      const urlParams = new URLSearchParams(window.location.search);
      const aiGenerated = urlParams.get('aiGenerated');
      
      if (aiGenerated === 'true') {
        // Load AI actions from session storage
        const storedActions = sessionStorage.getItem(`aiLayoutActions_${id}`);
        const storedSummary = sessionStorage.getItem(`aiLayoutSummary_${id}`);
        
        if (storedActions) {
          try {
            const actions = JSON.parse(storedActions);
            console.log('Loaded AI actions:', actions);
            setAiActions(actions);
            
            if (storedSummary) {
              const summary = JSON.parse(storedSummary);
              console.log('AI Layout Summary:', summary);
            }
            
            // Show AI execution overlay
            setShowAIExecutionOverlay(true);
            
            toastRef.current({
              title: 'AI Layout Ready',
              description: `Found ${actions.length} AI-generated panel actions. Click "Execute AI Layout" to apply them.`,
            });
          } catch (error) {
            console.error('Error parsing AI actions:', error);
            toastRef.current({
              title: 'Error',
              description: 'Failed to load AI layout actions.',
              variant: 'destructive',
            });
          }
        } else {
          console.log('No AI actions found in session storage');
        }
      }
    } catch (error) {
      console.error('Error checking for AI actions:', error);
    }
  }, [id]); // Only depend on id, not toast

  // Store toast function in ref to prevent infinite loops
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    console.log('🔵 [AUTO-RELOAD] === useEffect triggered ===');
    console.log('🔵 [AUTO-RELOAD] Current state:', {
      id,
      isPanelOperationInProgress,
      hasUnsavedChanges,
      layout: layout ? {
        hasLayout: true,
        panelCount: layout.panels?.length || 0,
        firstPanel: layout.panels?.[0] ? {
          id: layout.panels[0].id,
          x: layout.panels[0].x,
          y: layout.panels[0].y,
          width: layout.panels[0].width,
          length: layout.panels[0].length,
          shape: layout.panels[0].shape
        } : 'No panels'
      } : 'No layout'
    });
    
    if (!id) {
      console.log('🔵 [AUTO-RELOAD] No id yet, skipping loadProjectAndLayout');
      return;
    }
    
    // Prevent automatic reloading when panel operations are in progress
    if (isPanelOperationInProgress) {
      console.log('🔵 [AUTO-RELOAD] Panel operation in progress, skipping automatic reload');
      return;
    }
    
    // Prevent automatic reloading when there are unsaved changes
    if (hasUnsavedChanges) {
      console.log('🔵 [AUTO-RELOAD] Unsaved changes detected, skipping automatic reload to preserve user work');
      return;
    }
    
    console.log('🔵 [AUTO-RELOAD] All checks passed, calling loadProjectAndLayout with id:', id);
    console.log('🔵 [AUTO-RELOAD] === END useEffect ===');
    loadProjectAndLayout();
  }, [id, loadProjectAndLayout, isPanelOperationInProgress, hasUnsavedChanges]); // Add hasUnsavedChanges to dependencies

  // AI Layout Execution Functions
  const handleExecuteAILayout = async () => {
    if (!aiActions.length || !id) return;
    
    setIsExecutingAI(true);
    setShowAIExecutionOverlay(true);
    
    try {
      const results = await executeActions(aiActions, {
        onProgress: (current, total, action) => {
          setAiExecutionProgress({ current, total });
          console.log(`Executing action ${current}/${total}:`, action.type);
        },
        onComplete: (results) => {
          setAiExecutionResults(results);
          const successCount = results.filter(r => r.success).length;
          const totalCount = results.length;
          
          toastRef.current({
            title: 'AI Layout Complete',
            description: `Successfully executed ${successCount}/${totalCount} actions.`,
          });
          
          // Refresh the layout to show new panels by reloading the page
          // This ensures we get the latest data from the backend
          window.location.reload();
        },
        onError: (error) => {
          toastRef.current({
            title: 'AI Execution Error',
            description: error,
            variant: 'destructive',
          });
        },
        useBatch: true // Use batch execution for better performance
      });
      
      console.log('AI execution results:', results);
      
    } catch (error) {
      console.error('Error executing AI layout:', error);
      toastRef.current({
        title: 'AI Execution Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsExecutingAI(false);
      setShowAIExecutionOverlay(false);
      
      // Clear AI actions from session storage
      sessionStorage.removeItem(`aiLayoutActions_${id}`);
      sessionStorage.removeItem(`aiLayoutSummary_${id}`);
    }
  };

  const handleCancelAILayout = () => {
    setShowAIExecutionOverlay(false);
    setAiActions([]);
    setIsExecutingAI(false);
    
    // Clear AI actions from session storage
    sessionStorage.removeItem(`aiLayoutActions_${id}`);
    sessionStorage.removeItem(`aiLayoutSummary_${id}`);
    
    // Remove AI flag from URL
    const newUrl = window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  };

  // After loading layout, log the loaded layout and panels
  useEffect(() => {
    if (layout && layout.panels) {
      console.log('[DIAG] Layout loaded from backend:', layout);
      console.log('[DIAG] Panels loaded from backend:', layout.panels);
    }
  }, [layout?.id, layout?.panels?.length]); // Only log when layout ID or panel count changes

  // Add warning when leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Debug logging only in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 [DEBUG] Render state - project name:', project?.name);
    console.log('🔍 [DEBUG] Render state - project type:', typeof project?.name);
  }

  if (!project || !layout) {
    console.log('🔍 [DEBUG] Missing project or layout - project:', !!project, 'layout:', !!layout);
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2">Panel Layout Not Found</h2>
        <p className="text-gray-500 mb-4">
          The panel layout you&apos;re looking for does not exist or you don&apos;t have access to it.
        </p>
        <Button onClick={() => router.push(`/dashboard/projects/${id}`)}>
          Back to Project
        </Button>
      </div>
    );
  }

  // Debug logging only in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[DEBUG] Render: project name:', project?.name);
    console.log('[DEBUG] Render: layout panels count:', layout?.panels?.length || 0);
  }

  return (
    <div className="space-y-4 p-4">
      {/* Debug Information */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-800">Debug Information</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-yellow-700 space-y-1">
            <div>ID: {id || 'Not set'}</div>
            <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
            <div>Project: {project ? `✅ ${project.name}` : '❌ Not loaded'}</div>
            <div>Layout: {layout ? `✅ ${layout.panels?.length || 0} panels` : '❌ Not loaded'}</div>
            <div>Mapped Panels: {mappedPanels.length}</div>
            <div>Project Info: {projectInfo.projectName || 'Not set'}</div>
            <div>User: {user ? `✅ ${user.email}` : '❌ Not authenticated'}</div>
            <div className={hasUnsavedChanges ? "text-orange-600 font-semibold" : "text-green-600"}>
              Status: {hasUnsavedChanges ? "⚠️ Unsaved Changes" : "✅ All Changes Saved"}
            </div>
            <div className="text-blue-600">
              💡 Tip: Use Save button to persist changes, Reset Database to clear all panels
            </div>
            <div className="mt-2 space-x-2">
              <Button 
                size="sm" 
                onClick={async () => {
                  if (layout && project) {
                    try {
                      console.log('🔴 [SAVE BUTTON] === SAVE BUTTON CLICKED ===');
                      console.log('🔴 [SAVE BUTTON] Current layout state:', {
                        layout,
                        layoutType: typeof layout,
                        hasPanels: !!layout?.panels,
                        panelCount: layout?.panels?.length || 0,
                        firstPanel: layout?.panels?.[0] ? {
                          id: layout.panels[0].id,
                          x: layout.panels[0].x,
                          y: layout.panels[0].y,
                          width: layout.panels[0].width,
                          length: layout.panels[0].length,
                          shape: layout.panels[0].shape
                        } : 'No panels'
                      });
                      console.log('🔴 [SAVE BUTTON] Project object:', {
                        project,
                        projectId: project?.id,
                        projectKeys: project ? Object.keys(project) : 'No project'
                      });
                      console.log('🔴 [SAVE BUTTON] Calling saveProjectToSupabase...');
                      
                      await saveProjectToSupabase(layout, project);
                      
                      console.log('🔴 [SAVE BUTTON] saveProjectToSupabase completed');
                      console.log('🔴 [SAVE BUTTON] Layout state AFTER save:', {
                        layout,
                        panelCount: layout?.panels?.length || 0,
                        firstPanel: layout?.panels?.[0] ? {
                          id: layout.panels[0].id,
                          x: layout.panels[0].x,
                          y: layout.panels[0].y,
                          width: layout.panels[0].width,
                          length: layout.panels[0].length,
                          shape: layout.panels[0].shape
                        } : 'No panels'
                      });
                      
                      setHasUnsavedChanges(false); // Clear unsaved changes flag
                      console.log('🔴 [SAVE BUTTON] setHasUnsavedChanges(false) called');
                      
                      toastRef.current({
                        title: 'Success',
                        description: 'Panel layout saved successfully!',
                        variant: 'default',
                      });
                      
                      console.log('🔴 [SAVE BUTTON] === SAVE BUTTON COMPLETED ===');
                    } catch (error) {
                      console.error('🔴 [SAVE BUTTON] Manual save failed:', error);
                      toastRef.current({
                        title: 'Error',
                        description: 'Failed to save panel layout',
                        variant: 'destructive',
                      });
                    }
                  } else {
                    console.log('🔴 [SAVE BUTTON] Cannot save - missing layout or project:', { layout: !!layout, project: !!project });
                    toastRef.current({
                      title: 'Error',
                      description: 'Cannot save - layout or project not loaded',
                      variant: 'destructive',
                    });
                  }
                }} 
                variant={hasUnsavedChanges ? "destructive" : "default"}
                className={hasUnsavedChanges ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
              >
                {hasUnsavedChanges ? "💾 Save*" : "💾 Save Project"}
              </Button>
              <Button size="sm" onClick={createTestPanels} variant="outline">
                Create Test Panels
              </Button>
              <Button size="sm" onClick={() => console.log('Current state:', { layout, mappedPanels, project })} variant="outline">
                Log State
              </Button>
              <Button 
                size="sm" 
                onClick={async () => {
                  try {
                    // Clear in backend
                    await updatePanelLayout(id, { 
                      panels: [],
                      width: layout?.width || DEFAULT_LAYOUT_WIDTH,
                      height: layout?.height || DEFAULT_LAYOUT_HEIGHT,
                      scale: layout?.scale || DEFAULT_SCALE
                    });
                    // Clear in frontend
                    setLayout(prev => prev ? { ...prev, panels: [] } : null);
                    setHasUnsavedChanges(false); // No unsaved changes after clearing
                    console.log('[DEBUG] Cleared layout panels in backend and frontend');
                    toastRef.current({
                      title: 'Success',
                      description: 'All panels cleared successfully',
                      variant: 'default',
                    });
                  } catch (error) {
                    console.error('[DEBUG] Error clearing panels:', error);
                    toastRef.current({
                      title: 'Error',
                      description: 'Failed to clear panels in backend',
                      variant: 'destructive',
                    });
                  }
                }} 
                variant="outline"
                className="bg-red-100 text-red-700 border-red-300 hover:bg-red-200"
              >
                🗑️ Clear Layout
              </Button>
              <Button 
                size="sm" 
                onClick={async () => {
                  if (confirm('⚠️ WARNING: This will permanently delete ALL panels from the database. This action cannot be undone. Are you sure you want to continue?')) {
                    try {
                      // Clear in backend
                      await updatePanelLayout(id, { 
                        panels: [],
                        width: DEFAULT_LAYOUT_WIDTH,
                        height: DEFAULT_LAYOUT_HEIGHT,
                        scale: DEFAULT_SCALE
                      });
                      // Clear in frontend
                      setLayout(prev => prev ? { 
                        ...prev, 
                        panels: [],
                        width: DEFAULT_LAYOUT_WIDTH,
                        height: DEFAULT_LAYOUT_HEIGHT,
                        scale: DEFAULT_SCALE
                      } : null);
                      setHasUnsavedChanges(false); // No unsaved changes after clearing
                      console.log('[DEBUG] Reset entire layout to defaults in backend and frontend');
                      toastRef.current({
                        title: 'Success',
                        description: 'Database reset to clean state',
                        variant: 'default',
                      });
                    } catch (error) {
                      console.error('[DEBUG] Error resetting database:', error);
                      toastRef.current({
                        title: 'Error',
                        description: 'Failed to reset database',
                        variant: 'destructive',
                      });
                    }
                  }
                }} 
                variant="outline"
                className="bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
              >
                🔄 Reset Database
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Execution Overlay */}
      {showAIExecutionOverlay && (
        <div className="ai-execution-wrapper">
          {(() => {
            try {
              return (
                <AIExecutionOverlay
                  isVisible={showAIExecutionOverlay}
                  isExecuting={isExecutingAI}
                  actions={aiActions || []}
                  progress={aiExecutionProgress}
                  onExecute={handleExecuteAILayout}
                  onCancel={handleCancelAILayout}
                />
              );
            } catch (error) {
              console.error('Error rendering AI execution overlay:', error);
              return (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                    <div className="text-center">
                      <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
                      <p className="text-gray-600 mb-4">Failed to load AI execution overlay</p>
                      <Button onClick={handleCancelAILayout} className="w-full">
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }
          })()}
        </div>
      )}

      <Card className="w-full">
        <CardHeader>
          {(() => {
            try {
              return (
                <ControlToolbar
                  scale={layout.scale}
                  onScaleChange={handleScaleChange}
                  onAddPanel={handleAddPanel}
                  selectedPanel={selectedPanel}
                  onEditPanel={handleEditPanel}
                  onProjectLoad={handleProjectLoad}
                  currentProject={project}
                  onZoomToFit={handleZoomToFit}
                  onResetView={handleResetView}
                />
              );
            } catch (error) {
              console.error('Error rendering ControlToolbar:', error);
              return (
                <div className="p-4 text-center">
                  <p className="text-red-600">Error loading toolbar</p>
                </div>
              );
            }
          })()}
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full h-[calc(100vh-300px)] overflow-hidden">
            {(() => {
              try {
                // Add null checks for layout
                if (!layout) {
                  return (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-600 mb-2">Loading Panel Layout...</h3>
                        <p className="text-gray-500">Please wait while we load your panel data.</p>
                      </div>
                    </div>
                  );
                }
                
                // Check if any panels are visible (larger than 1 unit)
                const visiblePanels = mappedPanels.filter(p => p.width > 1 && p.length > 1);
                
                if (visiblePanels.length === 0 && mappedPanels.length > 0) {
                  return (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-orange-600 mb-2">Panels Too Small</h3>
                        <p className="text-gray-600 mb-4">
                          Found {mappedPanels.length} panels, but they are too small to display.
                          <br />
                          Try zooming in or check panel dimensions.
                        </p>
                        <div className="space-y-2">
                          <Button onClick={() => handleZoomToFit()} variant="outline">
                            Zoom to Fit
                          </Button>
                          <Button onClick={createTestPanels} variant="outline">
                            Add Test Panels
                          </Button>
                          <Button onClick={() => {
                            console.log('[DEBUG] Current layout state:', layout);
                            console.log('[DEBUG] Current mapped panels:', mappedPanels);
                            console.log('[DEBUG] Current project:', project);
                          }} variant="outline">
                            Debug State
                          </Button>
                          <Button onClick={async () => {
                            if (layout && project) {
                              console.log('[DEBUG] Manually testing save function...');
                              try {
                                await saveProjectToSupabase(layout, project);
                                console.log('[DEBUG] Manual save successful!');
                              } catch (error) {
                                console.error('[DEBUG] Manual save failed:', error);
                              }
                            } else {
                              console.warn('[DEBUG] Cannot test save - missing layout or project');
                            }
                          }} variant="outline">
                            Test Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="w-full h-[calc(100vh-300px)]">
                    <PanelLayout
                      mode="manual"
                      projectInfo={projectInfo}
                      externalPanels={mappedPanels}
                      onPanelUpdate={handlePanelUpdate}
                    />
                  </div>
                );
              } catch (error) {
                console.error('Error rendering PanelGrid:', error);
                return (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Panel Grid</h3>
                      <p className="text-gray-600 mb-4">Failed to render the panel layout</p>
                      <Button onClick={() => window.location.reload()} variant="outline">
                        Reload Page
                      </Button>
                    </div>
                  </div>
                );
              }
            })()}
          </div>
        </CardContent>
      </Card>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        projectId={id}
        layout={layout}
      />

      <EditPanelDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        panel={selectedPanel}
        onSave={handleSavePanel}
        onDelete={handleDeletePanel}
      />
    </div>
  );
}
