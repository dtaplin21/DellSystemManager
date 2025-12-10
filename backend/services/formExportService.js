const ExcelJS = require('exceljs');
const AsbuiltService = require('./asbuiltService');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

class FormExportService {
  constructor() {
    this.asbuiltService = new AsbuiltService();
  }

  /**
   * Export a single form as Excel
   */
  async exportFormAsExcel(recordId) {
    try {
      const record = await this.asbuiltService.getRecordById(recordId);
      
      if (!record) {
        throw new Error('Form record not found');
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Form Data');

      // Parse form data
      const mappedData = typeof record.mapped_data === 'string' 
        ? JSON.parse(record.mapped_data) 
        : record.mapped_data;

      // Add metadata header
      worksheet.addRow(['Form Metadata']);
      worksheet.addRow(['Form ID', record.id]);
      worksheet.addRow(['Form Type', record.domain]);
      worksheet.addRow(['Project ID', record.project_id]);
      worksheet.addRow(['Panel ID', record.panel_id || 'N/A']);
      worksheet.addRow(['Created At', record.created_at]);
      worksheet.addRow(['Created By', record.created_by || 'N/A']);
      worksheet.addRow(['AI Confidence', record.ai_confidence || 'N/A']);
      worksheet.addRow(['Requires Review', record.requires_review ? 'Yes' : 'No']);
      worksheet.addRow([]); // Empty row

      // Add form fields
      worksheet.addRow(['Form Fields']);
      worksheet.addRow(['Field', 'Value']);

      // Add all form fields
      for (const [key, value] of Object.entries(mappedData)) {
        worksheet.addRow([this.formatFieldName(key), value || '']);
      }

      // Style the header rows
      worksheet.getRow(1).font = { bold: true, size: 14 };
      worksheet.getRow(10).font = { bold: true, size: 12 };
      worksheet.getRow(11).font = { bold: true };

      // Auto-size columns
      worksheet.columns.forEach(column => {
        column.width = 30;
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      throw new Error(`Failed to export form as Excel: ${error.message}`);
    }
  }

  /**
   * Export all forms for a project as Excel
   */
  async exportProjectFormsAsExcel(projectId) {
    try {
      // Get all forms with pagination
      let allRecords = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const batch = await this.asbuiltService.getProjectRecords(projectId, limit, offset);
        allRecords = allRecords.concat(batch);
        offset += limit;
        hasMore = batch.length === limit;
      }

      if (allRecords.length === 0) {
        throw new Error('No forms found for this project');
      }

      const workbook = new ExcelJS.Workbook();

      // Group forms by domain (form type)
      const formsByDomain = {};
      for (const record of allRecords) {
        const domain = record.domain;
        if (!formsByDomain[domain]) {
          formsByDomain[domain] = [];
        }
        formsByDomain[domain].push(record);
      }

      // Create a sheet for each form type
      for (const [domain, records] of Object.entries(formsByDomain)) {
        const worksheet = workbook.addWorksheet(this.formatDomainName(domain));

        // Get all unique field names across all forms of this type
        const allFieldNames = new Set();
        for (const record of records) {
          const mappedData = typeof record.mapped_data === 'string' 
            ? JSON.parse(record.mapped_data) 
            : record.mapped_data;
          Object.keys(mappedData).forEach(key => allFieldNames.add(key));
        }

        // Create header row
        const headerRow = ['Form ID', 'Created At', 'Created By', 'AI Confidence', 'Requires Review', ...Array.from(allFieldNames).map(k => this.formatFieldName(k))];
        worksheet.addRow(headerRow);

        // Style header
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };

        // Add data rows
        for (const record of records) {
          const mappedData = typeof record.mapped_data === 'string' 
            ? JSON.parse(record.mapped_data) 
            : record.mapped_data;

          const row = [
            record.id,
            record.created_at,
            record.created_by || 'N/A',
            record.ai_confidence || 'N/A',
            record.requires_review ? 'Yes' : 'No',
            ...Array.from(allFieldNames).map(key => mappedData[key] || '')
          ];
          worksheet.addRow(row);
        }

        // Auto-size columns
        worksheet.columns.forEach(column => {
          column.width = 20;
        });
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      throw new Error(`Failed to export project forms as Excel: ${error.message}`);
    }
  }

  /**
   * Export a single form as PDF
   */
  async exportFormAsPDF(recordId) {
    try {
      const record = await this.asbuiltService.getRecordById(recordId);
      
      if (!record) {
        throw new Error('Form record not found');
      }

      // Parse form data
      const mappedData = typeof record.mapped_data === 'string' 
        ? JSON.parse(record.mapped_data) 
        : record.mapped_data;

      // Generate HTML for PDF
      const html = this.generateFormHTML(record, mappedData);

      // For now, return HTML (can be converted to PDF using puppeteer or similar)
      // In production, you would use puppeteer or pdfkit here
      return {
        html,
        contentType: 'text/html',
        filename: `form-${recordId}.html`
      };
    } catch (error) {
      throw new Error(`Failed to export form as PDF: ${error.message}`);
    }
  }

  /**
   * Export all forms for a project as PDF
   */
  async exportProjectFormsAsPDF(projectId) {
    try {
      // Get all forms with pagination
      let allRecords = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const batch = await this.asbuiltService.getProjectRecords(projectId, limit, offset);
        allRecords = allRecords.concat(batch);
        offset += limit;
        hasMore = batch.length === limit;
      }

      if (allRecords.length === 0) {
        throw new Error('No forms found for this project');
      }

      // Generate HTML for all forms
      const formsHTML = allRecords.map(record => {
        const mappedData = typeof record.mapped_data === 'string' 
          ? JSON.parse(record.mapped_data) 
          : record.mapped_data;
        return this.generateFormHTML(record, mappedData);
      }).join('<div style="page-break-after: always;"></div>');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Project Forms Export</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .form-section { margin-bottom: 40px; border: 1px solid #ccc; padding: 20px; }
            .form-header { background-color: #f0f0f0; padding: 10px; margin-bottom: 20px; }
            .form-field { margin: 10px 0; }
            .field-label { font-weight: bold; }
            .field-value { margin-left: 10px; }
          </style>
        </head>
        <body>
          <h1>Project Forms Export</h1>
          <p>Total Forms: ${allRecords.length}</p>
          ${formsHTML}
        </body>
        </html>
      `;

      return {
        html,
        contentType: 'text/html',
        filename: `project-forms-${projectId}.html`
      };
    } catch (error) {
      throw new Error(`Failed to export project forms as PDF: ${error.message}`);
    }
  }

  /**
   * Generate HTML for a form
   */
  generateFormHTML(record, mappedData) {
    const fieldsHTML = Object.entries(mappedData)
      .map(([key, value]) => `
        <div class="form-field">
          <span class="field-label">${this.formatFieldName(key)}:</span>
          <span class="field-value">${value || 'N/A'}</span>
        </div>
      `)
      .join('');

    return `
      <div class="form-section">
        <div class="form-header">
          <h2>${this.formatDomainName(record.domain)}</h2>
          <p><strong>Form ID:</strong> ${record.id}</p>
          <p><strong>Created:</strong> ${new Date(record.created_at).toLocaleString()}</p>
          <p><strong>Created By:</strong> ${record.created_by || 'N/A'}</p>
        </div>
        <div class="form-fields">
          ${fieldsHTML}
        </div>
      </div>
    `;
  }

  /**
   * Format field name for display
   */
  formatFieldName(key) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Format domain name for display
   */
  formatDomainName(domain) {
    return domain
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

module.exports = new FormExportService();

