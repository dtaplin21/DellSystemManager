'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PanelGrid from '@/components/panel-layout/panel-grid';
import ControlToolbar from '@/components/panel-layout/control-toolbar';
import ExportDialog from '@/components/panel-layout/export-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useWebSocket } from '@/hooks/use-websocket';
import { fetchProjectById, fetchPanelLayout } from '@/lib/api';

interface Project {
  id: string;
  name: string;
  subscription: string;
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

export default function PanelLayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const [project, setProject] = useState<Project | null>(null);
  const [layout, setLayout] = useState<PanelLayout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [id, setId] = useState<string>('');
  
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { socket, isConnected } = useWebSocket();

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!id) return; // Don't run until id is resolved

    const loadProjectAndLayout = async () => {
      try {
        setIsLoading(true);
        
        // Load project details
        const projectData = await fetchProjectById(id);
        setProject(projectData);
        
        // Check subscription for 2D automation access
        if (projectData.subscription !== 'premium') {
          toast({
            title: 'Subscription Required',
            description: 'Panel layout features require the premium subscription ($315/month).',
            variant: 'destructive',
          });
          router.push(`/dashboard/projects/${id}`);
          return;
        }
        
        // Load panel layout
        const layoutData = await fetchPanelLayout(id);
        setLayout(layoutData);
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

  useEffect(() => {
    if (socket && isConnected) {
      // Listen for panel layout updates from other users
      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PANEL_UPDATE' && data.projectId === id) {
            // Update layout with changes from other users
            setLayout((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                panels: data.panels || prev.panels,
                lastUpdated: data.timestamp || new Date().toISOString()
              };
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      // Join the panel layout room
      socket.send(JSON.stringify({
        type: 'JOIN_ROOM',
        room: `panel_layout_${id}`,
        userId: user?.id
      }));

      // Cleanup
      return () => {
        socket.send(JSON.stringify({
          type: 'LEAVE_ROOM',
          room: `panel_layout_${id}`,
          userId: user?.id
        }));
      };
    }
  }, [socket, isConnected, id, user]);

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

  const handlePanelUpdate = (updatedPanels: any[]) => {
    // Update local state
    setLayout({
      ...layout,
      panels: updatedPanels,
      lastUpdated: new Date().toISOString()
    });
    
    // Send update to server and other users via WebSocket
    if (socket && isConnected) {
      socket.send(JSON.stringify({
        type: 'PANEL_UPDATE',
        projectId: id,
        panels: updatedPanels,
        userId: user?.id,
        timestamp: new Date().toISOString()
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Panel Layout: {project.name}</h1>
          <p className="text-gray-500">
            Last updated: {new Date(layout.lastUpdated).toLocaleString()}
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

      <Card>
        <CardHeader>
          <ControlToolbar 
            scale={layout.scale}
            onScaleChange={(newScale) => setLayout({...layout, scale: newScale})}
          />
        </CardHeader>
        <CardContent>
          <PanelGrid 
            panels={layout.panels}
            width={layout.width}
            height={layout.height}
            scale={layout.scale}
            onPanelUpdate={handlePanelUpdate}
          />
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
