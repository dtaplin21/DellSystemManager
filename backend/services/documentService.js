const fs = require('fs').promises;
const path = require('path');
const { supabase } = require('../lib/supabase-server');

class DocumentService {
  /**
   * Get document text content by document ID
   */
  async getDocumentText(documentId) {
    try {
      console.log(`[DOCUMENT SERVICE] Fetching text for document: ${documentId}`);
      
      // First try to get from database
      const { data: document, error } = await supabase
        .from('documents')
        .select('text_content, path, name')
        .eq('id', documentId)
        .single();
      
      if (error) {
        console.warn(`[DOCUMENT SERVICE] Database error for document ${documentId}:`, error.message);
        return null;
      }
      
      if (!document) {
        console.warn(`[DOCUMENT SERVICE] Document not found: ${documentId}`);
        return null;
      }
      
      // If text content is already stored in database, return it
      if (document.text_content) {
        console.log(`[DOCUMENT SERVICE] Found text content in database for: ${document.name}`);
        return document.text_content;
      }
      
      // If no text content in database, try to extract from file
      if (document.path) {
        console.log(`[DOCUMENT SERVICE] Extracting text from file: ${document.path}`);
        const extractedText = await this.extractTextFromFile(document.path);
        
        if (extractedText) {
          // Update database with extracted text
          await this.updateDocumentText(documentId, extractedText);
          return extractedText;
        }
      }
      
      console.warn(`[DOCUMENT SERVICE] No text content available for document: ${documentId}`);
      return null;
      
    } catch (error) {
      console.error(`[DOCUMENT SERVICE] Error getting document text for ${documentId}:`, error);
      return null;
    }
  }
  
  /**
   * Extract text from file based on file type
   */
  async extractTextFromFile(filePath) {
    try {
      const fileExtension = path.extname(filePath).toLowerCase();
      
      switch (fileExtension) {
        case '.txt':
          return await this.extractTextFromTxt(filePath);
        case '.pdf':
          return await this.extractTextFromPdf(filePath);
        case '.docx':
          return await this.extractTextFromDocx(filePath);
        case '.xlsx':
        case '.xls':
          return await this.extractTextFromExcel(filePath);
        default:
          console.warn(`[DOCUMENT SERVICE] Unsupported file type: ${fileExtension}`);
          return null;
      }
    } catch (error) {
      console.error(`[DOCUMENT SERVICE] Error extracting text from file ${filePath}:`, error);
      return null;
    }
  }
  
  /**
   * Extract text from TXT file
   */
  async extractTextFromTxt(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      console.error(`[DOCUMENT SERVICE] Error reading TXT file ${filePath}:`, error);
      return null;
    }
  }
  
  /**
   * Extract text from PDF file
   */
  async extractTextFromPdf(filePath) {
    try {
      // Use pdf-parse library if available, otherwise return placeholder
      const pdfParse = require('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      console.warn(`[DOCUMENT SERVICE] PDF parsing not available for ${filePath}:`, error.message);
      return '[PDF content - text extraction not available]';
    }
  }
  
  /**
   * Extract text from DOCX file
   */
  async extractTextFromDocx(filePath) {
    try {
      // Use mammoth library if available, otherwise return placeholder
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      console.warn(`[DOCUMENT SERVICE] DOCX parsing not available for ${filePath}:`, error.message);
      return '[DOCX content - text extraction not available]';
    }
  }

  /**
   * Extract text from Excel file
   */
  async extractTextFromExcel(filePath) {
    try {
      // Use xlsx library if available, otherwise return placeholder
      const xlsx = require('xlsx');
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON for structured data
      const jsonData = xlsx.utils.sheet_to_json(worksheet);
      
      // Get cell range for raw text extraction
      const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1');
      let rawText = '';
      
      // Extract text from each cell
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = xlsx.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          if (cell && cell.v !== undefined) {
            rawText += cell.v.toString() + '\t';
          } else {
            rawText += '\t';
          }
        }
        rawText += '\n';
      }
      
      // Combine both formats for comprehensive analysis
      let extractedText = `Excel File Content:\n\n`;
      extractedText += `Sheet: ${sheetName}\n`;
      extractedText += `Total Rows: ${jsonData.length}\n`;
      extractedText += `Range: ${worksheet['!ref'] || 'A1'}\n\n`;
      
      // Add structured data
      extractedText += `Structured Data:\n`;
      extractedText += JSON.stringify(jsonData, null, 2);
      extractedText += `\n\nRaw Text Content:\n`;
      extractedText += rawText || 'No raw text content available';
      
      return extractedText;
    } catch (error) {
      console.warn(`[DOCUMENT SERVICE] Excel parsing not available for ${filePath}:`, error.message);
      return '[Excel content - text extraction not available]';
    }
  }
  
  /**
   * Update document text content in database
   */
  async updateDocumentText(documentId, textContent) {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ text_content: textContent })
        .eq('id', documentId);
      
      if (error) {
        console.error(`[DOCUMENT SERVICE] Error updating document text for ${documentId}:`, error);
      } else {
        console.log(`[DOCUMENT SERVICE] Updated text content for document: ${documentId}`);
      }
    } catch (error) {
      console.error(`[DOCUMENT SERVICE] Error updating document text:`, error);
    }
  }
  
  /**
   * Get documents for a project with text content
   */
  async getProjectDocuments(projectId) {
    try {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('id, name, text_content, path, uploaded_at')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });
      
      if (error) {
        console.error(`[DOCUMENT SERVICE] Error fetching project documents:`, error);
        return [];
      }
      
      // Enhance documents with text content if missing
      const enhancedDocuments = await Promise.all(
        documents.map(async (doc) => {
          if (!doc.text_content && doc.id) {
            const textContent = await this.getDocumentText(doc.id);
            return {
              ...doc,
              text: textContent
            };
          }
          return {
            ...doc,
            text: doc.text_content
          };
        })
      );
      
      return enhancedDocuments;
    } catch (error) {
      console.error(`[DOCUMENT SERVICE] Error getting project documents:`, error);
      return [];
    }
  }
}

module.exports = new DocumentService(); 