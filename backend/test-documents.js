const { db } = require('./db/index');
const { documents } = require('./db/schema');
const { eq } = require('drizzle-orm');

async function testDocuments() {
  try {
    console.log('🔍 Testing documents...');
    
    // Get all documents
    const allDocuments = await db
      .select()
      .from(documents);
    
    console.log(`📄 Found ${allDocuments.length} documents`);
    
    allDocuments.forEach((doc, index) => {
      console.log(`Document ${index + 1}:`);
      console.log(`  - Name: ${doc.name}`);
      console.log(`  - Has textContent: ${!!doc.textContent}`);
      console.log(`  - Text length: ${doc.textContent ? doc.textContent.length : 0}`);
      console.log(`  - Has path: ${!!doc.path}`);
      console.log('  ---');
    });
    
    // Test AI query with sample data
    const testData = {
      projectId: allDocuments[0]?.projectId || 'test-project',
      question: 'What are the specifications?',
      documents: allDocuments.slice(0, 2).map(doc => ({
        id: doc.id,
        filename: doc.name,
        text: doc.textContent || 'No text content'
      }))
    };
    
    console.log('🧪 Test data for AI query:', JSON.stringify(testData, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDocuments()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
