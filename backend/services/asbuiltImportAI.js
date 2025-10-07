const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');

class AsbuiltImportAI {
  constructor() {
    this.domains = [
      'panel_placement',
      'panel_seaming', 
      'non_destructive',
      'trial_weld',
      'repairs',
      'destructive',
      'panel_specs',  // Add missing domains
      'seaming',
      'testing'
    ];
  }

  /**
   * Import Excel data and return structured records
   */
  async importExcelData(fileBuffer, projectId, domain, userId) {
    try {
      console.log(`🤖 [ASBUILT_AI] Processing Excel file for domain: ${domain}`);
      
      // Parse Excel file
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error('Excel file must have at least a header row and one data row');
      }

      const headers = jsonData[0];
      const dataRows = jsonData.slice(1);

      console.log(`📊 [ASBUILT_AI] Found ${dataRows.length} data rows`);
      console.log(`📋 [ASBUILT_AI] Headers:`, headers);
      console.log(`📋 [ASBUILT_AI] First 3 data rows:`, jsonData.slice(1, 4));
      console.log(`📋 [ASBUILT_AI] All headers (raw):`, headers.map((h, i) => `[${i}] "${h}"`));

      // Process each row
      const records = [];
      const detectedPanels = new Set();

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.every(cell => !cell)) continue; // Skip empty rows

