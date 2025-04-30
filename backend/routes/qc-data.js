const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { auth } = require('../middlewares/auth');
const { validateObjectId, validateQCData } = require('../utils/validate');
const { db } = require('../db');
const { qcData, projects, panels } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const { wsSendToRoom } = require('../services/websocket');

// Configure multer for Excel file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/excel');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedFileTypes = ['.xls', '.xlsx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedFileTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
    }
  }
});

// Get QC data for a project
router.get('/:projectId', auth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    // Validate project ID
    if (!validateObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Verify project access
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get QC data
    const projectQCData = await db
      .select()
      .from(qcData)
      .where(eq(qcData.projectId, projectId));
    
    res.status(200).json(projectQCData);
  } catch (error) {
    next(error);
  }
});

// Add QC data
router.post('/:projectId', auth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const qcDataInput = req.body;
    
    // Validate project ID
    if (!validateObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Validate QC data
    const { error } = validateQCData(qcDataInput);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    // Verify project access
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Create QC data record
    const [newQCData] = await db
      .insert(qcData)
      .values({
        id: uuidv4(),
        projectId,
        type: qcDataInput.type,
        panelId: qcDataInput.panelId,
        date: qcDataInput.date,
        result: qcDataInput.result,
        technician: qcDataInput.technician || null,
        temperature: qcDataInput.temperature || null,
        pressure: qcDataInput.pressure || null,
        speed: qcDataInput.speed || null,
        notes: qcDataInput.notes || null,
        createdAt: new Date().toISOString(),
        createdBy: req.user.id,
      })
      .returning();
    
    // Update panel QC status in the panel layout if applicable
    try {
      const [panelLayout] = await db
        .select()
        .from(panels)
        .where(eq(panels.projectId, projectId));
      
      if (panelLayout) {
        const parsedPanels = JSON.parse(panelLayout.panels);
        
        // Find the panel by ID and update its QC status
        const updatedPanels = parsedPanels.map(panel => {
          if (panel.label === qcDataInput.panelId) {
            return {
              ...panel,
              qcStatus: qcDataInput.result,
            };
          }
          return panel;
        });
        
        // Update panel layout
        await db
          .update(panels)
          .set({
            panels: JSON.stringify(updatedPanels),
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(panels.projectId, projectId));
        
        // Notify other clients via WebSockets
        wsSendToRoom(`panel_layout_${projectId}`, {
          type: 'PANEL_UPDATE',
          projectId,
          panels: updatedPanels,
          userId: req.user.id,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (panelError) {
      console.error('Error updating panel QC status:', panelError);
      // Continue execution - this is not critical
    }
    
    res.status(201).json(newQCData);
  } catch (error) {
    next(error);
  }
});

// Import QC data from Excel
router.post('/:projectId/import', auth, upload.single('file'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { 
      hasHeaderRow = 'true', 
      typeColumn, 
      panelIdColumn, 
      dateColumn, 
      resultColumn, 
      technicianColumn 
    } = req.body;
    
    // Validate project ID
    if (!validateObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Verify project access
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Validate required column mappings
    if (!panelIdColumn || !dateColumn || !resultColumn) {
      return res.status(400).json({ 
        message: 'Required column mappings missing. Panel ID, Date, and Result columns are required.' 
      });
    }
    
    // Parse Excel file
    const workbook = new ExcelJS.Workbook();
    
    let parsedWorkbook;
    if (req.file.originalname.endsWith('.csv')) {
      parsedWorkbook = await workbook.csv.readFile(req.file.path);
    } else {
      parsedWorkbook = await workbook.xlsx.readFile(req.file.path);
    }
    
    const worksheet = parsedWorkbook.worksheets[0];
    
    if (!worksheet) {
      return res.status(400).json({ message: 'The uploaded file has no worksheets' });
    }
    
    // Process rows
    const qcDataRecords = [];
    const includeHeader = hasHeaderRow === 'true';
    
    let rowIndex = includeHeader ? 2 : 1; // Skip header row if applicable
    
    worksheet.eachRow({ includeEmpty: false }, (row, index) => {
      if (includeHeader && index === 1) return; // Skip header
      
      // Helper function to get cell value by column reference
      const getCellValue = (column) => {
        // Column can be a letter (e.g., 'A') or a name (e.g., 'Type')
        let cellValue;
        
        if (/^[A-Z]+$/.test(column)) {
          // Column is a letter reference
          const columnIndex = worksheet.getColumn(column).number;
          cellValue = row.getCell(columnIndex).value;
        } else if (includeHeader) {
          // Column is a name, find it in the header row
          const headerRow = worksheet.getRow(1);
          let columnIndex = -1;
          
          headerRow.eachCell({ includeEmpty: false }, (cell, colIndex) => {
            if (cell.value && cell.value.toString().toLowerCase() === column.toLowerCase()) {
              columnIndex = colIndex;
            }
          });
          
          if (columnIndex > 0) {
            cellValue = row.getCell(columnIndex).value;
          }
        }
        
        // Handle Excel date values
        if (cellValue && cellValue.getTime && typeof cellValue.getTime === 'function') {
          return cellValue.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        }
        
        return cellValue ? cellValue.toString() : null;
      };
      
      // Extract values using the column mappings
      const type = typeColumn ? getCellValue(typeColumn) : 'destructive'; // Default type
      const panelId = getCellValue(panelIdColumn);
      const date = getCellValue(dateColumn);
      const result = getCellValue(resultColumn);
      const technician = technicianColumn ? getCellValue(technicianColumn) : null;
      
      // Validate required fields
      if (panelId && date && result) {
        qcDataRecords.push({
          id: uuidv4(),
          projectId,
          type: type || 'destructive',
          panelId,
          date: new Date(date).toISOString(),
          result: result.toLowerCase(),
          technician,
          notes: `Imported from ${req.file.originalname}`,
          createdAt: new Date().toISOString(),
          createdBy: req.user.id,
        });
      }
    });
    
    // Insert QC data records into database
    if (qcDataRecords.length === 0) {
      return res.status(400).json({ 
        message: 'No valid QC data records found in the file' 
      });
    }
    
    const insertedRecords = await db
      .insert(qcData)
      .values(qcDataRecords)
      .returning();
    
    // Clean up temporary file
    fs.unlinkSync(req.file.path);
    
    res.status(200).json({ 
      message: `Successfully imported ${insertedRecords.length} QC data records`,
      data: insertedRecords
    });
  } catch (error) {
    // Clean up temp file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

module.exports = router;
