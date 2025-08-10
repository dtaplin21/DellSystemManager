'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { fetchProjectById, fetchPanelLayout, updatePanelLayout } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
const DEFAULT_SCALE = 1.0; // More intuitive default scale

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

  // Handler for Save Project button
  const handleManualSave = () => {
    if (!layout || !project || !user) return;
    saveProjectToSupabase(layout, project);
  };

  // Mapping function to normalize panel fields - moved up so it can be used in useEffect
  function mapPanelFields(panel: any, index: number = 0) {
    console.log(`[MAP DEBUG] Mapping panel ${index}:`, panel);
    // Ensure we have proper numeric values for dimensions
    const width = Number(panel.width || 100);
    const length = Number(panel.length || 100);
    const x = Number(panel.x || 0);
    const y = Number(panel.y || 0);
    const mapped = {
      id: panel.id || `panel-${index}`,
      shape: panel.shape || 'rectangle',
      x: x,
      y: y,
      width: width,
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
        location: { x, y, gridCell: { row: 0, col: 0 } }
      }
    };
    console.log(`[MAP DEBUG] Mapped panel ${index}:`, mapped);
    return mapped;
  }

  const { isConnected, isAuthenticated, sendMessage } = useWebSocket({
    userId: user?.id || null,
    onMessage: (message: any) => {
      // Support both formats: message.data.projectId and message.projectId
      const projectId = message.data?.projectId ?? message.projectId;
      if (message.type === 'PANEL_UPDATE' && projectId === id) {
        setLayout((prev) => {
          if (!prev) return null;
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
    if (!id) return;
    const loadProjectAndLayout = async () => {
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
    };

    loadProjectAndLayout();
  }, [id]); // Only depend on id, not toast or router

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
          
          // Refresh the layout to show new panels
          if (layout) {
            // Reload the project and layout data
            const loadProjectAndLayout = async () => {
              try {
                const projectData = await fetchProjectById(id);
                setProject(projectData);
                
                const layoutData = await fetchPanelLayout(id);
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
                console.error('Error reloading layout:', error);
              }
            };
            loadProjectAndLayout();
          }
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
    if (layout) {
      console.log('[DIAG] Layout loaded from backend:', layout);
      console.log('[DIAG] Panels loaded from backend:', layout.panels);
    }
  }, [layout]);

  const handleScaleChange = (newScale: number) => {
    console.log('Scale change in parent:', newScale);
    setLayout(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scale: newScale
      };
    });
  };

  const handlePositionChange = (newPosition: { x: number; y: number }) => {
    console.log('Position change in parent:', newPosition);
    setPosition(newPosition);
  };

  const handleZoomToFit = () => {
    if (!layout || !layout.panels.length) return;
    
    // Calculate bounds of all panels
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    layout.panels.forEach(panel => {
      minX = Math.min(minX, panel.x);
      minY = Math.min(minY, panel.y);
      maxX = Math.max(maxX, panel.x + panel.width);
      maxY = Math.max(maxY, panel.y + panel.length);
    });
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const containerWidth = window.innerWidth - 64;
    const containerHeight = window.innerHeight - 300;
    
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const fitScale = Math.max(0.1, Math.min(3.0, Math.min(scaleX, scaleY) * 0.9));
    
    setLayout(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scale: fitScale
      };
    });
    
    setPosition({
      x: (containerWidth - contentWidth * fitScale) / 2 - minX * fitScale,
      y: (containerHeight - contentHeight * fitScale) / 2 - minY * fitScale,
    });
  };

  const handleResetView = () => {
    setLayout(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scale: DEFAULT_SCALE
      };
    });
    setPosition({ x: 0, y: 0 });
  };

  const handlePanelUpdate = async (updatedPanels: Panel[]) => {
    console.log('🔍 [PanelLayoutPage] handlePanelUpdate called with panels:', updatedPanels);
    console.log('🔍 [PanelLayoutPage] Updated panels count:', updatedPanels.length);
    console.log('🔍 [PanelLayoutPage] First panel example:', updatedPanels[0]);
    
    console.log('🔍 [PanelLayoutPage] Updating local state...');
    setLayout((prev) => {
      if (!prev) {
        console.log('❌ [PanelLayoutPage] No previous layout, cannot update');
        return null;
      }
      const newLayout = {
        ...prev,
        panels: updatedPanels,
        lastUpdated: new Date().toISOString()
      };
      console.log('🔍 [PanelLayoutPage] New layout state created:', newLayout);
      console.log('🔍 [PanelLayoutPage] New layout panels count:', newLayout.panels.length);
      return newLayout;
    });
    
    console.log('🔍 [PanelLayoutPage] Local state updated, now persisting to backend...');
    
    // Persist to backend
    try {
      console.log('🔍 [PanelLayoutPage] Converting panels for backend...');
      console.log('🔍 [PanelLayoutPage] Project ID:', id);
      
      // Convert panels to the format expected by the backend
      const backendPanels = updatedPanels.map(panel => ({
        id: panel.id,
        type: panel.shape || 'rectangle',
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.length,
        rotation: panel.rotation || 0,
        fill: panel.fill || '#3b82f6',
        color: panel.color || panel.fill || '#3b82f6',
        roll_number: panel.rollNumber,
        panel_number: panel.panelNumber,
        date: panel.date || '',
        location: panel.location || '',
      }));
      
      console.log('🔍 [PanelLayoutPage] Converted panels for backend:', backendPanels);
      console.log('🔍 [PanelLayoutPage] Sending to updatePanelLayout with projectId:', id);
      
      const data = await updatePanelLayout(id, { panels: backendPanels });
      
      console.log('🔍 [PanelLayoutPage] Backend response received:', data);
      console.log('🔍 [PanelLayoutPage] Backend response type:', typeof data);
      console.log('🔍 [PanelLayoutPage] Backend response panels:', data?.panels);
      console.log('🔍 [PanelLayoutPage] Backend response panels count:', data?.panels?.length);
      
    } catch (error) {
      console.error('❌ [PanelLayoutPage] Error saving panels to backend:', error);
    }
    
    console.log('🔍 [PanelLayoutPage] Sending WebSocket update...');
    if (isConnected) {
      sendMessage('PANEL_UPDATE', {
        projectId: id,
        panels: updatedPanels,
        userId: user?.id,
        timestamp: new Date().toISOString()
      });
      console.log('🔍 [PanelLayoutPage] WebSocket message sent');
    } else {
      console.log('🔍 [PanelLayoutPage] WebSocket not connected, skipping message');
    }
    
    console.log('🔍 [PanelLayoutPage] handlePanelUpdate completed successfully');
  };

  const handleAddPanel = (panel: Panel) => {
    console.log('🔍 [PanelLayoutPage] handleAddPanel called with panel:', panel);
    console.log('🔍 [PanelLayoutPage] Current layout:', layout);
    console.log('🔍 [PanelLayoutPage] Layout panels count:', layout?.panels?.length);
    
    if (!layout) {
      console.log('❌ [PanelLayoutPage] No layout available, returning early');
      return;
    }
    
    // Normalize the panel data using mapPanelFields to ensure consistency
    const normalizedPanel = mapPanelFields(panel, layout.panels.length);
    console.log('🔍 [PanelLayoutPage] Normalized panel:', normalizedPanel);
    
    console.log('🔍 [PanelLayoutPage] Adding new panel to existing panels');
    const newPanels = [...layout.panels, normalizedPanel];
    console.log('🔍 [PanelLayoutPage] Updated panels array:', newPanels);
    console.log('🔍 [PanelLayoutPage] New panels count:', newPanels.length);
    
    console.log('🔍 [PanelLayoutPage] Calling handlePanelUpdate with new panels');
    handlePanelUpdate(newPanels);
    console.log('🔍 [PanelLayoutPage] handlePanelUpdate called successfully');
  };

  // Add a test function to create sample panels
  const createTestPanels = () => {
    if (!layout) return;
    console.log('Creating test panels...');
    
    // First, reset scale to a reasonable value
    const newScale = 1.0; // Full scale to make panels clearly visible
    setLayout(prev => {
      if (!prev) return null;
      return { ...prev, scale: newScale };
    });
    
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
    handlePanelUpdate(testPanels);
  };

  const handleEditPanel = (panel: any) => {
    console.log('Edit panel requested:', panel);
    setSelectedPanel(panel);
    setEditDialogOpen(true);
  };

  const handlePanelSelect = (panel: any) => {
    console.log('Panel selected:', panel);
    setSelectedPanel(panel);
  };

  const handleSavePanel = (updatedPanel: any) => {
    console.log('Saving updated panel:', updatedPanel);
    if (!layout) return;
    
    const updatedPanels = layout.panels.map(panel => 
      panel.id === updatedPanel.id ? updatedPanel : panel
    );
    
    handlePanelUpdate(updatedPanels);
    setSelectedPanel(updatedPanel);
  };

  const handleDeletePanel = (panelId: string) => {
    console.log('Deleting panel:', panelId);
    if (!layout) return;
    
    const updatedPanels = layout.panels.filter(panel => panel.id !== panelId);
    handlePanelUpdate(updatedPanels);
    setSelectedPanel(null);
  };

  const handleProjectLoad = async (projectData: any) => {
    try {
      setIsLoading(true);
      
      console.log('🔍 [DEBUG] handleProjectLoad called with:', projectData);
      console.log('🔍 [DEBUG] New project name:', projectData?.name);
      console.log('🔍 [DEBUG] New project object keys:', projectData ? Object.keys(projectData) : 'No project data');
      
      // Update the project state
      setProject(projectData);
      
      // Convert Supabase panel format to our internal format
      const convertedPanels = (projectData.panels || []).map((panel: any, index: number) => ({
        id: panel.id,
        shape: panel.shape || 'rectangle',
        x: panel.x,
        y: panel.y,
        width: panel.width,
        length: panel.length,
        rotation: panel.rotation || 0,
        fill: panel.fill || '#3b82f6',
        color: panel.color || panel.fill || '#3b82f6',
        rollNumber: panel.rollNumber || '',
        panelNumber: panel.panelNumber || '',
        date: panel.date || '',
        location: panel.location || '',
      }));

      // Create or update layout
      const newLayout: PanelLayout = {
        id: projectData.id,
        projectId: projectData.id,
        panels: convertedPanels,
        width: projectData.layoutWidth || DEFAULT_LAYOUT_WIDTH,
        height: projectData.layoutHeight || DEFAULT_LAYOUT_HEIGHT,
        scale: projectData.scale || DEFAULT_SCALE,
        lastUpdated: new Date().toISOString()
      };

      console.log('🔍 [DEBUG] Setting new layout:', newLayout);
      setLayout(newLayout);
      
      // Update the URL to reflect the new project
      router.push(`/dashboard/projects/${projectData.id}/panel-layout`);
      
      toast({
        title: 'Project Loaded',
        description: `Successfully loaded project: ${projectData.name}`,
      });
    } catch (error) {
      console.error('🔍 [DEBUG] Error in handleProjectLoad:', error);
      toast({
        title: 'Error',
        description: 'Failed to load project data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Diagnostic: Log layout state changes
  useEffect(() => {
    console.log('[DIAG] layout changed:', layout);
  }, [layout]);

  // Diagnostic: Log project state changes
  useEffect(() => {
    console.log('[DIAG] project changed:', project);
  }, [project]);

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
    <div className="w-full max-w-full overflow-x-hidden px-4">
      {(() => {
        console.log('🔍 [DEBUG] About to render title with project.name:', project.name);
        return null;
      })()}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Panel Layout: {project.name}</h1>
          <p className="text-gray-500">
            Last updated: {layout.lastUpdated ? new Date(layout.lastUpdated).toLocaleString() : 'Never'}
            {isConnected ? (
              <span className="text-green-500 ml-2">● Connected{isAuthenticated ? ' & Authenticated' : ' (Auth Pending)'}</span>
            ) : (
              <span className="text-red-500 ml-2">● Disconnected</span>
            )}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/projects/${id}`)}>
            Back to Project
          </Button>
          <Button variant="outline" onClick={() => {
            console.log('Current user:', user);
            console.log('Auth token exists:', !!localStorage.getItem('authToken'));
            console.log('User data exists:', !!localStorage.getItem('userData'));
            toast({
              title: 'Auth Status',
              description: user ? `Logged in as ${user.email}` : 'Not logged in',
            });
          }}>
            Test Auth
          </Button>
          <Button variant="outline" onClick={createTestPanels}>
            Add Test Panels
          </Button>
          <Button variant="outline" onClick={() => {
            console.log('=== CURRENT LAYOUT STATE ===');
            console.log('Layout:', layout);
            console.log('Layout panels:', layout?.panels);
            console.log('Layout scale:', layout?.scale);
            console.log('Layout dimensions:', { width: layout?.width, height: layout?.height });
            toast({
              title: 'Layout State',
              description: `Scale: ${layout?.scale}, Panels: ${layout?.panels?.length || 0}`,
            });
          }}>
            Debug Layout
          </Button>
          <Button onClick={() => setExportDialogOpen(true)}>
            Export to CAD
          </Button>
          <Button variant="outline" onClick={handleManualSave}>
            Save Project
          </Button>
          {aiActions.length > 0 && !showAIExecutionOverlay && (
            <Button 
              onClick={() => setShowAIExecutionOverlay(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              Execute AI Layout ({aiActions.length} actions)
            </Button>
          )}
          <Button 
            onClick={() => {
              // Phase 3: Advanced AI Layout Generation
              toast({
                title: 'Phase 3: Advanced AI Layout',
                description: 'Opening Phase 3 advanced layout generation...',
              });
              // TODO: Implement Phase 3 layout generation
            }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
          >
            Phase 3: Advanced AI Layout
          </Button>
        </div>
      </div>

      {/* AI Layout Execution UI */}
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
                console.log('[DEBUG] Raw panels from layout:', layout.panels);
                console.log('[DEBUG] Layout scale:', layout.scale);
                console.log('[DEBUG] Layout dimensions:', { width: layout.width, height: layout.height });
                const mappedPanels = layout.panels.map(mapPanelFields);
                console.log('[DEBUG] Mapped panels for PanelGrid:', mappedPanels);
                console.log('[DEBUG] Panel dimensions sample:', mappedPanels.slice(0, 3).map(p => ({
                  id: p.id,
                  x: p.x,
                  y: p.y,
                  width: p.width,
                  length: p.length,
                  visible: p.width > 1 && p.length > 1
                })));
                
                // Check if any panels are visible (larger than 1 unit)
                const visiblePanels = mappedPanels.filter(p => p.width > 1 && p.length > 1);
                console.log('[DEBUG] Visible panels count:', visiblePanels.length, 'out of', mappedPanels.length);
                
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
                      projectInfo={{
                        projectName: project.name,
                        location: project.location || '',
                        description: project.description || '',
                        manager: '',
                        material: ''
                      }}
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
