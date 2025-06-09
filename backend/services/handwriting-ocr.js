const OpenAI = require('openai');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;

class HandwritingOCRService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Extract text from handwritten QC form image using OpenAI Vision
   */
  async extractTextFromImage(imageBuffer, imageType = 'image/jpeg') {
    try {
      const base64Image = imageBuffer.toString('base64');
      
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
            
            Return the extracted text in a structured JSON format with clear field labels.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please extract all handwritten text from this QC form image. Focus on accuracy for pencil writing and provide structured output."
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

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error extracting text from image:', error);
      throw new Error('Failed to extract text from handwritten form');
    }
  }

  /**
   * Parse extracted OCR text into structured QC data
   */
  async parseQCData(extractedText) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are a QC data processing expert. Parse the extracted OCR text into a standardized QC data structure.

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
            - Flag any unclear or uncertain readings`
          },
          {
            role: "user",
            content: `Parse this OCR extracted text into structured QC data: ${JSON.stringify(extractedText)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error parsing QC data:', error);
      throw new Error('Failed to parse QC data from extracted text');
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