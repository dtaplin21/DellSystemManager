const documentService = require('../services/documentService');
const { db } = require('../db/index');
const { documents } = require('../db/schema');
const { eq, isNull } = require('drizzle-orm');

async function extractExistingDocuments() {
  try {
    console.log('🔍 Finding documents without text content...');
    
    // Get all documents that don't have text content
    const documentsWithoutText = await db
      .select()
      .from(documents)
      .where(isNull(documents.textContent));
    
    console.log(`📄 Found ${documentsWithoutText.length} documents without text content`);
    
    if (documentsWithoutText.length === 0) {
      console.log('✅ All documents already have text content');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const doc of documentsWithoutText) {
      try {
        console.log(`📄 Processing: ${doc.name}`);
        
        if (!doc.path) {
          console.warn(`⚠️ No file path for document: ${doc.name}`);
          errorCount++;
          continue;
        }
        
        // Extract text content
        const textContent = await documentService.extractTextFromFile(doc.path);
        
        if (textContent) {
          // Update the document in database
          await db
            .update(documents)
            .set({ textContent: textContent })
            .where(eq(documents.id, doc.id));
          
          console.log(`✅ Updated text content for: ${doc.name} (${textContent.length} characters)`);
          successCount++;
        } else {
          console.warn(`⚠️ No text content extracted for: ${doc.name}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${doc.name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Extraction Summary:');
    console.log(`✅ Successfully processed: ${successCount} documents`);
    console.log(`❌ Failed to process: ${errorCount} documents`);
    console.log(`📄 Total documents: ${documentsWithoutText.length}`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

// Run the script
extractExistingDocuments()
  .then(() => {
    console.log('🎉 Document extraction script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
