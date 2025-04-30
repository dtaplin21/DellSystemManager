const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');

// Promisify fs functions
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);

// Define storage paths
const UPLOAD_DIR = path.join(__dirname, '../uploads');
const DOCUMENTS_DIR = path.join(UPLOAD_DIR, 'documents');
const EXCEL_DIR = path.join(UPLOAD_DIR, 'excel');
const TEMP_DIR = path.join(UPLOAD_DIR, 'temp');

// Ensure directories exist
async function ensureDirectoriesExist() {
  try {
    // Check if uploads directory exists
    try {
      await access(UPLOAD_DIR, fs.constants.F_OK);
    } catch (error) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }
    
    // Check if documents directory exists
    try {
      await access(DOCUMENTS_DIR, fs.constants.F_OK);
    } catch (error) {
      await mkdir(DOCUMENTS_DIR, { recursive: true });
    }
    
    // Check if excel directory exists
    try {
      await access(EXCEL_DIR, fs.constants.F_OK);
    } catch (error) {
      await mkdir(EXCEL_DIR, { recursive: true });
    }
    
    // Check if temp directory exists
    try {
      await access(TEMP_DIR, fs.constants.F_OK);
    } catch (error) {
      await mkdir(TEMP_DIR, { recursive: true });
    }
    
    console.log('Storage directories initialized');
  } catch (error) {
    console.error('Error initializing storage directories:', error);
  }
}

// Initialize storage
ensureDirectoriesExist();

// Save a file to storage
async function saveFile(file, subDirectory = '') {
  const targetDir = path.join(UPLOAD_DIR, subDirectory);
  
  // Ensure target directory exists
  try {
    await access(targetDir, fs.constants.F_OK);
  } catch (error) {
    await mkdir(targetDir, { recursive: true });
  }
  
  // Generate a unique filename
  const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
  const filePath = path.join(targetDir, uniqueFilename);
  
  // Write file to disk
  await writeFile(filePath, file.buffer);
  
  return {
    filename: uniqueFilename,
    originalName: file.originalname,
    path: filePath,
    size: file.size,
    mimetype: file.mimetype,
  };
}

// Save a document file
async function saveDocument(file) {
  return await saveFile(file, 'documents');
}

// Save an Excel file
async function saveExcel(file) {
  return await saveFile(file, 'excel');
}

// Save a temporary file
async function saveTempFile(data, extension) {
  const uniqueFilename = `${Date.now()}-${uuidv4()}.${extension}`;
  const filePath = path.join(TEMP_DIR, uniqueFilename);
  
  // Write data to disk
  await writeFile(filePath, data);
  
  return {
    filename: uniqueFilename,
    path: filePath,
  };
}

// Delete a file
async function deleteFile(filePath) {
  try {
    await access(filePath, fs.constants.F_OK);
    await unlink(filePath);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}

// Read a file
async function readStoredFile(filePath) {
  try {
    await access(filePath, fs.constants.F_OK);
    return await readFile(filePath);
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
}

module.exports = {
  saveDocument,
  saveExcel,
  saveTempFile,
  deleteFile,
  readStoredFile,
  UPLOAD_DIR,
  DOCUMENTS_DIR,
  EXCEL_DIR,
  TEMP_DIR,
};
