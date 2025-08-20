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
const PIXELS_PER_FOOT = 200; // 100 pixels = 0.5ft, so 200 pixels = 1ft
const DEFAULT_SCALE = 1.0; // Reasonable default scale - 1.0 means 1 unit = 1 pixel (no scaling)

const BACKEND_URL = 'http://localhost:8003';

export default function PanelLayoutPage({ params }: { params: Promise<{ id: string }> }) {
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
  
  // Debounce timer ref
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const layoutRef = useRef<PanelLayout | null>(null);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Monitor id changes
  useEffect(() => {
    console.log('[DEBUG] id state changed to:', id);
  }, [id]);

  // Save function now takes layout and project as arguments
  const saveProjectToSupabase = async (currentLayout: PanelLayout, project: Project) => {
    console.log('[DIAG] Saving panels:', currentLayout?.panels);
    console.log('SaveProjectToSupabase called!');
    console.log('project:', project);
    console.log('layout:', currentLayout);
    console.log('user:', user);

    try {
      // Convert panels back to Supabase format, DO NOT divide by PIXELS_PER_FOOT
      const supabasePanels = currentLayout.panels.map(panel => ({
        project_id: project.id,
        type: panel.type,
        x: panel.x, // already in feet
        y: panel.y, // already in feet
        width_feet: panel.widthFeet || panel.width, // already in feet
        height_feet: panel.heightFeet || panel.height, // already in feet
        roll_number: panel.rollNumber,
        panel_number: panel.panelNumber,
        fill: panel.fill,
        stroke: panel.stroke,
        stroke_width: panel.strokeWidth,
        rotation: panel.rotation || 0
      }));
      const width = typeof currentLayout.width === 'number' ? currentLayout.width : DEFAULT_LAYOUT_WIDTH;
      const height = typeof currentLayout.height === 'number' ? currentLayout.height : DEFAULT_LAYOUT_HEIGHT;
      const scale = typeof currentLayout.scale === 'number' ? currentLayout.scale : DEFAULT_SCALE;
      const requestBody = { panels: supabasePanels, width, height, scale };
      console.log('[DIAG] Request body to backend:', JSON.stringify(requestBody, null, 2));
      // Use the updatePanelLayout function from the API helper
      const result = await updatePanelLayout(project.id, requestBody);
      console.log('[DIAG] Backend response from updatePanelLayout:', JSON.stringify(result, null, 2));
      toast({
        title: 'Project Saved',
        description: 'Project data saved successfully.',
      });
    } catch (error) {
      console.error('[DEBUG] Save: Error saving project:', error);
      toast({
        title: 'Error',
        description: `Failed to save project data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };



  // Mapping function to normalize panel fields - moved up so it can be used in useEffect
  function mapPanelFields(panel: any, index: number = 0) {
    console.log(`[MAP DEBUG] Mapping panel ${index}:`, panel);
    // Ensure we have proper numeric values for dimensions
    const width = Number(panel.width || 100);
    const length = Number(panel.length || 100);
    const x = Number(panel.x || 0);
    const y = Number(panel.y || 0);
    
    // Don't apply scaling here - let the canvas handle all transformations
    // This prevents double scaling issues between mapPanelFields and canvas rendering
    console.log(`[MAP DEBUG] No scaling applied - Original: x=${x}, y=${y}, w=${width}, l=${length}`);
    
    const mapped = {
      id: panel.id || `panel-${index}`,
      shape: panel.shape || 'rectangle',
      x: x, // Use original coordinates
      y: y, // Use original coordinates
      width: width, // Use original dimensions
      height: length, // Map length to height for Panel type compatibility
      length: length, // Keep length for backward compatibility
      rotation: Number(panel.rotation || 0),
      fill: panel.fill || '#3b82f6',
      color: panel.color || panel.fill || '#3b82f6',
      rollNumber: panel.rollNumber || '',
      panelNumber: panel.panelNumber || '',
      date: panel.date || '',
      location: panel.location || '',
      meta: {
        repairs: [],
        location: { x: x, y: y, gridCell: { row: 0, col: 0 } }
      }
    };
    console.log(`[MAP DEBUG] Mapped panel ${index}:`, mapped);
    return mapped;
  }

  // Load project and layout data
  const loadProjectAndLayout = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[DEBUG] Load: Loading project with ID:', id);
      const projectData = await fetchProjectById(id);
      console.log('[DEBUG] Load: Project data received:', projectData);
      console.log('🔍 [DEBUG] Project name:', projectData?.name);
      console.log('🔍 [DEBUG] Project object keys:', projectData ? Object.keys(projectData) : 'No project data');
      
      setProject(projectData);
      
      const layoutData = await fetchPanelLayout(id);
      console.log('[DEBUG] Load: Layout data received from backend:', layoutData);
      console.log('[DEBUG] Load: Raw panels from backend:', layoutData?.panels);
      console.log('[DEBUG] Load: Layout data type:', typeof layoutData);
      console.log('[DEBUG] Load: Panels array type:', Array.isArray(layoutData?.panels));
      console.log('[DEBUG] Load: Layout data keys:', layoutData ? Object.keys(layoutData) : 'No data');
      console.log('[DEBUG] Load: Layout data full object:', JSON.stringify(layoutData, null, 2));
      
      // Process panels properly
      let processedPanels: any[] = [];
      if (layoutData && Array.isArray(layoutData.panels)) {
        console.log('[DEBUG] Load: Processing', layoutData.panels.length, 'panels');
        processedPanels = layoutData.panels.map((panel: any, idx: number) => {
          console.log(`[DEBUG] Processing panel ${idx}:`, panel);
          return mapPanelFields(panel, idx);
        });
      } else {
        console.warn('[DEBUG] No panels array found in backend response:', layoutData);
        console.warn('[DEBUG] Layout data keys:', layoutData ? Object.keys(layoutData) : 'No data');
      }
      
      console.log('[DEBUG] Load: Processed panels:', processedPanels);
      
      if (!layoutData || layoutData.width < DEFAULT_LAYOUT_WIDTH || layoutData.height < DEFAULT_LAYOUT_HEIGHT) {
        console.log('🔍 [DEBUG] Using default layout dimensions');
        setLayout({
          ...layoutData,
          width: DEFAULT_LAYOUT_WIDTH,
          height: DEFAULT_LAYOUT_HEIGHT,
          scale: DEFAULT_SCALE,
          panels: processedPanels
        });
      } else {
        console.log('🔍 [DEBUG] Using existing layout data');
        setLayout({
          ...layoutData,
          panels: processedPanels
        });
      }
    } catch (error) {
      console.error('🔍 [DEBUG] Error loading project and layout:', error);
      toast({
        title: 'Error',
        description: 'Failed to load panel layout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]); // Only depend on id and toast, not on the function itself

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
    if (!layout?.panels || !Array.isArray(layout.panels)) {
      return [];
    }
    
    try {
      const mapped = layout.panels.map((panel: any, idx: number) => {
        return mapPanelFields(panel, idx);
      });
      
      // Create a stable reference for comparison
      const mappedString = JSON.stringify(mapped);
      
      // Only return new array if there's a real change
      if (lastMappedPanelsRef.current !== mappedString) {
        lastMappedPanelsRef.current = mappedString;
        return mapped;
      } else {
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

  // Panel update handler
  const handlePanelUpdate = useCallback((updatedPanels: Panel[]) => {
    setLayout(prev => {
      if (!prev) return prev;
      
      // Check if panels actually changed to prevent unnecessary updates
      const currentPanelsString = JSON.stringify(prev.panels);
      const updatedPanelsString = JSON.stringify(updatedPanels);
      
      if (currentPanelsString === updatedPanelsString) {
        return prev; // No change, return same reference
      }
      
      return {
        ...prev,
        panels: updatedPanels
      };
    });
  }, []); // No dependencies needed since we use functional update

  // Add panel handler
  const handleAddPanel = useCallback((newPanel: Panel) => {
    setLayout(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        panels: [...prev.panels, newPanel]
      };
    });
  }, []); // No dependencies needed since we use functional update

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
      toast({
        title: 'Error',
        description: 'Failed to load project data.',
        variant: 'destructive',
      });
    }
  }, [toast]);

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
      toast({
        title: 'Success',
        description: 'Panel layout saved successfully.',
      });
    } catch (error) {
      console.error('[DEBUG] Manual save failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to save panel layout.',
        variant: 'destructive',
      });
    }
  }, [layout, project, toast]);

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
            
            toast({
              title: 'AI Layout Ready',
              description: `Found ${actions.length} AI-generated panel actions. Click "Execute AI Layout" to apply them.`,
            });
          } catch (error) {
            console.error('Error parsing AI actions:', error);
            toast({
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

  useEffect(() => {
    console.log('[DEBUG] Load: useEffect triggered, id:', id);
    if (!id) {
      console.log('[DEBUG] Load: No id yet, skipping loadProjectAndLayout');
      return;
    }
    console.log('[DEBUG] Load: Calling loadProjectAndLayout with id:', id);
    // Call the function directly instead of depending on it to avoid circular dependency
    const loadData = async () => {
      try {
        setIsLoading(true);
        console.log('[DEBUG] Load: Loading project with ID:', id);
        const projectData = await fetchProjectById(id);
        console.log('[DEBUG] Load: Project data received:', projectData);
        console.log('🔍 [DEBUG] Project name:', projectData?.name);
        console.log('🔍 [DEBUG] Project object keys:', projectData ? Object.keys(projectData) : 'No project data');
        
        setProject(projectData);
        
        const layoutData = await fetchPanelLayout(id);
        console.log('[DEBUG] Load: Layout data received from backend:', layoutData);
        console.log('[DEBUG] Load: Raw panels from backend:', layoutData?.panels);
        console.log('[DEBUG] Load: Layout data type:', typeof layoutData);
        console.log('[DEBUG] Load: Panels array type:', Array.isArray(layoutData?.panels));
        console.log('[DEBUG] Load: Layout data keys:', layoutData ? Object.keys(layoutData) : 'No data');
        console.log('[DEBUG] Load: Layout data full object:', JSON.stringify(layoutData, null, 2));
        
        // Process panels properly
        let processedPanels: any[] = [];
        if (layoutData && Array.isArray(layoutData.panels)) {
          console.log('[DEBUG] Load: Processing', layoutData.panels.length, 'panels');
          processedPanels = layoutData.panels.map((panel: any, idx: number) => {
            console.log(`[DEBUG] Processing panel ${idx}:`, panel);
            return mapPanelFields(panel, idx);
          });
        } else {
          console.warn('[DEBUG] No panels array found in backend response:', layoutData);
          console.warn('[DEBUG] Layout data keys:', layoutData ? Object.keys(layoutData) : 'No data');
          console.warn('[DEBUG] Panels value:', layoutData?.panels);
          console.warn('[DEBUG] Panels type:', typeof layoutData?.panels);
          console.warn('[DEBUG] Is panels array?', Array.isArray(layoutData?.panels));
        }
        
        console.log('[DEBUG] Load: Processed panels:', processedPanels);
        
        if (!layoutData || layoutData.width < DEFAULT_LAYOUT_WIDTH || layoutData.height < DEFAULT_LAYOUT_HEIGHT) {
          console.log('🔍 [DEBUG] Using default layout dimensions');
          setLayout({
            ...layoutData,
            width: DEFAULT_LAYOUT_WIDTH,
            height: DEFAULT_LAYOUT_HEIGHT,
            scale: DEFAULT_SCALE,
            panels: processedPanels
          });
        } else {
          console.log('🔍 [DEBUG] Using existing layout data');
          setLayout({
            ...layoutData,
            panels: processedPanels
          });
        }
      } catch (error) {
        console.error('🔍 [DEBUG] Error loading project and layout:', error);
        toast({
          title: 'Error',
          description: 'Failed to load panel layout. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [id, toast]); // Only depend on id and toast, not on the function itself

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
          
          toast({
            title: 'AI Layout Complete',
            description: `Successfully executed ${successCount}/${totalCount} actions.`,
          });
          
          // Refresh the layout to show new panels by reloading the page
          // This ensures we get the latest data from the backend
          window.location.reload();
        },
        onError: (error) => {
          toast({
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
      toast({
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  console.log('🔍 [DEBUG] Render state - project:', project);
  console.log('🔍 [DEBUG] Render state - layout:', layout);
  console.log('🔍 [DEBUG] Render state - project name:', project?.name);
  console.log('🔍 [DEBUG] Render state - project type:', typeof project?.name);

  if (!project || !layout) {
    console.log('🔍 [DEBUG] Missing project or layout - project:', !!project, 'layout:', !!layout);
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2">Panel Layout Not Found</h2>
        <p className="text-gray-500 mb-4">
          The panel layout you're looking for does not exist or you don't have access to it.
        </p>
        <Button onClick={() => router.push(`/dashboard/projects/${id}`)}>
          Back to Project
        </Button>
      </div>
    );
  }

  console.log('[DEBUG] Render: project:', project);
  console.log('[DEBUG] Render: layout:', layout);
  console.log('[DEBUG] Render: layout.panels:', layout?.panels);

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
            <div className="mt-2 space-x-2">
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
                    await updatePanelLayout(id, { panels: [] });
                    // Clear in frontend
                    setLayout(prev => prev ? { ...prev, panels: [] } : null);
                    console.log('[DEBUG] Cleared layout panels in backend and frontend');
                    toast({
                      title: 'Success',
                      description: 'All panels cleared successfully',
                      variant: 'default',
                    });
                  } catch (error) {
                    console.error('[DEBUG] Error clearing panels:', error);
                    toast({
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
