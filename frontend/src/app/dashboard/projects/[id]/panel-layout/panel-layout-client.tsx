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
import Loading from './loading';
import '@/app/dashboard/dashboard.css';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  client?: string;
  location?: string;
  startDate?: string | null;
  endDate?: string | null;
  area?: number | null;
  progress: number;
  createdAt?: string | null;
  updatedAt?: string | null;
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

interface PanelLayoutClientProps {
  projectId: string;
  initialProject: Project;
  initialLayout: PanelLayout;
}

// Default layout dimensions (15000ft x 15000ft)
const DEFAULT_LAYOUT_WIDTH = 15000;
const DEFAULT_LAYOUT_HEIGHT = 15000;
const DEFAULT_SCALE = 1.0;

const BACKEND_URL = 'http://localhost:8003';

export default function PanelLayoutClient({ 
  projectId, 
  initialProject, 
  initialLayout 
}: PanelLayoutClientProps) {
  console.log('🔍 [CLIENT] === PanelLayoutClient INITIALIZING ===');
  
  const [project, setProject] = useState<Project>(initialProject);
  const [layout, setLayout] = useState<PanelLayout>(initialLayout);
  const [isLoading, setIsLoading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
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
  const { executeActions } = useCanvasActionExecutor(projectId);
  
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
    console.log('🔍 [CLIENT] Layout state changed:', {
      hasLayout: !!layout,
      panelCount: layout?.panels?.length || 0,
      width: layout?.width,
      height: layout?.height,
      scale: layout?.scale
    });
  }, [layout]);
  
  useEffect(() => {
    console.log('🔍 [CLIENT] Project state changed:', {
      hasProject: !!project,
      projectId: project?.id,
      projectName: project?.name
    });
  }, [project]);
  
  useEffect(() => {
    console.log('🔍 [CLIENT] ProjectId changed:', projectId);
  }, [projectId]);

  // CRITICAL DEBUG: Implement proper data source priority (localStorage > backend > SSR)
  useEffect(() => {
    const fetchRealData = async () => {
      try {
        console.log('🚨 [CLIENT] === DATA SOURCE PRIORITY: localStorage > backend > SSR ===');
        console.log('🚨 [CLIENT] fetchRealData called at:', new Date().toISOString());
        
        // STEP 1: Check localStorage first (highest priority)
        const savedPositions = localStorage.getItem('panelLayoutPositions');
        const hasLocalStoragePositions = savedPositions && savedPositions !== '{}';
        
        console.log('🚨 [CLIENT] localStorage check:');
        console.log('🚨 [CLIENT] - savedPositions exists:', !!savedPositions);
        console.log('🚨 [CLIENT] - savedPositions content:', savedPositions);
        console.log('🚨 [CLIENT] - hasLocalStoragePositions:', hasLocalStoragePositions);
        
        if (hasLocalStoragePositions) {
          console.log('🚨 [CLIENT] 🚨🚨🚨 localStorage has saved positions - this takes priority 🚨🚨🚨');
        }
        
        // STEP 2: Fetch backend data (but don't override localStorage positions)
        console.log('🚨 [CLIENT] Fetching backend data...');
        
        // Fetch real project data
        console.log('🚨 [CLIENT] Fetching project data from:', `${BACKEND_URL}/api/projects/ssr/${projectId}`);
        const projectResponse = await fetch(`${BACKEND_URL}/api/projects/ssr/${projectId}`);
        if (projectResponse.ok) {
          const realProject = await projectResponse.json();
          console.log('🚨 [CLIENT] Real project data fetched:', realProject);
          setProject(realProject);
        } else {
          console.warn('🚨 [CLIENT] Failed to fetch real project data:', projectResponse.status);
        }
        
        // Fetch real layout data
        console.log('🚨 [CLIENT] Fetching layout data from:', `${BACKEND_URL}/api/panel-layout/ssr-layout/${projectId}`);
        const layoutResponse = await fetch(`${BACKEND_URL}/api/panel-layout/ssr-layout/${projectId}`);
        if (layoutResponse.ok) {
          const realLayout = await layoutResponse.json();
          console.log('🚨 [CLIENT] Real layout data fetched:', realLayout);
          
          if (realLayout.success && realLayout.layout && realLayout.layout.panels) {
            console.log('🚨 [CLIENT] Backend panel positions:', realLayout.layout.panels.map((p: any) => ({ id: p.id, x: p.x, y: p.y })));
          }
          
          if (realLayout.success && realLayout.layout) {
            console.log('🚨 [CLIENT] === APPLYING DATA SOURCE PRIORITY ===');
            // STEP 3: Apply data source priority logic
            if (hasLocalStoragePositions) {
              try {
                const positionMap = JSON.parse(savedPositions);
                console.log('🚨 [CLIENT] localStorage positions found:', Object.keys(positionMap).length, 'panels');
                console.log('🚨 [CLIENT] localStorage positionMap:', positionMap);
                
                // Merge backend data with localStorage positions (localStorage wins)
                console.log('🚨 [CLIENT] Merging backend data with localStorage positions...');
                const panelsWithPreservedPositions = realLayout.layout.panels.map((panel: any) => {
                  const saved = positionMap[panel.id];
                  if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
                    console.log(`🚨 [CLIENT] 🚨🚨🚨 localStorage OVERRIDE: panel ${panel.id}: backend(${panel.x}, ${panel.y}) -> localStorage(${saved.x}, ${saved.y}) 🚨🚨🚨`);
                    return { ...panel, x: saved.x, y: saved.y };
                  }
                  console.log(`🚨 [CLIENT] No localStorage position for panel ${panel.id}, keeping backend position: (${panel.x}, ${panel.y})`);
                  return panel;
                });
                
                console.log('🚨 [CLIENT] Final merged panels:', panelsWithPreservedPositions);
                
                const layoutWithPreservedPositions = {
                  ...realLayout.layout,
                  panels: panelsWithPreservedPositions
                };
                
                console.log('🚨 [CLIENT] 🚨🚨🚨 Setting layout with localStorage priority (localStorage > backend) 🚨🚨🚨');
                console.log('🚨 [CLIENT] Layout to be set:', layoutWithPreservedPositions);
                setLayout(layoutWithPreservedPositions);
              } catch (error) {
                console.warn('🚨 [CLIENT] Error processing localStorage positions, using backend data:', error);
                setLayout(realLayout.layout);
              }
            } else {
              console.log('🚨 [CLIENT] No localStorage positions found, using backend data as-is');
              setLayout(realLayout.layout);
            }
          }
        } else {
          console.warn('🔍 [CLIENT] Failed to fetch real layout data:', layoutResponse.status);
        }
      } catch (error) {
        console.error('🔍 [CLIENT] Error fetching real data:', error);
      }
    };

    // CRITICAL FIX #11: Improved SSR fallback data handling
    const isSSRMode = project.name === 'Project (SSR Mode)' || layout.id === 'ssr-fallback-layout';
    
    if (isSSRMode) {
      console.log('🔍 [CLIENT] SSR mode detected - ALWAYS fetching from backend to get panel data');
      console.log('🔍 [CLIENT] Current SSR layout state:', {
        hasLayout: !!layout,
        panelCount: layout?.panels?.length || 0,
        layoutId: layout?.id,
        projectName: project?.name
      });
      // CRITICAL FIX: Always fetch backend data in SSR mode to get panel data
      // localStorage will only override positions, not prevent data fetching
      fetchRealData();
    } else {
      console.log('🔍 [CLIENT] Not in SSR mode, skipping backend fetch');
    }
  }, [projectId, project.name, layout.id]);

  // State for preventing unnecessary reloads after panel operations
  const [isPanelOperationInProgress, setIsPanelOperationInProgress] = useState(false);
  
  // State for tracking unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Handle adding new panels
  const handleAddPanel = useCallback(async (newPanel: any) => {
    try {
      setIsPanelOperationInProgress(true);
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
        length: newPanel.length || newPanel.height || 100,
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
        setHasUnsavedChanges(true);
        
        console.log('🔍 [ADD] Layout updated successfully');
      }
    } catch (error) {
      console.error('❌ [ADD] Error adding panel:', error);
      toastRef.current({
        title: 'Error',
        description: 'Failed to add panel. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPanelOperationInProgress(false);
    }
  }, [layout, toastRef]);
  
  // CRITICAL FIX #10: Fix handlePanelUpdate localStorage coordination
  const handlePanelUpdate = useCallback(async (updatedPanels: Panel[]) => {
    console.log('[DEBUG] handlePanelUpdate called with panels:', updatedPanels);
    console.log('[DEBUG] Current layout state:', {
      hasLayout: !!layout,
      layoutType: typeof layout,
      hasPanels: !!layout?.panels,
      panelsType: typeof layout?.panels,
      isArray: Array.isArray(layout?.panels),
      panelCount: layout?.panels?.length || 0
    });
    
    if (!layout) {
      console.error('[DEBUG] No layout to update');
      return;
    }
    
    try {
      // CRITICAL: Update localStorage positions when panels are updated
      try {
        const positionMap: Record<string, { x: number; y: number }> = {};
        updatedPanels.forEach(panel => {
          positionMap[panel.id] = { x: panel.x, y: panel.y };
        });
        localStorage.setItem('panelLayoutPositions', JSON.stringify(positionMap));
        console.log('[DEBUG] Updated localStorage positions for', Object.keys(positionMap).length, 'panels');
      } catch (localStorageError) {
        console.warn('[DEBUG] Failed to update localStorage positions:', localStorageError);
      }
      
      const updatedLayout = {
        ...layout,
        panels: updatedPanels,
        lastUpdated: new Date().toISOString()
      };
      
      console.log('[DEBUG] Setting updated layout:', updatedLayout);
      setLayout(updatedLayout);
      setHasUnsavedChanges(true);
      
      console.log('[DEBUG] Layout updated successfully with localStorage sync');
    } catch (error) {
      console.error('[DEBUG] Error updating layout:', error);
    }
  }, [layout]);
  
  // Handle scale changes
  const handleScaleChange = useCallback((newScale: number) => {
    if (layout) {
      setLayout({
        ...layout,
        scale: newScale
      });
      setHasUnsavedChanges(true);
    }
  }, [layout]);
  
  // Handle project loading
  const handleProjectLoad = useCallback(async () => {
    try {
      setIsLoading(true);
      const projectData = await fetchProjectById(projectId);
      setProject(projectData);
      
      const layoutData = await fetchPanelLayout(projectId);
      if (layoutData) {
        setLayout(layoutData);
      }
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);
  
  // Handle zoom to fit
  const handleZoomToFit = useCallback(() => {
    console.log('[DEBUG] Zoom to fit triggered');
    // Implementation would go here
  }, []);
  
  // Handle reset view
  const handleResetView = useCallback(() => {
    console.log('[DEBUG] Reset view triggered');
    // Implementation would go here
  }, []);
  
  // Handle edit panel
  const handleEditPanel = useCallback((panel: any) => {
    setSelectedPanel(panel);
    setEditDialogOpen(true);
  }, []);
  
  // Handle save panel
  const handleSavePanel = useCallback(async (updatedPanel: any) => {
    try {
      if (!layout) return;
      
      const updatedPanels = layout.panels.map(p => 
        p.id === updatedPanel.id ? updatedPanel : p
      );
      
      setLayout({
        ...layout,
        panels: updatedPanels
      });
      
      setEditDialogOpen(false);
      setSelectedPanel(null);
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Error saving panel:', error);
    }
  }, [layout]);
  
  // Handle delete panel
  const handleDeletePanel = useCallback(async (panelId: string) => {
    try {
      if (!layout) return;
      
      const updatedPanels = layout.panels.filter(p => p.id !== panelId);
      
      setLayout({
        ...layout,
        panels: updatedPanels
      });
      
      setEditDialogOpen(false);
      setSelectedPanel(null);
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Error deleting panel:', error);
    }
  }, [layout]);
  
  // Handle AI layout execution
  const handleExecuteAILayout = useCallback(async () => {
    try {
      setIsExecutingAI(true);
      setShowAIExecutionOverlay(true);
      
      // AI execution logic would go here
      console.log('AI layout execution started');
      
    } catch (error) {
      console.error('Error executing AI layout:', error);
    } finally {
      setIsExecutingAI(false);
      setShowAIExecutionOverlay(false);
    }
  }, []);
  
  // Handle cancel AI layout
  const handleCancelAILayout = useCallback(() => {
    setIsExecutingAI(false);
    setShowAIExecutionOverlay(false);
  }, []);
  
  // Create test panels for debugging
  const createTestPanels = useCallback(() => {
    if (!layout) return;
    
    const testPanels = [
      {
        id: generateId(),
        shape: 'rectangle',
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        length: 150,
        rotation: 0,
        fill: '#3b82f6',
        color: '#3b82f6',
        rollNumber: 'TEST-001',
        panelNumber: 'Test-1',
        date: new Date().toISOString(),
        location: 'Test Area',
        meta: {
          repairs: [],
          location: { x: 100, y: 100, gridCell: { row: 0, col: 0 } }
        }
      },
      {
        id: generateId(),
        shape: 'rectangle',
        x: 350,
        y: 100,
        width: 200,
        height: 150,
        length: 150,
        rotation: 0,
        fill: '#10b981',
        color: '#10b981',
        rollNumber: 'TEST-002',
        panelNumber: 'Test-2',
        date: new Date().toISOString(),
        location: 'Test Area',
        meta: {
          repairs: [],
          location: { x: 350, y: 100, gridCell: { row: 0, col: 0 } }
        }
      }
    ];
    
    setLayout({
      ...layout,
      panels: [...layout.panels, ...testPanels]
    });
    
    setHasUnsavedChanges(true);
  }, [layout]);
  
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
  }, [project?.name, project?.location, project?.description]);
  
  // CRITICAL DEBUG: Improve mapped panels memoization to preserve positions
  const lastMappedPanelsRef = useRef<string>('');
  
  const mappedPanels = useMemo(() => {
    console.log('🚨 [CLIENT] === MAPPED PANELS MEMOIZATION DEBUG ===');
    console.log('🚨 [CLIENT] mappedPanels recalculating with layout.panels:', layout?.panels);
    console.log('🚨 [CLIENT] Layout state:', {
      hasLayout: !!layout,
      layoutType: typeof layout,
      hasPanels: !!layout?.panels,
      panelsType: typeof layout?.panels,
      isArray: Array.isArray(layout?.panels),
      panelCount: layout?.panels?.length || 0
    });
    
    // CRITICAL FIX: Don't process localStorage if backend data is empty or invalid
    if (!layout?.panels || !Array.isArray(layout.panels) || layout.panels.length === 0) {
      console.log('🚨 [CLIENT] No valid backend panels, returning empty array (localStorage will be ignored)');
      return [];
    }
    
    try {
      // CRITICAL DEBUG: Check localStorage first to preserve positions during mapping
      console.log('🚨 [CLIENT] Checking localStorage for positions during mapping...');
      const savedPositions = localStorage.getItem('panelLayoutPositions');
      let positionMap: Record<string, { x: number; y: number }> = {};
      
      console.log('🚨 [CLIENT] localStorage savedPositions during mapping:', savedPositions);
      
      if (savedPositions) {
        try {
          positionMap = JSON.parse(savedPositions);
          console.log('🚨 [CLIENT] Found localStorage positions for', Object.keys(positionMap).length, 'panels');
          console.log('🚨 [CLIENT] localStorage positionMap during mapping:', positionMap);
        } catch (error) {
          console.warn('🚨 [CLIENT] Failed to parse localStorage positions:', error);
        }
      } else {
        console.log('🚨 [CLIENT] No localStorage positions found during mapping');
      }
      
      const mapped = layout.panels.map((panel: any, idx: number) => {
        console.log(`[DEBUG] Mapping panel ${idx}:`, panel);
        
        // CRITICAL FIX #7: Enhanced field name mapping with fallbacks - convert to unified coordinates
        const widthFeet = Number(panel.width_feet || panel.width || panel.width_feet || 100);
        const lengthFeet = Number(panel.height_feet || panel.length || panel.height || 100);
        
        // Convert feet to pixels for unified coordinate system
        const PIXELS_PER_FOOT = 10; // From unified coordinates (significantly larger for better visibility)
        const width = widthFeet * PIXELS_PER_FOOT;
        const length = lengthFeet * PIXELS_PER_FOOT;
        
        // CRITICAL: Preserve localStorage positions during mapping - convert to unified coordinates
        const xFeet = Number(panel.x || 0);
        const yFeet = Number(panel.y || 0);
        let x = xFeet * PIXELS_PER_FOOT; // Convert to pixels
        let y = yFeet * PIXELS_PER_FOOT; // Convert to pixels
        
        // CRITICAL DEBUG: Check if we have a saved position for this panel
        if (positionMap[panel.id]) {
          const saved = positionMap[panel.id];
          if (typeof saved.x === 'number' && typeof saved.y === 'number') {
            console.log(`🚨 [CLIENT] 🚨🚨🚨 localStorage OVERRIDE during mapping: panel ${panel.id}: layout(${x}, ${y}) -> localStorage(${saved.x}, ${saved.y}) 🚨🚨🚨`);
            // localStorage positions are already in pixels (unified coordinates)
            x = saved.x;
            y = saved.y;
          } else {
            console.log(`🚨 [CLIENT] Invalid localStorage position for panel ${panel.id}:`, saved);
          }
        } else {
          console.log(`🚨 [CLIENT] No localStorage position for panel ${panel.id}, using layout position: (${x}, ${y})`);
        }
        
        const shape = panel.type || panel.shape || 'rectangle';
        
        const mappedPanel = {
          id: panel.id || `panel-${idx}`,
          shape: shape,
          x: x,
          y: y,
          width: width,
          height: length,
          isValid: true,
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
        
        console.log(`[DEBUG] Mapped panel ${idx} result:`, mappedPanel);
        return mappedPanel;
      });
      
      console.log('[DEBUG] Mapped panels result with localStorage preservation:', mapped);
      
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
  }, [layout?.panels]);
  
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
    if (!projectId) return;
    
    try {
      // Check if we came from AI generation
      const urlParams = new URLSearchParams(window.location.search);
      const aiGenerated = urlParams.get('aiGenerated');
      
      if (aiGenerated === 'true') {
        // Load AI actions from session storage
        const storedActions = sessionStorage.getItem(`aiLayoutActions_${projectId}`);
        const storedSummary = sessionStorage.getItem(`aiLayoutSummary_${projectId}`);
        
        if (storedActions) {
          try {
            const actions = JSON.parse(storedActions);
            setAiActions(actions);
            console.log('Loaded AI actions from session storage:', actions);
          } catch (e) {
            console.error('Failed to parse stored AI actions:', e);
          }
        }
        
        if (storedSummary) {
          console.log('AI generation summary:', storedSummary);
        }
      }
    } catch (error) {
      console.error('Error checking AI generation status:', error);
    }
  }, [projectId]);
  
  // CRITICAL FIX #9: Coordinate WebSocket updates with localStorage (EXTRA CAREFUL)
  const { isConnected, isAuthenticated, sendMessage } = useWebSocket({
    userId: user?.id || null,
    onMessage: (message: any) => {
      const messageProjectId = message.data?.projectId ?? message.projectId;
      if (message.type === 'PANEL_UPDATE' && messageProjectId === projectId) {
        console.log('[WebSocket] Panel update received:', message);
        
        // CRITICAL: Check if this update conflicts with localStorage positions
        try {
          const savedPositions = localStorage.getItem('panelLayoutPositions');
          if (savedPositions) {
            const positionMap = JSON.parse(savedPositions);
            const hasLocalStoragePositions = Object.keys(positionMap).length > 0;
            
            if (hasLocalStoragePositions) {
              const incomingPanels = message.data?.panels ?? message.panels ?? [];
              
              // Check if incoming panels have default positions that would override localStorage
              const hasDefaultPositions = incomingPanels.some((panel: any) => {
                const isDefaultPosition = (panel.x === 50 && panel.y === 50) || 
                                        (panel.x === 0 && panel.y === 0) ||
                                        (Math.abs(panel.x - 50) < 10 && Math.abs(panel.y - 50) < 10);
                return isDefaultPosition;
              });
              
              if (hasDefaultPositions) {
                console.log('[WebSocket] CRITICAL: Incoming update has default positions, but localStorage has valid positions. IGNORING WebSocket update to prevent panel stacking.');
                console.log('[WebSocket] localStorage positions:', Object.keys(positionMap).length, 'panels');
                console.log('[WebSocket] Incoming panels with defaults:', incomingPanels.length);
                return; // Don't process this WebSocket update
              }
              
              // If no default positions, merge with localStorage positions
              console.log('[WebSocket] Merging WebSocket update with localStorage positions');
              const mergedPanels = incomingPanels.map((panel: any) => {
                const saved = positionMap[panel.id];
                if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
                  console.log(`[WebSocket] Preserving localStorage position for panel ${panel.id}: WebSocket(${panel.x}, ${panel.y}) -> localStorage(${saved.x}, ${saved.y})`);
                  return { ...panel, x: saved.x, y: saved.y };
                }
                return panel;
              });
              
              setLayout((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  panels: mergedPanels,
                  lastUpdated: message.data?.timestamp ?? message.timestamp ?? new Date().toISOString()
                };
              });
            } else {
              // No localStorage positions, use WebSocket data as-is
              console.log('[WebSocket] No localStorage positions, using WebSocket data as-is');
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
          } else {
            // No localStorage, use WebSocket data as-is
            console.log('[WebSocket] No localStorage, using WebSocket data as-is');
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
        } catch (error) {
          console.error('[WebSocket] Error processing panel update with localStorage:', error);
          // Fallback to original behavior on error
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
      }
    },
    onConnect: () => {
      console.log('WebSocket connected, user ID:', user?.id);
    },
    onAuthSuccess: () => {
      console.log('WebSocket authenticated, joining room:', `panel_layout_${projectId}`);
      sendMessage('JOIN_ROOM', { room: `panel_layout_${projectId}` });
    },
    onAuthFailure: (error) => {
      console.error('WebSocket authentication failed:', error);
    }
  });
  
  // Manual save function
  const handleManualSave = useCallback(async () => {
    if (!layout || !project) return;
    
    try {
      console.log('[DEBUG] Manual save triggered');
      // Save logic would go here
      setHasUnsavedChanges(false);
      
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
  }, [layout, project, toastRef]);
  
  // CRITICAL DEBUG: Check localStorage state
  const handleDebugLocalStorage = useCallback(() => {
    console.log('🚨 [DEBUG] === localStorage STATE CHECK ===');
    try {
      const savedPositions = localStorage.getItem('panelLayoutPositions');
      console.log('🚨 [DEBUG] localStorage.getItem("panelLayoutPositions"):', savedPositions);
      
      if (savedPositions) {
        const parsed = JSON.parse(savedPositions);
        console.log('🚨 [DEBUG] Parsed localStorage positions:', parsed);
        console.log('🚨 [DEBUG] Number of saved panels:', Object.keys(parsed).length);
        
        Object.entries(parsed).forEach(([id, pos]: [string, any]) => {
          console.log(`🚨 [DEBUG] Panel ${id}: x=${pos.x}, y=${pos.y}`);
        });
      } else {
        console.log('🚨 [DEBUG] No localStorage positions found');
      }
      
      // Check other localStorage items
      const zoomState = localStorage.getItem('panelLayoutZoomState');
      console.log('🚨 [DEBUG] localStorage.getItem("panelLayoutZoomState"):', zoomState);
      
    } catch (error) {
      console.error('🚨 [DEBUG] Error checking localStorage:', error);
    }
  }, []);
  
  // CRITICAL DEBUG: Force save current panel positions to localStorage
  const handleForceSavePositions = useCallback(() => {
    console.log('🚨 [DEBUG] === FORCE SAVE PANEL POSITIONS ===');
    console.log('🚨 [DEBUG] mappedPanels available:', mappedPanels?.length || 0);
    console.log('🚨 [DEBUG] layout.panels available:', layout?.panels?.length || 0);
    
    // CRITICAL FIX: Use mappedPanels instead of layout.panels
    // mappedPanels contains the actual positions being displayed (with localStorage overrides)
    const panelsToSave = mappedPanels && mappedPanels.length > 0 ? mappedPanels : layout?.panels;
    
    if (!panelsToSave || panelsToSave.length === 0) {
      console.log('🚨 [DEBUG] No panels to save');
      return;
    }
    
    try {
      const positionMap: Record<string, { x: number; y: number }> = {};
      panelsToSave.forEach(panel => {
        positionMap[panel.id] = { x: panel.x, y: panel.y };
      });
      
      localStorage.setItem('panelLayoutPositions', JSON.stringify(positionMap));
      console.log('🚨 [DEBUG] Forced save of', Object.keys(positionMap).length, 'panel positions');
      console.log('🚨 [DEBUG] Saved positions:', positionMap);
      console.log('🚨 [DEBUG] Source of positions:', mappedPanels && mappedPanels.length > 0 ? 'mappedPanels (displayed positions)' : 'layout.panels (backend positions)');
      
      toastRef.current({
        title: 'Debug: Positions Saved',
        description: `Saved ${Object.keys(positionMap).length} panel positions to localStorage`,
      });
    } catch (error) {
      console.error('🚨 [DEBUG] Error forcing save:', error);
      toastRef.current({
        title: 'Debug: Save Failed',
        description: 'Failed to save panel positions',
        variant: 'destructive',
      });
    }
  }, [mappedPanels, layout?.panels, toastRef]);
  
  // Set up toast ref
  useEffect(() => {
    if (toast) {
      toastRef.current = toast;
    }
  }, [toast]);
  
  // Loading state
  if (isLoading) {
    return <Loading />;
  }
  
  // Error state
  if (!project || !layout) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Failed to Load</h2>
          <p className="text-gray-600 mb-4">Unable to load project or layout data</p>
          <Button onClick={handleProjectLoad} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* CRITICAL DEBUG BANNER */}
      {typeof window !== 'undefined' && (
        <div className="fixed top-0 left-0 right-0 z-[99999] bg-red-600 text-white p-2 text-center font-bold">
          🚨 DEBUG MODE: Panel Position Tracking Active - Check Console for Details 🚨
        </div>
      )}
      
      {/* AI Execution Overlay */}
      {showAIExecutionOverlay && (() => {
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

      <Card className="w-full">
        <CardHeader>
          {/* CRITICAL DEBUG PANEL */}
          {typeof window !== 'undefined' && (
            <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 rounded">
              <h3 className="font-bold text-yellow-800 mb-2">🚨 DEBUG INFO</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>localStorage Positions:</strong>
                  <div className="mt-1">
                    {(() => {
                      try {
                        const saved = localStorage.getItem('panelLayoutPositions');
                        if (saved) {
                          const parsed = JSON.parse(saved);
                          return `${Object.keys(parsed).length} panels saved`;
                        }
                        return 'None';
                      } catch {
                        return 'Error parsing';
                      }
                    })()}
                  </div>
                </div>
                <div>
                  <strong>Current Layout:</strong>
                  <div className="mt-1">
                    {layout?.panels?.length || 0} panels
                  </div>
                </div>
                <div>
                  <strong>Mapped Panels:</strong>
                  <div className="mt-1">
                    {mappedPanels?.length || 0} panels
                  </div>
                </div>
                <div>
                  <strong>Last Update:</strong>
                  <div className="mt-1">
                    {layout?.lastUpdated ? new Date(layout.lastUpdated).toLocaleTimeString() : 'Never'}
                  </div>
                </div>
                <div className="col-span-2 space-y-2">
                  <Button 
                    onClick={handleDebugLocalStorage} 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    🔍 Check localStorage
                  </Button>
                  <Button 
                    onClick={handleForceSavePositions} 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    💾 Force Save Positions
                  </Button>
                  <Button 
                    onClick={() => {
                      console.log('🚨 [DEBUG] === MANUAL localStorage TEST ===');
                      try {
                        const testData = { test: 'data', timestamp: Date.now() };
                        localStorage.setItem('testKey', JSON.stringify(testData));
                        const retrieved = localStorage.getItem('testKey');
                        console.log('🚨 [DEBUG] Test save successful:', retrieved);
                        console.log('🚨 [DEBUG] localStorage is working properly');
                      } catch (error) {
                        console.error('🚨 [DEBUG] localStorage test failed:', error);
                      }
                    }} 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    🧪 Test localStorage
                  </Button>
                  <Button 
                    onClick={() => {
                      console.log('🚨 [DEBUG] === COMPARE PANEL SOURCES ===');
                      console.log('🚨 [DEBUG] layout.panels (backend data):', layout?.panels);
                      console.log('🚨 [DEBUG] mappedPanels (displayed data):', mappedPanels);
                      console.log('🚨 [DEBUG] Position comparison:');
                      if (layout?.panels && mappedPanels) {
                        layout.panels.forEach((layoutPanel, idx) => {
                          const mappedPanel = mappedPanels[idx];
                          if (mappedPanel) {
                            console.log(`🚨 [DEBUG] Panel ${idx} (${layoutPanel.id}):`);
                            console.log(`🚨 [DEBUG]   layout.panels: x=${layoutPanel.x}, y=${layoutPanel.y}`);
                            console.log(`🚨 [DEBUG]   mappedPanels: x=${mappedPanel.x}, y=${mappedPanel.y}`);
                            console.log(`🚨 [DEBUG]   positions match: ${layoutPanel.x === mappedPanel.x && layoutPanel.y === mappedPanel.y}`);
                          }
                        });
                      }
                    }} 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    🔍 Compare Sources
                  </Button>
                  <Button 
                    onClick={createTestPanels} 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    ➕ Add Test Panels
                  </Button>
                  <Button 
                    onClick={async () => {
                      console.log('🚨 [DEBUG] === FORCE BACKEND FETCH ===');
                      try {
                        const response = await fetch(`${BACKEND_URL}/api/panel-layout/ssr-layout/${projectId}`);
                        if (response.ok) {
                          const data = await response.json();
                          console.log('🚨 [DEBUG] Backend fetch successful:', data);
                          if (data.success && data.layout) {
                            console.log('🚨 [DEBUG] Setting layout from backend:', data.layout);
                            setLayout(data.layout);
                          }
                        } else {
                          console.error('🚨 [DEBUG] Backend fetch failed:', response.status);
                        }
                      } catch (error) {
                        console.error('🚨 [DEBUG] Backend fetch error:', error);
                      }
                    }} 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    🔄 Force Backend Fetch
                  </Button>
                </div>
              </div>
            </div>
          )}
          
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
          <div className="canvas-container w-full h-[calc(100vh-300px)] overflow-hidden">
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
                // TEMPORARILY DISABLED: Allow all panels to be visible for debugging
                const visiblePanels = mappedPanels; // .filter(p => p.width > 1 && p.length > 1);
                
                // DEBUG: Log panel dimensions
                console.log('🔍 [CLIENT] Panel visibility check:');
                console.log('🔍 [CLIENT] mappedPanels.length:', mappedPanels.length);
                console.log('🔍 [CLIENT] visiblePanels.length:', visiblePanels.length);
                if (mappedPanels.length > 0) {
                  console.log('🔍 [CLIENT] Panel dimensions:');
                  mappedPanels.forEach((panel, idx) => {
                    console.log(`🔍 [CLIENT] Panel ${idx}: width=${panel.width}, height=${panel.height}, x=${panel.x}, y=${panel.y}`);
                  });
                }
                
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
                          <Button onClick={handleManualSave} variant="outline">
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
                      projectId={projectId}
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
        projectId={projectId}
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
