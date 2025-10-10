const xlsx = require('xlsx');
const fs = require('fs');

function looksLikeHeaderRow(row) {
  const headerKeywords = ['panel', 'date', 'id', 'number', 'type', 'name', 'location', 'test', 'result'];
  const cellsWithKeywords = row.filter(cell => {
    if (!cell) return false;
    const cellStr = cell.toString().toLowerCase();
    return headerKeywords.some(keyword => cellStr.includes(keyword));
  });

  // More strict check: require at least 3 header keywords and no null cells in key positions
  const nonNullCells = row.filter(cell => cell !== null && cell !== undefined && cell.toString().trim() !== '');
  
  return cellsWithKeywords.length >= 3 && nonNullCells.length >= 4;
}

function debugHeaderDetection() {
  try {
    console.log('🔍 Debugging header detection logic...');
    
    const filePath = '/Users/dtaplin21/DellSystemManager/backend/uploads/asbuilt-files/3589cf62-d099-4751-9388-6efef50edc44.xlsx';
    const fileBuffer = fs.readFileSync(filePath);
    
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    console.log(`📊 Total rows: ${jsonData.length}\n`);
    
    // Test the current looksLikeHeaderRow logic
    const headerRows = [];
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const looksLikeHeader = looksLikeHeaderRow(row);
      
      if (looksLikeHeader) {
        headerRows.push(i);
        const nonEmptyCells = row.filter(cell => cell && cell.toString().trim() !== '');
        console.log(`✅ Header found at row ${i + 1}: [${nonEmptyCells.map(cell => `"${cell}"`).join(', ')}]`);
      }
    }
    
    console.log(`\n📊 Found ${headerRows.length} header rows at positions:`, headerRows);
    
    // Test the duplicate detection logic
    if (headerRows.length > 1) {
      console.log('\n🔍 Testing duplicate detection logic...');
      
      const firstHeader = jsonData[headerRows[0]].map(h => h?.toString().toLowerCase().trim());
      console.log(`First header: [${firstHeader.map(h => `"${h}"`).join(', ')}]`);
      
      const isDuplicateHeader = headerRows.every(idx => {
        const header = jsonData[idx].map(h => h?.toString().toLowerCase().trim());
        const matches = JSON.stringify(header) === JSON.stringify(firstHeader);
        console.log(`Row ${idx + 1} matches: ${matches}`);
        if (!matches) {
          const nonEmptyCells = jsonData[idx].filter(cell => cell && cell.toString().trim() !== '');
          console.log(`  Content: [${nonEmptyCells.map(cell => `"${cell}"`).join(', ')}]`);
        }
        return matches;
      });
      
      console.log(`\nIs duplicate header: ${isDuplicateHeader}`);
      
      if (isDuplicateHeader) {
        console.log('✅ Would trigger multi-section processing with deduplication');
      } else {
        console.log('❌ Would trigger single-table processing (only first table)');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugHeaderDetection();
