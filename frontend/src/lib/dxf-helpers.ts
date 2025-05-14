import { saveAs } from 'file-saver';

interface Panel {
  id: string;
  panelNumber: string;
  length: number;
  width: number;
  x: number;
  y: number;
  rotation: number;
  shape: 'rectangle' | 'polygon' | 'circle';
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
 * Simple DXF string generator
 * This is a simplified version without using external libraries
 */
export function generateDXF(panels: Panel[], projectInfo: ProjectInfo): string {
  let dxf = '';
  
  // DXF Header
  dxf += '0\nSECTION\n';
  dxf += '2\nHEADER\n';
  dxf += '0\nENDSEC\n';
  
  // Tables section (layers, etc)
  dxf += '0\nSECTION\n';
  dxf += '2\nTABLES\n';
  
  // Layer table
  dxf += '0\nTABLE\n';
  dxf += '2\nLAYER\n';
  dxf += '0\nLAYER\n';
  dxf += '2\n0\n';
  dxf += '70\n0\n';
  dxf += '62\n7\n';
  dxf += '6\nCONTINUOUS\n';
  dxf += '0\nENDTAB\n';
  
  dxf += '0\nENDSEC\n';
  
  // Entities section
  dxf += '0\nSECTION\n';
  dxf += '2\nENTITIES\n';
  
  // Add project info as text
  dxf += addText(-40, -30, 5, `Project: ${projectInfo.projectName}`);
  dxf += addText(-40, -40, 5, `Location: ${projectInfo.location}`);
  dxf += addText(-40, -50, 5, `Material: ${projectInfo.material}`);
  dxf += addText(-40, -60, 5, `Manager: ${projectInfo.manager}`);
  dxf += addText(-40, -70, 5, `Description: ${projectInfo.description}`);
  dxf += addText(-40, -80, 5, `Date: ${new Date().toLocaleDateString()}`);
  
  // Add border for title block
  dxf += addLine(-50, -20, 450, -20);
  dxf += addLine(-50, -90, 450, -90);
  dxf += addLine(-50, -20, -50, -90);
  dxf += addLine(450, -20, 450, -90);
  
  // Add grid reference lines
  for (let i = 0; i <= 500; i += 100) {
    dxf += addLine(i, 0, i, 500);
    dxf += addLine(0, i, 500, i);
    dxf += addText(i + 5, 5, 3, `${i}'`);
    dxf += addText(5, i + 5, 3, `${i}'`);
  }
  
  // Add panels
  panels.forEach(panel => {
    if (panel.shape === 'rectangle') {
      // Add rectangle
      dxf += addPolyline([
        panel.x, panel.y,
        panel.x + panel.width, panel.y,
        panel.x + panel.width, panel.y + panel.length,
        panel.x, panel.y + panel.length,
        panel.x, panel.y  // Close the rectangle
      ]);
      
      // Add panel number
      dxf += addText(
        panel.x + panel.width / 2, 
        panel.y + panel.length / 2, 
        5, 
        panel.panelNumber
      );
      
      // Add dimensions
      dxf += addText(
        panel.x + panel.width / 2, 
        panel.y - 10, 
        3, 
        `${panel.width.toFixed(1)}'`
      );
      
      dxf += addText(
        panel.x + panel.width + 10, 
        panel.y + panel.length / 2, 
        3, 
        `${panel.length.toFixed(1)}'`
      );
    }
    else if (panel.shape === 'circle' && panel.radius) {
      dxf += addCircle(panel.x, panel.y, panel.radius);
      dxf += addText(panel.x, panel.y, 5, panel.panelNumber);
    }
    else if (panel.shape === 'polygon' && panel.points) {
      dxf += addPolyline(panel.points);
      
      // Calculate centroid
      const xCoords = panel.points.filter((_, i) => i % 2 === 0);
      const yCoords = panel.points.filter((_, i) => i % 2 === 1);
      
      const centroidX = xCoords.reduce((sum, x) => sum + x, 0) / xCoords.length;
      const centroidY = yCoords.reduce((sum, y) => sum + y, 0) / yCoords.length;
      
      dxf += addText(centroidX, centroidY, 5, panel.panelNumber);
    }
  });
  
  dxf += '0\nENDSEC\n';
  dxf += '0\nEOF\n';
  
  return dxf;
}

// Helper to add a line
function addLine(x1: number, y1: number, x2: number, y2: number): string {
  let entity = '0\nLINE\n';
  entity += '8\n0\n';  // Layer
  entity += `10\n${x1}\n`;  // Start X
  entity += `20\n${y1}\n`;  // Start Y
  entity += `11\n${x2}\n`;  // End X
  entity += `21\n${y2}\n`;  // End Y
  return entity;
}

// Helper to add text
function addText(x: number, y: number, height: number, text: string): string {
  let entity = '0\nTEXT\n';
  entity += '8\n0\n';  // Layer
  entity += `10\n${x}\n`;  // Position X
  entity += `20\n${y}\n`;  // Position Y
  entity += `40\n${height}\n`;  // Text height
  entity += `1\n${text}\n`;  // Text content
  return entity;
}

// Helper to add a polyline
function addPolyline(points: number[]): string {
  let entity = '0\nPOLYLINE\n';
  entity += '8\n0\n';  // Layer
  entity += '66\n1\n';  // Vertices follow
  entity += '70\n1\n';  // Closed polyline
  
  // Add vertices
  for (let i = 0; i < points.length; i += 2) {
    entity += '0\nVERTEX\n';
    entity += '8\n0\n';  // Layer
    entity += `10\n${points[i]}\n`;  // X
    entity += `20\n${points[i+1]}\n`;  // Y
  }
  
  entity += '0\nSEQEND\n';
  return entity;
}

// Helper to add a circle
function addCircle(x: number, y: number, radius: number): string {
  let entity = '0\nCIRCLE\n';
  entity += '8\n0\n';  // Layer
  entity += `10\n${x}\n`;  // Center X
  entity += `20\n${y}\n`;  // Center Y
  entity += `40\n${radius}\n`;  // Radius
  return entity;
}

/**
 * Export panels to DXF format for CAD software
 */
export function exportToDXF(panels: Panel[], projectInfo: ProjectInfo): void {
  const dxfString = generateDXF(panels, projectInfo);
  const blob = new Blob([dxfString], { type: 'application/dxf' });
  const filename = `${projectInfo.projectName.replace(/\s+/g, '_')}_panels.dxf`;
  
  saveAs(blob, filename);
}

/**
 * Export panels to a simplified JSON format that can be loaded later
 */
export function exportToJSON(panels: Panel[], projectInfo: ProjectInfo): void {
  const exportData = {
    projectInfo,
    panels: panels.map(panel => ({
      id: panel.id,
      panelNumber: panel.panelNumber,
      length: panel.length,
      width: panel.width,
      x: panel.x,
      y: panel.y,
      rotation: panel.rotation,
      shape: panel.shape,
      points: panel.points,
      radius: panel.radius
    }))
  };
  
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const filename = `${projectInfo.projectName.replace(/\s+/g, '_')}_panels.json`;
  
  saveAs(blob, filename);
}