'use client';
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PanelLayoutRefactored } from '@/components/panels/PanelLayoutRefactored';
import PanelAIChat from '@/components/panels/PanelAIChat';
import { useProjects } from '@/contexts/ProjectsProvider';
import NoProjectSelected from '@/components/ui/no-project-selected';
import { usePanelData } from '@/hooks/usePanelData';
import type { Panel } from '@/types/panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PanelWorkspaceProps {
  projectId: string;
  project: {
    id: string;
    name: string;
    location?: string;
    description?: string;
    status?: string;
  };
}

function PanelWorkspace({ projectId, project }: PanelWorkspaceProps) {
  const {
    panels: backendPanels,
    isLoading,
    error,
    refreshData
  } = usePanelData({ projectId });

  const [panels, setPanels] = useState<Panel[]>([]);

  useEffect(() => {
    setPanels(backendPanels);
  }, [backendPanels]);

  const projectInfo = useMemo(() => ({
    projectName: project.name,
    location: project.location,
    description: project.description
  }), [project]);

  const handlePanelsUpdated = useCallback(async (updatedPanels: Panel[]) => {
    setPanels(updatedPanels);
    try {
      await refreshData();
    } catch (refreshError) {
      console.warn('Failed to refresh panel data after AI update:', refreshError);
    }
  }, [refreshData]);

  return (
    <div className="space-y-6">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold text-navy-600">AI Panel Workspace</h1>
        <p className="text-muted-foreground">
          Manage your panel layout with natural language instructions and see updates reflected in real time.
        </p>
      </div>

      <div className="rounded-lg border bg-card px-6 py-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Project</div>
            <div className="font-medium">{project.name}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Location</div>
            <div className="font-medium">{project.location || 'Not specified'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Status</div>
            <div className="font-medium">{project.status || 'Not specified'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Panels</div>
            <div className="font-medium">{panels.length}</div>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Panel data error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <div className="h-[560px] rounded-lg border bg-card p-2">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Loading panel layout…
            </div>
          ) : (
            <div className="h-full rounded-md bg-muted/40">
              <PanelLayoutRefactored
                panels={panels}
                projectId={projectId}
                featureFlags={{
                  ENABLE_PERSISTENCE: true,
                  ENABLE_DRAGGING: true,
                  ENABLE_LOCAL_STORAGE: true,
                  ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development',
                  ENABLE_WEBSOCKET_UPDATES: false,
                }}
              />
            </div>
          )}
        </div>

        <div className="h-[560px] rounded-lg border bg-card p-4 flex flex-col">
          <PanelAIChat
            projectId={projectId}
            projectInfo={projectInfo}
            panels={panels}
            onPanelsUpdated={handlePanelsUpdated}
          />
        </div>
      </div>
    </div>
  );
}

export default function PanelsPage() {
  const { selectedProjectId, selectedProject } = useProjects();

  if (!selectedProjectId || !selectedProject) {
    return (
      <div className="container mx-auto px-4 py-8">
        <NoProjectSelected message="Select a project to access the AI panel workspace." />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PanelWorkspace projectId={selectedProjectId} project={selectedProject} />
    </div>
  );
}
