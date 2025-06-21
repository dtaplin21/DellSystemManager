import React from 'react';
import { FolderOpen } from 'lucide-react';
import { useProjects } from '@/contexts/ProjectsProvider';
import { useRouter } from 'next/navigation';

interface NoProjectSelectedProps {
  message?: string;
}

export default function NoProjectSelected({ message = "Please select a project to continue." }: NoProjectSelectedProps) {
  const { projects, selectProject, isLoading, error } = useProjects();
  const router = useRouter();

  const handleSelectProject = (projectId: string) => {
    if (!projectId) return;
    selectProject(projectId);
    // After selecting, navigate to the dashboard with the project ID in the URL
    // to ensure all components react correctly.
    router.push(`/dashboard?projectId=${projectId}`);
  };

  const activeProjects = projects.filter(p => p.status === 'active');

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="text-center">
        <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Project Selected</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="text-sm text-gray-500">
          Use the project selector in the toolbar to choose a project.
        </div>

        <div className="mt-8 border-t pt-8 w-full max-w-sm mx-auto">
          <label htmlFor="project-quick-select" className="block text-sm font-medium text-gray-700 mb-2">
            Or select an active project here:
          </label>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading projects...</p>
          ) : error ? (
            <p className="text-sm text-red-600">Could not load projects. Please try again.</p>
          ) : (
            <select
              id="project-quick-select"
              className="bg-white block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm"
              onChange={(e) => handleSelectProject(e.target.value)}
              defaultValue=""
              aria-label="Select a project"
            >
              <option value="" disabled>
                {activeProjects.length > 0 ? `Choose from ${activeProjects.length} active project(s)...` : 'No active projects found'}
              </option>
              {activeProjects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
} 