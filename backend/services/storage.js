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
const ASBUILT_FILES_DIR = path.join(UPLOAD_DIR, 'asbuilt-files');

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
    
    // Check if asbuilt-files directory exists
    try {
      await access(ASBUILT_FILES_DIR, fs.constants.F_OK);
    } catch (error) {
      await mkdir(ASBUILT_FILES_DIR, { recursive: true });
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

// Save an as-built file (for Excel imports)
async function saveAsbuiltFile(fileBuffer, originalName, projectId, userId) {
  try {
    const fileId = uuidv4();
    const fileExtension = path.extname(originalName);
    const filename = `${fileId}${fileExtension}`;
    const filePath = path.join(ASBUILT_FILES_DIR, filename);

    // Save file to disk
    await writeFile(filePath, fileBuffer);
    
    // Verify file was saved successfully
    try {
      await access(filePath, fs.constants.F_OK);
      console.log(`✅ As-built file saved successfully: ${filePath}`);
    } catch (verifyError) {
      throw new Error(`File verification failed: ${verifyError.message}`);
    }

    return {
      fileId,
      filename,
      originalFilename: originalName,
      filePath,
      fileSize: fileBuffer.length,
      uploaderId: userId
    };
  } catch (error) {
    console.error('❌ Error saving as-built file:', error);
    throw new Error(`Failed to save as-built file: ${error.message}`);
  }
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

// Get as-built file by filename (for AI model or sidebar display)
async function getAsbuiltFile(filename) {
  try {
    const filePath = path.join(ASBUILT_FILES_DIR, filename);
    const buffer = await readFile(filePath);
    return {
      buffer,
      path: filePath,
      exists: true
    };
  } catch (error) {
    return { 
      exists: false, 
      error: error.message 
    };
  }
}

// Get as-built file path by filename (for downloads)
function getAsbuiltFilePath(filename) {
  return path.join(ASBUILT_FILES_DIR, filename);
}

module.exports = {
  saveDocument,
  saveExcel,
  saveAsbuiltFile,
  saveTempFile,
  deleteFile,
  readStoredFile,
  getAsbuiltFile,
  getAsbuiltFilePath,
  UPLOAD_DIR,
  DOCUMENTS_DIR,
  EXCEL_DIR,
  TEMP_DIR,
  ASBUILT_FILES_DIR,
};
