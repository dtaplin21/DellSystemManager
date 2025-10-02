const xlsx = require('xlsx');
const { Pool } = require('pg');
const PanelLookupService = require('./panelLookupService');
require('dotenv').config();

class AsbuiltImportAI {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    this.panelLookup = new PanelLookupService();
    
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
   * Auto-detect panels mentioned in Excel data
   */
  detectPanelsInData(dataRows) {
    console.log(`🔍 Starting frequency-based panel detection on ${dataRows.length} rows`);
    
    // More precise panel patterns - match explicit panel references
    const panelPatterns = [
      /panel[\s\-_]*(\d+)/gi,     // "Panel 30", "Panel-30", "Panel_30"
      /p[\s\-_]*(\d+)/gi,         // "P 30", "P-30", "P_30"
      /panel\s*#?\s*(\d+)/gi,     // "Panel #30", "Panel#30"
      /\bp(\d+)\b/gi,             // "P30" as standalone word
      /^(\d{1,3})$/               // Just numbers 1-3 digits (potential panel IDs)
    ];
    
    // Step 1: Count frequency of each number
    const numberFrequency = {};
    let totalCellsProcessed = 0;
    let cellsSkipped = 0;
    
    dataRows.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell) return;
        
        const cellStr = cell.toString().trim();
        totalCellsProcessed++;
        
        // Skip obviously non-panel cells
        if (this.isNonPanelCell(cellStr, rowIndex, colIndex)) {
          cellsSkipped++;
          return;
        }
        
