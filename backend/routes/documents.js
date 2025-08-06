const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middlewares/auth');
const { db } = require('../db/index');
const { documents, projects } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const axios = require('axios');

// Simple validation function
const validateObjectId = (id) => {
  return id && typeof id === 'string' && id.length > 0;
};

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
  console.log('=== Documents Upload Request Received ===');
  console.log('Request headers:', {
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'Bearer [HIDDEN]' : 'none',
    'user-agent': req.headers['user-agent']
  });
  console.log('Request body keys:', Object.keys(req.body || {}));
  console.log('Request files count:', req.files ? req.files.length : 0);
  
  try {
    const { projectId } = req.params;
    console.log('Project ID:', projectId);
    console.log('User info:', {
      id: req.user?.id,
      email: req.user?.email,
      displayName: req.user?.displayName
    });
    
    // Validate project ID
    if (!validateObjectId(projectId)) {
      console.log('❌ Invalid project ID:', projectId);
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Verify project belongs to user
    console.log('🔍 Verifying project ownership...');
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, req.user.id)
      ));
    
    if (!project) {
      console.log('❌ Project not found or user not authorized');
      return res.status(404).json({ message: 'Project not found' });
    }
    console.log('✅ Project verified:', project.name);
    
    // Handle uploaded files
    if (!req.files || req.files.length === 0) {
      console.log('❌ No files uploaded in request');
      console.log('Request body:', req.body);
      return res.status(400).json({ message: 'No files uploaded' });
    }
    
    console.log('✅ Files received:', req.files.map(f => ({
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      fieldname: f.fieldname
    })));
    
    const uploadedDocuments = [];
    
    // Save file info to database
    for (const file of req.files) {
      console.log('💾 Saving file to database:', file.originalname);
      const newDocument = {
        id: uuidv4(),
        projectId,
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        path: file.path,
        uploadedAt: new Date(),
        uploadedBy: req.user.displayName || req.user.email,
      };
      
      const [document] = await db
        .insert(documents)
        .values(newDocument)
        .returning();
      
      uploadedDocuments.push(document);
      console.log('✅ File saved:', file.originalname);
    }
    
    console.log('🎉 All files uploaded successfully:', uploadedDocuments.length);
    res.status(200).json({ 
      message: 'Files uploaded successfully',
      documents: uploadedDocuments
    });
  } catch (error) {
    console.error('❌ Documents upload failed:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
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
    
    if (!question || question.trim().length === 0) {
      return res.status(400).json({ message: 'Question is required' });
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
    const documentsToAnalyze = await db
      .select()
      .from(documents)
      .where(and(
        eq(documents.projectId, projectId),
        // Add document ID filter if needed
      ));
    
    if (documentsToAnalyze.length === 0) {
      return res.status(404).json({ message: 'No documents found for analysis' });
    }
    
    // Here you would integrate with your AI service
    // For now, return a placeholder response
    res.status(200).json({
      analysis: {
        question,
        answer: 'AI analysis would be performed here.',
        documents: documentsToAnalyze.map(doc => doc.name),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Download document
router.get('/download/:documentId', auth, async (req, res, next) => {
  try {
    const { documentId } = req.params;
    
    // Validate document ID
    if (!validateObjectId(documentId)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }
    
    // Get document details
    const [document] = await db
      .select({
        id: documents.id,
        name: documents.name,
        path: documents.path,
        projectId: documents.projectId
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
    
    // Check if file exists
    if (!document.path || !fs.existsSync(document.path)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    
    // Set response headers for file download
    const ext = path.extname(document.name).toLowerCase();
    let contentType = 'application/octet-stream';
    
    // Set appropriate content type based on file extension
    switch (ext) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.xlsx':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case '.xls':
        contentType = 'application/vnd.ms-excel';
        break;
      case '.docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case '.doc':
        contentType = 'application/msword';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
      case '.csv':
        contentType = 'text/csv';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.name}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(document.path);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading document:', error);
    next(error);
  }
});

module.exports = router;
