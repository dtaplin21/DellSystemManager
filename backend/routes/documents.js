const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middlewares/auth');
const { validateObjectId } = require('../utils/validate');
const { db } = require('../db');
const { documents, projects } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const axios = require('axios');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedFileTypes = ['.pdf', '.xls', '.xlsx', '.doc', '.docx', '.txt', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedFileTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Excel, Word, text, and CSV files are allowed.'));
    }
  }
});

// Get all documents for a project
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
    
    // Get documents
    const projectDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId));
    
    res.status(200).json(projectDocuments);
  } catch (error) {
    next(error);
  }
});

// Upload documents
router.post('/:projectId/upload', auth, upload.array('documents', 5), async (req, res, next) => {
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
    
    // Handle uploaded files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    
    const uploadedDocuments = [];
    
    // Save file info to database
    for (const file of req.files) {
      const newDocument = {
        id: uuidv4(),
        projectId,
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        path: file.path,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user.displayName || req.user.email,
      };
      
      const [document] = await db
        .insert(documents)
        .values(newDocument)
        .returning();
      
      uploadedDocuments.push(document);
    }
    
    res.status(200).json({ 
      message: 'Files uploaded successfully',
      documents: uploadedDocuments
    });
  } catch (error) {
    next(error);
  }
});

// Delete document
router.delete('/:documentId', auth, async (req, res, next) => {
  try {
    const { documentId } = req.params;
    
    // Validate document ID
    if (!validateObjectId(documentId)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }
    
    // Get document
    const [document] = await db
      .select({
        id: documents.id,
        projectId: documents.projectId,
        path: documents.path
      })
      .from(documents)
      .where(eq(documents.id, documentId));
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Verify project belongs to user
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, document.projectId),
        eq(projects.userId, req.user.id)
      ));
    
    if (!project) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Delete file from storage
    if (document.path && fs.existsSync(document.path)) {
      fs.unlinkSync(document.path);
    }
    
    // Delete document from database
    await db
      .delete(documents)
      .where(eq(documents.id, documentId));
    
    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Analyze documents with AI
router.post('/:projectId/analyze', auth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { documentIds, question } = req.body;
    
    // Validate inputs
    if (!validateObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ message: 'Document IDs are required' });
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
    
    // Get documents
    const selectedDocuments = await db
      .select()
      .from(documents)
      .where(and(
        eq(documents.projectId, projectId)
      ));
    
    // Filter by documentIds
    const documentsToAnalyze = selectedDocuments.filter(doc => 
      documentIds.includes(doc.id)
    );
    
    if (documentsToAnalyze.length === 0) {
      return res.status(404).json({ message: 'No valid documents found for analysis' });
    }
    
    // Call AI service for document analysis
    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:5001';
      
      const response = await axios.post(`${aiServiceUrl}/analyze`, {
        documents: documentsToAnalyze,
        question: question || 'Provide a comprehensive analysis of these documents',
      });
      
      res.status(200).json(response.data);
    } catch (aiError) {
      console.error('AI service error:', aiError.message);
      res.status(500).json({ 
        message: 'AI analysis failed',
        error: aiError.message
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
