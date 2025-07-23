require('dotenv').config();

console.log('🧪 Testing Document Service Version...');

// Check the actual file content
const fs = require('fs');
const documentServicePath = './services/documentService.js';
const documentServiceContent = fs.readFileSync(documentServicePath, 'utf8');

console.log('📄 Document service file path:', documentServicePath);
console.log('📄 File size:', documentServiceContent.length, 'bytes');

// Check for specific patterns
const hasTextContent = documentServiceContent.includes('text_content');
const hasPath = documentServiceContent.includes('path');
const hasFilePath = documentServiceContent.includes('file_path');

console.log('🔍 Column references in file:');
console.log('  - text_content:', hasTextContent);
console.log('  - path:', hasPath);
console.log('  - file_path:', hasFilePath);

// Now try to load the service
try {
  const documentService = require('./services/documentService');
  console.log('✅ Document service loaded successfully');
  
  // Test with a sample document ID
  const testDocumentId = 'e2d8c1db-0842-43cc-8e47-f15f1db71b3b';
  console.log(`📄 Testing document: ${testDocumentId}`);
  
  // This will show us exactly what error we get
  documentService.getDocumentText(testDocumentId)
    .then(textContent => {
      if (textContent) {
        console.log('✅ Document service working - text content found');
        console.log(`📝 Text preview: ${textContent.substring(0, 100)}...`);
      } else {
        console.log('⚠️ Document service working - no text content');
      }
    })
    .catch(error => {
      console.error('❌ Document service error:', error.message);
      console.error('Error stack:', error.stack);
    });
    
} catch (error) {
  console.error('❌ Failed to load document service:', error.message);
} 