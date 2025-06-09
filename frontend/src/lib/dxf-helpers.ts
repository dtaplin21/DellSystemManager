import { saveAs } from 'file-saver';

interface Panel {
  id: string;
  panelNumber: string;
  length: number;
  width: number;
  x: number;
  y: number;
  rotation: number;
  shape: 'rectangle' | 'triangle' | 'circle';
  points?: number[];
  radius?: number;
}

interface ProjectInfo {
  projectName: string;
  location: string;
  description: string;
  manager: string;
  material: string;
}

/**
 * Exports the panel layout data to a DXF file for CAD software
 */
export function exportToDXF(panels: Panel[], projectInfo: ProjectInfo) {
  try {
    // Generate DXF content
    const dxfContent = generateDXF(panels, projectInfo);
    
    // Create blob and download
    const blob = new Blob([dxfContent], { type: 'text/plain' });
    saveAs(blob, `${projectInfo.projectName.replace(/\s+/g, '_')}_panel_layout.dxf`);
  } catch (error) {
    console.error('Error exporting to DXF:', error);
    alert('Failed to export DXF file');
  }
}

/**
 * Exports the panel layout data to a JSON file
 */
export function exportToJSON(panels: Panel[], projectInfo: ProjectInfo) {
  try {
    const data = {
      projectInfo,
      panels,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `${projectInfo.projectName.replace(/\s+/g, '_')}_panel_layout.json`);
  } catch (error) {
    console.error('Error exporting to JSON:', error);
    alert('Failed to export JSON file');
  }
}

/**
 * Generate DXF file content
 * This is a simplified implementation that creates a basic DXF file
 */
function generateDXF(panels: Panel[], projectInfo: ProjectInfo): string {
  // DXF file header
  let dxf = '';
  
  // Begin DXF file
  dxf += '0\nSECTION\n';
  dxf += '2\nHEADER\n';
  dxf += '0\nENDSEC\n';
  
  // Tables section
  dxf += '0\nSECTION\n';
  dxf += '2\nTABLES\n';
  
  // Layer table
  dxf += '0\nTABLE\n';
  dxf += '2\nLAYER\n';
  dxf += '0\nLAYER\n';
  dxf += '2\nPanels\n';
  dxf += '70\n64\n';
  dxf += '62\n7\n';
  dxf += '6\nCONTINUOUS\n';
  dxf += '0\nENDTAB\n';
  dxf += '0\nENDSEC\n';
  
  // Entities section
  dxf += '0\nSECTION\n';
  dxf += '2\nENTITIES\n';
  
  // Project information as text
  dxf += '0\nTEXT\n';
  dxf += '8\nInfo\n';
  dxf += '1\nProject: ' + projectInfo.projectName + '\n';
  dxf += '10\n10\n';
  dxf += '20\n10\n';
  dxf += '40\n2.5\n';
  
  dxf += '0\nTEXT\n';
  dxf += '8\nInfo\n';
  dxf += '1\nLocation: ' + projectInfo.location + '\n';
  dxf += '10\n10\n';
  dxf += '20\n15\n';
  dxf += '40\n2.5\n';
  
  dxf += '0\nTEXT\n';
  dxf += '8\nInfo\n';
  dxf += '1\nMaterial: ' + projectInfo.material + '\n';
  dxf += '10\n10\n';
  dxf += '20\n20\n';
  dxf += '40\n2.5\n';
  
  // Add each panel as a rectangle
  panels.forEach(panel => {
    if (panel.shape === 'rectangle') {
      // Add rectangle
      dxf += '0\nPOLYLINE\n';
      dxf += '8\nPanels\n';
      dxf += '66\n1\n';
      dxf += '70\n1\n';
      
      // Bottom left
      dxf += '0\nVERTEX\n';
      dxf += '8\nPanels\n';
      dxf += '10\n' + panel.x + '\n';
      dxf += '20\n' + panel.y + '\n';
      
      // Bottom right
      dxf += '0\nVERTEX\n';
      dxf += '8\nPanels\n';
      dxf += '10\n' + (panel.x + panel.width) + '\n';
      dxf += '20\n' + panel.y + '\n';
      
      // Top right
      dxf += '0\nVERTEX\n';
      dxf += '8\nPanels\n';
      dxf += '10\n' + (panel.x + panel.width) + '\n';
      dxf += '20\n' + (panel.y + panel.length) + '\n';
      
      // Top left
      dxf += '0\nVERTEX\n';
      dxf += '8\nPanels\n';
      dxf += '10\n' + panel.x + '\n';
      dxf += '20\n' + (panel.y + panel.length) + '\n';
      
      dxf += '0\nSEQEND\n';
      
      // Add panel number as text
      dxf += '0\nTEXT\n';
      dxf += '8\nLabels\n';
      dxf += '1\n' + panel.panelNumber + '\n';
      dxf += '10\n' + (panel.x + panel.width / 2) + '\n';
      dxf += '20\n' + (panel.y + panel.length / 2) + '\n';
      dxf += '40\n2.5\n';
      dxf += '72\n1\n'; // Horizontal text justification (center)
      dxf += '73\n1\n'; // Vertical text justification (middle)
    }
    else if (panel.shape === 'circle' && panel.radius) {
      // Add circle
      dxf += '0\nCIRCLE\n';
      dxf += '8\nPanels\n';
      dxf += '10\n' + panel.x + '\n';
      dxf += '20\n' + panel.y + '\n';
      dxf += '40\n' + panel.radius + '\n';
      
      // Add panel number as text
      dxf += '0\nTEXT\n';
      dxf += '8\nLabels\n';
      dxf += '1\n' + panel.panelNumber + '\n';
      dxf += '10\n' + panel.x + '\n';
      dxf += '20\n' + panel.y + '\n';
      dxf += '40\n2.5\n';
      dxf += '72\n1\n'; // Horizontal text justification (center)
      dxf += '73\n1\n'; // Vertical text justification (middle)
    }
    else if (panel.shape === 'triangle' && panel.points && panel.points.length >= 6) {
      // Add triangle
      dxf += '0\nPOLYLINE\n';
      dxf += '8\nPanels\n';
      dxf += '66\n1\n';
      dxf += '70\n1\n';
      
      // Add each vertex (triangle has 3 vertices)
      for (let i = 0; i < panel.points.length; i += 2) {
        dxf += '0\nVERTEX\n';
        dxf += '8\nPanels\n';
        dxf += '10\n' + panel.points[i] + '\n';
        dxf += '20\n' + panel.points[i + 1] + '\n';
      }
      
      dxf += '0\nSEQEND\n';
      
      // Calculate centroid for text position
      const xCoords = panel.points.filter((_, i) => i % 2 === 0);
      const yCoords = panel.points.filter((_, i) => i % 2 === 1);
      const centroidX = xCoords.reduce((sum, x) => sum + x, 0) / xCoords.length;
      const centroidY = yCoords.reduce((sum, y) => sum + y, 0) / yCoords.length;
      
      // Add panel number as text
      dxf += '0\nTEXT\n';
      dxf += '8\nLabels\n';
      dxf += '1\n' + panel.panelNumber + '\n';
      dxf += '10\n' + centroidX + '\n';
      dxf += '20\n' + centroidY + '\n';
      dxf += '40\n2.5\n';
      dxf += '72\n1\n'; // Horizontal text justification (center)
      dxf += '73\n1\n'; // Vertical text justification (middle)
    }
  });
  
  // End entities section
  dxf += '0\nENDSEC\n';
  
  // End of file
  dxf += '0\nEOF\n';
  
  return dxf;
}