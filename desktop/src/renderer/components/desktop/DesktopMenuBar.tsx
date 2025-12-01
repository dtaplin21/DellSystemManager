import React from 'react';
import { isElectron, onMenuAction } from '../../../shared/electron/ipc';

/**
 * Desktop menu bar component
 * Provides desktop-style menu bar for construction workflows
 */
export const DesktopMenuBar: React.FC = () => {
  const isDesktop = isElectron();

  React.useEffect(() => {
    if (isDesktop) {
      // Listen for menu actions from Electron menu
      onMenuAction((action, ...args) => {
        handleMenuAction(action, ...args);
      });
    }
  }, [isDesktop]);

  const handleMenuAction = (action: string, ...args: any[]) => {
    switch (action) {
      case 'new-project':
        window.location.href = '/dashboard/projects/new';
        break;
      case 'open-project':
        // Handle open project from file
        console.log('Open project:', args[0]);
        break;
      case 'import-cad':
        // Handle CAD import
        if (window.electronAPI) {
          window.electronAPI.showOpenDialog({
            title: 'Import CAD File',
            filters: [
              { name: 'CAD Files', extensions: ['dwg', 'dxf'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          }).then((result) => {
            if (!result.canceled && result.filePaths) {
              console.log('CAD file selected:', result.filePaths[0]);
              // Handle CAD file import
            }
          });
        }
        break;
      case 'export-project':
        // Handle project export
        if (window.electronAPI) {
          window.electronAPI.showSaveDialog({
            title: 'Export Project',
            defaultPath: 'project.gsqc',
            filters: [
              { name: 'GeoSynth QC Projects', extensions: ['gsqc'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          }).then((result) => {
            if (!result.canceled && result.filePath) {
              console.log('Export to:', result.filePath);
              // Handle project export
            }
          });
        }
        break;
      case 'open-qc-inspector':
        window.location.href = '/dashboard/qc-inspector';
        break;
      case 'open-material-inventory':
        window.location.href = '/dashboard/materials';
        break;
      case 'open-reports':
        window.location.href = '/dashboard/reports';
        break;
      case 'open-settings':
        window.location.href = '/dashboard/settings';
        break;
      case 'show-shortcuts':
        // Show keyboard shortcuts dialog
        console.log('Show keyboard shortcuts');
        break;
      case 'show-about':
        // Show about dialog
        if (window.electronAPI) {
          window.electronAPI.showMessageBox({
            type: 'info',
            title: 'About GeoSynth QC Pro',
            message: 'GeoSynth QC Pro Desktop\nVersion 1.0.0\n\nProfessional QC management for construction companies.',
            buttons: ['OK']
          });
        }
        break;
      default:
        console.log('Unknown menu action:', action, args);
    }
  };

  // Menu bar is handled by Electron's native menu
  // This component is for handling menu actions in React
  return null;
};

export default DesktopMenuBar;

