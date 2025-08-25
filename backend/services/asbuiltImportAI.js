const xlsx = require('xlsx');
const { Pool } = require('pg');
require('dotenv').config();

class AsbuiltImportAI {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Canonical field mappings for each domain
    this.canonicalFields = {
      panel_placement: [
        'dateTime', 'panelNumber', 'locationNote', 'weatherComments'
      ],
      panel_seaming: [
        'dateTime', 'panelNumbers', 'seamLength', 'seamerInitials',
        'machineNumber', 'wedgeTemp', 'nipRollerSpeed', 'barrelTemp',
        'preheatTemp', 'trackPeelInside', 'trackPeelOutside',
        'tensileLbsPerIn', 'tensileRate', 'vboxPassFail', 'weatherComments'
      ],
      non_destructive: [
        'dateTime', 'panelNumbers', 'operatorInitials', 'vboxPassFail', 'notes'
      ],
      trial_weld: [
        'dateTime', 'seamerInitials', 'machineNumber', 'wedgeTemp',
        'nipRollerSpeed', 'barrelTemp', 'preheatTemp', 'trackPeelInside',
        'trackPeelOutside', 'tensileLbsPerIn', 'tensileRate',
        'passFail', 'ambientTemp', 'comments'
      ],
      repairs: [
        'date', 'repairId', 'panelNumbers', 'extruderNumber',
        'operatorInitials', 'typeDetailLocation', 'vboxPassFail'
      ],
      destructive: [
        'date', 'panelNumbers', 'sampleId', 'testerInitials',
        'machineNumber', 'trackPeelInside', 'trackPeelOutside',
        'tensileLbsPerIn', 'tensileRate', 'passFail', 'comments'
      ]
    };

