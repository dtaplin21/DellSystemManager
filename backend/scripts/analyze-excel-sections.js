const xlsx = require('xlsx');
const fs = require('fs');

function analyzeExcelSections() {
  try {
    console.log('🔍 Analyzing Excel file sections in detail...');
    
    const filePath = '/Users/dtaplin21/DellSystemManager/backend/uploads/asbuilt-files/3589cf62-d099-4751-9388-6efef50edc44.xlsx';
    const fileBuffer = fs.readFileSync(filePath);
    
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    console.log(`📊 Total rows in Excel: ${jsonData.length}\n`);
    
    // Define the sections we found
    const sections = [
      { startRow: 20, name: "Section 1", description: "First panel placement data" },
      { startRow: 79, name: "Section 2", description: "Second panel placement data" },
      { startRow: 138, name: "Section 3", description: "Third panel placement data" },
      { startRow: 197, name: "Section 4", description: "Fourth panel placement data" },
      { startRow: 256, name: "Section 5", description: "Fifth panel placement data" },
      { startRow: 315, name: "Section 6", description: "Sixth panel placement data" },
      { startRow: 374, name: "Section 7", description: "Seventh panel placement data" },
      { startRow: 433, name: "Section 8", description: "Eighth panel placement data" },
      { startRow: 492, name: "Section 9", description: "Ninth panel placement data" },
      { startRow: 551, name: "Section 10", description: "Tenth panel placement data" },
      { startRow: 610, name: "Section 11", description: "Eleventh panel placement data" }
    ];
    
    sections.forEach((section, index) => {
      console.log(`📍 ${section.name} (Row ${section.startRow + 1}):`);
      
      // Show the header row
      const headerRow = jsonData[section.startRow];
      const headerCells = headerRow.filter(cell => cell && cell.toString().trim() !== '');
      console.log(`   Header: [${headerCells.map(cell => `"${cell}"`).join(', ')}]`);
      
      // Show the first few data rows
      console.log(`   Data rows:`);
      for (let i = 1; i <= 3; i++) {
        const dataRow = jsonData[section.startRow + i];
        if (dataRow) {
          const dataCells = dataRow.filter(cell => cell && cell.toString().trim() !== '');
          if (dataCells.length >= 3) {
            console.log(`     Row ${section.startRow + i + 1}: [${dataCells.map(cell => `"${cell}"`).join(', ')}]`);
          }
        }
      }
      
      // Show what comes before this section (to understand the pattern)
      console.log(`   What's before this section:`);
      for (let i = Math.max(0, section.startRow - 5); i < section.startRow; i++) {
        const beforeRow = jsonData[i];
        const beforeCells = beforeRow.filter(cell => cell && cell.toString().trim() !== '');
        if (beforeCells.length > 0) {
          console.log(`     Row ${i + 1}: [${beforeCells.map(cell => `"${cell}"`).join(', ')}]`);
        }
      }
      
      console.log('');
    });
    
    // Look for patterns that might identify sections
    console.log('🔍 Looking for section identification patterns...\n');
    
    // Check for repeating patterns before each section
    const patterns = [];
    sections.forEach((section, index) => {
      const beforeRows = [];
      for (let i = Math.max(0, section.startRow - 10); i < section.startRow; i++) {
        const row = jsonData[i];
        const cells = row.filter(cell => cell && cell.toString().trim() !== '');
        if (cells.length > 0) {
          beforeRows.push({ row: i + 1, content: cells.join(' | ') });
        }
      }
      patterns.push({ section: section.name, beforeRows });
    });
    
    console.log('📋 Patterns before each section:');
    patterns.forEach((pattern, index) => {
      console.log(`\n${pattern.section}:`);
      pattern.beforeRows.slice(-3).forEach(row => {
        console.log(`  Row ${row.row}: ${row.content}`);
      });
    });
    
    // Look for unique identifiers
    console.log('\n🔍 Looking for unique section identifiers...\n');
    
    sections.forEach((section, index) => {
      const headerRow = jsonData[section.startRow];
      const firstDataRow = jsonData[section.startRow + 1];
      
      if (firstDataRow) {
        const dateValue = firstDataRow[1]; // Date column
        const panelValue = firstDataRow[2]; // Panel # column
        const locationValue = firstDataRow[6]; // Panel Location column
        
        console.log(`${section.name}:`);
        console.log(`  - Date: ${dateValue}`);
        console.log(`  - First Panel: ${panelValue}`);
        console.log(`  - Location: ${locationValue}`);
        console.log('');
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeExcelSections();
