const fs = require('fs');
const path = require('path');
const HandwritingOCRService = require('./backend/services/handwriting-ocr');

async function testHandwritingOCR() {
  console.log('🧪 Testing Handwriting OCR Service...');
  
  // Initialize the service
  const ocrService = new HandwritingOCRService();
  
  // Check if OpenAI API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is not set');
    console.log('💡 Please set your OpenAI API key: export OPENAI_API_KEY="your-key-here"');
    return;
  }
  
  console.log('✅ OpenAI API key is configured');
  
  // Test with a sample image (you'll need to provide one)
  const testImagePath = process.argv[2];
  
  if (!testImagePath) {
    console.log('📝 Usage: node test-handwriting-debug.js <path-to-image>');
    console.log('📝 Example: node test-handwriting-debug.js ./test-image.jpg');
    return;
  }
  
  if (!fs.existsSync(testImagePath)) {
    console.error('❌ Test image not found:', testImagePath);
    return;
  }
  
  try {
    console.log('📁 Reading test image:', testImagePath);
    const imageBuffer = fs.readFileSync(testImagePath);
    const mimeType = path.extname(testImagePath).toLowerCase() === '.pdf' 
      ? 'application/pdf' 
      : 'image/jpeg';
    
    console.log('📊 Image details:', {
      size: imageBuffer.length,
      mimeType: mimeType,
      filename: path.basename(testImagePath)
    });
    
    // Test text extraction
    console.log('\n🔄 Step 1: Extracting text from image...');
    const extractedData = await ocrService.extractTextFromFile(imageBuffer, mimeType);
    console.log('✅ Text extraction completed');
    console.log('📊 Extraction result type:', extractedData.type);
    console.log('📄 Extracted data preview:', JSON.stringify(extractedData, null, 2).substring(0, 500) + '...');
    
    // Test QC data parsing
    console.log('\n🔄 Step 2: Parsing QC data...');
    const qcData = await ocrService.parseQCData(extractedData);
    console.log('✅ QC data parsing completed');
    console.log('📊 Parsed QC data:', JSON.stringify(qcData, null, 2));
    
    // Test validation
    console.log('\n🔄 Step 3: Validating QC data...');
    const validation = ocrService.validateQCData(qcData);
    console.log('✅ Validation completed');
    console.log('📊 Validation result:', validation);
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
}

// Run the test
testHandwritingOCR().catch(console.error); 