    // Common field variations for fuzzy matching
    this.fieldVariations = {
      'dateTime': ['date', 'time', 'datetime', 'date/time', 'timestamp'],
      'panelNumber': ['panel', 'panel #', 'panel number', 'panel_num', 'panelid'],
      'panelNumbers': ['panels', 'panel numbers', 'panel_nums', 'panel_ids'],
      'seamLength': ['length', 'seam length', 'seam_length', 'length_ft', 'length_feet'],
      'seamerInitials': ['seamer', 'operator', 'initials', 'seamer_initials', 'operator_initials'],
      'machineNumber': ['machine', 'machine #', 'machine_num', 'machine_number', 'equipment'],
      'wedgeTemp': ['wedge temp', 'wedge_temp', 'wedge temperature', 'wedge_temp_f'],
      'nipRollerSpeed': ['nip speed', 'nip_speed', 'roller speed', 'roller_speed', 'speed'],
      'barrelTemp': ['barrel temp', 'barrel_temp', 'barrel temperature', 'barrel_temp_f'],
      'preheatTemp': ['preheat temp', 'preheat_temp', 'preheat temperature', 'preheat_temp_f'],
      'trackPeelInside': ['inside peel', 'inside_peel', 'track peel inside', 'track_peel_inside'],
      'trackPeelOutside': ['outside peel', 'outside_peel', 'track peel outside', 'track_peel_outside'],
      'tensileLbsPerIn': ['tensile', 'tensile_lbs', 'tensile_lbs_per_in', 'tensile strength'],
      'tensileRate': ['tensile rate', 'tensile_rate', 'rate', 'test rate', 'test_rate'],
      'vboxPassFail': ['vbox', 'pass/fail', 'pass_fail', 'result', 'test result', 'test_result'],
      'weatherComments': ['weather', 'weather_comments', 'weather notes', 'weather_notes', 'conditions'],
      'operatorInitials': ['operator', 'operator_initials', 'tester', 'tester_initials'],
      'notes': ['note', 'comment', 'comments', 'description', 'desc'],
      'date': ['date', 'test date', 'test_date', 'inspection date', 'inspection_date'],
      'repairId': ['repair id', 'repair_id', 'repair #', 'repair_num', 'repair number'],
      'extruderNumber': ['extruder', 'extruder #', 'extruder_num', 'extruder number'],
      'typeDetailLocation': ['type', 'detail', 'location', 'type_detail_location', 'repair_type'],
      'sampleId': ['sample id', 'sample_id', 'sample #', 'sample_num', 'sample number'],
      'testerInitials': ['tester', 'tester_initials', 'inspector', 'inspector_initials'],
      'passFail': ['pass/fail', 'pass_fail', 'result', 'test result', 'test_result', 'outcome'],
      'comments': ['comment', 'note', 'notes', 'description', 'desc', 'remarks'],
      'ambientTemp': ['ambient temp', 'ambient_temp', 'ambient temperature', 'ambient_temp_f', 'room temp']
    };
  }

  /**
   * Parse Excel file and extract data
   */
  async parseExcelFile(fileBuffer, domain) {
    try {
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with headers
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        throw new Error('Excel file must have at least headers and one data row');
      }

      const headers = jsonData[0];
      const dataRows = jsonData.slice(1);

      console.log(`📊 Parsed Excel file: ${headers.length} columns, ${dataRows.length} rows`);
      console.log(`📊 Headers:`, headers);

      return { headers, dataRows, sheetName };
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
   * AI-powered field mapping using fuzzy matching
   */
  mapHeadersToCanonicalFields(headers, domain) {
    const mappings = [];
    const unmappedHeaders = [];
    const confidenceScores = [];

    console.log(`🔍 Mapping headers for domain: ${domain}`);
    console.log(`🔍 Available canonical fields:`, this.canonicalFields[domain]);

    headers.forEach((header, index) => {
      if (!header) return; // Skip empty headers

      const headerStr = header.toString().trim();
      const bestMatch = this.findBestFieldMatch(headerStr, domain);
      
      if (bestMatch) {
        mappings.push({
          sourceHeader: headerStr,
          canonicalField: bestMatch.field,
          confidence: bestMatch.confidence,
          columnIndex: index,
          domain: domain
        });
        confidenceScores.push(bestMatch.confidence);
        console.log(`✅ Mapped: "${headerStr}" → "${bestMatch.field}" (confidence: ${bestMatch.confidence})`);
      } else {
        unmappedHeaders.push(headerStr);
        console.log(`❌ Unmapped: "${headerStr}"`);
      }
    });

    const overallConfidence = confidenceScores.length > 0 
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length 
      : 0;

    console.log(`📊 Mapping Summary: ${mappings.length} mapped, ${unmappedHeaders.length} unmapped`);
    console.log(`📊 Overall confidence: ${(overallConfidence * 100).toFixed(1)}%`);

    return {
      mappings,
      unmappedHeaders,
      overallConfidence,
      requiresReview: overallConfidence < 0.8
    };
  }

  /**
   * Find best field match using fuzzy matching
   */
  findBestFieldMatch(header, domain) {
    const headerLower = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    let bestMatch = null;
    let bestScore = 0;

    // Check canonical fields first
    this.canonicalFields[domain].forEach(field => {
      const fieldLower = field.toLowerCase().replace(/[^a-z0-9]/g, '');
      const score = this.calculateSimilarity(headerLower, fieldLower);
      
      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = { field, confidence: score };
      }
    });

    // Check field variations if no direct match
    if (!bestMatch) {
      Object.entries(this.fieldVariations).forEach(([canonicalField, variations]) => {
        if (this.canonicalFields[domain].includes(canonicalField)) {
          variations.forEach(variation => {
            const variationLower = variation.toLowerCase().replace(/[^a-z0-9]/g, '');
            const score = this.calculateSimilarity(headerLower, variationLower);
            
            if (score > bestScore && score > 0.6) {
              bestScore = score;
              bestMatch = { field: canonicalField, confidence: score };
            }
          });
        }
      });
    }

    return bestMatch;
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (str1.length === 0) return 0.0;
    if (str2.length === 0) return 0.0;

    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Transform raw data to canonical format
   */
  transformDataToCanonical(dataRows, mappings, domain) {
    const transformedRecords = [];

    dataRows.forEach((row, rowIndex) => {
      if (row.every(cell => !cell)) return; // Skip empty rows

      const record = {
        rawData: {},
        mappedData: {},
        rowIndex: rowIndex + 2 // +2 because Excel is 1-indexed and we have headers
      };

      // Extract raw data
      mappings.forEach(mapping => {
        const value = row[mapping.columnIndex];
        if (value !== undefined && value !== null && value !== '') {
          record.rawData[mapping.sourceHeader] = value;
          record.mappedData[mapping.canonicalField] = this.normalizeValue(value, mapping.canonicalField);
        }
      });

      if (Object.keys(record.mappedData).length > 0) {
        transformedRecords.push(record);
      }
    });

    console.log(`🔄 Transformed ${transformedRecords.length} records for domain: ${domain}`);
    return transformedRecords;
  }

  /**
   * Normalize values based on field type
   */
  normalizeValue(value, fieldName) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const strValue = value.toString().trim();

    // Handle numeric fields
    if (fieldName.includes('Temp') || fieldName.includes('Length') || 
        fieldName.includes('Speed') || fieldName.includes('Peel') || 
        fieldName.includes('Tensile') || fieldName.includes('Rate')) {
      const num = parseFloat(strValue);
      return isNaN(num) ? strValue : num;
    }

    // Handle date fields
    if (fieldName.includes('Date') || fieldName.includes('Time')) {
      const date = new Date(strValue);
      return isNaN(date.getTime()) ? strValue : date.toISOString();
    }

    // Handle boolean/status fields
    if (fieldName.includes('PassFail') || fieldName.includes('vboxPassFail')) {
      const lower = strValue.toLowerCase();
      if (lower.includes('pass')) return 'Pass';
      if (lower.includes('fail')) return 'Fail';
      if (lower.includes('n/a') || lower.includes('na')) return 'N/A';
      return strValue;
    }

    // Default: return as string
    return strValue;
  }

  /**
   * Validate transformed data
   */
  validateTransformedData(records, domain) {
    const validationResults = [];
    let validCount = 0;
    let invalidCount = 0;

    records.forEach((record, index) => {
      const validation = this.validateRecord(record, domain);
      validationResults.push({
        recordIndex: index,
        record: record,
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      });

      if (validation.isValid) {
        validCount++;
      } else {
        invalidCount++;
      }
    });

    console.log(`✅ Validation complete: ${validCount} valid, ${invalidCount} invalid records`);
    return validationResults;
  }

  /**
   * Validate individual record
   */
  validateRecord(record, domain) {
    const errors = [];
    const warnings = [];

    // Check required fields based on domain
    const requiredFields = this.getRequiredFields(domain);
    requiredFields.forEach(field => {
      if (!record.mappedData[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Check data types and ranges
    Object.entries(record.mappedData).forEach(([field, value]) => {
      if (value !== null && value !== undefined) {
        const fieldValidation = this.validateFieldValue(field, value);
        if (fieldValidation.error) {
          errors.push(fieldValidation.error);
        }
        if (fieldValidation.warning) {
          warnings.push(fieldValidation.warning);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get required fields for each domain
   */
  getRequiredFields(domain) {
    const requiredFields = {
      panel_placement: ['dateTime', 'panelNumber'],
      panel_seaming: ['dateTime', 'panelNumbers', 'seamerInitials'],
      non_destructive: ['dateTime', 'panelNumbers', 'operatorInitials'],
      trial_weld: ['dateTime', 'seamerInitials', 'passFail'],
      repairs: ['date', 'repairId', 'panelNumbers'],
      destructive: ['date', 'panelNumbers', 'sampleId', 'passFail']
    };

    return requiredFields[domain] || [];
  }

  /**
   * Validate individual field value
   */
  validateFieldValue(field, value) {
    const result = { error: null, warning: null };

    // Temperature validation
    if (field.includes('Temp') && typeof value === 'number') {
      if (value < -50 || value > 500) {
        result.warning = `${field} value ${value} is outside typical range (-50°F to 500°F)`;
      }
    }

    // Length validation
    if (field.includes('Length') && typeof value === 'number') {
      if (value < 0 || value > 1000) {
        result.warning = `${field} value ${value} is outside typical range (0-1000 ft)`;
      }
    }

    // Speed validation
    if (field.includes('Speed') && typeof value === 'number') {
      if (value < 0 || value > 100) {
        result.warning = `${field} value ${value} is outside typical range (0-100)`;
      }
    }

    // Panel numbers validation
    if (field.includes('Panel') && typeof value === 'string') {
      if (!/^[\d\s\-\|]+$/.test(value)) {
        result.warning = `${field} value "${value}" may contain invalid characters`;
      }
    }

    return result;
  }

  /**
   * Main import method
   */
  async importExcelData(fileBuffer, projectId, domain, userId) {
    try {
      console.log(`🚀 Starting Excel import for domain: ${domain}, project: ${projectId}`);

      // Parse Excel file
      const { headers, dataRows } = await this.parseExcelFile(fileBuffer, domain);

      // Map headers to canonical fields
      const mappingResult = this.mapHeadersToCanonicalFields(headers, domain);

      // Transform data
      const transformedRecords = this.transformDataToCanonical(dataRows, mappingResult.mappings, domain);

      // Validate data
      const validationResults = this.validateTransformedData(transformedRecords, domain);

      // Prepare records for database insertion
      const recordsToInsert = validationResults
        .filter(result => result.isValid)
        .map(result => ({
          projectId,
          panelId: this.extractPanelId(result.record, domain), // This will need to be implemented
          domain,
          rawData: result.record.rawData,
          mappedData: result.record.mappedData,
          aiConfidence: mappingResult.overallConfidence,
          requiresReview: mappingResult.requiresReview || result.errors.length > 0,
          createdBy: userId
        }));

      console.log(`📊 Import summary: ${recordsToInsert.length} valid records ready for insertion`);
      console.log(`📊 Confidence: ${(mappingResult.overallConfidence * 100).toFixed(1)}%`);
      console.log(`📊 Review required: ${mappingResult.requiresReview ? 'Yes' : 'No'}`);

      return {
        importedRows: recordsToInsert.length,
        unmappedHeaders: mappingResult.unmappedHeaders,
        confidenceScore: mappingResult.overallConfidence,
        requiresReview: mappingResult.requiresReview,
        pendingRows: validationResults.filter(r => !r.isValid).length,
        records: recordsToInsert,
        validationResults
      };

    } catch (error) {
      console.error('Import failed:', error);
      throw new Error(`Excel import failed: ${error.message}`);
    }
  }

  /**
   * Extract panel ID from record data
   * This is a placeholder - will need integration with panel layout system
   */
  extractPanelId(record, domain) {
    // For now, return a placeholder
    // In production, this would need to:
    // 1. Extract panel number from the data
    // 2. Look up the actual panel ID from the panel layout system
    // 3. Handle multiple panels if specified
    return 'placeholder-panel-id';
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = AsbuiltImportAI;
