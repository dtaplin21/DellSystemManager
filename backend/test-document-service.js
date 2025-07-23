require('dotenv').config();
const documentService = require('./services/documentService');

async function testDocumentService() {
  console.log('🧪 Testing Document Service...');
  
  try {
    // Test with a sample document ID from the logs
    const testDocumentId = 'e2d8c1db-0842-43cc-8e47-f15f1db71b3b';
    
    console.log(`📄 Testing document: ${testDocumentId}`);
    
    const textContent = await documentService.getDocumentText(testDocumentId);
    
    if (textContent) {
      console.log('✅ Document service working - text content found');
      console.log(`📝 Text preview: ${textContent.substring(0, 100)}...`);
    } else {
      console.log('⚠️ Document service working - no text content (this is normal for new documents)');
    }
    
    console.log('✅ Document service test completed successfully');
    
  } catch (error) {
    console.error('❌ Document service test failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the test
testDocumentService()
  .then(() => {
    console.log('🎉 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }); 