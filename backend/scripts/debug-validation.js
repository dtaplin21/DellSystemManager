const xlsx = require('xlsx');
const fs = require('fs');
require('dotenv').config({ path: '../.env' });

function isValidDataRow(row, headers) {
  const cellValues = row.map(cell => cell ? cell.toString().toLowerCase() : '');
  
  // Check if row matches header keywords
  const headerKeywords = headers.map(h => h ? h.toString().toLowerCase() : '');
  let headerMatches = 0;
  
  cellValues.forEach(cell => {
    if (headerKeywords.includes(cell)) headerMatches++;
  });
  
  if (headerMatches > headers.length / 3) {
    console.log(`🚫 [AI] Skipping header row`);
    return false;
  }
  
  // Check for material descriptions or project info (enhanced keyword matching)
  const metadataKeywords = [
    'geomembrane', 'mil', 'black', 'hdpe', 'lldpe', 'specification',
    'project name:', 'project location:', 'project description:', 'project manager:',
    'supervisor:', 'engineer:', 'contractor:', 'contact:', 'material:',
    'wpwm mod', 'wpwm mod 6', 'wpwm-mod', 'project:', 'job #:', 'date:'
  ];
  const hasMetadata = cellValues.some(cell => 
    metadataKeywords.some(keyword => cell.includes(keyword))
  );
  
  if (hasMetadata) {
    console.log(`🚫 [AI] Skipping metadata row`);
    return false;
  }
  
  // Require at least 3 non-empty cells for panel placement data
  const nonEmptyCells = cellValues.filter(cell => cell.trim() !== '');
  if (nonEmptyCells.length < 3) {
    console.log(`🚫 [AI] Skipping sparse row`);
    return false;
  }
  
  // LAZY LOADING: Only process rows with valid numeric panel numbers
  const hasValidPanelNumber = row.some(cell => {
    if (!cell) return false;
    const str = cell.toString().trim();
    // Must be a pure number between 1-999 (reasonable panel range)
    return /^\d+$/.test(str) && parseInt(str) > 0 && parseInt(str) < 1000;
  });
  
  if (hasValidPanelNumber) {
    console.log(`✅ [AI] Valid data row with numeric panel number`);
    return true;
  }
  
  // Reject rows without valid numeric panel numbers (lazy loading approach)
  console.log(`🚫 [AI] Skipping row - no valid numeric panel number`);
  return false;
}

async function debugValidation() {
  try {
    console.log('🔍 Debugging row validation...');
    
    // Read the Excel file
    const filePath = '/Users/dtaplin21/DellSystemManager/backend/uploads/asbuilt-files/3589cf62-d099-4751-9388-6efef50edc44.xlsx';
    const fileBuffer = fs.readFileSync(filePath);
    
    // Parse with xlsx
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    // Find header row (we know it's at index 20)
    const headerRowIndex = 20;
    const headers = jsonData[headerRowIndex];
    const dataRows = jsonData.slice(headerRowIndex + 1).filter(row => 
      row.some(cell => cell && cell.toString().trim() !== '')
    );
    
    console.log(`📋 Headers: [${headers.map(h => `"${h}"`).join(', ')}]`);
    console.log(`📊 Testing first 10 data rows:\n`);
    
    dataRows.slice(0, 10).forEach((row, index) => {
      console.log(`Row ${headerRowIndex + 1 + index}: [${row.map(cell => cell === null ? 'NULL' : `"${cell}"`).join(', ')}]`);
      const isValid = isValidDataRow(row, headers);
      console.log(`  -> Valid: ${isValid}\n`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugValidation();