        try {
          const processedRecord = await this.processRow(row, headers, domain, projectId, userId);
          if (processedRecord) {
            records.push(processedRecord);
            if (processedRecord.mappedData.panelNumber) {
              detectedPanels.add(processedRecord.mappedData.panelNumber);
            }
          }
        } catch (rowError) {
          console.warn(`⚠️ [ASBUILT_AI] Error processing row ${i + 1}:`, rowError.message);
        }
      }

      console.log(`✅ [ASBUILT_AI] Successfully processed ${records.length} records`);
      console.log(`🎯 [ASBUILT_AI] Detected panels:`, Array.from(detectedPanels));

      return {
        success: true,
        records,
        importedRows: records.length,
        detectedPanels: Array.from(detectedPanels),
        detectedDomains: [domain],
        confidence: this.calculateOverallConfidence(records)
      };

    } catch (error) {
      console.error(`❌ [ASBUILT_AI] Error importing Excel data:`, error);
      throw error;
    }
  }

  /**
   * Process a single row of data
   */
  async processRow(row, headers, domain, projectId, userId) {
    console.log(`🔍 [ASBUILT_AI] Processing row for domain ${domain}:`, row);
    
    const rawData = {};
    const mappedData = {};

    // Map raw data
    headers.forEach((header, index) => {
      if (header && row[index] !== undefined) {
        rawData[header] = row[index];
      }
    });
    
    console.log(`📝 [ASBUILT_AI] Raw data mapped:`, rawData);

    // AI-powered field mapping based on domain
    const fieldMapping = this.getFieldMapping(domain);
    const confidence = this.mapFields(rawData, mappedData, fieldMapping);

    // Generate panel ID - always use UUID for database compatibility
    let panelId = null;
    let panelIdentifier = null;
    
    if (mappedData.panelNumber) {
      panelIdentifier = mappedData.panelNumber;
      // Generate UUID for database, but keep human-readable identifier in mapped data
      panelId = require('uuid').v4();
      console.log(`🎯 [ASBUILT_AI] Generated panelId: ${panelId} from panelNumber: ${panelIdentifier}`);
    } else {
      console.log(`⚠️ [ASBUILT_AI] No panelNumber found in mappedData:`, mappedData);
      console.log(`🔍 [ASBUILT_AI] Available headers:`, Object.keys(rawData));
      
      // Fallback: try to extract panel identifier from any column that might contain panel info
      for (const [key, value] of Object.entries(rawData)) {
        if (value && typeof value === 'string' && (
          key.toLowerCase().includes('panel') || 
          key.toLowerCase().includes('id') ||
          /^p\d+$/i.test(value) || // Pattern like P1, P2, etc.
          /^\d+$/.test(value) // Just numbers
        )) {
          console.log(`🔄 [ASBUILT_AI] Fallback: Using ${key} = ${value} as panel identifier`);
          panelIdentifier = value;
          panelId = require('uuid').v4();
          mappedData.panelNumber = value;
          break;
        }
      }
      
      // If still no panel identifier found, generate a default one
      if (!panelId) {
        panelId = require('uuid').v4();
        panelIdentifier = `Unknown-${panelId.slice(0, 8)}`;
        mappedData.panelNumber = panelIdentifier;
        console.log(`🔧 [ASBUILT_AI] Generated fallback panelId: ${panelId} with identifier: ${panelIdentifier}`);
      }
    }

    return {
      projectId,
      panelId,
      domain,
      sourceDocId: null, // Will be set by the calling service
      rawData,
      mappedData,
      aiConfidence: confidence,
      requiresReview: confidence < 0.7,
      createdBy: userId
    };
  }

  /**
   * Get field mapping configuration for a domain
   */
  getFieldMapping(domain) {
    const mappings = {
      panel_placement: {
        'panel number': 'panelNumber',
        'panel id': 'panelNumber',
        'panel_id': 'panelNumber',
        'panel': 'panelNumber',
        'date': 'date',
        'time': 'time',
        'datetime': 'dateTime',
        'location': 'location',
        'coordinates': 'coordinates',
        'x': 'xCoordinate',
        'y': 'yCoordinate',
        'length': 'length',
        'width': 'width',
        'area': 'area',
        'notes': 'notes'
      },
      panel_seaming: {
        'panel number': 'panelNumber',
        'panel id': 'panelNumber',
        'seam id': 'seamId',
        'seam_id': 'seamId',
        'seam type': 'seamType',
        'seam_type': 'seamType',
        'length': 'length',
        'width': 'width',
        'temperature': 'temperature',
        'speed': 'speed',
        'pressure': 'pressure',
        'date': 'date',
        'time': 'time',
        'operator': 'operator',
        'notes': 'notes'
      },
      non_destructive: {
        'panel number': 'panelNumber',
        'panel id': 'panelNumber',
        'test id': 'testId',
        'test_id': 'testId',
        'test type': 'testType',
        'test_type': 'testType',
        'result': 'result',
        'value': 'value',
        'unit': 'unit',
        'date': 'date',
        'time': 'time',
        'inspector': 'inspector',
        'notes': 'notes'
      },
      trial_weld: {
        'panel number': 'panelNumber',
        'panel id': 'panelNumber',
        'weld id': 'weldId',
        'weld_id': 'weldId',
        'material': 'material',
        'thickness': 'thickness',
        'temperature': 'temperature',
        'pressure': 'pressure',
        'speed': 'speed',
        'result': 'result',
        'date': 'date',
        'time': 'time',
        'operator': 'operator',
        'notes': 'notes'
      },
      repairs: {
        'panel number': 'panelNumber',
        'panel id': 'panelNumber',
        'repair id': 'repairId',
        'repair_id': 'repairId',
        'issue type': 'issueType',
        'issue_type': 'issueType',
        'description': 'description',
        'location': 'location',
        'method': 'method',
        'material': 'material',
        'date': 'date',
        'time': 'time',
        'technician': 'technician',
        'status': 'status',
        'notes': 'notes'
      },
      destructive: {
        'panel number': 'panelNumber',
        'panel id': 'panelNumber',
        'sample id': 'sampleId',
        'sample_id': 'sampleId',
        'test type': 'testType',
        'test_type': 'testType',
        'result': 'result',
        'value': 'value',
        'unit': 'unit',
        'standard': 'standard',
        'date': 'date',
        'time': 'time',
        'lab': 'lab',
        'technician': 'technician',
        'notes': 'notes'
      },
      panel_specs: {
        'panel number': 'panelNumber',
        'panel id': 'panelNumber',
        'panel_id': 'panelNumber',
        'panel': 'panelNumber',
        'specification': 'specification',
        'spec': 'specification',
        'material': 'material',
        'thickness': 'thickness',
        'width': 'width',
        'length': 'length',
        'area': 'area',
        'weight': 'weight',
        'date': 'date',
        'time': 'time',
        'notes': 'notes'
      },
      seaming: {
        'panel number': 'panelNumber',
        'panel id': 'panelNumber',
        'panel_id': 'panelNumber',
        'seam id': 'seamId',
        'seam_id': 'seamId',
        'seam type': 'seamType',
        'seam_type': 'seamType',
        'length': 'length',
        'width': 'width',
        'temperature': 'temperature',
        'speed': 'speed',
        'pressure': 'pressure',
        'date': 'date',
        'time': 'time',
        'operator': 'operator',
        'notes': 'notes'
      },
      testing: {
        'panel number': 'panelNumber',
        'panel id': 'panelNumber',
        'panel_id': 'panelNumber',
        'test id': 'testId',
        'test_id': 'testId',
        'test type': 'testType',
        'test_type': 'testType',
        'result': 'result',
        'value': 'value',
        'unit': 'unit',
        'method': 'method',
        'date': 'date',
        'time': 'time',
        'inspector': 'inspector',
        'notes': 'notes'
      }
    };

    return mappings[domain] || {};
  }

  /**
   * Map fields using AI-like logic
   */
  mapFields(rawData, mappedData, fieldMapping) {
    let totalConfidence = 0;
    let mappedFields = 0;

    console.log(`🔍 [ASBUILT_AI] Mapping fields for domain with ${Object.keys(fieldMapping).length} mappings`);
    console.log(`🔍 [ASBUILT_AI] Available raw data keys:`, Object.keys(rawData));

    for (const [rawKey, mappedKey] of Object.entries(fieldMapping)) {
      const confidence = this.findBestMatch(rawKey, Object.keys(rawData));
      console.log(`🔍 [ASBUILT_AI] Looking for '${rawKey}' -> '${mappedKey}', confidence: ${confidence.toFixed(2)}`);
      
      if (confidence > 0.5) {
        const bestMatch = this.findBestMatchKey(rawKey, Object.keys(rawData));
        if (bestMatch && rawData[bestMatch] !== undefined && rawData[bestMatch] !== null && rawData[bestMatch] !== '') {
          mappedData[mappedKey] = rawData[bestMatch];
          totalConfidence += confidence;
          mappedFields++;
          console.log(`✅ [ASBUILT_AI] Mapped '${bestMatch}' -> '${mappedKey}' = '${rawData[bestMatch]}'`);
        }
      }
    }

    console.log(`📊 [ASBUILT_AI] Final mapped data:`, mappedData);
    return mappedFields > 0 ? totalConfidence / mappedFields : 0;
  }

  /**
   * Find best match for a field name
   */
  findBestMatch(target, candidates) {
    if (!candidates || candidates.length === 0) return 0;

    const targetLower = target.toLowerCase();
    let bestScore = 0;

    for (const candidate of candidates) {
      const candidateLower = candidate.toLowerCase();
      
      // Exact match
      if (candidateLower === targetLower) return 1.0;
      
      // Contains match
      if (candidateLower.includes(targetLower) || targetLower.includes(candidateLower)) {
        bestScore = Math.max(bestScore, 0.8);
      }
      
      // Word boundary match
      const targetWords = targetLower.split(/[\s_-]+/);
      const candidateWords = candidateLower.split(/[\s_-]+/);
      
      let wordMatches = 0;
      for (const targetWord of targetWords) {
        for (const candidateWord of candidateWords) {
          if (candidateWord.includes(targetWord) || targetWord.includes(candidateWord)) {
            wordMatches++;
            break;
          }
        }
      }
      
      if (wordMatches > 0) {
        const wordScore = wordMatches / Math.max(targetWords.length, candidateWords.length);
        bestScore = Math.max(bestScore, wordScore * 0.7);
      }
    }

    return bestScore;
  }

  /**
   * Find the best matching key
   */
  findBestMatchKey(target, candidates) {
    if (!candidates || candidates.length === 0) return null;

    let bestKey = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = this.findBestMatch(target, [candidate]);
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidate;
      }
    }

    return bestScore > 0.5 ? bestKey : null;
  }

  /**
   * Calculate overall confidence for all records
   */
  calculateOverallConfidence(records) {
    if (records.length === 0) return 0;
    
    const totalConfidence = records.reduce((sum, record) => sum + (record.aiConfidence || 0), 0);
    return totalConfidence / records.length;
  }
}

module.exports = AsbuiltImportAI;
