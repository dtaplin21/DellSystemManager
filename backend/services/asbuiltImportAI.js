const xlsx = require('xlsx');
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

class AsbuiltImportAI {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Initialize Claude Haiku (fast & cheap)
    this.anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    }) : null;

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
  async importExcelData(fileBuffer, projectId, domain, userId) {
    try {
      console.log(`🤖 [AI] ===== STARTING IMPORT =====`);
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
            records.push(record);
          }
        } catch (error) {
          errors.push({ row: i + 2, error: error.message });
          console.warn(`⚠️ [AI] Row ${i + 2} error: ${error.message}`);
        }
      }

      console.log(`✅ [AI] Processed ${records.length} valid records, ${errors.length} errors`);

      // Step 6: Check for duplicate import
      const isDuplicate = await this.checkDuplicateImport(projectId, records);
      if (isDuplicate) {
        console.warn(`⚠️ [AI] Potential duplicate import detected`);
      }

      return {
        success: true,
        records,
        importedRows: records.length,
        errors,
        detectedDomain,
        confidence,
        usedAI,
        isDuplicate
      };

    } catch (error) {
      console.error(`❌ [AI] Import failed:`, error);
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
   * Parse multi-section Excel file with deduplication
   */
  parseMultiSectionFile(jsonData, headerRows) {
    console.log(`📊 [AI] Processing ${headerRows.length} sections...`);
    
    const headers = jsonData[headerRows[0]];
    const allDataRows = [];
    const seenPanels = new Set();
    
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
        // Find panel number column dynamically
        const panelIndex = headers.findIndex(h => 
          h && h.toString().toLowerCase().includes('panel')
        );
        
        if (panelIndex === -1) continue;
        
        const panelCell = row[panelIndex];
        if (!panelCell) continue;
        
        const panelNum = panelCell.toString().trim();
        
        if (!seenPanels.has(panelNum)) {
          seenPanels.add(panelNum);
          allDataRows.push(row);
          console.log(`✅ [AI] Keeping panel ${panelNum} from section ${i + 1}`);
        } else {
          console.log(`🚫 [AI] Skipping duplicate panel ${panelNum} from section ${i + 1}`);
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

    // If confidence is low, use AI (if available)
    if (bestDomain[1] < 2 && this.anthropic) {
      console.log(`🤖 [AI] Low confidence domain detection, using Claude...`);
      return await this.aiDetectDomain(headers, dataRows);
    }

    console.log(`✅ [AI] Using domain: ${bestDomain[0]}`);
    return bestDomain[0];
  }

  /**
   * AI-powered domain detection (fallback)
   */
  async aiDetectDomain(headers, dataRows) {
    if (!this.anthropic) {
      console.warn('⚠️ [AI] Claude not configured, using fallback');
      return 'panel_placement';
    }

    const sampleRows = dataRows.slice(0, 3);
    
    const prompt = `You are analyzing construction geomembrane data. Determine the domain.

Headers: ${JSON.stringify(headers)}
Sample rows: ${JSON.stringify(sampleRows)}

Possible domains:
- panel_placement: Panel location and installation data
- panel_seaming: Welding and seaming information
- non_destructive: Non-destructive testing results
- trial_weld: Trial welding test data
- repairs: Repair and maintenance records
- destructive: Destructive testing and lab results

Return ONLY the domain name, nothing else.`;

    const message = await this.anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 50,
      messages: [{ role: "user", content: prompt }]
    });

    const domain = message.content[0].text.trim();
    console.log(`🤖 [AI] Claude detected domain: ${domain}`);
    
    return domain;
  }

  /**
   * Map headers using explicit rules first, then AI
   */
  async mapHeaders(headers, domain, dataRows) {
    console.log(`📋 [AI] Mapping headers for domain: ${domain}`);
    
    const mappings = [];
    const domainMappings = this.explicitMappings[domain] || {};
    let unmappedHeaders = [];

    // Try explicit mappings first (fast and free)
    headers.forEach((header, index) => {
      if (!header) return;

      const headerClean = header.toString().trim().toLowerCase();
      
      if (domainMappings[headerClean]) {
        mappings.push({
          sourceHeader: header,
          sourceIndex: index,
          canonicalField: domainMappings[headerClean],
          confidence: 1.0,
          method: 'explicit'
        });
        console.log(`✅ [AI] Explicit mapping: "${header}" → "${domainMappings[headerClean]}"`);
      } else {
        unmappedHeaders.push({ header, index });
      }
    });

    // Calculate confidence
    const explicitConfidence = mappings.length / headers.filter(h => h).length;

    // If confidence is high enough OR no AI available, use explicit mappings only
    if (explicitConfidence >= 0.6 || unmappedHeaders.length === 0 || !this.anthropic) {
      console.log(`✅ [AI] Using explicit mappings (${(explicitConfidence * 100).toFixed(1)}% confidence)`);
      return {
        mappings,
        confidence: Math.max(explicitConfidence, 0.7), // Minimum 70% for explicit
        usedAI: false
      };
    }

    // Otherwise, use AI for unmapped headers
    console.log(`🤖 [AI] Using Claude for ${unmappedHeaders.length} unmapped headers...`);
    const aiMappings = await this.aiMapHeaders(unmappedHeaders, domain, dataRows);
    
    return {
      mappings: [...mappings, ...aiMappings],
      confidence: 0.95,
      usedAI: true
    };
  }

  /**
   * AI-powered header mapping
   */
  async aiMapHeaders(unmappedHeaders, domain, dataRows) {
    const canonicalFields = this.canonicalFields[domain];
    const sampleData = dataRows.slice(0, 3);

    const headersToMap = unmappedHeaders.map(h => ({
      header: h.header,
      index: h.index,
      sampleData: sampleData.map(row => row[h.index])
    }));

    const prompt = `You are a geomembrane construction data specialist. Map these Excel headers to canonical fields.

Domain: ${domain}
Canonical fields available: ${JSON.stringify(canonicalFields)}

Unmapped headers and sample data:
${JSON.stringify(headersToMap, null, 2)}

CRITICAL RULES:
1. Map "Panel #" or "Panel Number" → panelNumber (NEVER "Roll Number")
2. Map "Date" or "DateTime" → dateTime
3. Ignore columns with material descriptions like "geomembrane", "thickness specifications"
4. Return ONLY valid mappings, omit headers that don't match any canonical field
5. Return JSON format: { "sourceHeader": "canonicalField" }

Return ONLY valid JSON, no explanation.`;

    const message = await this.anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });

    const aiMappings = JSON.parse(message.content[0].text);
    
    const result = Object.entries(aiMappings).map(([sourceHeader, canonicalField]) => {
      const headerInfo = unmappedHeaders.find(h => h.header === sourceHeader);
      return {
        sourceHeader,
        sourceIndex: headerInfo?.index,
        canonicalField,
        confidence: 0.95,
        method: 'ai'
      };
    });

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
    // Panel numbers should be numeric and in reasonable range (1-999)
    let panelNumberFound = false;
    let panelValue = null;
    
    for (let i = 0; i < row.length; i++) {
      if (!row[i]) continue;
      
      const cellStr = row[i].toString().trim();
      
      // Check if this cell is a valid panel number
      // Accept: "1", "10", "123", but reject: "1.5", "abc", "45230" (date serial)
      if (/^\d{1,3}$/.test(cellStr)) {
        const num = parseInt(cellStr);
        if (num > 0 && num < 1000) {
          panelNumberFound = true;
          panelValue = cellStr;
          break;
        }
      }
    }
    
    if (!panelNumberFound) {
      console.log(`🚫 [AI] Skipping row - no valid panel number found`);
      console.log(`   Row values:`, cellValues.slice(0, 6)); // Debug first 6 cells
      return false;
    }
    
    console.log(`✅ [AI] Valid data row - Panel: ${panelValue}`);
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
   * Normalize panel number for comparison
   */
  normalizePanelNumber(panelNumber) {
    if (!panelNumber) return null;
    
    const str = panelNumber.toString().trim().toUpperCase();
    
    // If already in P001 format, return as is
    if (str.match(/^P\d+$/)) {
      return str;
    }
    
    // Extract numeric value and convert to P001 format
    const match = str.match(/\d+/);
    if (!match) return null;
    
    const numeric = parseInt(match[0], 10);
    return `P${numeric.toString().padStart(3, '0')}`;
  }

  /**
   * Normalize field values
   */
  normalizeValue(value, fieldName) {
    if (value === null || value === undefined) return null;

    const strValue = value.toString().trim();

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