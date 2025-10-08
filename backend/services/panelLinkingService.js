const { Pool } = require('pg');
const xlsx = require('xlsx');
const fs = require('fs').promises;
const path = require('path');
const PanelLookupService = require('./panelLookupService');
const AsbuiltService = require('./asbuiltService');
const AsbuiltImportAI = require('./asbuiltImportAI');
require('dotenv').config();

class PanelLinkingService {
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
   * Main method to process documents and link data to panels
   */
  async processDocumentsForProject(projectId, userId = null) {
    try {
      console.log(`🚀 [PANEL_LINKING] Starting document processing for project: ${projectId}`);
      
      // Get all documents for the project
      const documents = await this.getProjectDocuments(projectId);
      console.log(`📄 [PANEL_LINKING] Found ${documents.length} documents to process`);
      
      if (documents.length === 0) {
        return {
          success: true,
          message: 'No documents found for processing',
          projectId,
          documentsProcessed: 0,
          recordsLinked: 0
        };
      }
      
      let totalRecordsLinked = 0;
      const processingResults = [];
      
      // Process each document
      for (const document of documents) {
        try {
          console.log(`📄 [PANEL_LINKING] Processing: ${document.name}`);
          
          const result = await this.processDocument(document, projectId, userId);
          processingResults.push(result);
          
          if (result.success) {
            totalRecordsLinked += result.recordsLinked || 0;
            console.log(`✅ [PANEL_LINKING] Linked ${result.recordsLinked || 0} records from ${document.name}`);
          } else {
            console.log(`⚠️ [PANEL_LINKING] Failed to process ${document.name}: ${result.error}`);
          }
        } catch (error) {
          console.error(`❌ [PANEL_LINKING] Error processing ${document.name}:`, error.message);
          processingResults.push({
            success: false,
            documentId: document.id,
            documentName: document.name,
            error: error.message
          });
        }
      }
      
      console.log(`🎉 [PANEL_LINKING] Processing complete! Linked ${totalRecordsLinked} total records`);
      
      return {
        success: true,
        projectId,
        documentsProcessed: documents.length,
        recordsLinked: totalRecordsLinked,
        results: processingResults
      };
      
    } catch (error) {
      console.error(`❌ [PANEL_LINKING] Error processing project:`, error);
      return {
        success: false,
        error: error.message,
        projectId
      };
    }
  }

  /**
   * Process a single document and link data to panels
   */
  async processDocument(document, projectId, userId = null) {
    try {
      const documentType = this.categorizeDocument(document);
      console.log(`🔍 [PANEL_LINKING] Document type: ${documentType} for ${document.name}`);
      
      let recordsLinked = 0;
      
      switch (documentType) {
        case 'excel_asbuilt':
          recordsLinked = await this.processExcelAsbuiltDocument(document, projectId, userId);
          break;
        case 'pdf_report':
          recordsLinked = await this.processPdfReportDocument(document, projectId, userId);
          break;
        case 'panel_specs':
          recordsLinked = await this.processPanelSpecsDocument(document, projectId, userId);
          break;
        default:
          console.log(`⚠️ [PANEL_LINKING] Unknown document type: ${documentType}, skipping`);
          return {
            success: false,
            documentId: document.id,
            documentName: document.name,
            error: 'Unknown document type'
          };
      }
      
      return {
        success: true,
        documentId: document.id,
        documentName: document.name,
        documentType,
        recordsLinked
      };
      
    } catch (error) {
      console.error(`❌ [PANEL_LINKING] Error processing document:`, error);
      return {
        success: false,
        documentId: document.id,
        documentName: document.name,
        error: error.message
      };
    }
  }

