import React from 'react';
import { FolderOpen } from 'lucide-react';

interface NoProjectSelectedProps {
  message?: string;
}

export default function NoProjectSelected({ message = "Please select a project to continue." }: NoProjectSelectedProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="text-center">
        <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Project Selected</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="text-sm text-gray-500">
          Use the project selector in the toolbar to choose a project.
        </div>
      </div>
    </div>
  );
} 