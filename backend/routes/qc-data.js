const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { auth } = require('../middlewares/auth');
const { db } = require('../db');
const { qcData, projects, panels } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const { wsSendToRoom } = require('../services/websocket');

// Simple validation functions
const validateObjectId = (id) => {
  return id && typeof id === 'string' && id.length > 0;
};

const validateQCData = (qcDataInput) => {
  const errors = [];
  
  if (!qcDataInput.type || qcDataInput.type.trim().length === 0) {
    errors.push('QC type is required');
  }
  
  if (!qcDataInput.panelId || qcDataInput.panelId.trim().length === 0) {
    errors.push('Panel ID is required');
  }
  
  if (!qcDataInput.date) {
    errors.push('Date is required');
  }
  
  if (!qcDataInput.result || qcDataInput.result.trim().length === 0) {
    errors.push('Result is required');
  }
  
  return { error: errors.length > 0 ? { details: [{ message: errors.join(', ') }] } : null };
};

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
    
    // Verify project belongs to user
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
    
    // Verify project belongs to user
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
    
    // Verify project belongs to user
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
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return res.status(400).json({ message: 'No worksheet found in file' });
    }
    
    const importedData = [];
    const startRow = hasHeaderRow === 'true' ? 2 : 1;
    
    for (let rowNumber = startRow; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      
      // Skip empty rows
      if (row.cellCount === 0) continue;
      
      const getCellValue = (column) => {
        const cell = row.getCell(column);
        return cell.value ? cell.value.toString().trim() : '';
      };
      
      const qcRecord = {
        type: getCellValue(typeColumn),
        panelId: getCellValue(panelIdColumn),
        date: getCellValue(dateColumn),
        result: getCellValue(resultColumn),
        technician: getCellValue(technicianColumn),
      };
      
      // Only add if we have the required fields
      if (qcRecord.type && qcRecord.panelId && qcRecord.date && qcRecord.result) {
        importedData.push(qcRecord);
      }
    }
    
    // Insert all imported data
    const insertedData = [];
    for (const record of importedData) {
      const [newQCData] = await db
        .insert(qcData)
        .values({
          id: uuidv4(),
          projectId,
          type: record.type,
          panelId: record.panelId,
          date: record.date,
          result: record.result,
          technician: record.technician || null,
          createdAt: new Date().toISOString(),
          createdBy: req.user.id,
        })
        .returning();
      
      insertedData.push(newQCData);
    }
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.status(201).json({
      message: `Successfully imported ${insertedData.length} QC records`,
      importedCount: insertedData.length,
      data: insertedData
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

// Delete QC data
router.delete('/:projectId/:id', auth, async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    
    // Validate IDs
    if (!validateObjectId(projectId) || !validateObjectId(id)) {
      return res.status(400).json({ message: 'Invalid project or QC data ID' });
    }
    
    // Verify project belongs to user
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
    
    // Delete QC data
    await db
      .delete(qcData)
      .where(and(
        eq(qcData.id, id),
        eq(qcData.projectId, projectId)
      ));
    
    res.status(200).json({ message: 'QC data deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