  /**
   * Get all documents for a project
   */
  async getProjectDocuments(projectId) {
    try {
      const query = `
        SELECT id, name, type, size, path, uploaded_at, uploaded_by, text_content
        FROM documents 
        WHERE project_id = $1
        ORDER BY uploaded_at DESC
      `;
      
      const result = await this.pool.query(query, [projectId]);
      return result.rows;
    } catch (error) {
      console.error(`❌ [PANEL_LINKING] Error getting documents:`, error);
      return [];
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
          name.includes('seaming') || name.includes('seam') || name.includes('ndt') ||
          name.includes('repair') || name.includes('destructive')) {
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
  async processExcelAsbuiltDocument(document, projectId, userId = null) {
    try {
      console.log(`📊 [PANEL_LINKING] Processing Excel as-built document: ${document.name}`);
      
      // Read the Excel file
      const fileBuffer = await this.readDocumentFile(document.path);
      if (!fileBuffer) {
        throw new Error('Could not read document file');
      }
      
      // Determine the domain based on document name
      const domain = this.determineAsbuiltDomain(document.name);
      console.log(`🔍 [PANEL_LINKING] Detected domain: ${domain}`);
      
      // Use the AI import service to process the Excel file
      const importResult = await this.asbuiltImportAI.importExcelData(
        fileBuffer,
        projectId,
        domain,
        userId
      );
      
      console.log(`📊 [PANEL_LINKING] Import result:`, {
        success: importResult.success,
        records: importResult.records?.length || 0,
        errors: importResult.errors?.length || 0,
        confidence: importResult.confidence,
        usedAI: importResult.usedAI
      });
      
      // Insert records into database
      let recordsLinked = 0;
      if (importResult.success && importResult.records && importResult.records.length > 0) {
        for (const record of importResult.records) {
          try {
            await this.asbuiltService.createRecord(record);
            recordsLinked++;
            console.log(`✅ [PANEL_LINKING] Created ${domain} record for panel ${record.panelId}`);
          } catch (insertError) {
            console.error(`❌ [PANEL_LINKING] Failed to create record:`, insertError.message);
          }
        }
      }
      
      return recordsLinked;
      
    } catch (error) {
      console.error(`❌ [PANEL_LINKING] Error processing Excel document:`, error);
      return 0;
    }
  }

  /**
   * Process PDF report documents
   */
  async processPdfReportDocument(document, projectId, userId = null) {
    try {
      console.log(`📄 [PANEL_LINKING] Processing PDF report document: ${document.name}`);
      
      // Extract text content if available
      const textContent = document.text_content;
      if (!textContent) {
        console.log(`⚠️ [PANEL_LINKING] No text content available for PDF: ${document.name}`);
        return 0;
      }
      
      // Use AI to extract panel-specific data from PDF
      const extractedData = await this.extractPanelDataFromText(textContent, document.name);
      
      // Link extracted data to panels
      let recordsLinked = 0;
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
              recordsLinked++;
              console.log(`✅ [PANEL_LINKING] Created ${data.domain} record for panel ${data.panelNumber}`);
            } catch (insertError) {
              console.error(`❌ [PANEL_LINKING] Error inserting PDF record:`, insertError.message);
            }
          }
        }
      }
      