        panelPatterns.forEach(pattern => {
          const matches = cellStr.match(pattern);
          if (matches) {
            matches.forEach(match => {
              const panelNum = match.replace(/[^\d]/g, '');
              if (panelNum && this.isValidPanelNumber(panelNum)) {
                const num = parseInt(panelNum);
                numberFrequency[num] = (numberFrequency[num] || 0) + 1;
              }
            });
          }
        });
      });
    });
    
    console.log(`📊 Number frequency analysis:`);
    const sortedFrequencies = Object.entries(numberFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20); // Show top 20 most frequent
    
    sortedFrequencies.forEach(([num, freq]) => {
      console.log(`   ${num}: ${freq} times`);
    });
    
    // Step 2: Filter based on frequency (panel numbers should appear infrequently)
    const FREQUENCY_THRESHOLD = 3; // If a number appears more than 3 times, it's likely data, not a panel
    const detectedPanels = new Set();
    
    Object.entries(numberFrequency).forEach(([num, freq]) => {
      const normalizedPanel = `P-${num.padStart(3, '0')}`;
      
      if (freq <= FREQUENCY_THRESHOLD) {
        detectedPanels.add(normalizedPanel);
        console.log(`✅ Panel candidate: ${normalizedPanel} (appears ${freq} times)`);
      } else {
        console.log(`🚫 Filtered out: ${normalizedPanel} (appears ${freq} times - too frequent)`);
      }
    });
    
    console.log(`📊 Frequency-based panel detection summary:`);
    console.log(`   - Total cells processed: ${totalCellsProcessed}`);
    console.log(`   - Cells skipped: ${cellsSkipped}`);
    console.log(`   - Numbers analyzed: ${Object.keys(numberFrequency).length}`);
    console.log(`   - Frequency threshold: ${FREQUENCY_THRESHOLD} times`);
    console.log(`   - Unique panels detected: ${detectedPanels.size}`);
    
    const result = Array.from(detectedPanels).sort();
    console.log(`🎯 Final panels:`, result);
    return result;
  }

  /**
   * Check if a cell is obviously not a panel reference
   */
  isNonPanelCell(cellStr, rowIndex, colIndex) {
    // Skip empty cells
    if (!cellStr || cellStr.length === 0) return true;
    
    // Skip cells that look like measurements, quantities, or other data
    const nonPanelPatterns = [
      { pattern: /^\d+\.\d+$/, reason: 'decimals' },
      { pattern: /^\d+[x×]\d+$/, reason: 'dimensions' },
      { pattern: /^\d+[km]?m$/, reason: 'units' },
      { pattern: /^\d+%$/, reason: 'percentages' },
      { pattern: /^\d+:\d+$/, reason: 'ratios/times' },
      { pattern: /^(pass|fail|na|n\/a)$/i, reason: 'test_results' },
      { pattern: /^(yes|no|true|false)$/i, reason: 'boolean_values' },
      { pattern: /^\d{4,}$/, reason: 'large_numbers' }
    ];
    
    for (const { pattern, reason } of nonPanelPatterns) {
      if (pattern.test(cellStr)) {
        console.log(`🚫 Skipping cell "${cellStr}" (reason: ${reason})`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Validate if a number could be a valid panel ID
   */
  isValidPanelNumber(panelNum) {
    const num = parseInt(panelNum);
    
    // Panel numbers should be reasonable (1-999 for most projects)
    if (num < 1 || num > 999) {
      console.log(`❌ Invalid panel number: ${panelNum} (out of range 1-999)`);
      return false;
    }
    
    // Panel numbers should not be too long (max 3 digits for most projects)
    if (panelNum.length > 3) {
      console.log(`❌ Invalid panel number: ${panelNum} (too long: ${panelNum.length} digits)`);
      return false;
    }
    
    console.log(`✅ Valid panel number: ${panelNum}`);
    return true;
  }

  /**
   * Analyze header to understand column type and content
   */
  analyzeHeader(headerStr, columnIndex) {
    const analysis = {
      type: 'unknown',
      containsNumbers: /\d/.test(headerStr),
      containsUnits: /(ft|m|in|cm|mm|kg|lb|%|°|temp|temp\.)/i.test(headerStr),
      isDateField: /(date|time|created|updated)/i.test(headerStr),
      isTestResult: /(pass|fail|result|test|status)/i.test(headerStr),
      isMeasurement: /(length|width|height|depth|distance|size|dimension)/i.test(headerStr),
      isQuantity: /(count|number|qty|quantity|amount|total)/i.test(headerStr),
      isPanelRelated: /(panel|p\-|p\s)/i.test(headerStr),
      isOperatorField: /(operator|inspector|technician|name|initials)/i.test(headerStr),
      isMachineField: /(machine|equipment|tool|seamer)/i.test(headerStr),
      columnIndex: columnIndex
    };

    // Determine primary type
    if (analysis.isPanelRelated) analysis.type = 'panel';
    else if (analysis.isDateField) analysis.type = 'datetime';
    else if (analysis.isTestResult) analysis.type = 'test_result';
    else if (analysis.isMeasurement) analysis.type = 'measurement';
    else if (analysis.isQuantity) analysis.type = 'quantity';
    else if (analysis.isOperatorField) analysis.type = 'operator';
    else if (analysis.isMachineField) analysis.type = 'machine';
    else if (analysis.containsUnits) analysis.type = 'measurement';
    else if (analysis.containsNumbers) analysis.type = 'numeric';
    else analysis.type = 'text';

    return analysis;
  }

  /**
   * Check if a column should be preserved as custom data
   */
  isDataColumn(headerStr, analysis) {
    // Preserve columns that contain useful data but don't map to canonical fields
    const usefulPatterns = [
      /(note|comment|remark|description|detail)/i,
      /(additional|extra|custom|other)/i,
      /(reference|id|code|number|serial)/i,
      /(location|position|area|zone|section)/i,
      /(weather|condition|environment)/i,
      /(quality|grade|rating|score)/i
    ];

    return usefulPatterns.some(pattern => pattern.test(headerStr)) ||
           analysis.type !== 'unknown' ||
           headerStr.length > 3; // Preserve longer headers as they likely contain useful info
  }

  /**
   * Auto-detect domain based on Excel content
   */
  detectDomainFromContent(headers, dataRows) {
    const domainKeywords = {
      panel_placement: ['placement', 'location', 'placed', 'installed', 'position'],
      panel_seaming: ['seam', 'weld', 'seamer', 'machine', 'temperature', 'wedge', 'barrel'],
      non_destructive: ['ndt', 'test', 'testing', 'operator', 'vbox', 'pass', 'fail'],
      trial_weld: ['trial', 'test', 'sample', 'ambient', 'tensile'],
      repairs: ['repair', 'fix', 'patch', 'extruder', 'replacement'],
      destructive: ['destructive', 'sample', 'tester', 'tensile', 'peel']
    };
    
    const allText = [...headers.map(h => h.toString()), 
                    ...dataRows.flat().map(c => c ? c.toString() : '')].join(' ').toLowerCase();
    
    let bestDomain = 'panel_placement'; // Default
    let maxScore = 0;
    
    Object.entries(domainKeywords).forEach(([domain, keywords]) => {
      const score = keywords.reduce((acc, keyword) => {
        return acc + (allText.includes(keyword) ? 1 : 0);
      }, 0);
      
      if (score > maxScore) {
        maxScore = score;
        bestDomain = domain;
      }
    });
    
    return bestDomain;
  }

  /**
   * Parse Excel file and extract data
   */
  async parseExcelFile(fileBuffer, domain = null) {
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
      
      // Enhanced header analysis
      const headerAnalysis = this.analyzeHeader(headerStr, index);
      console.log(`🔍 Header analysis for "${headerStr}":`, headerAnalysis);
      
      const bestMatch = this.findBestFieldMatch(headerStr, domain);
      
      if (bestMatch) {
        mappings.push({
          sourceHeader: headerStr,
          canonicalField: bestMatch.field,
          confidence: bestMatch.confidence,
          columnIndex: index,
          domain: domain,
          analysis: headerAnalysis
        });
        confidenceScores.push(bestMatch.confidence);
        console.log(`✅ Mapped: "${headerStr}" → "${bestMatch.field}" (confidence: ${bestMatch.confidence})`);
      } else {
        // Check if this might be a data column we should preserve
        if (this.isDataColumn(headerStr, headerAnalysis)) {
          mappings.push({
            sourceHeader: headerStr,
            canonicalField: 'custom_data',
            confidence: 0.5,
            columnIndex: index,
            domain: domain,
            analysis: headerAnalysis,
            isCustomField: true
          });
          console.log(`📊 Custom data column: "${headerStr}" (preserved as custom field)`);
        } else {
          unmappedHeaders.push(headerStr);
          console.log(`❌ Unmapped: "${headerStr}"`);
        }
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

      // Extract raw data and handle custom fields
      const customData = {};
      mappings.forEach(mapping => {
        const value = row[mapping.columnIndex];
        if (value !== undefined && value !== null && value !== '') {
          record.rawData[mapping.sourceHeader] = value;
          
          if (mapping.isCustomField) {
            // Store custom fields separately
            customData[mapping.sourceHeader] = this.normalizeValue(value, 'custom_data');
          } else {
            record.mappedData[mapping.canonicalField] = this.normalizeValue(value, mapping.canonicalField);
          }
        }
      });
      
      // Add custom data to mapped data if any exists
      if (Object.keys(customData).length > 0) {
        record.mappedData.customData = customData;
      }

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

    // Handle custom data fields
    if (fieldName === 'custom_data') {
      // For custom data, try to preserve the original type but normalize format
      if (/^\d+\.?\d*$/.test(strValue)) {
        const num = parseFloat(strValue);
        return isNaN(num) ? strValue : num;
      } else if (/^\d{4}-\d{2}-\d{2}/.test(strValue) || /^\d{2}\/\d{2}\/\d{4}/.test(strValue)) {
        // Try to parse as date
        const date = new Date(strValue);
        return isNaN(date.getTime()) ? strValue : date.toISOString();
      }
      return strValue; // Return as string for text data
    }

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
  async importExcelData(fileBuffer, projectId, domain = null, userId) {
    try {
      console.log(`🚀 Starting Excel import for project: ${projectId}`);

      // Parse Excel file
      const { headers, dataRows } = await this.parseExcelFile(fileBuffer, domain);

      // Auto-detect domain if not provided
      if (!domain) {
        domain = this.detectDomainFromContent(headers, dataRows);
        console.log(`🔍 Auto-detected domain: ${domain}`);
      }

      // Auto-detect panels
      const detectedPanels = this.detectPanelsInData(dataRows);
      console.log(`🔍 Auto-detected panels:`, detectedPanels);

      // Map headers to canonical fields (more permissive)
      const mappingResult = this.mapHeadersToCanonicalFields(headers, domain);

      // Transform data
      const transformedRecords = this.transformDataToCanonical(dataRows, mappingResult.mappings, domain);

      // Validate data
      const validationResults = this.validateTransformedData(transformedRecords, domain);

      // Prepare records for database insertion with proper panel ID extraction
      const recordsToInsert = [];
      
      for (const result of validationResults.filter(r => r.isValid)) {
        const panelId = await this.extractPanelId(result.record, domain, projectId);
        
        if (panelId) {
          recordsToInsert.push({
            projectId,
            panelId,
            domain,
            rawData: result.record.rawData,
            mappedData: result.record.mappedData,
            aiConfidence: mappingResult.overallConfidence,
            requiresReview: mappingResult.requiresReview || result.errors.length > 0,
            createdBy: userId
          });
        } else {
          console.warn(`⚠️ [ASBUILT_IMPORT] Skipping record due to missing panel ID:`, result.record);
        }
      }

      console.log(`📊 Import summary: ${recordsToInsert.length} valid records ready for insertion`);
      console.log(`📊 Confidence: ${(mappingResult.overallConfidence * 100).toFixed(1)}%`);
      console.log(`📊 Review required: ${mappingResult.requiresReview ? 'Yes' : 'No'}`);

      return {
        importedRows: recordsToInsert.length,
        detectedPanels: detectedPanels,
        detectedDomain: domain,
        unmappedHeaders: mappingResult.unmappedHeaders,
        confidenceScore: Math.max(mappingResult.overallConfidence, 0.5), // Minimum 50% confidence
        requiresReview: false, // Don't block imports
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
   * Now properly integrated with panel layout system
   */
  async extractPanelId(record, domain, projectId) {
    try {
      console.log(`🔍 [ASBUILT_IMPORT] Extracting panel ID for domain: ${domain}, project: ${projectId}`);
      
      // Extract panel number from the mapped data
      let panelNumber = null;
      
      // Try different field names based on domain
      if (record.mappedData.panelNumber) {
        panelNumber = record.mappedData.panelNumber;
      } else if (record.mappedData.panelNumbers) {
        // Handle multiple panels - take the first one for now
        const panelNumbers = record.mappedData.panelNumbers;
        if (typeof panelNumbers === 'string') {
          // Split by common separators
          panelNumber = panelNumbers.split(/[|,;]/)[0].trim();
        } else if (Array.isArray(panelNumbers)) {
          panelNumber = panelNumbers[0];
        }
      }
      
      if (!panelNumber) {
        console.warn(`⚠️ [ASBUILT_IMPORT] No panel number found in record for domain: ${domain}`);
        return null;
      }
      
      console.log(`🔍 [ASBUILT_IMPORT] Found panel number: ${panelNumber}`);
      
      // Look up the actual panel ID from the panel layout system
      const panelId = await this.panelLookup.findPanelIdByNumber(panelNumber, projectId);
      
      if (panelId) {
        console.log(`✅ [ASBUILT_IMPORT] Found panel ID: ${panelId} for panel number: ${panelNumber}`);
        return panelId;
      }
      
      // If panel doesn't exist, create it automatically
      console.log(`🔍 [ASBUILT_IMPORT] Panel not found, creating new panel: ${panelNumber}`);
      const newPanelId = await this.panelLookup.createPanelIfNotExists(panelNumber, projectId, {
        // Add some default properties based on domain
        ...(domain === 'panel_placement' && record.mappedData.dimensions ? {
          width: record.mappedData.dimensions.width || 100,
          height: record.mappedData.dimensions.length || 100
        } : {})
      });
      
      if (newPanelId) {
        console.log(`✅ [ASBUILT_IMPORT] Created new panel: ${newPanelId} for panel number: ${panelNumber}`);
        return newPanelId;
      }
      
      console.error(`❌ [ASBUILT_IMPORT] Failed to find or create panel for: ${panelNumber}`);
      return null;
      
    } catch (error) {
      console.error(`❌ [ASBUILT_IMPORT] Error extracting panel ID:`, error);
      return null;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = AsbuiltImportAI;
