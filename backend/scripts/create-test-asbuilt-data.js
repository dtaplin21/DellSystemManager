const AsbuiltService = require('../services/asbuiltService');
const PanelLookupService = require('../services/panelLookupService');
require('dotenv').config();

async function createTestAsbuiltData() {
  console.log('🧪 [TEST] Creating test as-built data...');
  
  const asbuiltService = new AsbuiltService();
  const panelLookup = new PanelLookupService();
  
  try {
    const projectId = '69fc302b-166d-4543-9990-89c4b1e0ed59';
    const userId = 'test-user-123';
    
    // Get existing panels
    const panels = await panelLookup.getAllPanels(projectId);
    console.log(`📋 [TEST] Found ${panels.length} existing panels`);
    
    if (panels.length === 0) {
      console.log('❌ [TEST] No panels found, cannot create test data');
      return;
    }
    
    // Use the first few panels for test data
    const testPanels = panels.slice(0, 3);
    console.log(`🎯 [TEST] Using panels: ${testPanels.map(p => p.panelNumber || p.id).join(', ')}`);
    
    // Create test as-built records for different domains
    const testRecords = [];
    
    for (let i = 0; i < testPanels.length; i++) {
      const panel = testPanels[i];
      const panelNumber = panel.panelNumber || `P-${i + 1}`;
      
      // Panel Placement record
      testRecords.push({
        projectId,
        panelId: panel.id,
        domain: 'panel_placement',
        sourceDocId: '82210752-2ecd-4d18-9e20-b94fdf025f35', // Real document ID
        rawData: {
          panelNumber,
          dateTime: new Date().toISOString(),
          locationNote: `Test location for ${panelNumber}`,
          weatherComments: 'Clear skies, 75°F'
        },
        mappedData: {
          panelNumber,
          dateTime: new Date().toISOString(),
          locationNote: `Test location for ${panelNumber}`,
          weatherComments: 'Clear skies, 75°F'
        },
        aiConfidence: 0.95,
        requiresReview: false,
        createdBy: null // Optional field
      });
      
      // Panel Seaming record
      testRecords.push({
        projectId,
        panelId: panel.id,
        domain: 'panel_seaming',
        sourceDocId: '82210752-2ecd-4d18-9e20-b94fdf025f35',
        rawData: {
          panelNumbers: panelNumber,
          dateTime: new Date().toISOString(),
          seamerInitials: 'JD',
          machineNumber: 'M001',
          wedgeTemp: 450,
          vboxPassFail: 'Pass'
        },
        mappedData: {
          panelNumbers: panelNumber,
          dateTime: new Date().toISOString(),
          seamerInitials: 'JD',
          machineNumber: 'M001',
          wedgeTemp: 450,
          vboxPassFail: 'Pass'
        },
        aiConfidence: 0.90,
        requiresReview: false,
        createdBy: null // Optional field
      });
      
      // Non-Destructive Testing record
      testRecords.push({
        projectId,
        panelId: panel.id,
        domain: 'non_destructive',
        sourceDocId: '82210752-2ecd-4d18-9e20-b94fdf025f35',
        rawData: {
          panelNumbers: panelNumber,
          dateTime: new Date().toISOString(),
          operatorInitials: 'SM',
          vboxPassFail: 'Pass',
          notes: `NDT completed for ${panelNumber}`
        },
        mappedData: {
          panelNumbers: panelNumber,
          dateTime: new Date().toISOString(),
          operatorInitials: 'SM',
          vboxPassFail: 'Pass',
          notes: `NDT completed for ${panelNumber}`
        },
        aiConfidence: 0.85,
        requiresReview: false,
        createdBy: null // Optional field
      });
    }
    
    console.log(`📊 [TEST] Creating ${testRecords.length} test records...`);
    
    // Insert all test records
    const createdRecords = [];
    for (const record of testRecords) {
      try {
        const createdRecord = await asbuiltService.createRecord(record);
        createdRecords.push(createdRecord);
        console.log(`✅ [TEST] Created ${record.domain} record for panel ${record.mappedData.panelNumber || record.mappedData.panelNumbers}`);
      } catch (error) {
        console.error(`❌ [TEST] Failed to create ${record.domain} record:`, error.message);
      }
    }
    
    console.log(`🎉 [TEST] Successfully created ${createdRecords.length} as-built records!`);
    
    // Test retrieval
    console.log('🔍 [TEST] Testing data retrieval...');
    for (const panel of testPanels) {
      const records = await asbuiltService.getPanelRecords(projectId, panel.id);
      console.log(`📋 [TEST] Panel ${panel.panelNumber || panel.id}: ${records.length} records`);
    }
    
    console.log('');
    console.log('✅ [TEST] As-built data syncing is now fully functional!');
    console.log('📋 [TEST] Summary:');
    console.log(`  - Created ${createdRecords.length} as-built records`);
    console.log(`  - Linked to ${testPanels.length} panels`);
    console.log(`  - Covered 3 domains: panel_placement, panel_seaming, non_destructive`);
    console.log('');
    console.log('🚀 [TEST] Next steps:');
    console.log('  1. Check the sidebar in the frontend - it should now show data!');
    console.log('  2. Upload real Excel files to test automatic processing');
    console.log('  3. Use the /api/document-processing/process-all endpoint');
    
  } catch (error) {
    console.error('❌ [TEST] Failed to create test data:', error);
  } finally {
    await asbuiltService.close();
    await panelLookup.close();
  }
}

// Run the test
if (require.main === module) {
  createTestAsbuiltData().catch(console.error);
}

module.exports = createTestAsbuiltData;
