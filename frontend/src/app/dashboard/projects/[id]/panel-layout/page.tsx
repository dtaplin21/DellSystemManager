'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { fetchProjectById, fetchPanelLayout, updatePanelLayout } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import PanelGrid from '@/components/panel-layout/panel-grid';
import ControlToolbar from '@/components/panel-layout/control-toolbar';
import ExportDialog from '@/components/panel-layout/export-dialog';
import EditPanelDialog from '@/components/panel-layout/edit-panel-dialog';
import { generateId } from '@/lib/utils';

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
const DEFAULT_SCALE = 0.0025; // Halved from 0.005 to make panels take up half the space

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
  
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  // Mapping function to normalize panel fields - moved up so it can be used in useEffect
  function mapPanelFields(panel: any, index: number = 0) {
    console.log(`[MAP DEBUG] Mapping panel ${index}:`, panel);
    
    // Ensure we have proper numeric values for dimensions
    const width = Number(panel.width || panel.width_feet || 100);
    const height = Number(panel.height || panel.height_feet || 100);
    const x = Number(panel.x || 0);
    const y = Number(panel.y || 0);
    
    const mapped = {
      id: panel.id || panel.panel_id || `panel-${index}`,
      type: panel.type || 'rectangle',
      x: x,
      y: y,
      width: width,
      height: height,
      rotation: Number(panel.rotation || 0),
      fill: panel.fill || '#3b82f6',
      stroke: panel.stroke || '#1d4ed8',
      strokeWidth: Number(panel.strokeWidth || panel.stroke_width || 2),
      rollNumber: (panel.rollNumber || panel.roll_number) && (panel.rollNumber || panel.roll_number) !== 'N/A' ? (panel.rollNumber || panel.roll_number) : `R${String(index + 1).padStart(3, '0')}`,
      panelNumber: (panel.panelNumber || panel.panel_number) && (panel.panelNumber || panel.panel_number) !== 'N/A' ? (panel.panelNumber || panel.panel_number) : `P${String(index + 1).padStart(3, '0')}`,
      widthFeet: Number(panel.widthFeet || panel.width_feet || width),
      heightFeet: Number(panel.heightFeet || panel.height_feet || height),
    };
    
    console.log(`[MAP DEBUG] Mapped panel ${index}:`, mapped);
    return mapped;
  }

  const { isConnected, sendMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'PANEL_UPDATE' && message.data.projectId === id) {
        setLayout((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            panels: message.data.panels || prev.panels,
            lastUpdated: message.data.timestamp || new Date().toISOString()
          };
        });
      }
    },
    onConnect: () => {
      if (user?.id) {
        sendMessage('AUTH', { userId: user.id });
        sendMessage('JOIN_ROOM', { room: `panel_layout_${id}` });
      }
    }
  });

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      console.log('[DEBUG] Params resolved:', resolvedParams);
      setId(resolvedParams.id);
    };
    resolveParams();
  }, [params]);

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
  }, [id, toast, router]);

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

  const handlePanelUpdate = async (updatedPanels: any[]) => {
    console.log('[DEBUG] PanelUpdate: Updating layout with panels:', updatedPanels);
    setLayout((prev) => {
      if (!prev) return null;
      const newLayout = {
        ...prev,
        panels: updatedPanels,
        lastUpdated: new Date().toISOString()
      };
      console.log('[DEBUG] PanelUpdate: New layout state:', newLayout);
      return newLayout;
    });
    // Persist to backend
    try {
      console.log('[DEBUG] PanelUpdate: Saving panels to backend:', updatedPanels);
      console.log('[DEBUG] PanelUpdate: Project ID:', id);
      
      // Convert panels to the format expected by the backend
      const backendPanels = updatedPanels.map(panel => ({
        id: panel.id,
        type: panel.type || 'rectangle',
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.height,
        rotation: panel.rotation || 0,
        fill: panel.fill || '#3b82f6',
        stroke: panel.stroke || '#1d4ed8',
        stroke_width: panel.strokeWidth || 2,
        roll_number: panel.rollNumber || panel.roll_number,
        panel_number: panel.panelNumber || panel.panel_number,
        width_feet: panel.widthFeet || panel.width,
        height_feet: panel.heightFeet || panel.height
      }));
      
      console.log('[DEBUG] PanelUpdate: Converted panels for backend:', backendPanels);
      console.log('[DEBUG] PanelUpdate: Sending to updatePanelLayout with projectId:', id);
      const data = await updatePanelLayout(id, { panels: backendPanels });
      console.log('[DEBUG] PanelUpdate: Backend response:', data);
      console.log('[DEBUG] PanelUpdate: Backend response type:', typeof data);
      console.log('[DEBUG] PanelUpdate: Backend response panels:', data?.panels);
    } catch (error) {
      console.error('[DEBUG] PanelUpdate: Error saving panels to backend:', error);
    }
    if (isConnected) {
      sendMessage('PANEL_UPDATE', {
        projectId: id,
        panels: updatedPanels,
        userId: user?.id,
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleAddPanel = (panel: any) => {
    if (!layout) return;
    console.log('Adding new panel:', panel);
    const newPanels = [...layout.panels, panel];
    console.log('Updated panels array:', newPanels);
    handlePanelUpdate(newPanels);
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
    
    const testPanels = [
      {
        id: 'test-panel-1',
        type: 'rectangle',
        x: 50,
        y: 50,
        width: 100,
        height: 80,
        rotation: 0,
        fill: '#ff0000', // Bright red to make it very visible
        stroke: '#000000',
        strokeWidth: 3,
        rollNumber: 'R001',
        panelNumber: 'P001',
        widthFeet: 10,
        heightFeet: 7.5
      },
      {
        id: 'test-panel-2',
        type: 'rectangle',
        x: 200,
        y: 50,
        width: 120,
        height: 90,
        rotation: 0,
        fill: '#00ff00', // Bright green to make it very visible
        stroke: '#000000',
        strokeWidth: 3,
        rollNumber: 'R002',
        panelNumber: 'P002',
        widthFeet: 9,
        heightFeet: 6
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
        type: panel.type,
        x: panel.x,
        y: panel.y,
        width: panel.width_feet * PIXELS_PER_FOOT,
        height: panel.height_feet * PIXELS_PER_FOOT,
        rotation: panel.rotation || 0,
        fill: panel.fill || '#3b82f6',
        stroke: panel.stroke || '#1d4ed8',
        strokeWidth: panel.stroke_width || 2,
        rollNumber: panel.roll_number && panel.roll_number !== 'N/A' ? panel.roll_number : `R${String(index + 1).padStart(3, '0')}`,
        panelNumber: panel.panel_number && panel.panel_number !== 'N/A' ? panel.panel_number : `P${String(index + 1).padStart(3, '0')}`,
        widthFeet: panel.width_feet,
        heightFeet: panel.height_feet,
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

  const saveProjectToSupabase = async () => {
    console.log('SaveProjectToSupabase called!');
    console.log('project:', project);
    console.log('layout:', layout);
    console.log('user:', user);

    if (!project) {
      console.log('[DEBUG] Save: Project is missing');
      return;
    }
    if (!layout) {
      console.log('[DEBUG] Save: Layout is missing');
      return;
    }
    if (!user) {
      console.log('[DEBUG] Save: User is missing');
      return;
    }

    try {
      console.log(`[DEBUG] Save: Saving project ${project.id} (${project.name}) with panels:`, layout.panels);
      console.log('[DEBUG] Save: Layout state before save:', layout);
      // Convert panels back to Supabase format
      const supabasePanels = layout.panels.map(panel => ({
        project_id: project.id,
        type: panel.type,
        x: panel.x,
        y: panel.y,
        width_feet: panel.widthFeet,
        height_feet: panel.heightFeet,
        roll_number: panel.rollNumber,
        panel_number: panel.panelNumber,
        fill: panel.fill,
        stroke: panel.stroke,
        stroke_width: panel.strokeWidth,
        rotation: panel.rotation || 0
      }));
      console.log('[DEBUG] Save: Converted panels for backend:', supabasePanels);
      // Always send defaults if values are missing
      const width = typeof layout.width === 'number' ? layout.width : DEFAULT_LAYOUT_WIDTH;
      const height = typeof layout.height === 'number' ? layout.height : DEFAULT_LAYOUT_HEIGHT;
      const scale = typeof layout.scale === 'number' ? layout.scale : DEFAULT_SCALE;
      // Use the updatePanelLayout function from the API helper
      const result = await updatePanelLayout(project.id, {
        panels: supabasePanels,
        width,
        height,
        scale
      });
      console.log('[DEBUG] Save: Backend response from updatePanelLayout:', result);
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
              <span className="text-green-500 ml-2">● Connected</span>
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
          <Button variant="outline" onClick={saveProjectToSupabase}>
            Save Project
          </Button>
          <Button onClick={() => setExportDialogOpen(true)}>
            Export to CAD
          </Button>
        </div>
      </div>

      <Card className="w-full">
        <CardHeader>
          <ControlToolbar
            scale={layout.scale}
            onScaleChange={handleScaleChange}
            onAddPanel={handleAddPanel}
            selectedPanel={selectedPanel}
            onEditPanel={handleEditPanel}
            onProjectLoad={handleProjectLoad}
            currentProject={project}
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full h-[calc(100vh-300px)] overflow-hidden">
            <PanelGrid
              panels={(() => { 
                console.log('[DEBUG] Raw panels from layout:', layout.panels);
                console.log('[DEBUG] Layout scale:', layout.scale);
                console.log('[DEBUG] Layout dimensions:', { width: layout.width, height: layout.height });
                const mappedPanels = layout.panels.map(mapPanelFields);
                console.log('[DEBUG] Mapped panels for PanelGrid:', mappedPanels);
                return mappedPanels;
              })()}
              width={window.innerWidth - 64}
              height={window.innerHeight - 300}
              scale={layout.scale}
              onPanelUpdate={handlePanelUpdate}
              selectedPanel={selectedPanel}
              onEditPanel={handlePanelSelect}
            />
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
