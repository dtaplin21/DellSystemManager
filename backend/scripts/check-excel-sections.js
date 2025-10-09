const xlsx = require('xlsx');
const fs = require('fs');

function checkExcelSections() {
  try {
    console.log('🔍 Checking Excel file for multiple sections...');
    
    const filePath = '/Users/dtaplin21/DellSystemManager/backend/uploads/asbuilt-files/3589cf62-d099-4751-9388-6efef50edc44.xlsx';
    const fileBuffer = fs.readFileSync(filePath);
    
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    console.log(`📊 Total rows in Excel: ${jsonData.length}`);
    
    // Look for multiple header rows (indicating multiple sections)
    console.log('\n🔍 Looking for multiple header sections...');
    
    let headerRowCount = 0;
    let dataSectionCount = 0;
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const nonEmptyCells = row.filter(cell => cell && cell.toString().trim() !== '');
      
      if (nonEmptyCells.length > 0) {
        // Check if this looks like a header row
        const headerKeywords = ['panel', 'date', 'id', 'number', 'type', 'name', 'location', 'test', 'result'];
        const cellsWithKeywords = row.filter(cell => {
          if (!cell) return false;
          const cellStr = cell.toString().toLowerCase();
          return headerKeywords.some(keyword => cellStr.includes(keyword));
        });
        
        const looksLikeHeader = cellsWithKeywords.length >= 3 && nonEmptyCells.length >= 4;
        
        if (looksLikeHeader) {
          headerRowCount++;
          console.log(`\n📍 Header section ${headerRowCount} found at row ${i + 1}:`);
          console.log(`   Content: [${nonEmptyCells.map(cell => `"${cell}"`).join(', ')}]`);
          
          // Count data rows after this header
          let dataRowsAfter = 0;
          for (let j = i + 1; j < Math.min(i + 50, jsonData.length); j++) {
            const dataRow = jsonData[j];
            const dataNonEmpty = dataRow.filter(cell => cell && cell.toString().trim() !== '');
            if (dataNonEmpty.length >= 3) {
              // Check if it has a numeric panel number
              const hasPanelNumber = dataRow.some(cell => {
                if (!cell) return false;
                const str = cell.toString().trim();
                return /^\d{1,3}$/.test(str) && parseInt(str) > 0 && parseInt(str) < 1000;
              });
              
              if (hasPanelNumber) {
                dataRowsAfter++;
                if (dataRowsAfter <= 3) { // Show first 3 data rows
                  console.log(`   Data row ${j + 1}: [${dataNonEmpty.map(cell => `"${cell}"`).join(', ')}]`);
                }
              } else {
                // Stop counting if we hit a non-data row
                break;
              }
            }
          }
          console.log(`   → ${dataRowsAfter} data rows found after this header`);
          dataSectionCount += dataRowsAfter;
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Header sections found: ${headerRowCount}`);
    console.log(`   - Total data rows across all sections: ${dataSectionCount}`);
    
    if (headerRowCount > 1) {
      console.log(`\n⚠️  ISSUE FOUND: Multiple header sections detected!`);
      console.log(`   This explains why you're seeing duplicate panel numbers.`);
      console.log(`   The Excel file has ${headerRowCount} separate data sections,`);
      console.log(`   each with its own set of panel records.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkExcelSections();
