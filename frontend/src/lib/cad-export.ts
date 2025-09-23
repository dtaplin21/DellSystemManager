import Drawing from 'dxf-writer';
import { saveAs } from 'file-saver';

declare class DxfDrawing {
  addLine(x1: number, y1: number, x2: number, y2: number): void;
  addText(x: number, y: number, height: number, rotation: number, text: string): void;
  addPolyline(points: number[], closed: boolean): void;
  addCircle(x: number, y: number, radius: number): void;
  toDxfString(): string;
}

interface Panel {
  id: string;
  panelNumber: string;
  length: number;
  width: number;
  x: number;
  y: number;
  rotation: number;
  shape: 'rectangle' | 'right-triangle' | 'circle';
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
 * Export panels to DXF format for CAD software
 */
export function exportToDXF(panels: Panel[], projectInfo: ProjectInfo): void {
  // Create a new drawing
  const d = new Drawing() as unknown as DxfDrawing;
  
  // Add a title block with project information
  addTitleBlock(d, projectInfo);
  
  // Add each panel to the drawing
  panels.forEach(panel => {
    if (panel.shape === 'rectangle') {
      addRectangle(d, panel);
    } else if (panel.shape === 'circle' && panel.radius) {
      addCircle(d, panel);
    } else if (panel.shape === 'triangle' && panel.points) {
      addTriangle(d, panel);
    } else if (panel.shape === 'right-triangle') {
      addRightTriangle(d, panel);
    }
  });
  
  // Convert to DXF string
  const dxfString = d.toDxfString();
  
  // Create a blob and save the file
  const blob = new Blob([dxfString], { type: 'application/dxf' });
  const filename = `${projectInfo.projectName.replace(/\s+/g, '_')}_panels.dxf`;
  
  saveAs(blob, filename);
}

/**
 * Add a title block with project information
 */
function addTitleBlock(d: DxfDrawing, projectInfo: ProjectInfo): void {
  const yPos = -50;
  const textHeight = 5;
  
  // Add a border around the title block
  d.addLine(-50, yPos, 450, yPos);
  d.addLine(-50, yPos - 80, 450, yPos - 80);
  d.addLine(-50, yPos, -50, yPos - 80);
  d.addLine(450, yPos, 450, yPos - 80);
  
  // Add dividing lines
  d.addLine(200, yPos, 200, yPos - 80);
  d.addLine(-50, yPos - 20, 450, yPos - 20);
  d.addLine(-50, yPos - 40, 450, yPos - 40);
  d.addLine(-50, yPos - 60, 450, yPos - 60);
  
  // Add project information
  d.addText(-40, yPos - 15, textHeight, 0, `Project: ${projectInfo.projectName}`);
  d.addText(-40, yPos - 35, textHeight, 0, `Location: ${projectInfo.location}`);
  d.addText(-40, yPos - 55, textHeight, 0, `Material: ${projectInfo.material}`);
  d.addText(-40, yPos - 75, textHeight, 0, `Description: ${projectInfo.description}`);
  
  d.addText(210, yPos - 15, textHeight, 0, `Manager: ${projectInfo.manager}`);
  d.addText(210, yPos - 35, textHeight, 0, `Date: ${new Date().toLocaleDateString()}`);
  d.addText(210, yPos - 55, textHeight, 0, 'Scale: As Shown');
  d.addText(210, yPos - 75, textHeight, 0, 'Units: Feet');
}

/**
 * Add a rectangle panel to the drawing
 */
function addRectangle(d: DxfDrawing, panel: Panel): void {
  // Calculate the corners based on position, dimensions, and rotation
  const { x, y, width, length, rotation, panelNumber } = panel;
  
  if (rotation === 0) {
    // If no rotation, just add a simple rectangle
    const points = [
      x, y,
      x + width, y,
      x + width, y + length,
      x, y + length,
      x, y // Close the rectangle
    ];
    
    d.addPolyline(points, true);
  } else {
    // If rotated, calculate the corner points
    const rad = rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    const centerX = x + width / 2;
    const centerY = y + length / 2;
    
    const points = [
      // Top-left
      centerX - (width / 2) * cos - (length / 2) * sin,
      centerY - (width / 2) * sin + (length / 2) * cos,
      // Top-right
      centerX + (width / 2) * cos - (length / 2) * sin,
      centerY + (width / 2) * sin + (length / 2) * cos,
      // Bottom-right
      centerX + (width / 2) * cos + (length / 2) * sin,
      centerY + (width / 2) * sin - (length / 2) * cos,
      // Bottom-left
      centerX - (width / 2) * cos + (length / 2) * sin,
      centerY - (width / 2) * sin - (length / 2) * cos,
      // Close the rectangle
      centerX - (width / 2) * cos - (length / 2) * sin,
      centerY - (width / 2) * sin + (length / 2) * cos
    ];
    
    d.addPolyline(points, true);
  }
  
  // Add panel number text in the center
  const centerX = x + width / 2;
  const centerY = y + length / 2;
  
  d.addText(centerX, centerY, 5, rotation, panelNumber);
  
  // Add dimensions
  addDimensions(d, panel);
}

/**
 * Add a circular panel to the drawing
 */
function addCircle(d: DxfDrawing, panel: Panel): void {
  const { x, y, radius, panelNumber } = panel;
  
  if (radius) {
    d.addCircle(x, y, radius);
    
    // Add panel number in the center
    d.addText(x, y, 5, 0, panelNumber);
    
    // Add radius dimension
    d.addText(x + radius, y + 5, 3, 0, `R=${radius.toFixed(1)}'`);
  }
}

/**
 * Add a triangle panel to the drawing
 */
function addTriangle(d: DxfDrawing, panel: Panel): void {
  const { points, panelNumber } = panel;
  
  if (points && points.length >= 6) {
    // Triangle has exactly 3 points (6 coordinates)
    const trianglePoints = [
      points[0], points[1], // Point 1
      points[2], points[3], // Point 2
      points[4], points[5], // Point 3
      points[0], points[1]  // Close triangle back to Point 1
    ];
    
    d.addPolyline(trianglePoints, true);
    
    // Calculate the centroid for the panel number
    const centroidX = (points[0] + points[2] + points[4]) / 3;
    const centroidY = (points[1] + points[3] + points[5]) / 3;
    
    d.addText(centroidX, centroidY, 5, 0, panelNumber);
  }
}

/**
 * Add a right triangle panel to the drawing
 */
function addRightTriangle(d: DxfDrawing, panel: Panel): void {
  const { x, y, width, length, rotation, panelNumber } = panel;
  
  if (rotation === 0) {
    // If no rotation, draw a right triangle with 90-degree angle at bottom-left
    const points = [
      x, y, // Top-left corner
      x + width, y, // Top-right corner
      x, y + length, // Bottom-left corner (right angle)
      x, y // Close the triangle
    ];
    
    d.addPolyline(points, true);
  } else {
    // If rotated, calculate the corner points for right triangle
    const rad = rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // For right triangle, we need to calculate the three vertices
    // Right angle is at (x, y + length)
    const rightAngleX = x;
    const rightAngleY = y + length;
    
    const points = [
      // Top-left (hypotenuse start)
      x, y,
      // Top-right (hypotenuse end)
      x + width, y,
      // Bottom-left (right angle)
      rightAngleX, rightAngleY,
      // Close the triangle
      x, y
    ];
    
    // Apply rotation around the center
    const centerX = x + width / 2;
    const centerY = y + length / 2;
    
    const rotatedPoints = [];
    for (let i = 0; i < points.length; i += 2) {
      const px = points[i];
      const py = points[i + 1];
      
      const rotatedX = centerX + (px - centerX) * cos - (py - centerY) * sin;
      const rotatedY = centerY + (px - centerX) * sin + (py - centerY) * cos;
      
      rotatedPoints.push(rotatedX, rotatedY);
    }
    
    d.addPolyline(rotatedPoints, true);
  }
  
  // Add panel number text at the centroid (consistent with rendering)
  const centerX = x + width / 3;
  const centerY = y + length / 3;
  
  d.addText(centerX, centerY, 5, rotation, panelNumber);
  
  // Add dimensions
  addDimensions(d, panel);
}

/**
 * Add dimensions to a panel
 */
function addDimensions(d: DxfDrawing, panel: Panel): void {
  const { x, y, width, length, rotation } = panel;
  
  if (rotation === 0) {
    // Width dimension (top)
    d.addLine(x, y - 10, x + width, y - 10);
    d.addLine(x, y - 8, x, y - 12);
    d.addLine(x + width, y - 8, x + width, y - 12);
    d.addText(x + width / 2, y - 15, 3, 0, `${width.toFixed(1)}'`);
    
    // Length dimension (right)
    d.addLine(x + width + 10, y, x + width + 10, y + length);
    d.addLine(x + width + 8, y, x + width + 12, y);
    d.addLine(x + width + 8, y + length, x + width + 12, y + length);
    d.addText(x + width + 15, y + length / 2, 3, 90, `${length.toFixed(1)}'`);
  }
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