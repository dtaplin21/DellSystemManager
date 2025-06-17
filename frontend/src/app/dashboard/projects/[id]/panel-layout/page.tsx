'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { fetchProjectById, fetchPanelLayout } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import PanelGrid from '@/components/panel-layout/panel-grid';
import ControlToolbar from '@/components/panel-layout/control-toolbar';
import ExportDialog from '@/components/panel-layout/export-dialog';
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
  createdAt: string;
  updatedAt: string;
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

export default function PanelLayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const [project, setProject] = useState<Project | null>(null);
  const [layout, setLayout] = useState<PanelLayout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [id, setId] = useState<string>('');
  
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
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
      setId(resolvedParams.id);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!id) return;

    const loadProjectAndLayout = async () => {
      try {
        setIsLoading(true);
        
        const projectData = await fetchProjectById(id);
        setProject(projectData);
        
        const layoutData = await fetchPanelLayout(id);
        
        if (!layoutData || layoutData.width < DEFAULT_LAYOUT_WIDTH || layoutData.height < DEFAULT_LAYOUT_HEIGHT) {
          setLayout({
            ...layoutData,
            width: DEFAULT_LAYOUT_WIDTH,
            height: DEFAULT_LAYOUT_HEIGHT,
            scale: DEFAULT_SCALE,
            panels: layoutData?.panels || []
          });
        } else {
          setLayout(layoutData);
        }
      } catch (error) {
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

  const handlePanelUpdate = (updatedPanels: any[]) => {
    setLayout((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        panels: updatedPanels,
        lastUpdated: new Date().toISOString()
      };
    });
    
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
    const newPanels = [...layout.panels, panel];
    handlePanelUpdate(newPanels);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!project || !layout) {
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

  return (
    <div className="w-full max-w-full overflow-x-hidden px-4">
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
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full h-[calc(100vh-300px)] overflow-hidden">
            <PanelGrid
              panels={layout.panels}
              width={window.innerWidth - 64}
              height={window.innerHeight - 300}
              scale={layout.scale}
              onPanelUpdate={handlePanelUpdate}
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
    </div>
  );
}
