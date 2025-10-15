const xlsx = require('xlsx');
const { Pool } = require('pg');
const OpenAI = require('openai');
const DuplicateDetectionService = require('./duplicateDetectionService');
const ImportAnalysisService = require('./importAnalysisService');
require('dotenv').config({ path: '../.env' });

class AsbuiltImportAI {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Initialize Claude Haiku (fast & cheap)
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }) : null;

    // Initialize new services
    this.duplicateDetectionService = new DuplicateDetectionService();
    this.importAnalysisService = new ImportAnalysisService();

    // Canonical field definitions per domain
    this.canonicalFields = {
      panel_placement: ['panelNumber', 'dateTime', 'location', 'coordinates', 'notes', 'weatherComments', 'length', 'width'],
      panel_seaming: ['panelNumber', 'seamId', 'dateTime', 'seamType', 'temperature', 'operator', 'seamerInitials', 'machineNumber', 'wedgeTemp', 'vboxPassFail'],
      non_destructive: ['panelNumber', 'testId', 'testType', 'result', 'dateTime', 'inspector', 'operatorInitials', 'vboxPassFail'],
      trial_weld: ['panelNumber', 'weldId', 'material', 'temperature', 'result', 'dateTime', 'passFail'],
      repairs: ['panelNumber', 'repairId', 'issueType', 'description', 'dateTime', 'technician', 'repairId'],
      destructive: ['panelNumber', 'sampleId', 'testType', 'result', 'dateTime', 'lab', 'testerInitials', 'passFail']
    };

    // Explicit mapping rules (fast path - no AI needed)
    this.explicitMappings = {
      panel_placement: {
        'panel #': 'panelNumber',
        'panel number': 'panelNumber',
        'panel id': 'panelNumber',
        'panel': 'panelNumber',
        'date': 'dateTime',
        'datetime': 'dateTime',
        'date/time': 'dateTime',
        'location': 'location',
        'notes': 'notes',
        'comments': 'notes',
        'panel location / comment': 'location',
        'panel location': 'location',
        'comment': 'notes',
        'weather': 'weatherComments',
        'weather comments': 'weatherComments',
        'length': 'length',
        'width': 'width'
      },
      panel_seaming: {
        'panel #': 'panelNumber',
        'panel number': 'panelNumber',
        'panels': 'panelNumber',
        'seam id': 'seamId',
        'date': 'dateTime',
        'datetime': 'dateTime',
        'seam type': 'seamType',
        'temperature': 'temperature',
        'temp': 'temperature',
        'operator': 'operator',
        'seamer': 'operator',
        'seamer initials': 'seamerInitials',
        'machine number': 'machineNumber',
        'machine #': 'machineNumber',
        'wedge temp': 'wedgeTemp',
        'vbox': 'vboxPassFail',
        'pass/fail': 'vboxPassFail'
      },
      non_destructive: {
        'panel #': 'panelNumber',
        'panel number': 'panelNumber',
        'test id': 'testId',
        'test type': 'testType',
        'result': 'result',
        'date': 'dateTime',
        'inspector': 'inspector',
        'operator': 'inspector',
        'operator initials': 'operatorInitials',
        'vbox': 'vboxPassFail'
      },
      trial_weld: {
        'panel #': 'panelNumber',
        'weld id': 'weldId',
        'material': 'material',
        'temperature': 'temperature',
        'result': 'result',
        'pass/fail': 'passFail',
        'date': 'dateTime'
      },
      repairs: {
        'panel #': 'panelNumber',
        'panel number': 'panelNumber',
        'repair id': 'repairId',
        'issue type': 'issueType',
        'type': 'issueType',
        'description': 'description',
        'desc': 'description',
        'date': 'dateTime',
        'technician': 'technician',
        'tech': 'technician'
      },
      destructive: {
        'panel #': 'panelNumber',
        'panel number': 'panelNumber',
        'sample id': 'sampleId',
        'test type': 'testType',
        'result': 'result',
        'date': 'dateTime',
        'lab': 'lab',
        'technician': 'testerInitials',
        'pass/fail': 'passFail'
      }
    };
  }

  /**
   * Main import function - Production ready
   */
  async importExcelData(fileBuffer, projectId, domain, userId, options = {}) {
    const startTime = Date.now();
    try {
      console.log(`🤖 [AI] ===== STARTING ENHANCED IMPORT =====`);
      console.log(`🤖 [AI] Starting import for project ${projectId}, domain: ${domain}`);
      console.log(`🤖 [AI] Domain type: ${typeof domain}, value: ${JSON.stringify(domain)}`);
      console.log(`🤖 [AI] File buffer size: ${fileBuffer.length} bytes`);

      // Step 1: Parse Excel file
      const { headers, dataRows } = this.parseExcelFile(fileBuffer);
      console.log(`📊 [AI] Parsed ${dataRows.length} rows with ${headers.length} columns`);

      // Step 2: Detect domain if not provided
      const detectedDomain = domain || await this.detectDomain(headers, dataRows);
      console.log(`🎯 [AI] Using domain: ${detectedDomain}`);

      // Step 3: Map headers to canonical fields
      const { mappings, confidence, usedAI } = await this.mapHeaders(headers, detectedDomain, dataRows);
      console.log(`📋 [AI] Mapped ${mappings.length} fields (confidence: ${(confidence * 100).toFixed(1)}%, AI: ${usedAI})`);

      // Step 4: Validate mappings
      if (!this.hasRequiredFields(mappings, detectedDomain)) {
        throw new Error(`Missing required fields for domain ${detectedDomain}. Required: panelNumber`);
      }

      // Step 5: Process rows with validation
      const records = [];
      const errors = [];
      const seenPanelKeys = new Set();

      for (let i = 0; i < dataRows.length; i++) {
        try {
          const record = await this.processRow(
            dataRows[i], 
            headers, 
            mappings, 
            detectedDomain, 
            projectId, 
            userId
          );

          if (record) {
            const dedupeKey = record.panelId
              ? `${record.domain}:${record.panelId}`
              : `${record.domain}:${this.normalizePanelNumber(record?.mappedData?.panelNumber)}`;

            if (dedupeKey && seenPanelKeys.has(dedupeKey)) {
              console.log(`🚫 [AI] Skipping duplicate record for panel key ${dedupeKey}`);
              continue;
            }

            if (dedupeKey) {
              seenPanelKeys.add(dedupeKey);
            }

            records.push(record);
          }
        } catch (error) {
          errors.push({ row: i + 2, error: error.message });
          console.warn(`⚠️ [AI] Row ${i + 2} error: ${error.message}`);
        }
      }

      console.log(`✅ [AI] Processed ${records.length} valid records, ${errors.length} errors`);

      // Step 6: Enhanced duplicate detection
      const panelNumbers = records.map(r => r.mappedData?.panelNumber).filter(Boolean);
      const duplicateCheck = await this.duplicateDetectionService.checkForDuplicates(
        projectId, 
        panelNumbers, 
        detectedDomain
      );

      console.log(`🔍 [AI] Duplicate check completed:`, {
        duplicates: duplicateCheck.duplicates.length,
        conflicts: duplicateCheck.conflicts.length
      });

      // Step 7: AI-powered similarity detection
      const similarityCheck = await this.duplicateDetectionService.detectSimilarRecords(
        projectId,
        records,
        detectedDomain
      );

      console.log(`🤖 [AI] Similarity check completed:`, {
        similarRecords: similarityCheck.similarRecords.length,
        confidence: similarityCheck.confidence
      });

      // Step 8: Filter out duplicates from records
      const cleanRecords = records.filter(record => {
        const panelNumber = record.mappedData?.panelNumber;
        return !duplicateCheck.duplicates.some(dup => dup.panelNumber === panelNumber);
      });

      console.log(`🧹 [AI] Filtered records: ${records.length} → ${cleanRecords.length} (removed ${records.length - cleanRecords.length} duplicates)`);

      // Step 9: Generate AI analysis
      const processingTime = Date.now() - startTime;
      const averageConfidence = records.length > 0 ? 
        records.reduce((sum, r) => sum + (r.ai_confidence || 0), 0) / records.length : 0;

      const importResult = {
        records: cleanRecords,
        duplicates: duplicateCheck.duplicates,
        conflicts: duplicateCheck.conflicts,
        processingTime,
        aiConfidence: averageConfidence,
        detectedDomain,
        confidence,
        usedAI
      };

      const fileMetadata = {
        fileName: options.fileName || 'Unknown',
        fileSize: fileBuffer.length,
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        processingTime,
        uploadedAt: new Date().toISOString()
      };

      // Step 10: Generate comprehensive AI analysis
      const aiAnalysis = await this.duplicateDetectionService.generateImportAnalysis(
        importResult,
        duplicateCheck.duplicates,
        duplicateCheck.conflicts,
        fileMetadata
      );

      console.log(`🤖 [AI] AI analysis completed:`, {
        summary: aiAnalysis.summary?.substring(0, 100) + '...',
        dataQuality: aiAnalysis.dataQuality?.score,
        recommendations: aiAnalysis.recommendations?.length
      });

      // Step 11: Create import session and summary
      const importSession = {
        id: `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        fileId: options.fileId || null,
        sessionId: `session_${Date.now()}`,
        totalRecords: records.length,
        duplicatesFound: duplicateCheck.duplicates.length,
        conflictsResolved: duplicateCheck.conflicts.length
      };

      const importSummary = await this.duplicateDetectionService.createImportSummary(
        projectId,
        importSession,
        aiAnalysis
      );

      console.log(`📝 [AI] Import summary created:`, {
        sessionId: importSession.id,
        breakdown: importSummary.breakdown
      });

      return {
        success: true,
        records: cleanRecords,
        duplicates: duplicateCheck.duplicates,
        conflicts: duplicateCheck.conflicts,
        summary: duplicateCheck.summary,
        
        // NEW: AI Analysis and Insights
        aiAnalysis: {
          summary: aiAnalysis.summary,
          dataQuality: aiAnalysis.dataQuality,
          duplicateDetails: aiAnalysis.duplicateAnalysis,
          panelCoverage: aiAnalysis.panelCoverage,
          recommendations: aiAnalysis.recommendations,
          insights: aiAnalysis.insights,
          processingTime: aiAnalysis.processingTime
        },
        
        // NEW: Detailed breakdown
        breakdown: {
          totalProcessed: records.length,
          successfullyImported: cleanRecords.length,
          duplicatesSkipped: duplicateCheck.duplicates.length,
          conflictsResolved: duplicateCheck.conflicts.length,
          panelsAffected: new Set(panelNumbers).size,
          filesProcessed: 1,
          aiConfidence: averageConfidence
        },

        // Legacy fields for backward compatibility
        importedRows: cleanRecords.length,
        errors,
        detectedDomain,
        confidence,
        usedAI,
        isDuplicate: duplicateCheck.duplicates.length > 0
      };

    } catch (error) {
      console.error(`❌ [AI] Enhanced import failed:`, error);
      throw error;
    }
  }

  /**
   * Detect if Excel sheet has multiple data tables
   */
  detectMultipleTables(jsonData) {
    const headerRows = [];
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (this.looksLikeHeaderRow(row)) {
        headerRows.push(i);
      }
    }
    
    console.log(`📊 [AI] Found ${headerRows.length} header rows at positions:`, headerRows);
    
    // If multiple headers found, check if they're duplicates
    if (headerRows.length > 1) {
      const firstHeader = jsonData[headerRows[0]].map(h => h?.toString().toLowerCase().trim());
      const isDuplicateHeader = headerRows.every(idx => {
        const header = jsonData[idx].map(h => h?.toString().toLowerCase().trim());
        return JSON.stringify(header) === JSON.stringify(firstHeader);
      });
      
      if (isDuplicateHeader) {
        console.log(`⚠️ [AI] Multiple sections detected with identical headers`);
        return { multiTable: true, headerRows, isDuplicate: true };
      } else {
        console.log(`⚠️ [AI] Multiple different tables detected`);
        return { multiTable: true, headerRows, isDuplicate: false };
      }
    }
    
    return { multiTable: false, headerRows };
  }

  /**
   * Parse Excel file with multi-table detection
   */
  parseExcelFile(fileBuffer) {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });

    if (jsonData.length < 2) {
      throw new Error('Excel file must contain at least a header row and one data row');
    }

    console.log(`📊 [AI] Total rows in Excel: ${jsonData.length}`);

    // Detect multiple tables
    const tableDetection = this.detectMultipleTables(jsonData);
    
    if (tableDetection.multiTable && tableDetection.isDuplicate) {
      // Multiple sections with same headers - handle deduplication
      console.log(`📊 [AI] Multi-section file detected, processing with deduplication...`);
      return this.parseMultiSectionFile(jsonData, tableDetection.headerRows);
    } else {
      // Single table or multiple different tables - use first table only
      console.log(`📊 [AI] Single table file detected, processing normally...`);
      return this.parseSingleTableFile(jsonData);
    }
  }

  /**
   * Parse single-table Excel file (current behavior)
   */
  parseSingleTableFile(jsonData) {
    // Find the actual header row (might not be row 0)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(30, jsonData.length); i++) {
      const row = jsonData[i];
      const nonEmptyCells = row.filter(cell => cell && cell.toString().trim() !== '');
      
      if (nonEmptyCells.length >= 3 && this.looksLikeHeaderRow(row)) {
        headerRowIndex = i;
        console.log(`✅ [AI] Found header row at index ${i}`);
        break;
      }
    }

    const headers = jsonData[headerRowIndex];
    const dataRows = jsonData.slice(headerRowIndex + 1).filter(row => 
      row.some(cell => cell && cell.toString().trim() !== '')
    );

    console.log(`📋 [AI] Headers:`, headers);
    console.log(`📊 [AI] Data rows: ${dataRows.length}`);

    return { headers, dataRows };
  }

  /**
   * Rank potential panel number columns so we can prefer numeric identifiers over comment columns.
   */
  getPanelCandidateIndices(headers) {
    if (!headers || headers.length === 0) {
      return [];
    }

    const candidates = [];

    headers.forEach((header, index) => {
      if (!header) return;

      const normalized = header.toString().toLowerCase().trim();
      if (!normalized.includes('panel')) return;

      let score = 1; // base score when column references "panel"

      if (/panel\s*#/.test(normalized)) score += 4;
      if (normalized.includes('#')) score += 2;
      if (normalized.includes('number') || normalized.includes('no.')) score += 3;
      if (normalized.includes('id')) score += 2;
      if (normalized === 'panel') score += 2;

      if (normalized.includes('location') || normalized.includes('comment') || normalized.includes('notes')) {
        score -= 4;
      }

      if (score > 0) {
        candidates.push({ index, score });
      }
    });

    return candidates
      .sort((a, b) => b.score - a.score)
      .map(candidate => candidate.index);
  }

  /**
   * Helper to get the most likely panel number column
   */
  getPanelColumnIndex(headers) {
    const candidates = this.getPanelCandidateIndices(headers);
    return candidates.length ? candidates[0] : -1;
  }

  /**
   * Determine priority of a mapping based on source and metadata.
   */
  getMappingPriority(mapping) {
    if (!mapping) return -Infinity;
    if (mapping.method === 'explicit') return 3;
    if (mapping.method === 'ai') return 2;
    return mapping.confidence || 0;
  }

  /**
   * Decide if a new mapping should replace the existing one.
   */
  shouldReplaceMapping(existing, candidate) {
    const existingPriority = this.getMappingPriority(existing);
    const candidatePriority = this.getMappingPriority(candidate);

    if (candidatePriority > existingPriority) return true;
    if (candidatePriority < existingPriority) return false;

    const existingHasIndex = Number.isInteger(existing.sourceIndex);
    const candidateHasIndex = Number.isInteger(candidate.sourceIndex);

    if (!existingHasIndex && candidateHasIndex) return true;
    if (existingHasIndex && candidateHasIndex && candidate.sourceIndex < existing.sourceIndex) return true;
    
    return false;
  }

  /**
   * Add a mapping to the tracker, replacing lower priority mappings when needed.
   */
  addMapping(mappingTracker, mapping) {
    if (mapping.sourceIndex === undefined || mapping.sourceIndex === null) {
      console.log(`🚫 [AI] Skipping mapping for "${mapping.sourceHeader}" due to missing source index`);
      return false;
    }
    
    const key = mapping.canonicalField;
    const existing = mappingTracker.get(key);

    if (!existing) {
      mappingTracker.set(key, mapping);
        return true;
      }

    if (this.shouldReplaceMapping(existing, mapping)) {
      console.log(`🔁 [AI] Replacing mapping for "${key}" with column "${mapping.sourceHeader}"`);
      mappingTracker.set(key, mapping);
    return true;
    }
    
    console.log(`🚫 [AI] Skipping ${mapping.method} mapping for "${mapping.sourceHeader}" → "${key}" (better mapping already exists)`);
    return false;
  }

  /**
   * Return final mappings sorted in worksheet order.
   */
  getSortedMappings(mappingTracker) {
    return Array.from(mappingTracker.values()).sort((a, b) => {
      if (a.sourceIndex === undefined) return 1;
      if (b.sourceIndex === undefined) return -1;
      return a.sourceIndex - b.sourceIndex;
    });
  }

  /**
   * Parse multi-section Excel file with deduplication
   */
  parseMultiSectionFile(jsonData, headerRows) {
    console.log(`📊 [AI] Processing ${headerRows.length} sections...`);
    
    const headers = jsonData[headerRows[0]];
    const allDataRows = [];
    const seenPanels = new Set();
    const panelCandidateIndices = this.getPanelCandidateIndices(headers);
    const panelHeaderIndices = headers.reduce((indices, header, index) => {
      if (!header) return indices;
      const normalized = header.toString().toLowerCase().trim();
      if (normalized.includes('panel')) {
        indices.push(index);
      }
      return indices;
    }, []);
    const dedupeIndices = panelCandidateIndices.length ? panelCandidateIndices : panelHeaderIndices;
    const canDedupe = dedupeIndices.length > 0;
    
    if (!canDedupe) {
      console.warn(`⚠️ [AI] Could not identify a reliable panel number column; skipping deduplication`);
    } else if (panelCandidateIndices.length === 0) {
      console.warn(`⚠️ [AI] Falling back to generic panel column detection for deduplication`);
    }
    
    // Process each section
    for (let i = 0; i < headerRows.length; i++) {
      const sectionStart = headerRows[i] + 1;
      const sectionEnd = i < headerRows.length - 1 ? headerRows[i + 1] : jsonData.length;
      
      console.log(`📊 [AI] Section ${i + 1}: rows ${sectionStart}-${sectionEnd}`);
      
      // Extract data rows for this section
      const sectionData = jsonData.slice(sectionStart, sectionEnd).filter(row => 
        row.some(cell => cell && cell.toString().trim() !== '')
      );
      
      // Deduplicate by panel number (keep first occurrence)
      for (const row of sectionData) {
        if (!canDedupe) {
          allDataRows.push(row);
          continue;
        }

        let rawPanelValue = null;
        let normalizedPanelValue = null;

        for (const index of dedupeIndices) {
          const cell = row[index];
          if (cell === undefined || cell === null || cell === '') continue;

          const normalized = this.getNormalizedPanelValue(cell);
          if (!normalized) continue;

          rawPanelValue = cell.toString().trim();
          normalizedPanelValue = normalized;
          break;
        }

        if (!normalizedPanelValue) {
          allDataRows.push(row);
          console.log(`⚠️ [AI] Unable to normalize panel number in section ${i + 1}; keeping row`);
          continue;
        }
        
        if (!seenPanels.has(normalizedPanelValue)) {
          seenPanels.add(normalizedPanelValue);
          allDataRows.push(row);
          console.log(`✅ [AI] Keeping panel ${rawPanelValue} (normalized ${normalizedPanelValue}) from section ${i + 1}`);
        } else {
          console.log(`🚫 [AI] Skipping duplicate panel ${rawPanelValue} (normalized ${normalizedPanelValue}) from section ${i + 1}`);
        }
      }
    }
    
    console.log(`📊 [AI] Total unique panels after deduplication: ${allDataRows.length}`);
    
    return { headers, dataRows: allDataRows };
  }

  /**
   * Check if a row looks like headers
   */
  looksLikeHeaderRow(row) {
    const headerKeywords = ['panel', 'date', 'id', 'number', 'type', 'name', 'location', 'test', 'result'];
    const cellsWithKeywords = row.filter(cell => {
      if (!cell) return false;
      const cellStr = cell.toString().toLowerCase();
      return headerKeywords.some(keyword => cellStr.includes(keyword));
    });

    // More strict check: require at least 3 header keywords and no null cells in key positions
    const nonNullCells = row.filter(cell => cell !== null && cell !== undefined && cell.toString().trim() !== '');
    
    return cellsWithKeywords.length >= 3 && nonNullCells.length >= 4;
  }

  /**
   * Detect domain using rules first, AI if uncertain
   */
  async detectDomain(headers, dataRows) {
    const headerText = headers.join(' ').toLowerCase();
    
    // Rule-based detection (fast path)
    const domainScores = {
      panel_placement: 0,
      panel_seaming: 0,
      non_destructive: 0,
      trial_weld: 0,
      repairs: 0,
      destructive: 0
    };

    // Score each domain
    if (headerText.includes('location') || headerText.includes('coordinates') || headerText.includes('panel placement') || headerText.includes('roll number')) {
      domainScores.panel_placement += 3;
    }
    if (headerText.includes('seam') || headerText.includes('weld')) {
      domainScores.panel_seaming += 3;
      domainScores.trial_weld += 2;
    }
    if (headerText.includes('test') || headerText.includes('inspection')) {
      domainScores.non_destructive += 2;
    }
    if (headerText.includes('trial')) {
      domainScores.trial_weld += 3;
    }
    if (headerText.includes('repair') || headerText.includes('fix')) {
      domainScores.repairs += 3;
    }
    if (headerText.includes('destructive') || headerText.includes('sample') || headerText.includes('lab')) {
      domainScores.destructive += 3;
    }

    const bestDomain = Object.entries(domainScores)
      .sort(([,a], [,b]) => b - a)[0];

    console.log(`🎯 [AI] Domain scores:`, domainScores);
    console.log(`🎯 [AI] Best domain: ${bestDomain[0]} (score: ${bestDomain[1]})`);

    // Always use OpenAI if available (remove confidence check)
    if (this.openai) {
      console.log(`🤖 [AI] Using OpenAI for domain detection...`);
      const openaiDomain = await this.aiDetectDomain(headers, dataRows);
      console.log(`✅ [AI] OpenAI determined domain: ${openaiDomain}`);
      return openaiDomain;
    } else {
      console.warn('⚠️ [AI] OpenAI not available, using rule-based fallback');
      console.log(`✅ [AI] Using rule-based domain: ${bestDomain[0]}`);
      return bestDomain[0]; // Fall back to rule-based
    }
  }

  /**
   * AI-powered domain detection (fallback)
   */
  async aiDetectDomain(headers, dataRows) {
    if (!this.openai) {
      console.warn('⚠️ [AI] OpenAI not configured, using fallback');
      return 'panel_placement';
    }

    console.log(`🤖 [AI] OpenAI analyzing domain for headers: ${headers.join(', ')}`);
    
    const sampleRows = dataRows.slice(0, 3);
    
    const prompt = `Analyze this construction as-built data and determine the domain type.

Headers: ${headers.join(', ')}
Sample data rows: ${JSON.stringify(sampleRows, null, 2)}

Domain types:
- panel_placement: Panel installation records with location, dimensions, dates
- panel_seaming: Seam welding records with temperature, operator, machine data
- non_destructive: Testing records with test types, results, inspectors
- trial_weld: Weld testing with material, temperature, pass/fail
- repairs: Repair records with issue types, descriptions, technicians
- destructive: Lab testing with sample IDs, test types, results

Respond with ONLY the domain name (e.g., "panel_placement").`;

    const startTime = Date.now();
    const completion = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      max_tokens: 50,
      messages: [{ role: "user", content: prompt }]
    });
    
    const processingTime = Date.now() - startTime;
    const domain = completion.choices[0].message.content.trim();
    
    console.log(`🤖 [AI] OpenAI detected domain: ${domain} (${processingTime}ms)`);
    console.log(`🤖 [AI] OpenAI response: ${completion.choices[0].message.content}`);
    
    return domain;
  }

  /**
   * Map headers using explicit rules first, then AI
   */
  async mapHeaders(headers, domain, dataRows) {
    console.log(`📋 [AI] Mapping headers for domain: ${domain}`);
    
    const mappingTracker = new Map();
    const domainMappings = this.explicitMappings[domain] || {};
    let unmappedHeaders = [];
    const totalHeaderCount = headers.filter(h => h).length || 1;

    // Try explicit mappings first (fast and free)
    headers.forEach((header, index) => {
      if (!header) return;

      const headerClean = header.toString().trim().toLowerCase();
      
      if (domainMappings[headerClean]) {
        const mapping = {
          sourceHeader: header,
          sourceIndex: index,
          canonicalField: domainMappings[headerClean],
        confidence: 1.0,
          method: 'explicit'
        };
        this.addMapping(mappingTracker, mapping);
        console.log(`✅ [AI] Explicit mapping: "${header}" → "${domainMappings[headerClean]}"`);
      } else {
        unmappedHeaders.push({ header, index });
      }
    });

    // Calculate confidence
    const explicitMappings = this.getSortedMappings(mappingTracker);
    const explicitConfidence = explicitMappings.length / totalHeaderCount;

    // Always use OpenAI for header mapping if available
    if (this.openai && unmappedHeaders.length > 0) {
      console.log(`🤖 [AI] Using OpenAI for ${unmappedHeaders.length} unmapped headers...`);
      const aiMappings = await this.aiMapHeaders(unmappedHeaders, domain, dataRows);
      aiMappings.forEach(mapping => this.addMapping(mappingTracker, mapping));

    return {
        mappings: this.getSortedMappings(mappingTracker),
        confidence: 0.95, // High confidence when using OpenAI
        usedAI: true
      };
    } else {
      console.log(`✅ [AI] Using explicit mappings only (${(explicitConfidence * 100).toFixed(1)}% confidence)`);
      return {
        mappings: explicitMappings,
        confidence: Math.max(explicitConfidence, 0.7), // Minimum 70% for explicit
        usedAI: false
      };
    }
  }

  /**
   * AI-powered header mapping
   */
  async aiMapHeaders(unmappedHeaders, domain, dataRows) {
    console.log(`🤖 [AI] OpenAI mapping ${unmappedHeaders.length} headers for domain: ${domain}`);
    
    const canonicalFields = this.canonicalFields[domain];
    const sampleData = dataRows.slice(0, 3);

    const headersToMap = unmappedHeaders.map(h => ({
      header: h.header,
      index: h.index,
      sampleData: sampleData.map(row => row[h.index])
    }));

    const prompt = `Map these Excel column headers to standardized field names for ${domain} data.

Headers: ${unmappedHeaders.map(h => h.header).join(', ')}
Sample data: ${JSON.stringify(sampleData.slice(0, 2), null, 2)}

Standard fields for ${domain}: ${canonicalFields.join(', ')}

CRITICAL RULES:
1. Map "Panel #" or "Panel Number" → panelNumber (NEVER "Roll Number")
2. Map "Date" or "DateTime" → dateTime
3. Ignore columns with material descriptions like "geomembrane", "thickness specifications"
4. Return ONLY valid mappings, omit headers that don't match any canonical field
5. Return JSON format: [{"header": "original", "field": "standardized", "confidence": 0.95}]

Return ONLY valid JSON, no explanation.`;

    const startTime = Date.now();
    const completion = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });
    
    const processingTime = Date.now() - startTime;
    const aiMappings = JSON.parse(completion.choices[0].message.content);
    
    console.log(`🤖 [AI] OpenAI mapped headers in ${processingTime}ms`);
    console.log(`🤖 [AI] OpenAI response: ${completion.choices[0].message.content}`);
    
    const result = Object.entries(aiMappings)
      .map(([sourceHeader, canonicalField]) => {
        const sanitizedCanonical = canonicalField?.toString().trim();
        if (!sanitizedCanonical || !canonicalFields.includes(sanitizedCanonical)) {
          console.log(`⚠️ [AI] Ignoring unsupported canonical field "${canonicalField}" for header "${sourceHeader}"`);
          return null;
        }

        const headerInfo = unmappedHeaders.find(h => {
          if (!h.header) return false;
          return h.header.toString().trim().toLowerCase() === sourceHeader.toString().trim().toLowerCase();
        });

        if (!headerInfo) {
          console.log(`⚠️ [AI] Could not match AI-mapped header "${sourceHeader}" to original headers`);
          return null;
        }

        return {
          sourceHeader: headerInfo.header,
          sourceIndex: headerInfo.index,
          canonicalField: sanitizedCanonical,
          confidence: 0.95,
          method: 'ai'
        };
      })
      .filter(Boolean);

    console.log(`🤖 [AI] Mapped ${result.length} fields using Claude`);
    return result;
  }

  /**
   * Validate that row is actual data (not header/metadata)
   * PRODUCTION-READY: Handles all edge cases with precise logic
   */
  isValidDataRow(row, headers) {
    const cellValues = row.map(cell => cell ? cell.toString().toLowerCase().trim() : '');
    
    // === STEP 1: Check for duplicate headers ===
    // If this row contains the same text as headers, it's a duplicate header row
    const headerKeywords = headers.map(h => h ? h.toString().toLowerCase().trim() : '');
    let exactHeaderMatches = 0;
    
    cellValues.forEach((cell, idx) => {
      if (cell && headerKeywords[idx] && cell === headerKeywords[idx]) {
        exactHeaderMatches++;
      }
    });
    
    // If more than 50% of cells match their header position exactly, it's a header row
    if (exactHeaderMatches > headers.length * 0.5) {
      console.log(`🚫 [AI] Skipping duplicate header row (${exactHeaderMatches} exact matches)`);
      return false;
    }
    
    // === STEP 2: Check for metadata/project info rows ===
    const metadataKeywords = [
      'geomembrane', 'mil', 'black', 'hdpe', 'lldpe', 
      'specification', 'project name:', 'project location:', 
      'project description:', 'project manager:', 'supervisor:', 
      'engineer:', 'contractor:', 'contact:', 'material:',
      'wpwm mod', 'wpwm-mod', 'job #:', 'job number'
    ];
    
    const hasMetadata = cellValues.some(cell => 
      metadataKeywords.some(keyword => cell.includes(keyword))
    );
    
    if (hasMetadata) {
      console.log(`🚫 [AI] Skipping metadata row`);
      return false;
    }
    
    // === STEP 3: Check for sparse/empty rows ===
    const nonEmptyCells = cellValues.filter(cell => cell !== '');
    if (nonEmptyCells.length < 3) {
      console.log(`🚫 [AI] Skipping sparse row (only ${nonEmptyCells.length} cells)`);
      return false;
    }
    
    // === STEP 4: CRITICAL - Must have valid panel number ===
    // Prefer columns that look like panel identifiers (e.g. "Panel #", "Panel Number")
    const panelCandidateIndices = this.getPanelCandidateIndices(headers);
    const fallbackPanelIndices = panelCandidateIndices.length
      ? panelCandidateIndices
      : headers.reduce((indices, header, index) => {
          if (!header) return indices;
          const normalized = header.toString().toLowerCase().trim();
          if (normalized.includes('panel')) {
            indices.push(index);
          }
          return indices;
        }, []);

    let panelNumberFound = false;
    let panelValue = null;
    let normalizedPanel = null;

    const attemptIndices = fallbackPanelIndices.length ? fallbackPanelIndices : [];

    for (const index of attemptIndices) {
      const cell = row[index];
      if (cell === undefined || cell === null || cell === '') continue;

      const normalized = this.getNormalizedPanelValue(cell);
      if (!normalized) continue;

      panelNumberFound = true;
      panelValue = cell.toString().trim();
      normalizedPanel = normalized;
      break;
    }

    // Fallback for legacy sheets where headers are unreliable
    if (!panelNumberFound) {
      for (let i = 0; i < row.length; i++) {
        const cell = row[i];
        if (cell === undefined || cell === null || cell === '') continue;

        const normalized = this.getNormalizedPanelValue(cell);
        if (!normalized) continue;

        panelNumberFound = true;
        panelValue = cell.toString().trim();
        normalizedPanel = normalized;
        break;
      }
    }
    
    if (!panelNumberFound) {
      console.log(`🚫 [AI] Skipping row - no valid panel number found`);
      console.log(`   Row values:`, cellValues.slice(0, 6)); // Debug first 6 cells
      return false;
    }
    
    console.log(`✅ [AI] Valid data row - Panel: ${panelValue} (normalized ${normalizedPanel})`);
    return true;
  }

  /**
   * Check if required fields are present
   */
  hasRequiredFields(mappings, domain) {
    const required = ['panelNumber'];
    const mappedFields = mappings.map(m => m.canonicalField);
    
    const hasRequired = required.every(field => mappedFields.includes(field));
    
    if (!hasRequired) {
      console.error(`❌ [AI] Missing required field: panelNumber. Have: ${mappedFields.join(', ')}`);
    }
    
    return hasRequired;
  }

  /**
   * Process a single row with strict validation
   */
  async processRow(row, headers, mappings, domain, projectId, userId) {
    // Validate row is not a header or metadata
    
    // Validate row is actual data (not header/metadata)
    if (!this.isValidDataRow(row, headers)) {
      return null;
    }

    const rawData = {};
    const mappedData = {};

    // Build raw data
    headers.forEach((header, index) => {
      if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') {
        rawData[header] = row[index];
      }
    });

    // Build mapped data
    mappings.forEach(mapping => {
      const value = row[mapping.sourceIndex];
      if (value !== undefined && value !== null && value !== '') {
        mappedData[mapping.canonicalField] = this.normalizeValue(value, mapping.canonicalField);
      }
    });

    // CRITICAL: Get actual panel ID from database
    const panelNumber = mappedData.panelNumber;
    if (!panelNumber) {
      throw new Error('Missing panel number');
    }

    const panelId = await this.findPanelId(projectId, panelNumber);
    if (!panelId) {
      throw new Error(`Panel not found in layout: ${panelNumber}`);
    }

    console.log(`✅ [AI] Mapped panel ${panelNumber} → ${panelId}`);

    return {
      projectId,
      panelId,
      domain,
      rawData,
      mappedData,
      aiConfidence: 0.95,
      requiresReview: false,
      createdBy: userId
    };
  }


  /**
   * Find panel ID from database (CRITICAL)
   */
  async findPanelId(projectId, panelNumber) {
    try {
      const query = `SELECT panels FROM panel_layouts WHERE project_id = $1`;
      const result = await this.pool.query(query, [projectId]);
      
      if (result.rows.length === 0 || !result.rows[0].panels) {
        console.error(`❌ [AI] No panel layout found for project ${projectId}`);
        return null;
      }

      const panels = result.rows[0].panels;
      const normalizedSearch = this.normalizePanelNumber(panelNumber);
      
      const panel = panels.find(p => {
        const normalizedDb = this.normalizePanelNumber(p.panelNumber);
        return normalizedDb === normalizedSearch;
      });

      if (panel) {
        console.log(`✅ [AI] Found panel: ${panelNumber} → ${panel.id}`);
        return panel.id;
      }

      console.error(`❌ [AI] Panel not found: ${panelNumber} (normalized: ${normalizedSearch})`);
      console.log(`Available panels:`, panels.slice(0, 5).map(p => ({ 
        id: p.id, 
        panelNumber: p.panelNumber, 
        normalized: this.normalizePanelNumber(p.panelNumber) 
      })));
      return null;

    } catch (error) {
      console.error(`❌ [AI] Error finding panel:`, error);
      return null;
    }
  }

  /**
   * Normalize a raw cell value and only return it when it represents a plausible panel number.
   */
  getNormalizedPanelValue(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = this.normalizePanelNumber(value);
    if (!normalized) return null;

    const numericPortion = parseInt(normalized.slice(1), 10);
    if (Number.isNaN(numericPortion) || numericPortion <= 0 || numericPortion >= 1000) {
      return null;
    }

    return normalized;
  }

  /**
   * Normalize panel number for comparison
   */
  normalizePanelNumber(panelNumber) {
    if (!panelNumber) return null;
    
    let str = panelNumber.toString().trim().toUpperCase();

    // Normalize common prefixes/suffixes and remove separators while preserving suffix letters
    str = str
      .replace(/^PANEL\s*/, 'P')
      .replace(/^PNL\s*/, 'P')
      .replace(/^PN\s*/, 'P')
      .replace(/^P#/, 'P')
      .replace(/^#/, '')
      .replace(/[^A-Z0-9]/g, '');

    // If already in canonical format (e.g. P001 or P001A)
    if (/^P\d{1,4}[A-Z]{0,3}$/.test(str)) {
      const [, digits, suffix] = str.match(/^P(\d{1,4})([A-Z]{0,3})$/);
      const numeric = parseInt(digits, 10);
      if (Number.isNaN(numeric)) return null;
      return `P${numeric.toString().padStart(3, '0')}${suffix || ''}`;
    }

    // Extract trailing digits with optional alpha suffix (e.g. 12A, 012B)
    const match = str.match(/(\d{1,4})([A-Z]{0,3})$/);
    if (!match) {
      return null;
    }

    const numeric = parseInt(match[1], 10);
    if (Number.isNaN(numeric)) {
      return null;
    }

    const suffix = match[2] || '';
    return `P${numeric.toString().padStart(3, '0')}${suffix}`;
  }

  /**
   * Normalize field values
   */
  normalizeValue(value, fieldName) {
    if (value === null || value === undefined) return null;

    const strValue = value.toString().trim();

    if (fieldName === 'panelNumber') {
      const normalizedPanel = this.normalizePanelNumber(strValue);
      return normalizedPanel || strValue.toUpperCase();
    }

    // Date fields - handle Excel date serial numbers
    if (fieldName.includes('date') || fieldName.includes('Date') || fieldName.includes('Time')) {
      // Check if it's an Excel serial date number
      if (!isNaN(strValue) && parseFloat(strValue) > 25569) { // Excel epoch starts at 25569
        const excelDate = parseFloat(strValue);
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? strValue : date.toISOString();
      }
      
      const date = new Date(strValue);
      return isNaN(date.getTime()) ? strValue : date.toISOString();
    }

    // Numeric fields
    if (['temperature', 'pressure', 'speed', 'thickness', 'length', 'width', 'wedgeTemp'].includes(fieldName)) {
      const num = parseFloat(strValue);
      return isNaN(num) ? strValue : num;
    }

    // Pass/Fail fields
    if (fieldName === 'result' || fieldName === 'vboxPassFail' || fieldName === 'passFail') {
      const lower = strValue.toLowerCase();
      if (lower.includes('pass')) return 'Pass';
      if (lower.includes('fail')) return 'Fail';
      return strValue;
    }

    return strValue;
  }

  /**
   * Check for duplicate imports
   */
  async checkDuplicateImport(projectId, records) {
    if (records.length === 0) return false;

    try {
      const sampleRecord = records[0];
      const query = `
        SELECT COUNT(*) as count
        FROM asbuilt_records
        WHERE project_id = $1
        AND domain = $2
        AND created_at > NOW() - INTERVAL '1 hour'
      `;

      const result = await this.pool.query(query, [projectId, sampleRecord.domain]);
      const recentCount = parseInt(result.rows[0].count);
      
      return recentCount >= records.length * 0.5;
      
    } catch (error) {
      console.error(`Error checking duplicates:`, error);
      return false;
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