      return recordsLinked;
      
    } catch (error) {
      console.error(`❌ [PANEL_LINKING] Error processing PDF document:`, error);
      return 0;
    }
  }

  /**
   * Process panel specifications documents
   */
  async processPanelSpecsDocument(document, projectId, userId = null) {
    try {
      console.log(`📋 [PANEL_LINKING] Processing panel specs document: ${document.name}`);
      
      // This would use the existing panel document analyzer
      // For now, return 0 as this is handled by other services
      return 0;
      
    } catch (error) {
      console.error(`❌ [PANEL_LINKING] Error processing panel specs document:`, error);
      return 0;
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
    
    // Default to panel_seaming for Excel files
    return 'panel_seaming';
  }

  /**
   * Extract panel data from text content using AI
   */
  async extractPanelDataFromText(textContent, documentName) {
    // This would use OpenAI to extract panel-specific data from text
    // For now, return empty array as this requires more complex AI integration
    console.log(`🔍 [PANEL_LINKING] Would extract panel data from text (${textContent.length} chars)`);
    return [];
  }

  /**
   * Read document file from storage
   */
  async readDocumentFile(filePath) {
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Read the file
      const fileBuffer = await fs.readFile(filePath);
      console.log(`📁 [PANEL_LINKING] Successfully read file: ${filePath} (${fileBuffer.length} bytes)`);
      return fileBuffer;
    } catch (error) {
      console.error(`❌ [PANEL_LINKING] Error reading file ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Create test as-built data for demonstration
   */
  async createTestAsbuiltData(projectId, userId = null) {
    try {
      console.log(`🧪 [PANEL_LINKING] Creating test as-built data for project: ${projectId}`);
      
      // Get existing panels
      const panels = await this.panelLookup.getAllPanels(projectId);
      console.log(`📋 [PANEL_LINKING] Found ${panels.length} existing panels`);
      
      if (panels.length === 0) {
        console.log('❌ [PANEL_LINKING] No panels found, cannot create test data');
        return 0;
      }
      
      // Use the first few panels for test data
      const testPanels = panels.slice(0, 3);
      console.log(`🎯 [PANEL_LINKING] Using panels: ${testPanels.map(p => p.panelNumber || p.id).join(', ')}`);
      
      // Create test as-built records for different domains
      const testRecords = [];
      
      for (let i = 0; i < testPanels.length; i++) {
        const panel = testPanels[i];
        const panelNumber = panel.panelNumber || `P-${i + 1}`;
        
        // Panel Placement record
        testRecords.push({
          projectId,
          panelId: panel.id,
          domain: 'panel_placement',
          sourceDocId: null,
          rawData: {
            panelNumber,
            dateTime: new Date().toISOString(),
            locationNote: `Test location for ${panelNumber}`,
            weatherComments: 'Clear skies, 75°F'
          },
          mappedData: {
            panelNumber,
            dateTime: new Date().toISOString(),
            locationNote: `Test location for ${panelNumber}`,
            weatherComments: 'Clear skies, 75°F'
          },
          aiConfidence: 0.95,
          requiresReview: false,
          createdBy: userId
        });
        
        // Panel Seaming record
        testRecords.push({
          projectId,
          panelId: panel.id,
          domain: 'panel_seaming',
          sourceDocId: null,
          rawData: {
            panelNumbers: panelNumber,
            dateTime: new Date().toISOString(),
            seamerInitials: 'JD',
            machineNumber: 'M001',
            wedgeTemp: 450,
            vboxPassFail: 'Pass'
          },
          mappedData: {
            panelNumbers: panelNumber,
            dateTime: new Date().toISOString(),
            seamerInitials: 'JD',
            machineNumber: 'M001',
            wedgeTemp: 450,
            vboxPassFail: 'Pass'
          },
          aiConfidence: 0.90,
          requiresReview: false,
          createdBy: userId
        });
        
        // Non-Destructive Testing record
        testRecords.push({
          projectId,
          panelId: panel.id,
          domain: 'non_destructive',
          sourceDocId: null,
          rawData: {
            panelNumbers: panelNumber,
            dateTime: new Date().toISOString(),
            operatorInitials: 'SM',
            vboxPassFail: 'Pass',
            notes: `NDT completed for ${panelNumber}`
          },
          mappedData: {
            panelNumbers: panelNumber,
            dateTime: new Date().toISOString(),
            operatorInitials: 'SM',
            vboxPassFail: 'Pass',
            notes: `NDT completed for ${panelNumber}`
          },
          aiConfidence: 0.85,
          requiresReview: false,
          createdBy: userId
        });
      }
      
      console.log(`📊 [PANEL_LINKING] Creating ${testRecords.length} test records...`);
      
      // Insert all test records
      let recordsCreated = 0;
      for (const record of testRecords) {
        try {
          const createdRecord = await this.asbuiltService.createRecord(record);
          recordsCreated++;
          console.log(`✅ [PANEL_LINKING] Created ${record.domain} record for panel ${record.mappedData.panelNumber || record.mappedData.panelNumbers}`);
        } catch (error) {
          console.error(`❌ [PANEL_LINKING] Failed to create ${record.domain} record:`, error.message);
        }
      }
      
      console.log(`🎉 [PANEL_LINKING] Successfully created ${recordsCreated} test as-built records!`);
      return recordsCreated;
      
    } catch (error) {
      console.error(`❌ [PANEL_LINKING] Error creating test data:`, error);
      return 0;
    }
  }

  /**
   * Get processing status for a project
   */
  async getProcessingStatus(projectId) {
    try {
      // Get document count
      const documentQuery = `
        SELECT COUNT(*) as document_count
        FROM documents 
        WHERE project_id = $1
      `;
      
      const docResult = await this.pool.query(documentQuery, [projectId]);
      const documentCount = parseInt(docResult.rows[0].document_count);

      // Get as-built record count
      const recordQuery = `
        SELECT COUNT(*) as record_count
        FROM asbuilt_records 
        WHERE project_id = $1
      `;
      
      const recordResult = await this.pool.query(recordQuery, [projectId]);
      const recordCount = parseInt(recordResult.rows[0].record_count);

      return {
        success: true,
        projectId,
        documentCount,
        recordCount,
        processingStatus: recordCount > 0 ? 'processed' : 'pending'
      };
    } catch (error) {
      console.error(`❌ [PANEL_LINKING] Error getting status:`, error);
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

module.exports = PanelLinkingService;
