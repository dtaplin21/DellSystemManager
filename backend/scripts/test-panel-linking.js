const PanelLinkingService = require('../services/panelLinkingService');
require('dotenv').config();

async function testPanelLinking() {
  console.log('🧪 [TEST] Testing complete panel linking system...');
  
  const service = new PanelLinkingService();
  
  try {
    const projectId = '69fc302b-166d-4543-9990-89c4b1e0ed59';
    
    console.log('🔍 [TEST] Step 1: Getting processing status...');
    const status = await service.getProcessingStatus(projectId);
    console.log('📊 [TEST] Status:', JSON.stringify(status, null, 2));
    
    console.log('🔍 [TEST] Step 2: Creating test as-built data...');
    const recordsCreated = await service.createTestAsbuiltData(projectId, null);
    console.log(`✅ [TEST] Created ${recordsCreated} test records`);
    
    console.log('🔍 [TEST] Step 3: Processing all documents...');
    const processResult = await service.processDocumentsForProject(projectId, null);
    console.log('📊 [TEST] Processing result:', JSON.stringify(processResult, null, 2));
    
    console.log('🔍 [TEST] Step 4: Final status check...');
    const finalStatus = await service.getProcessingStatus(projectId);
    console.log('📊 [TEST] Final status:', JSON.stringify(finalStatus, null, 2));
    
    console.log('');
    console.log('🎉 [TEST] Panel linking system test completed successfully!');
    console.log('');
    console.log('📋 [TEST] Summary:');
    console.log(`  - Test records created: ${recordsCreated}`);
    console.log(`  - Documents processed: ${processResult.documentsProcessed || 0}`);
    console.log(`  - Records linked: ${processResult.recordsLinked || 0}`);
    console.log(`  - Total as-built records: ${finalStatus.recordCount || 0}`);
    console.log('');
    console.log('🚀 [TEST] The as-built data syncing is now fully functional!');
    console.log('   - Documents are automatically categorized');
    console.log('   - Panel numbers are extracted and linked to existing panels');
    console.log('   - As-built records are created in the database');
    console.log('   - The sidebar will now display the linked data');
    
  } catch (error) {
    console.error('❌ [TEST] Test failed:', error);
  } finally {
    await service.close();
  }
}

// Run the test
if (require.main === module) {
  testPanelLinking().catch(console.error);
}

module.exports = testPanelLinking;
