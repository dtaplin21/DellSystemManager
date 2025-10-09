const xlsx = require('xlsx');
const fs = require('fs');
require('dotenv').config({ path: '../.env' });

async function debugExcelParsing() {
  try {
    console.log('🔍 Debugging Excel parsing...');
    
    // Read the Excel file
    const filePath = '/Users/dtaplin21/DellSystemManager/backend/uploads/asbuilt-files/3589cf62-d099-4751-9388-6efef50edc44.xlsx';
    const fileBuffer = fs.readFileSync(filePath);
    
    console.log(`📁 File size: ${fileBuffer.length} bytes`);
    
    // Parse with xlsx
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log(`📋 Sheet name: ${sheetName}`);
    
    // Convert to JSON with headers
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    console.log(`📊 Total rows in Excel: ${jsonData.length}`);
    console.log('\n🔍 First 25 rows of raw data:');
    
    jsonData.slice(0, 25).forEach((row, index) => {
      console.log(`Row ${index}: [${row.map(cell => cell === null ? 'NULL' : `"${cell}"`).join(', ')}]`);
    });
    
    // Try to find header row
    console.log('\n🔍 Looking for header row...');
    for (let i = 0; i < Math.min(30, jsonData.length); i++) {
      const row = jsonData[i];
      const nonEmptyCells = row.filter(cell => cell && cell.toString().trim() !== '');
      
      if (nonEmptyCells.length > 0) {
        console.log(`Row ${i}: nonEmpty=${nonEmptyCells.length}, content=[${nonEmptyCells.map(cell => `"${cell}"`).join(', ')}]`);
        
        // Check if it looks like a header
        const headerKeywords = ['panel', 'date', 'id', 'number', 'type', 'name', 'location', 'test', 'result'];
        const cellsWithKeywords = row.filter(cell => {
          if (!cell) return false;
          const cellStr = cell.toString().toLowerCase();
          return headerKeywords.some(keyword => cellStr.includes(keyword));
        });
        
        const looksLikeHeader = cellsWithKeywords.length >= 3 && nonEmptyCells.length >= 4;
        console.log(`  -> Header keywords found: ${cellsWithKeywords.length}, looksLikeHeader: ${looksLikeHeader}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugExcelParsing();
