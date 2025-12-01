import React from 'react';
import { showOpenDialog } from '../../../shared/electron/ipc';

/**
 * CAD Importer Component
 * Imports AutoCAD/DWG files into the application
 * 
 * Features:
 * - Import DWG/DXF files
 * - Parse CAD geometry
 * - Extract panel layouts
 * - Coordinate system alignment
 */
export const CADImporter: React.FC = () => {
  const handleImport = async () => {
    const result = await showOpenDialog({
      title: 'Import CAD File',
      filters: [
        { name: 'CAD Files', extensions: ['dwg', 'dxf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths) {
      console.log('CAD file selected:', result.filePaths[0]);
      // TODO: Implement CAD import logic
    }
  };

  return (
    <div className="cad-importer p-6">
      <h2 className="text-2xl font-bold mb-4">CAD Import</h2>
      <button
        onClick={handleImport}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Import CAD File
      </button>
      <p className="text-gray-600 mt-4">CAD import functionality coming soon...</p>
    </div>
  );
};

export default CADImporter;

