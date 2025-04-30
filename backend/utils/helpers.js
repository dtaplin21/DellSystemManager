const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

// Generate a secure random ID
function generateId() {
  return uuidv4();
}

// Hash a password
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

// Compare password with hash
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Format date to ISO string without time
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Format file size for display
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Generate a random color
function generateRandomColor() {
  const r = Math.floor(Math.random() * 200 + 55); // 55-255
  const g = Math.floor(Math.random() * 200 + 55);
  const b = Math.floor(Math.random() * 200 + 55);
  
  return `rgba(${r}, ${g}, ${b}, 0.7)`;
}

// Get file extension
function getFileExtension(filename) {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

// Check if a file is an Excel file
function isExcelFile(filename) {
  const ext = getFileExtension(filename).toLowerCase();
  return ext === 'xls' || ext === 'xlsx' || ext === 'csv';
}

// Check if a file is a PDF
function isPdfFile(filename) {
  return getFileExtension(filename).toLowerCase() === 'pdf';
}

// Convert Excel column letter to index (e.g., A -> 0, Z -> 25, AA -> 26)
function excelColToIndex(col) {
  col = col.toUpperCase();
  let result = 0;
  
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  
  return result - 1; // 0-based index
}

// Convert index to Excel column letter (e.g., 0 -> A, 25 -> Z, 26 -> AA)
function indexToExcelCol(index) {
  index += 1; // 1-based index
  let result = '';
  
  while (index > 0) {
    const remainder = (index - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    index = Math.floor((index - 1) / 26);
  }
  
  return result;
}

// Error response helper
function errorResponse(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  generateId,
  hashPassword,
  comparePassword,
  formatDate,
  formatFileSize,
  generateRandomColor,
  getFileExtension,
  isExcelFile,
  isPdfFile,
  excelColToIndex,
  indexToExcelCol,
  errorResponse,
};
