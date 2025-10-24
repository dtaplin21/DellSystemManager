'use client';
export const dynamic = "force-dynamic";

import PanelAIChat from '@/components/panels/PanelAIChat';
import { useProjects } from '@/contexts/ProjectsProvider';
import NoProjectSelected from '@/components/ui/no-project-selected';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';

export default function PanelsPage() {
  const { selectedProjectId, selectedProject } = useProjects();
  const { user } = useSupabaseAuth();

  if (!selectedProjectId || !selectedProject) {
    return (
      <div className="container mx-auto px-4 py-8">
        <NoProjectSelected message="Select a project to access the AI operations chat." />
      </div>
    );
  }

  const projectInfo = {
    projectName: selectedProject.name,
    location: selectedProject.location,
    description: selectedProject.description
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <PanelAIChat
          projectId={selectedProjectId}
          projectInfo={projectInfo}
          userId={user?.id}
          userTier={user?.subscription ?? 'free_user'}
        />
      </div>
    </div>
  );
}
