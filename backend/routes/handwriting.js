const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const HandwritingOCRService = require('../services/handwriting-ocr');
const { auth } = require('../middlewares/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG) and PDF files are allowed'));
    }
  }
});

// Initialize OCR service
const ocrService = new HandwritingOCRService();

/**
 * POST /api/handwriting/scan
 * Process handwritten QC form and generate Excel report
 */
router.post('/scan', auth, upload.single('qcForm'), async (req, res) => {
  console.log('=== Handwriting Scan Request Received ===');
  console.log('Request headers:', {
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'Bearer [HIDDEN]' : 'none',
    'user-agent': req.headers['user-agent']
  });
  console.log('Request body keys:', Object.keys(req.body || {}));
  console.log('Request files:', req.files ? Object.keys(req.files) : 'none');
  console.log('Request file (single):', req.file ? 'present' : 'none');
  
  try {
    if (!req.file) {
      console.log('❌ No file uploaded in request.');
      console.log('Request body:', req.body);
      console.log('Request files:', req.files);
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded. Please upload a QC form image or PDF.' 
      });
    }

    const { projectId } = req.body;
    if (!projectId) {
      console.log('❌ No projectId provided in request body.');
      return res.status(400).json({ 
        success: false, 
        message: 'Project ID is required' 
      });
    }

    console.log('✅ File received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      fieldname: req.file.fieldname
    });
    console.log('✅ Project ID:', projectId);
    console.log('✅ User info:', {
      id: req.user?.id,
      email: req.user?.email,
      displayName: req.user?.displayName
    });

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY environment variable is not set');
      return res.status(500).json({
        success: false,
        message: 'OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.'
      });
    }

    console.log(`🔄 Processing handwriting scan for project ${projectId}...`);

    // Extract text from the uploaded image
    const extractedText = await ocrService.extractTextFromImage(
      req.file.buffer, 
      req.file.mimetype
    );

    console.log('✅ Text extracted successfully, parsing QC data...');

    // Parse the extracted text into structured QC data
    const qcData = await ocrService.parseQCData(extractedText);

    // Validate the parsed data
    const validation = ocrService.validateQCData(qcData);

    // Generate unique filename for Excel output
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `QC_Report_${projectId}_${timestamp}.xlsx`;
    const outputPath = path.join(__dirname, '../uploads', filename);

    // Ensure uploads directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Generate Excel report
    await ocrService.generateExcelReport(qcData, outputPath);

    console.log(`✅ Excel report generated: ${filename}`);

    // Return the results
    res.json({
      success: true,
      data: {
        filename: filename,
        excelUrl: `/api/handwriting/download/${filename}`,
        qcData: qcData,
        validation: validation,
        extractedText: extractedText,
        processingInfo: {
          originalFilename: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          processedAt: new Date().toISOString()
        }
      },
      message: validation.isValid 
        ? 'QC form processed successfully' 
        : `QC form processed with ${validation.issues.length} validation issues`
    });

  } catch (error) {
    console.error('❌ Error processing handwriting scan:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process handwriting scan',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/handwriting/download/:filename
 * Download generated Excel report
 */
router.get('/download/:filename', auth, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename (security check)
    if (!filename.match(/^QC_Report_[\w-]+\.xlsx$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename format'
      });
    }

    const filePath = path.join(__dirname, '../uploads', filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Set appropriate headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);

  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
});

/**
 * GET /api/handwriting/preview/:filename
 * Get preview data for Excel file (first sheet data)
 */
router.get('/preview/:filename', auth, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (!filename.match(/^QC_Report_[\w-]+\.xlsx$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename format'
      });
    }

    const filePath = path.join(__dirname, '../uploads', filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Read Excel file and extract preview data
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const preview = {};

    // Get data from each worksheet
    workbook.eachSheet((worksheet, sheetId) => {
      const sheetData = [];
      
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const rowData = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowData.push({
            value: cell.value,
            type: cell.type,
            style: {
              font: cell.font,
              fill: cell.fill
            }
          });
        });
        sheetData.push(rowData);
      });

      preview[worksheet.name] = {
        data: sheetData.slice(0, 20), // Limit to first 20 rows for preview
        totalRows: sheetData.length
      };
    });

    res.json({
      success: true,
      data: {
        filename: filename,
        preview: preview,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate preview'
    });
  }
});

/**
 * POST /api/handwriting/validate
 * Validate and correct OCR results before generating Excel
 */
router.post('/validate', auth, async (req, res) => {
  try {
    const { qcData, corrections } = req.body;

    if (!qcData) {
      return res.status(400).json({
        success: false,
        message: 'QC data is required'
      });
    }

    // Apply user corrections to the QC data
    let correctedData = { ...qcData };
    
    if (corrections) {
      // Apply corrections to specific fields
      Object.keys(corrections).forEach(section => {
        if (correctedData[section]) {
          Object.assign(correctedData[section], corrections[section]);
        }
      });
    }

    // Re-validate the corrected data
    const validation = ocrService.validateQCData(correctedData);

    res.json({
      success: true,
      data: {
        correctedData: correctedData,
        validation: validation
      },
      message: validation.isValid 
        ? 'Data validation passed' 
        : `${validation.issues.length} validation issues found`
    });

  } catch (error) {
    console.error('Error validating QC data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate QC data'
    });
  }
});

/**
 * DELETE /api/handwriting/cleanup/:filename
 * Clean up temporary files
 */
router.delete('/cleanup/:filename', auth, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (!filename.match(/^QC_Report_[\w-]+\.xlsx$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename format'
      });
    }

    const filePath = path.join(__dirname, '../uploads', filename);
    
    try {
      await fs.unlink(filePath);
      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          success: true,
          message: 'File already deleted'
        });
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

module.exports = router;