import React from 'react';
import { showSaveDialog } from '../../../shared/electron/ipc';

/**
 * CAD Exporter Component
 * Exports panel layouts to AutoCAD-compatible formats
 * 
 * Features:
 * - Export to DWG/DXF
 * - Include QC data in export
 * - Custom export options
 * - Coordinate system preservation
 */
export const CADExporter: React.FC = () => {
  const handleExport = async () => {
    const result = await showSaveDialog({
      title: 'Export to CAD',
      defaultPath: 'panel-layout.dwg',
      filters: [
        { name: 'DWG Files', extensions: ['dwg'] },
        { name: 'DXF Files', extensions: ['dxf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      console.log('Export to:', result.filePath);
      // TODO: Implement CAD export logic
    }
  };

  return (
    <div className="cad-exporter p-6">
      <h2 className="text-2xl font-bold mb-4">CAD Export</h2>
      <button
        onClick={handleExport}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Export to CAD
      </button>
      <p className="text-gray-600 mt-4">CAD export functionality coming soon...</p>
    </div>
  );
};

export default CADExporter;

