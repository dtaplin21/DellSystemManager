const xlsx = require('xlsx');
const fs = require('fs');

function checkPanelLocations() {
  try {
    console.log('🔍 Checking panel locations across sections...');
    
    const filePath = '/Users/dtaplin21/DellSystemManager/backend/uploads/asbuilt-files/3589cf62-d099-4751-9388-6efef50edc44.xlsx';
    const fileBuffer = fs.readFileSync(filePath);
    
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    // Define the sections
    const sections = [
      { startRow: 20, name: "Section 1" },
      { startRow: 79, name: "Section 2" },
      { startRow: 138, name: "Section 3" },
      { startRow: 197, name: "Section 4" },
      { startRow: 256, name: "Section 5" },
      { startRow: 315, name: "Section 6" },
      { startRow: 374, name: "Section 7" },
      { startRow: 433, name: "Section 8" },
      { startRow: 492, name: "Section 9" },
      { startRow: 551, name: "Section 10" },
      { startRow: 610, name: "Section 11" }
    ];
    
    // Collect all panel data
    const allPanels = [];
    
    sections.forEach((section, index) => {
      console.log(`\n📍 ${section.name}:`);
      
      // Process data rows after the header
      for (let i = 1; i < 20; i++) { // Check up to 20 rows after header
        const dataRow = jsonData[section.startRow + i];
        if (!dataRow) break;
        
        const dateValue = dataRow[1]; // Date column
        const panelValue = dataRow[2]; // Panel # column
        const lengthValue = dataRow[3]; // Length column
        const widthValue = dataRow[4]; // Width column
        const rollValue = dataRow[5]; // Roll Number column
        const locationValue = dataRow[7]; // Panel Location column
        
        // Check if this is a valid data row
        if (panelValue && typeof panelValue === 'number' && panelValue > 0) {
          const panelData = {
            section: section.name,
            date: dateValue,
            panelNumber: panelValue,
            length: lengthValue,
            width: widthValue,
            rollNumber: rollValue,
            location: locationValue
          };
          
          allPanels.push(panelData);
          
          if (i <= 3) { // Show first 3 panels from each section
            console.log(`  Panel ${panelValue}: ${locationValue || 'no location'} (Date: ${dateValue}, Roll: ${rollValue})`);
          }
        } else {
          // If we hit an invalid row, this section is done
          break;
        }
      }
    });
    
    // Check for duplicates
    console.log('\n🔍 Checking for duplicate panel numbers across sections...\n');
    
    const panelGroups = {};
    allPanels.forEach(panel => {
      if (!panelGroups[panel.panelNumber]) {
        panelGroups[panel.panelNumber] = [];
      }
      panelGroups[panel.panelNumber].push(panel);
    });
    
    // Show duplicates
    Object.keys(panelGroups).forEach(panelNumber => {
      const panels = panelGroups[panelNumber];
      if (panels.length > 1) {
        console.log(`⚠️  Panel ${panelNumber} appears in ${panels.length} sections:`);
        panels.forEach(panel => {
          console.log(`    - ${panel.section}: ${panel.location || 'no location'} (Date: ${panel.date})`);
        });
        console.log('');
      }
    });
    
    // Show unique panels by section
    console.log('📊 Panel distribution by section:\n');
    sections.forEach(section => {
      const sectionPanels = allPanels.filter(p => p.section === section.name);
      if (sectionPanels.length > 0) {
        const panelNumbers = sectionPanels.map(p => p.panelNumber).sort((a, b) => a - b);
        const locations = [...new Set(sectionPanels.map(p => p.location).filter(l => l))];
        console.log(`${section.name}: Panels ${panelNumbers.join(', ')} (${sectionPanels.length} total) - Locations: ${locations.join(', ')}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPanelLocations();
