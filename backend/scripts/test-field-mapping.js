#!/usr/bin/env node

/**
 * Test Field Mapping Script
 * 
 * This script tests the field mapping logic to ensure backend data
 * is correctly transformed to frontend format.
 */

// Simulate the backend panel data structure
const backendPanel = {
  "x": 100,
  "y": 100,
  "fill": "hsl(102, 70%, 80%)",
  "type": "rectangle",
  "stroke": "hsl(102, 70%, 80%)",
  "rotation": 0,
  "project_id": "69fc302b-166d-4543-9990-89c4b1e0ed59",
  "width_feet": 22,
  "height_feet": 400,
  "roll_number": "5458",
  "panel_number": "1",
  "stroke_width": 1
};

// Simulate the frontend mapPanelFields function
function mapPanelFields(panel, index = 0) {
  console.log(`[MAP DEBUG] Mapping panel ${index}:`, panel);
  
  // Map backend field names to frontend field names
  // Backend sends: width_feet, height_feet, type
  // Frontend expects: width, length, shape
  const width = Number(panel.width_feet || panel.width || 100);
  const length = Number(panel.height_feet || panel.length || 100);
  const x = Number(panel.x || 0);
  const y = Number(panel.y || 0);
  // Validate shape and default to rectangle if invalid
  const validShapes = ['rectangle', 'right-triangle', 'circle'];
  const rawShape = panel.type || panel.shape || 'rectangle';
  const shape = validShapes.includes(rawShape) ? rawShape : 'rectangle';
  
  console.log(`[MAP DEBUG] Field mapping:`, {
    'width_feet -> width': `${panel.width_feet} -> ${width}`,
    'height_feet -> length': `${panel.height_feet} -> ${length}`,
    'type -> shape': `${panel.type} -> ${shape}`,
    'x': x,
    'y': y
  });
  
  const mapped = {
    id: panel.id || `panel-${index}`,
    shape: shape,
    x: x,
    y: y,
    width: width,
    height: length,
    length: length,
    rotation: Number(panel.rotation || 0),
    fill: panel.fill || '#3b82f6',
    color: panel.color || panel.fill || '#3b82f6',
    rollNumber: panel.roll_number || panel.rollNumber || '',
    panelNumber: panel.panel_number || panel.panelNumber || '',
    date: panel.date || '',
    location: panel.location || '',
    meta: {
      repairs: [],
      location: { x: x, y: y, gridCell: { row: 0, col: 0 } }
    }
  };
  
  console.log(`[MAP DEBUG] Mapped panel ${index}:`, mapped);
  return mapped;
}

// Test the mapping
console.log('🧪 Testing Field Mapping Logic');
console.log('='.repeat(50));

console.log('\n📥 Backend Panel Data:');
console.log(JSON.stringify(backendPanel, null, 2));

console.log('\n🔄 Applying Field Mapping...');
const mappedPanel = mapPanelFields(backendPanel, 0);

console.log('\n📤 Frontend Mapped Panel:');
console.log(JSON.stringify(mappedPanel, null, 2));

console.log('\n✅ Field Mapping Results:');
console.log(`   width_feet (22) -> width: ${mappedPanel.width}`);
console.log(`   height_feet (400) -> length: ${mappedPanel.length}`);
console.log(`   type ("rectangle") -> shape: ${mappedPanel.shape}`);
console.log(`   x: ${mappedPanel.x}`);
console.log(`   y: ${mappedPanel.y}`);

console.log('\n🎯 Expected vs Actual:');
console.log(`   Expected width: 22, Got: ${mappedPanel.width} ${mappedPanel.width === 22 ? '✅' : '❌'}`);
console.log(`   Expected length: 400, Got: ${mappedPanel.length} ${mappedPanel.length === 400 ? '✅' : '❌'}`);
console.log(`   Expected shape: "rectangle", Got: "${mappedPanel.shape}" ${mappedPanel.shape === 'rectangle' ? '✅' : '❌'}`);

if (mappedPanel.width === 22 && mappedPanel.length === 400 && mappedPanel.shape === 'rectangle') {
  console.log('\n🎉 SUCCESS: Field mapping is working correctly!');
  console.log('✅ Panels should now maintain their proper dimensions');
} else {
  console.log('\n❌ FAILURE: Field mapping has issues');
  console.log('❌ Panels may still appear at default sizes');
}
