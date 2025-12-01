import React from 'react';
import { isElectron } from '../../shared/electron/ipc';

interface DesktopLayoutProps {
  children: React.ReactNode;
}

/**
 * Desktop-optimized layout for construction companies
 * Features:
 * - Multi-panel interface (not mobile-first)
 * - Desktop toolbar
 * - Keyboard shortcuts
 * - Large screen optimization
 */
export const DesktopLayout: React.FC<DesktopLayoutProps> = ({ children }) => {
  const isDesktop = isElectron();

  return (
    <div className="desktop-layout h-screen w-screen flex flex-col bg-gray-50">
      {/* Desktop Toolbar (only in Electron) */}
      {isDesktop && (
        <div className="desktop-toolbar bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm">
          <div className="toolbar-left flex items-center space-x-4">
            <button
              className="toolbar-button px-3 py-1.5 rounded hover:bg-gray-100 text-sm font-medium text-gray-700"
              onClick={() => {
                // Handle new project
                if (window.electronAPI) {
                  window.electronAPI.onMenuAction((action) => {
                    if (action === 'new-project') {
                      // Navigate to new project
                      window.location.href = '/dashboard/projects/new';
                    }
                  });
                }
              }}
            >
              New Project
            </button>
            <button
              className="toolbar-button px-3 py-1.5 rounded hover:bg-gray-100 text-sm font-medium text-gray-700"
              onClick={() => {
                // Handle import CAD
                if (window.electronAPI) {
                  window.electronAPI.showOpenDialog({
                    title: 'Import CAD File',
                    filters: [
                      { name: 'CAD Files', extensions: ['dwg', 'dxf'] },
                      { name: 'All Files', extensions: ['*'] }
                    ]
                  });
                }
              }}
            >
              Import CAD
            </button>
            <div className="toolbar-divider w-px h-6 bg-gray-300" />
            <button className="toolbar-button px-3 py-1.5 rounded hover:bg-gray-100 text-sm font-medium text-gray-700">
              QC Inspector
            </button>
            <button className="toolbar-button px-3 py-1.5 rounded hover:bg-gray-100 text-sm font-medium text-gray-700">
              Reports
            </button>
          </div>
          <div className="toolbar-right flex items-center space-x-2">
            <div className="status-indicator flex items-center space-x-2 text-xs text-gray-500">
              <div className="status-dot w-2 h-2 rounded-full bg-green-500"></div>
              <span>Online</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="desktop-content flex-1 overflow-hidden">
        {children}
      </div>

      {/* Desktop-specific styles */}
      <style jsx>{`
        .desktop-layout {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        
        .desktop-toolbar {
          user-select: none;
          -webkit-app-region: drag;
        }
        
        .toolbar-button {
          -webkit-app-region: no-drag;
          transition: background-color 0.2s;
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

export default DesktopLayout;

