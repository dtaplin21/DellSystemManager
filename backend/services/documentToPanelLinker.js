const PanelLookupService = require('./panelLookupService');
const AsbuiltService = require('./asbuiltService');
const AsbuiltImportAI = require('./asbuiltImportAI');
const { Pool } = require('pg');
require('dotenv').config();

class DocumentToPanelLinker {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    this.panelLookup = new PanelLookupService();
    this.asbuiltService = new AsbuiltService();
    this.asbuiltImportAI = new AsbuiltImportAI();
  }

  /**
   * Process a document and link extracted data to panels
   */
  async processDocumentForPanels(documentId, projectId, userId) {
    try {
      console.log(`🚀 [DOCUMENT_LINKER] Processing document ${documentId} for project ${projectId}`);
      
      // Get document details
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }
      
      console.log(`📄 [DOCUMENT_LINKER] Processing document: ${document.name} (${document.type})`);
      
      // Determine document type and processing strategy
      const documentType = this.categorizeDocument(document);
      
      let linkedRecords = [];
      
      switch (documentType) {
        case 'excel_asbuilt':
          linkedRecords = await this.processExcelAsbuiltDocument(document, projectId, userId);
          break;
        case 'pdf_report':
          linkedRecords = await this.processPdfReportDocument(document, projectId, userId);
          break;
        case 'panel_specs':
          linkedRecords = await this.processPanelSpecsDocument(document, projectId, userId);
          break;
        default:
          console.log(`⚠️ [DOCUMENT_LINKER] Unknown document type: ${documentType}, skipping`);
          return { success: false, message: 'Unknown document type' };
      }
      
      console.log(`✅ [DOCUMENT_LINKER] Successfully linked ${linkedRecords.length} records to panels`);
      
      return {
        success: true,
        documentId,
        projectId,
        linkedRecords: linkedRecords.length,
        records: linkedRecords
      };
      
    } catch (error) {
      console.error(`❌ [DOCUMENT_LINKER] Error processing document:`, error);
      return {
        success: false,
        error: error.message,
        documentId,
        projectId
      };
    }
  }

  /**
   * Get document details from database
   */
  async getDocument(documentId) {
    try {
      const query = `
        SELECT id, project_id, name, type, size, path, uploaded_at, uploaded_by, text_content
        FROM documents 
        WHERE id = $1
      `;
      
      const result = await this.pool.query(query, [documentId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error(`❌ [DOCUMENT_LINKER] Error getting document:`, error);
      return null;
    }
  }

  /**
   * Categorize document based on name and type
   */
  categorizeDocument(document) {
    const name = document.name.toLowerCase();
    const type = document.type.toLowerCase();
    
    // Excel files that look like as-built data
    if (type.includes('excel') || type.includes('spreadsheet') || name.includes('.xlsx') || name.includes('.xls')) {
      if (name.includes('asbuilt') || name.includes('as-built') || name.includes('qc') || 
          name.includes('weld') || name.includes('test') || name.includes('placement') ||
          name.includes('seaming') || name.includes('seam')) {
        return 'excel_asbuilt';
      }
    }
    
    // PDF reports
    if (type.includes('pdf') || name.includes('.pdf')) {
      if (name.includes('report') || name.includes('test') || name.includes('qc') || 
          name.includes('inspection') || name.includes('asbuilt')) {
        return 'pdf_report';
      }
    }
    
    // Panel specifications
    if (name.includes('panel') || name.includes('spec') || name.includes('layout')) {
      return 'panel_specs';
    }
    
    return 'unknown';
  }

  /**
   * Process Excel as-built documents
   */
  async processExcelAsbuiltDocument(document, projectId, userId) {
    try {
      console.log(`📊 [DOCUMENT_LINKER] Processing Excel as-built document: ${document.name}`);
      
      // For now, we'll need to read the file from storage
      // This is a simplified version - in production you'd read from actual file storage
      const fileBuffer = await this.readDocumentFile(document.path);
      
      if (!fileBuffer) {
        throw new Error('Could not read document file');
      }
      
      // Determine the domain based on document name/content
      const domain = this.determineAsbuiltDomain(document.name);
      
      // Use the existing AI import service
      const importResult = await this.asbuiltImportAI.importExcelData(
        fileBuffer,
        projectId,
        domain,
        userId
      );
      
      // Insert records into database
      const linkedRecords = [];
      if (importResult.records && importResult.records.length > 0) {
        for (const record of importResult.records) {
          try {
            const insertedRecord = await this.asbuiltService.createRecord(record);
            linkedRecords.push(insertedRecord);
          } catch (insertError) {
            console.error(`❌ [DOCUMENT_LINKER] Error inserting record:`, insertError);
          }
        }
      }
      
      return linkedRecords;
      
    } catch (error) {
      console.error(`❌ [DOCUMENT_LINKER] Error processing Excel document:`, error);
      return [];
    }
  }

  /**
   * Process PDF report documents
   */
  async processPdfReportDocument(document, projectId, userId) {
    try {
      console.log(`📄 [DOCUMENT_LINKER] Processing PDF report document: ${document.name}`);
      
      // Extract text content if available
      const textContent = document.text_content;
      if (!textContent) {
        console.log(`⚠️ [DOCUMENT_LINKER] No text content available for PDF: ${document.name}`);
        return [];
      }
      
      // Use AI to extract panel-specific data from PDF
      const extractedData = await this.extractPanelDataFromText(textContent, document.name);
      
      // Link extracted data to panels
      const linkedRecords = [];
      for (const data of extractedData) {
        if (data.panelNumber) {
          const panelId = await this.panelLookup.findPanelIdByNumber(data.panelNumber, projectId);
          if (panelId) {
            const record = {
              projectId,
              panelId,
              domain: data.domain,
              sourceDocId: document.id,
              rawData: data.rawData,
              mappedData: data.mappedData,
              aiConfidence: data.confidence || 0.8,
              requiresReview: data.confidence < 0.7,
              createdBy: userId
            };
            
            try {
              const insertedRecord = await this.asbuiltService.createRecord(record);
              linkedRecords.push(insertedRecord);
            } catch (insertError) {
              console.error(`❌ [DOCUMENT_LINKER] Error inserting PDF record:`, insertError);
            }
          }
        }
      }
      
      return linkedRecords;
      
    } catch (error) {
      console.error(`❌ [DOCUMENT_LINKER] Error processing PDF document:`, error);
      return [];
    }
  }

  /**
   * Process panel specifications documents
   */
  async processPanelSpecsDocument(document, projectId, userId) {
    try {
      console.log(`📋 [DOCUMENT_LINKER] Processing panel specs document: ${document.name}`);
      
      // This would use the existing panel document analyzer
      // For now, return empty array as this is handled by other services
      return [];
      
    } catch (error) {
      console.error(`❌ [DOCUMENT_LINKER] Error processing panel specs document:`, error);
      return [];
    }
  }

  /**
   * Determine as-built domain from document name
   */
  determineAsbuiltDomain(documentName) {
    const name = documentName.toLowerCase();
    
    if (name.includes('placement') || name.includes('location')) {
      return 'panel_placement';
    } else if (name.includes('seam') || name.includes('weld')) {
      return 'panel_seaming';
    } else if (name.includes('ndt') || name.includes('non-destructive') || name.includes('test')) {
      return 'non_destructive';
    } else if (name.includes('trial')) {
      return 'trial_weld';
    } else if (name.includes('repair')) {
      return 'repairs';
    } else if (name.includes('destructive')) {
      return 'destructive';
    }
    
    // Default to panel_placement
    return 'panel_placement';
  }

  /**
   * Extract panel data from text content using AI
   */
  async extractPanelDataFromText(textContent, documentName) {
    // This would use OpenAI to extract panel-specific data from text
    // For now, return empty array as this requires more complex AI integration
    console.log(`🔍 [DOCUMENT_LINKER] Would extract panel data from text (${textContent.length} chars)`);
    return [];
  }

  /**
   * Read document file from storage (simplified version)
   */
  async readDocumentFile(filePath) {
    // In production, this would read from actual file storage (S3, local filesystem, etc.)
    // For now, return null as we don't have file storage implemented
    console.log(`📁 [DOCUMENT_LINKER] Would read file from: ${filePath}`);
    return null;
  }

  /**
   * Process all documents for a project
   */
  async processAllDocumentsForProject(projectId, userId) {
    try {
      console.log(`🚀 [DOCUMENT_LINKER] Processing all documents for project: ${projectId}`);
      
      // Get all documents for the project
      const query = `
        SELECT id, name, type, uploaded_at
        FROM documents 
        WHERE project_id = $1
        ORDER BY uploaded_at DESC
      `;
      
      const result = await this.pool.query(query, [projectId]);
      const documents = result.rows;
      
      console.log(`📄 [DOCUMENT_LINKER] Found ${documents.length} documents to process`);
      
      const allLinkedRecords = [];
      
      for (const document of documents) {
        try {
          const result = await this.processDocumentForPanels(document.id, projectId, userId);
          if (result.success) {
            allLinkedRecords.push(...result.records);
          }
        } catch (error) {
          console.error(`❌ [DOCUMENT_LINKER] Error processing document ${document.id}:`, error);
        }
      }
      
      console.log(`✅ [DOCUMENT_LINKER] Processed all documents, linked ${allLinkedRecords.length} total records`);
      
      return {
        success: true,
        projectId,
        documentsProcessed: documents.length,
        recordsLinked: allLinkedRecords.length,
        records: allLinkedRecords
      };
      
    } catch (error) {
      console.error(`❌ [DOCUMENT_LINKER] Error processing all documents:`, error);
      return {
        success: false,
        error: error.message,
        projectId
      };
    }
  }

  /**
   * Close database connections
   */
  async close() {
    await this.pool.end();
    await this.panelLookup.close();
  }
}

module.exports = DocumentToPanelLinker;
