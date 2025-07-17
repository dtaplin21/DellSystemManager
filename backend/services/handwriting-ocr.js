const OpenAI = require('openai');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;
const pdf = require('pdf-parse');

class HandwritingOCRService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Extract text from uploaded file (handwritten image or PDF)
   */
  async extractTextFromFile(fileBuffer, mimeType) {
    try {
      console.log('🔄 Extracting text from file with mime type:', mimeType);
      
      if (mimeType === 'application/pdf') {
        console.log('📄 Processing PDF file...');
        return await this.extractTextFromPDF(fileBuffer);
      } else if (mimeType.startsWith('image/')) {
        console.log('🖼️ Processing image file...');
        return await this.extractTextFromImage(fileBuffer, mimeType);
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      console.error('❌ Error extracting text from file:', error);
      throw new Error(`Failed to extract text from file: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF using pdf-parse
   */
  async extractTextFromPDF(pdfBuffer) {
    try {
      console.log('📄 Extracting text from PDF...');
      
      const data = await pdf(pdfBuffer);
      console.log('✅ PDF text extracted successfully');
      console.log('📊 PDF info:', {
        pages: data.numpages,
        textLength: data.text.length,
        info: data.info
      });
      
      // Return structured data for PDF text
      return {
        type: 'pdf',
        text: data.text,
        pages: data.numpages,
        info: data.info,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Extract text from handwritten QC form image using OpenAI Vision
   */
  async extractTextFromImage(imageBuffer, imageType = 'image/jpeg') {
    try {
      console.log('🖼️ Extracting text from image using OpenAI Vision...');
      console.log('📊 Image buffer size:', imageBuffer.length, 'bytes');
      console.log('📊 Image type:', imageType);
      
      const base64Image = imageBuffer.toString('base64');
      console.log('📊 Base64 image length:', base64Image.length);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert OCR system specialized in reading handwritten QC (Quality Control) forms for geosynthetic engineering. 
            
            Extract ALL visible text from this handwritten form, paying special attention to:
            - Project information (name, location, date)
            - Panel data (IDs, dimensions, patches, seam welders)
            - Test results (tester names, test types, values, pass/fail)
            - Inspector notes and remarks
            
            Be very careful with:
            - Faint pencil marks and light handwriting
            - Numbers vs letters (0 vs O, 1 vs I, 5 vs S)
            - Measurement units (ft, m, mm, etc.)
            - Test result values and their units
            
            IMPORTANT: If you cannot read any text clearly, return a JSON object with an "error" field explaining what you see.
            If you can read some text, return it in a structured format with clear labels.
            
            Return the extracted text in a structured JSON format with clear field labels.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please extract all handwritten text from this QC form image. Focus on accuracy for pencil writing and provide structured output. If you cannot read the text clearly, explain what you see."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${imageType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000
      });

      console.log('✅ OpenAI Vision response received');
      console.log('📊 Response usage:', response.usage);
      
      const responseContent = response.choices[0].message.content;
      console.log('📄 Raw response content:', responseContent);
      
      let result;
      try {
        result = JSON.parse(responseContent);
        console.log('✅ Image text extracted successfully using OpenAI Vision');
        console.log('📊 Extracted result structure:', Object.keys(result));
      } catch (parseError) {
        console.error('❌ JSON parse error for image extraction:', parseError);
        console.error('❌ Raw response content:', responseContent);
        throw new Error(`Invalid JSON response from OpenAI Vision: ${parseError.message}`);
      }
      
      return {
        type: 'image',
        text: result,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error extracting text from image:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        status: error.status
      });
      
      if (error.name === 'OpenAIError') {
        console.error('❌ OpenAI API error details:', {
          status: error.status,
          code: error.code,
          type: error.type
        });
        throw new Error(`OpenAI Vision API error: ${error.message}`);
      }
      
      throw new Error(`Failed to extract text from handwritten form: ${error.message}`);
    }
  }

  /**
   * Parse extracted text into structured QC data
   */
  async parseQCData(extractedData) {
    try {
      console.log('🔄 Parsing extracted data into structured QC format...');
      console.log('📊 Extracted data type:', extractedData.type);
      
      let textContent;
      if (extractedData.type === 'pdf') {
        // For PDFs, use the raw text content
        textContent = extractedData.text;
        console.log('📄 PDF text length:', textContent.length);
        console.log('📄 PDF text preview:', textContent.substring(0, 200) + '...');
      } else if (extractedData.type === 'image') {
        // For images, use the structured OCR result
        textContent = JSON.stringify(extractedData.text);
        console.log('🖼️ Image OCR result:', extractedData.text);
      } else {
        throw new Error('Unknown extraction type: ' + extractedData.type);
      }

      console.log('🤖 Sending to OpenAI for parsing...');
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are a QC data processing expert. Parse the extracted text into a standardized QC data structure.

            Expected QC schema:
            {
              "projectInfo": {
                "name": "string",
                "location": "string", 
                "date": "YYYY-MM-DD",
                "inspector": "string",
                "weather": "string"
              },
              "panels": [
                {
                  "panelId": "string",
                  "width": "number (ft)",
                  "height": "number (ft)", 
                  "patches": "number",
                  "seamWelder": "string",
                  "material": "string"
                }
              ],
              "tests": [
                {
                  "testId": "string",
                  "type": "string (seam strength, peel, etc.)",
                  "value": "number",
                  "unit": "string",
                  "result": "PASS/FAIL",
                  "operator": "string",
                  "location": "string"
                }
              ],
              "notes": [
                {
                  "section": "string",
                  "note": "string",
                  "timestamp": "string"
                }
              ],
              "confidence": "number (0-1)"
            }

            Apply QC industry standards:
            - Panel dimensions should be positive numbers
            - Test results need proper units (lbs, psi, etc.)
            - Dates should be standardized format
            - PASS/FAIL should be uppercase
            - Flag any unclear or uncertain readings
            
            For PDF text, look for structured data in tables, forms, or formatted text.
            For handwritten text, interpret the OCR results carefully.
            
            IMPORTANT: Always return valid JSON that matches the schema above. If no QC data is found, return empty arrays and default values.`
          },
          {
            role: "user",
            content: `Parse this extracted text into structured QC data: ${textContent}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000
      });

      console.log('✅ OpenAI response received');
      console.log('📊 Response usage:', response.usage);
      
      const responseContent = response.choices[0].message.content;
      console.log('📄 Response content preview:', responseContent.substring(0, 200) + '...');
      
      let result;
      try {
        result = JSON.parse(responseContent);
        console.log('✅ JSON parsed successfully');
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        console.error('❌ Raw response content:', responseContent);
        throw new Error(`Invalid JSON response from OpenAI: ${parseError.message}`);
      }
      
      // Validate the result structure
      if (!result || typeof result !== 'object') {
        throw new Error('OpenAI returned invalid data structure');
      }
      
      console.log('✅ QC data parsed successfully');
      console.log('📊 Parsed structure:', {
        hasProjectInfo: !!result.projectInfo,
        panelsCount: result.panels?.length || 0,
        testsCount: result.tests?.length || 0,
        notesCount: result.notes?.length || 0
      });
      
      return result;
    } catch (error) {
      console.error('❌ Error parsing QC data:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      if (error.name === 'OpenAIError') {
        console.error('❌ OpenAI API error details:', {
          status: error.status,
          code: error.code,
          type: error.type
        });
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      
      throw new Error(`Failed to parse QC data from extracted text: ${error.message}`);
    }
  }

  /**
   * Generate Excel report from parsed QC data
   */
  async generateExcelReport(qcData, outputPath) {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Create Project Info sheet
      const projectSheet = workbook.addWorksheet('Project Info');
      this.createProjectInfoSheet(projectSheet, qcData.projectInfo);
      
      // Create Panels sheet
      const panelsSheet = workbook.addWorksheet('Panels');
      this.createPanelsSheet(panelsSheet, qcData.panels || []);
      
      // Create Tests sheet
      const testsSheet = workbook.addWorksheet('Tests');
      this.createTestsSheet(testsSheet, qcData.tests || []);
      
      // Create Notes sheet
      const notesSheet = workbook.addWorksheet('Notes');
      this.createNotesSheet(notesSheet, qcData.notes || []);
      
      // Create Summary sheet
      const summarySheet = workbook.addWorksheet('Summary');
      this.createSummarySheet(summarySheet, qcData);
      
      // Save the workbook
      await workbook.xlsx.writeFile(outputPath);
      
      return outputPath;
    } catch (error) {
      console.error('Error generating Excel report:', error);
      throw new Error('Failed to generate Excel report');
    }
  }

  createProjectInfoSheet(worksheet, projectInfo) {
    // Set up headers
    worksheet.columns = [
      { header: 'Field', key: 'field', width: 25 },
      { header: 'Value', key: 'value', width: 40 }
    ];
    
    // Make header row bold
    worksheet.getRow(1).font = { bold: true };
    
    // Add project data
    const fields = [
      { field: 'Project Name', value: projectInfo?.name || 'N/A' },
      { field: 'Location', value: projectInfo?.location || 'N/A' },
      { field: 'Date', value: projectInfo?.date || 'N/A' },
      { field: 'Inspector', value: projectInfo?.inspector || 'N/A' },
      { field: 'Weather Conditions', value: projectInfo?.weather || 'N/A' }
    ];
    
    fields.forEach((item, index) => {
      worksheet.addRow(item);
    });
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width, 15);
    });
  }

  createPanelsSheet(worksheet, panels) {
    // Set up headers
    worksheet.columns = [
      { header: 'Panel ID', key: 'panelId', width: 15 },
      { header: 'Width (ft)', key: 'width', width: 12 },
      { header: 'Height (ft)', key: 'height', width: 12 },
      { header: 'Patches', key: 'patches', width: 10 },
      { header: 'Seam Welder', key: 'seamWelder', width: 20 },
      { header: 'Material', key: 'material', width: 20 }
    ];
    
    // Make header row bold
    worksheet.getRow(1).font = { bold: true };
    
    // Add panel data
    panels.forEach(panel => {
      worksheet.addRow({
        panelId: panel.panelId || 'N/A',
        width: panel.width || 0,
        height: panel.height || 0,
        patches: panel.patches || 0,
        seamWelder: panel.seamWelder || 'N/A',
        material: panel.material || 'N/A'
      });
    });
    
    // Add data validation for numeric fields
    const widthColumn = worksheet.getColumn('width');
    const heightColumn = worksheet.getColumn('height');
    const patchesColumn = worksheet.getColumn('patches');
    
    [widthColumn, heightColumn, patchesColumn].forEach(column => {
      column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber > 1) { // Skip header
          cell.dataValidation = {
            type: 'decimal',
            operator: 'greaterThan',
            formulae: [0],
            showErrorMessage: true,
            errorTitle: 'Invalid Value',
            error: 'Value must be greater than 0'
          };
        }
      });
    });
  }

  createTestsSheet(worksheet, tests) {
    // Set up headers
    worksheet.columns = [
      { header: 'Test ID', key: 'testId', width: 15 },
      { header: 'Test Type', key: 'type', width: 20 },
      { header: 'Value', key: 'value', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Result', key: 'result', width: 12 },
      { header: 'Operator', key: 'operator', width: 20 },
      { header: 'Location', key: 'location', width: 25 }
    ];
    
    // Make header row bold
    worksheet.getRow(1).font = { bold: true };
    
    // Add test data
    tests.forEach(test => {
      worksheet.addRow({
        testId: test.testId || 'N/A',
        type: test.type || 'N/A',
        value: test.value || 0,
        unit: test.unit || 'N/A',
        result: test.result || 'N/A',
        operator: test.operator || 'N/A',
        location: test.location || 'N/A'
      });
    });
    
    // Color code results
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        const resultCell = row.getCell('result');
        if (resultCell.value === 'PASS') {
          resultCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF90EE90' } // Light green
          };
        } else if (resultCell.value === 'FAIL') {
          resultCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCCCB' } // Light red
          };
        }
      }
    });
  }

  createNotesSheet(worksheet, notes) {
    // Set up headers
    worksheet.columns = [
      { header: 'Section', key: 'section', width: 20 },
      { header: 'Note', key: 'note', width: 60 },
      { header: 'Timestamp', key: 'timestamp', width: 20 }
    ];
    
    // Make header row bold
    worksheet.getRow(1).font = { bold: true };
    
    // Add notes data
    notes.forEach(note => {
      worksheet.addRow({
        section: note.section || 'General',
        note: note.note || 'N/A',
        timestamp: note.timestamp || new Date().toISOString()
      });
    });
    
    // Enable text wrapping for notes column
    worksheet.getColumn('note').alignment = { wrapText: true };
  }

  createSummarySheet(worksheet, qcData) {
    // Set up headers
    worksheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];
    
    // Make header row bold
    worksheet.getRow(1).font = { bold: true };
    
    // Calculate summary metrics
    const totalPanels = qcData.panels?.length || 0;
    const totalTests = qcData.tests?.length || 0;
    const passedTests = qcData.tests?.filter(test => test.result === 'PASS').length || 0;
    const failedTests = qcData.tests?.filter(test => test.result === 'FAIL').length || 0;
    const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
    const confidence = (qcData.confidence * 100).toFixed(1) || 'N/A';
    
    const summaryData = [
      { metric: 'Total Panels', value: totalPanels },
      { metric: 'Total Tests', value: totalTests },
      { metric: 'Tests Passed', value: passedTests },
      { metric: 'Tests Failed', value: failedTests },
      { metric: 'Pass Rate (%)', value: `${passRate}%` },
      { metric: 'OCR Confidence (%)', value: `${confidence}%` },
      { metric: 'Generated On', value: new Date().toLocaleDateString() }
    ];
    
    summaryData.forEach(item => {
      worksheet.addRow(item);
    });
    
    // Color code pass rate
    const passRateRow = worksheet.getRow(5); // Pass Rate row
    const passRateCell = passRateRow.getCell('value');
    const rate = parseFloat(passRate);
    
    if (rate >= 90) {
      passRateCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF90EE90' } // Green
      };
    } else if (rate >= 70) {
      passRateCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF99' } // Yellow
      };
    } else {
      passRateCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFCCCB' } // Red
      };
    }
  }

  /**
   * Validate QC data and flag potential issues
   */
  validateQCData(qcData) {
    const issues = [];
    
    // Validate project info
    if (!qcData.projectInfo?.name) {
      issues.push('Project name is missing');
    }
    if (!qcData.projectInfo?.date) {
      issues.push('Project date is missing');
    }
    
    // Validate panels
    qcData.panels?.forEach((panel, index) => {
      if (!panel.panelId) {
        issues.push(`Panel ${index + 1}: Missing panel ID`);
      }
      if (!panel.width || panel.width <= 0) {
        issues.push(`Panel ${panel.panelId || index + 1}: Invalid width`);
      }
      if (!panel.height || panel.height <= 0) {
        issues.push(`Panel ${panel.panelId || index + 1}: Invalid height`);
      }
    });
    
    // Validate tests
    qcData.tests?.forEach((test, index) => {
      if (!test.type) {
        issues.push(`Test ${index + 1}: Missing test type`);
      }
      if (test.value === undefined || test.value === null) {
        issues.push(`Test ${test.testId || index + 1}: Missing test value`);
      }
      if (!['PASS', 'FAIL'].includes(test.result)) {
        issues.push(`Test ${test.testId || index + 1}: Invalid result (must be PASS or FAIL)`);
      }
    });
    
    // Check confidence level
    if (qcData.confidence < 0.8) {
      issues.push('Low OCR confidence - manual review recommended');
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues,
      confidence: qcData.confidence
    };
  }
}

module.exports = HandwritingOCRService;