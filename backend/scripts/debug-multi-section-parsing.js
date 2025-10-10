const xlsx = require('xlsx');
const fs = require('fs');

function looksLikeHeaderRow(row) {
  const headerKeywords = ['panel', 'date', 'id', 'number', 'type', 'name', 'location', 'test', 'result'];
  const cellsWithKeywords = row.filter(cell => {
    if (!cell) return false;
    const cellStr = cell.toString().toLowerCase();
    return headerKeywords.some(keyword => cellStr.includes(keyword));
  });

  const nonNullCells = row.filter(cell => cell !== null && cell !== undefined && cell.toString().trim() !== '');
  
  return cellsWithKeywords.length >= 3 && nonNullCells.length >= 4;
}

function debugMultiSectionParsing() {
  try {
    console.log('🔍 Debugging multi-section parsing logic...');
    
    const filePath = '/Users/dtaplin21/DellSystemManager/backend/uploads/asbuilt-files/3589cf62-d099-4751-9388-6efef50edc44.xlsx';
    const fileBuffer = fs.readFileSync(filePath);
    
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    // Find header rows
    const headerRows = [];
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (looksLikeHeaderRow(row)) {
        headerRows.push(i);
      }
    }
    
    console.log(`📊 Found ${headerRows.length} header rows:`, headerRows);
    
    // Simulate parseMultiSectionFile logic
    const headers = jsonData[headerRows[0]];
    const allDataRows = [];
    const seenPanels = new Set();
    
    console.log(`📋 Headers: [${headers.map(h => `"${h}"`).join(', ')}]`);
    
    // Find panel column index
    const panelIndex = headers.findIndex(h => 
      h && h.toString().toLowerCase().includes('panel')
    );
    console.log(`📊 Panel column index: ${panelIndex}`);
    
    // Process each section
    for (let i = 0; i < headerRows.length; i++) {
      const sectionStart = headerRows[i] + 1;
      const sectionEnd = i < headerRows.length - 1 ? headerRows[i + 1] : jsonData.length;
      
      console.log(`\n📍 Section ${i + 1}: rows ${sectionStart}-${sectionEnd}`);
      
      // Extract data rows for this section
      const sectionData = jsonData.slice(sectionStart, sectionEnd).filter(row => 
        row.some(cell => cell && cell.toString().trim() !== '')
      );
      
      console.log(`  Found ${sectionData.length} non-empty rows in section`);
      
      let sectionPanels = 0;
      
      // Process each row in the section
      for (const row of sectionData) {
        const panelCell = row[panelIndex];
        
        if (panelCell) {
          const panelNum = panelCell.toString().trim();
          
          if (!seenPanels.has(panelNum)) {
            seenPanels.add(panelNum);
            allDataRows.push(row);
            sectionPanels++;
            console.log(`    ✅ Keeping panel ${panelNum}`);
          } else {
            console.log(`    🚫 Skipping duplicate panel ${panelNum}`);
          }
        } else {
          console.log(`    ⚠️  Row with no panel number: [${row.slice(0, 3).map(cell => `"${cell}"`).join(', ')}...]`);
        }
      }
      
      console.log(`  Section ${i + 1} contributed ${sectionPanels} unique panels`);
    }
    
    console.log(`\n📊 Final results:`);
    console.log(`  Total unique panels: ${allDataRows.length}`);
    console.log(`  Panel numbers: ${Array.from(seenPanels).sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugMultiSectionParsing();
