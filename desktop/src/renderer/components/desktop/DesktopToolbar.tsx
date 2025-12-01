import React from 'react';
import { isElectron } from '../../../shared/electron/ipc';

interface DesktopToolbarProps {
  onNewProject?: () => void;
  onImportCAD?: () => void;
  onOpenQCInspector?: () => void;
  onOpenReports?: () => void;
}

/**
 * Desktop toolbar component
 * Provides quick access to common construction workflows
 */
export const DesktopToolbar: React.FC<DesktopToolbarProps> = ({
  onNewProject,
  onImportCAD,
  onOpenQCInspector,
  onOpenReports
}) => {
  const isDesktop = isElectron();

  if (!isDesktop) {
    return null; // Only show in desktop app
  }

  return (
    <div className="desktop-toolbar bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm">
      <div className="toolbar-left flex items-center space-x-2">
        {/* New Project */}
        <button
          className="toolbar-button px-3 py-1.5 rounded hover:bg-gray-100 text-sm font-medium text-gray-700 flex items-center space-x-1"
          onClick={onNewProject}
          title="New Project (Ctrl+N)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Project</span>
        </button>

        {/* Import CAD */}
        <button
          className="toolbar-button px-3 py-1.5 rounded hover:bg-gray-100 text-sm font-medium text-gray-700 flex items-center space-x-1"
          onClick={onImportCAD}
          title="Import CAD File (Ctrl+I)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span>Import CAD</span>
        </button>

        <div className="toolbar-divider w-px h-6 bg-gray-300 mx-2" />

        {/* QC Inspector */}
        <button
          className="toolbar-button px-3 py-1.5 rounded hover:bg-gray-100 text-sm font-medium text-gray-700 flex items-center space-x-1"
          onClick={onOpenQCInspector}
          title="QC Inspector (Ctrl+1)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>QC Inspector</span>
        </button>

        {/* Reports */}
        <button
          className="toolbar-button px-3 py-1.5 rounded hover:bg-gray-100 text-sm font-medium text-gray-700 flex items-center space-x-1"
          onClick={onOpenReports}
          title="Reports (Ctrl+3)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Reports</span>
        </button>
      </div>

      <div className="toolbar-right flex items-center space-x-4">
        {/* Status Indicator */}
        <div className="status-indicator flex items-center space-x-2 text-xs text-gray-500">
          <div className="status-dot w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>Online</span>
        </div>
      </div>

      <style jsx>{`
        .toolbar-button {
          transition: background-color 0.2s;
          -webkit-app-region: no-drag;
        }
        
        .toolbar-button:hover {
          background-color: #f3f4f6;
        }
        
        .toolbar-button:active {
          background-color: #e5e7eb;
        }
      `}</style>
    </div>
  );
};

export default DesktopToolbar;

