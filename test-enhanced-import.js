const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testEnhancedImport() {
  try {
    console.log('🧪 Testing Enhanced Import with AI Analysis...');
    
    // Test data - create a simple Excel file for testing
    const testData = [
      ['Panel #', 'Date', 'Location', 'Notes'],
      ['P001', '2023-11-01', 'Area A', 'Test panel 1'],
      ['P002', '2023-11-01', 'Area B', 'Test panel 2'],
      ['P003', '2023-11-01', 'Area C', 'Test panel 3']
    ];
    
    // Create a simple CSV-like structure for testing
    const csvContent = testData.map(row => row.join(',')).join('\n');
    
    // Create form data
    const form = new FormData();
    form.append('excelFile', Buffer.from(csvContent), {
      filename: 'test-panels.csv',
      contentType: 'text/csv'
    });
    form.append('projectId', '49e74875-5d29-4027-a817-d53602e68e4c');
    form.append('importScope', 'project-wide');
    
    console.log('📤 Sending import request...');
    
    const response = await fetch('http://localhost:8003/api/asbuilt/import', {
      method: 'POST',
      body: form,
      headers: {
        'x-dev-bypass': 'true' // Bypass auth for testing
      }
    });
    
    const result = await response.json();
    
    console.log('📊 Import Response:');
    console.log('✅ Success:', result.success);
    console.log('📈 Records created:', result.count);
    console.log('🎯 Detected panels:', result.detectedPanels);
    console.log('📋 Processed domains:', result.processedDomains);
    
    // NEW: Check AI Analysis
    if (result.aiAnalysis) {
      console.log('\n🤖 AI Analysis:');
      console.log('📝 Summary:', result.aiAnalysis.summary?.substring(0, 200) + '...');
      console.log('📊 Data Quality Score:', result.aiAnalysis.dataQuality?.score);
      console.log('💡 Recommendations:', result.aiAnalysis.recommendations?.length || 0);
      console.log('🔍 Insights:', result.aiAnalysis.insights?.length || 0);
    }
    
    // NEW: Check Breakdown
    if (result.breakdown) {
      console.log('\n📊 Import Breakdown:');
      console.log('📥 Total Processed:', result.breakdown.totalProcessed);
      console.log('✅ Successfully Imported:', result.breakdown.successfullyImported);
      console.log('🚫 Duplicates Skipped:', result.breakdown.duplicatesSkipped);
      console.log('⚡ Conflicts Resolved:', result.breakdown.conflictsResolved);
      console.log('🎯 Panels Affected:', result.breakdown.panelsAffected);
      console.log('🤖 AI Confidence:', result.breakdown.aiConfidence);
    }
    
    // NEW: Check Duplicates
    if (result.duplicates && result.duplicates.length > 0) {
      console.log('\n⚠️ Duplicates Found:');
      result.duplicates.forEach(dup => {
        console.log(`  - Panel ${dup.panelNumber}: ${dup.reason}`);
      });
    }
    
    // NEW: Check Conflicts
    if (result.conflicts && result.conflicts.length > 0) {
      console.log('\n⚡ Conflicts Detected:');
      result.conflicts.forEach(conflict => {
        console.log(`  - Panel ${conflict.panelNumber}: ${conflict.conflictType}`);
      });
    }
    
    console.log('\n🎉 Enhanced Import Test Completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEnhancedImport();
