const { Pool } = require('pg');
require('dotenv').config();

class AsbuiltValidationService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Business rules for each domain
    this.businessRules = {
      panel_placement: {
        dateTime: {
          required: true,
          type: 'datetime',
          validation: (value) => {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              return { isValid: false, error: 'Invalid date format' };
            }
            if (date > new Date()) {
              return { isValid: false, error: 'Date cannot be in the future' };
            }
            return { isValid: true };
          }
        },
        panelNumber: {
          required: true,
          type: 'string',
          validation: (value) => {
            if (!value || value.toString().trim() === '') {
              return { isValid: false, error: 'Panel number is required' };
            }
            if (!/^[\d\s\-\|]+$/.test(value.toString())) {
              return { isValid: false, error: 'Panel number contains invalid characters' };
            }
            return { isValid: true };
          }
        }
      },
      panel_seaming: {
        dateTime: {
          required: true,
          type: 'datetime',
          validation: (value) => {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              return { isValid: false, error: 'Invalid date format' };
            }
            return { isValid: true };
          }
        },
        panelNumbers: {
          required: true,
          type: 'string',
          validation: (value) => {
            if (!value || value.toString().trim() === '') {
              return { isValid: false, error: 'Panel numbers are required' };
            }
            return { isValid: true };
          }
        },
        seamerInitials: {
          required: true,
          type: 'string',
          validation: (value) => {
            if (!value || value.toString().trim() === '') {
              return { isValid: false, error: 'Seamer initials are required' };
            }
            if (!/^[A-Z]{2,4}$/.test(value.toString().toUpperCase())) {
              return { isValid: false, error: 'Seamer initials should be 2-4 uppercase letters' };
            }
            return { isValid: true };
          }
        },
        wedgeTemp: {
          required: false,
          type: 'number',
          validation: (value) => {
            if (value === null || value === undefined || value === '') {
              return { isValid: true }; // Optional field
            }
            const num = parseFloat(value);
            if (isNaN(num)) {
              return { isValid: false, error: 'Wedge temperature must be a number' };
            }
            if (num < 200 || num > 600) {
              return { isValid: false, error: 'Wedge temperature should be between 200°F and 600°F' };
            }
            return { isValid: true };
          }
        },
        vboxPassFail: {
          required: true,
          type: 'enum',
          allowedValues: ['Pass', 'Fail', 'N/A'],
          validation: (value) => {
            if (!value || !['Pass', 'Fail', 'N/A'].includes(value.toString())) {
              return { isValid: false, error: 'VBox result must be Pass, Fail, or N/A' };
            }
            return { isValid: true };
          }
        }
      },
      non_destructive: {
        dateTime: {
          required: true,
          type: 'datetime',
          validation: (value) => {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              return { isValid: false, error: 'Invalid date format' };
            }
            return { isValid: true };
          }
        },
        panelNumbers: {
          required: true,
          type: 'string',
          validation: (value) => {
            if (!value || value.toString().trim() === '') {
              return { isValid: false, error: 'Panel numbers are required' };
            }
            return { isValid: true };
          }
        },
        operatorInitials: {
          required: true,
          type: 'string',
          validation: (value) => {
            if (!value || value.toString().trim() === '') {
              return { isValid: false, error: 'Operator initials are required' };
            }
            if (!/^[A-Z]{2,4}$/.test(value.toString().toUpperCase())) {
              return { isValid: false, error: 'Operator initials should be 2-4 uppercase letters' };
            }
            return { isValid: true };
          }
        },
        vboxPassFail: {
          required: true,
          type: 'enum',
          allowedValues: ['Pass', 'Fail'],
          validation: (value) => {
            if (!value || !['Pass', 'Fail'].includes(value.toString())) {
              return { isValid: false, error: 'VBox result must be Pass or Fail' };
            }
            return { isValid: true };
          }
        }
      },
      trial_weld: {
        dateTime: {
          required: true,
          type: 'datetime',
          validation: (value) => {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              return { isValid: false, error: 'Invalid date format' };
            }
            return { isValid: true };
          }
        },
        seamerInitials: {
          required: true,
          type: 'string',
          validation: (value) => {
            if (!value || value.toString().trim() === '') {
              return { isValid: false, error: 'Seamer initials are required' };
            }
            if (!/^[A-Z]{2,4}$/.test(value.toString().toUpperCase())) {
              return { isValid: false, error: 'Seamer initials should be 2-4 uppercase letters' };
            }
            return { isValid: true };
          }
        },
        passFail: {
          required: true,
          type: 'enum',
          allowedValues: ['Pass', 'Fail'],
          validation: (value) => {
            if (!value || !['Pass', 'Fail'].includes(value.toString())) {
              return { isValid: false, error: 'Trial weld result must be Pass or Fail' };
            }
            return { isValid: true };
          }
        }
      },
      repairs: {
        date: {
          required: true,
          type: 'date',
          validation: (value) => {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              return { isValid: false, error: 'Invalid date format' };
            }
            return { isValid: true };
          }
        },
        repairId: {
          required: true,
          type: 'string',
          validation: (value) => {
            if (!value || value.toString().trim() === '') {
              return { isValid: false, error: 'Repair ID is required' };
            }
            if (!/^DS-\d+$/.test(value.toString())) {
              return { isValid: false, error: 'Repair ID should follow format DS-XX' };
            }
            return { isValid: true };
          }
        },
        panelNumbers: {
          required: true,
          type: 'string',
          validation: (value) => {
            if (!value || value.toString().trim() === '') {
              return { isValid: false, error: 'Panel numbers are required' };
            }
            return { isValid: true };
          }
        }
      },
      destructive: {
        date: {
          required: true,
          type: 'date',
          validation: (value) => {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              return { isValid: false, error: 'Invalid date format' };
            }
            return { isValid: true };
          }
        },
        panelNumbers: {
          required: true,
          type: 'string',
          validation: (value) => {
            if (!value || value.toString().trim() === '') {
              return { isValid: false, error: 'Panel numbers are required' };
            }
            return { isValid: true };
          }
        },
        sampleId: {
          required: true,
          type: 'string',
          validation: (value) => {
            if (!value || value.toString().trim() === '') {
              return { isValid: false, error: 'Sample ID is required' };
            }
            if (!/^DS-\d+$/.test(value.toString())) {
              return { isValid: false, error: 'Sample ID should follow format DS-XX' };
            }
            return { isValid: true };
          }
        },
        passFail: {
          required: true,
          type: 'enum',
          allowedValues: ['Pass', 'Fail'],
          validation: (value) => {
            if (!value || !['Pass', 'Fail'].includes(value.toString())) {
              return { isValid: false, error: 'Destructive test result must be Pass or Fail' };
            }
            return { isValid: true };
          }
        }
      }
    };
  }

  /**
   * Validate a single record against business rules
   */
  validateRecord(record, domain) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      fieldValidations: {}
    };

    if (!this.businessRules[domain]) {
      validation.errors.push(`Unknown domain: ${domain}`);
      validation.isValid = false;
      return validation;
    }

    const rules = this.businessRules[domain];
    
    // Validate each field according to business rules
    Object.entries(rules).forEach(([fieldName, rule]) => {
      const fieldValue = record.mappedData[fieldName];
      const fieldValidation = this.validateField(fieldName, fieldValue, rule);
      
      validation.fieldValidations[fieldName] = fieldValidation;
      
      if (fieldValidation.errors.length > 0) {
        validation.errors.push(...fieldValidation.errors);
        validation.isValid = false;
      }
      
      if (fieldValidation.warnings.length > 0) {
        validation.warnings.push(...fieldValidation.warnings);
      }
    });

    // Check for missing required fields
    Object.entries(rules).forEach(([fieldName, rule]) => {
      if (rule.required && (!record.mappedData[fieldName] || record.mappedData[fieldName] === '')) {
        const error = `Required field '${fieldName}' is missing`;
        validation.errors.push(error);
        validation.isValid = false;
        
        if (!validation.fieldValidations[fieldName]) {
          validation.fieldValidations[fieldName] = { errors: [], warnings: [] };
        }
        validation.fieldValidations[fieldName].errors.push(error);
      }
    });

    return validation;
  }

  /**
   * Validate a single field against its business rule
   */
  validateField(fieldName, value, rule) {
    const validation = {
      errors: [],
      warnings: []
    };

    // Skip validation for optional fields that are empty
    if (!rule.required && (value === null || value === undefined || value === '')) {
      return validation;
    }

    // Type validation
    if (rule.type === 'number' && value !== null && value !== undefined) {
      const num = parseFloat(value);
      if (isNaN(num)) {
        validation.errors.push(`${fieldName} must be a number`);
      }
    }

    // Enum validation
    if (rule.type === 'enum' && rule.allowedValues) {
      if (!rule.allowedValues.includes(value)) {
        validation.errors.push(`${fieldName} must be one of: ${rule.allowedValues.join(', ')}`);
      }
    }

    // Custom validation function
    if (rule.validation && typeof rule.validation === 'function') {
      try {
        const result = rule.validation(value);
        if (!result.isValid) {
          validation.errors.push(result.error);
        }
      } catch (error) {
        validation.errors.push(`Validation error for ${fieldName}: ${error.message}`);
      }
    }

    return validation;
  }

  /**
   * Validate multiple records
   */
  validateRecords(records, domain) {
    const results = records.map((record, index) => {
      const validation = this.validateRecord(record, domain);
      return {
        recordIndex: index,
        record: record,
        validation: validation
      };
    });

    const validCount = results.filter(r => r.validation.isValid).length;
    const invalidCount = results.length - validCount;

    return {
      totalRecords: records.length,
      validRecords: validCount,
      invalidRecords: invalidCount,
      validationScore: records.length > 0 ? validCount / records.length : 0,
      results: results,
      requiresReview: invalidCount > 0
    };
  }

  /**
   * Cross-reference validation (check for data consistency across records)
   */
  async crossReferenceValidation(records, domain, projectId) {
    const crossRefResults = {
      warnings: [],
      inconsistencies: []
    };

    if (domain === 'panel_seaming') {
      // Check for duplicate panel numbers in the same batch
      const panelNumbers = records.map(r => r.mappedData.panelNumbers).filter(Boolean);
      const duplicates = this.findDuplicates(panelNumbers);
      
      if (duplicates.length > 0) {
        crossRefResults.warnings.push(`Duplicate panel numbers found: ${duplicates.join(', ')}`);
      }

      // Check for missing seamer initials consistency
      const seamerInitials = records.map(r => r.mappedData.seamerInitials).filter(Boolean);
      const uniqueInitials = [...new Set(seamerInitials)];
      
      if (uniqueInitials.length > 3) {
        crossRefResults.warnings.push(`Multiple seamer initials detected: ${uniqueInitials.join(', ')}`);
      }
    }

    if (domain === 'repairs' || domain === 'destructive') {
      // Check for duplicate repair/sample IDs
      const ids = records.map(r => r.mappedData.repairId || r.mappedData.sampleId).filter(Boolean);
      const duplicateIds = this.findDuplicates(ids);
      
      if (duplicateIds.length > 0) {
        crossRefResults.inconsistencies.push(`Duplicate ${domain === 'repairs' ? 'repair' : 'sample'} IDs: ${duplicateIds.join(', ')}`);
      }
    }

    return crossRefResults;
  }

  /**
   * Find duplicate values in an array
   */
  findDuplicates(array) {
    const counts = {};
    const duplicates = [];

    array.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
      if (counts[item] === 2) {
        duplicates.push(item);
      }
    });

    return duplicates;
  }

  /**
   * Get validation summary for a project
   */
  async getProjectValidationSummary(projectId) {
    try {
      const query = `
        SELECT 
          domain,
          COUNT(*) as total_records,
          COUNT(CASE WHEN requires_review = true THEN 1 END) as review_required,
          AVG(ai_confidence) as avg_confidence
        FROM asbuilt_records 
        WHERE project_id = $1
        GROUP BY domain
        ORDER BY domain
      `;

      const result = await this.pool.query(query, [projectId]);
      
      return result.rows.map(row => ({
        domain: row.domain,
        totalRecords: parseInt(row.total_records),
        reviewRequired: parseInt(row.review_required),
        averageConfidence: parseFloat(row.avg_confidence) || 0,
        validationScore: row.total_records > 0 ? 
          (row.total_records - row.review_required) / row.total_records : 0
      }));
    } catch (error) {
      console.error('Error getting project validation summary:', error);
      throw new Error(`Failed to get validation summary: ${error.message}`);
    }
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = AsbuiltValidationService;
