const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

async function testImport() {
  try {
    console.log('🧪 Testing Excel import with multi-section file...\n');

    const projectId = '49e74875-5d29-4027-a817-d53602e68e4c';
    const filePath = '/Users/dtaplin21/DellSystemManager/backend/uploads/asbuilt-files/3589cf62-d099-4751-9388-6efef50edc44.xlsx';

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('❌ Test file not found:', filePath);
      return;
    }

    console.log('📁 File found:', path.basename(filePath));
    console.log('📊 Project ID:', projectId);
    console.log('🎯 Domain: auto-detect\n');

    // Create form data
    const form = new FormData();
    form.append('excelFile', fs.createReadStream(filePath));
    form.append('projectId', projectId);
    form.append('importScope', 'project-wide'); // This triggers auto-detect

    // Send import request
    console.log('📤 Sending import request...\n');
    const response = await axios.post(
      'http://localhost:8003/api/asbuilt/import',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'x-dev-bypass': 'true'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    console.log('✅ Import completed!\n');
    console.log('📊 Results:');
    console.log('  - Success:', response.data.success);
    console.log('  - Domain:', response.data.detectedDomain);
    console.log('  - Records imported:', response.data.importedRows);
    console.log('  - Errors:', response.data.errors?.length || 0);
    console.log('  - Confidence:', (response.data.confidence * 100).toFixed(1) + '%');
    console.log('  - Used AI:', response.data.usedAI);

    if (response.data.errors && response.data.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      response.data.errors.slice(0, 5).forEach(err => {
        console.log(`  - Row ${err.row}: ${err.error}`);
      });
    }

    // Verify records in database
    console.log('\n🔍 Verifying records in database...');
    const verifyResponse = await axios.get(
      `http://localhost:8003/api/asbuilt/${projectId}`,
      {
        headers: { 'x-dev-bypass': 'true' }
      }
    );

    const records = verifyResponse.data.records;
    console.log('📊 Total records in database:', records.length);

    // Count unique panels
    const panelCounts = {};
    records.forEach(record => {
      const panelNum = record.mapped_data.panelNumber;
      panelCounts[panelNum] = (panelCounts[panelNum] || 0) + 1;
    });

    const uniquePanels = Object.keys(panelCounts).length;
    const duplicates = Object.entries(panelCounts).filter(([_, count]) => count > 1);

    console.log('📊 Unique panel numbers:', uniquePanels);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️  Duplicate panels found:');
      duplicates.slice(0, 10).forEach(([panel, count]) => {
        console.log(`  - Panel ${panel}: ${count} times`);
      });
    } else {
      console.log('✅ No duplicates - all panels are unique!');
    }

    // Show panel number range
    const panelNumbers = Object.keys(panelCounts)
      .filter(p => /^\d+$/.test(p))
      .map(p => parseInt(p))
      .sort((a, b) => a - b);

    if (panelNumbers.length > 0) {
      console.log('\n📊 Panel number range:');
      console.log('  - Min:', panelNumbers[0]);
      console.log('  - Max:', panelNumbers[panelNumbers.length - 1]);
      console.log('  - Count:', panelNumbers.length);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.data?.details) {
      console.error('Details:', error.response.data.details);
    }
  }
}

testImport();

