const xlsx = require('xlsx');
const { Pool } = require('pg');
const OpenAI = require('openai');
require('dotenv').config();

class AsbuiltImportAI {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Initialize OpenAI (use GPT-3.5-turbo for cost efficiency)
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Canonical field definitions per domain
    this.canonicalFields = {
      panel_placement: ['panelNumber', 'dateTime', 'location', 'coordinates', 'notes'],
      panel_seaming: ['panelNumber', 'seamId', 'dateTime', 'seamType', 'temperature', 'operator'],
      non_destructive: ['panelNumber', 'testId', 'testType', 'result', 'dateTime', 'inspector'],
      trial_weld: ['panelNumber', 'weldId', 'material', 'temperature', 'result', 'dateTime'],
      repairs: ['panelNumber', 'repairId', 'issueType', 'description', 'dateTime', 'technician'],
      destructive: ['panelNumber', 'sampleId', 'testType', 'result', 'dateTime', 'lab']
    };

    // Explicit mapping rules (fast path)
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
        'comments': 'notes'
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
        'seamer': 'operator'
      },
      non_destructive: {
        'panel #': 'panelNumber',
        'panel number': 'panelNumber',
        'test id': 'testId',
        'test type': 'testType',
        'result': 'result',
        'date': 'dateTime',
        'inspector': 'inspector',
        'operator': 'inspector'
      },
      trial_weld: {
        'panel #': 'panelNumber',
        'weld id': 'weldId',
        'material': 'material',
        'temperature': 'temperature',
        'result': 'result',
        'pass/fail': 'result',
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
        'technician': 'technician'
      }
    };
  }

  /**
   * Main import function - Production ready
   */
  async importExcelData(fileBuffer, projectId, domain, userId) {
    try {
      console.log(`🤖 [AI] Starting import for project ${projectId}, domain: ${domain}`);

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
        throw new Error(`Missing required fields for domain ${detectedDomain}. Required: panelNumber, dateTime`);
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
          errors.push({ row: i + 2, error: error.message }); // +2 for header and 0-index
          console.warn(`⚠️ [AI] Row ${i + 2} error: ${error.message}`);
        }
      }

      console.log(`✅ [AI] Processed ${records.length} valid records, ${errors.length} errors`);

      // Step 6: Detect duplicate import
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
   * Parse Excel file with robust error handling
   */
  parseExcelFile(fileBuffer) {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });

    if (jsonData.length < 2) {
      throw new Error('Excel file must contain at least a header row and one data row');
    }

    // Find the actual header row (might not be row 0)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i];
      const nonEmptyCells = row.filter(cell => cell && cell.toString().trim() !== '');
      
      // Check if this looks like a header row
      if (nonEmptyCells.length >= 3 && this.looksLikeHeaderRow(row)) {
        headerRowIndex = i;
        break;
      }
    }

    const headers = jsonData[headerRowIndex];
    const dataRows = jsonData.slice(headerRowIndex + 1).filter(row => 
      row.some(cell => cell && cell.toString().trim() !== '')
    );

    console.log(`📋 [AI] Found headers at row ${headerRowIndex + 1}:`, headers);

    return { headers, dataRows };
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

    return cellsWithKeywords.length >= 2;
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
    if (headerText.includes('location') || headerText.includes('coordinates')) {
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

    // If confidence is low, use AI
    if (bestDomain[1] < 2) {
      console.log(`🤖 [AI] Low confidence domain detection, using Claude...`);
      return await this.aiDetectDomain(headers, dataRows);
    }

    return bestDomain[0];
  }

  /**
   * AI-powered domain detection (fallback)
   */
  async aiDetectDomain(headers, dataRows) {
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

    const completion = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      max_tokens: 50,
      messages: [{ role: "user", content: prompt }]
    });

    const domain = completion.choices[0].message.content.trim();
    console.log(`🤖 [AI] ChatGPT detected domain: ${domain}`);
    
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

    // If confidence is high enough, use explicit mappings only
    if (explicitConfidence >= 0.7 || unmappedHeaders.length === 0) {
      console.log(`✅ [AI] Using explicit mappings only (${(explicitConfidence * 100).toFixed(1)}% confidence)`);
      return {
        mappings,
        confidence: explicitConfidence,
        usedAI: false
      };
    }

    // Otherwise, use AI for unmapped headers
    console.log(`🤖 [AI] Using Claude for ${unmappedHeaders.length} unmapped headers...`);
    const aiMappings = await this.aiMapHeaders(unmappedHeaders, domain, dataRows);
    
    return {
      mappings: [...mappings, ...aiMappings],
      confidence: 0.95, // AI-backed mapping has high confidence
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

    const completion = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });

    const aiMappings = JSON.parse(completion.choices[0].message.content);
    
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

    console.log(`🤖 [AI] Mapped ${result.length} fields using ChatGPT`);
    return result;
  }

  /**
   * Check if required fields are present
   */
  hasRequiredFields(mappings, domain) {
    const required = ['panelNumber', 'dateTime'];
    const mappedFields = mappings.map(m => m.canonicalField);
    
    const hasRequired = required.every(field => mappedFields.includes(field));
    
    if (!hasRequired) {
      console.error(`❌ [AI] Missing required fields. Have: ${mappedFields.join(', ')}`);
    }
    
    return hasRequired;
  }

  /**
   * Process a single row with strict validation
   */
  async processRow(row, headers, mappings, domain, projectId, userId) {
    // Validate row is not a header or metadata
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
   * Validate that row is actual data (not header/metadata)
   */
  isValidDataRow(row, headers) {
    const cellValues = row.map(cell => cell ? cell.toString().toLowerCase() : '');
    
    // Check if row matches header keywords
    const headerKeywords = headers.map(h => h ? h.toString().toLowerCase() : '');
    let headerMatches = 0;
    
    cellValues.forEach(cell => {
      if (headerKeywords.includes(cell)) headerMatches++;
    });

    if (headerMatches > headers.length / 3) {
      console.log(`🚫 [AI] Skipping header row`);
      return false;
    }

    // Check for material descriptions
    const materialKeywords = ['geomembrane', 'mil', 'black', 'hdpe', 'lldpe', 'specification'];
    const hasMaterialDescription = cellValues.some(cell => 
      materialKeywords.some(keyword => cell.includes(keyword))
    );

    if (hasMaterialDescription) {
      console.log(`🚫 [AI] Skipping material description row`);
      return false;
    }

    // Require at least 3 non-empty cells
    const nonEmptyCells = cellValues.filter(cell => cell.trim() !== '');
    if (nonEmptyCells.length < 3) {
      console.log(`🚫 [AI] Skipping sparse row`);
      return false;
    }

    return true;
  }

  /**
   * Find panel ID from database (CRITICAL)
   */
  async findPanelId(projectId, panelNumber) {
    try {
      // Query panel_layouts to find the panel
      const query = `
        SELECT panels 
        FROM panel_layouts 
        WHERE project_id = $1
      `;
      
      const result = await this.pool.query(query, [projectId]);
      
      if (result.rows.length === 0 || !result.rows[0].panels) {
        console.error(`❌ [AI] No panel layout found for project ${projectId}`);
        return null;
      }

      const panels = result.rows[0].panels;
      
      // Normalize panel number for comparison
      const normalizedSearch = this.normalizePanelNumber(panelNumber);
      
      // Find matching panel
      const panel = panels.find(p => {
        const normalizedDb = this.normalizePanelNumber(p.panelNumber);
        return normalizedDb === normalizedSearch;
      });

      if (panel) {
        console.log(`✅ [AI] Found panel: ${panelNumber} → ${panel.id}`);
        return panel.id;
      }

      console.error(`❌ [AI] Panel not found: ${panelNumber} (normalized: ${normalizedSearch})`);
      console.log(`Available panels:`, panels.map(p => ({
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
    
    // Extract numeric value
    const match = panelNumber.toString().match(/\d+/);
    if (!match) return null;
    
    const numeric = parseInt(match[0], 10);
    
    // Return standard format: P###
    return `P${numeric.toString().padStart(3, '0')}`;
  }

  /**
   * Normalize field values
   */
  normalizeValue(value, fieldName) {
    if (value === null || value === undefined) return null;

    const strValue = value.toString().trim();

    // Date fields
    if (fieldName.includes('date') || fieldName.includes('Date') || fieldName.includes('Time')) {
      const date = new Date(strValue);
      return isNaN(date.getTime()) ? strValue : date.toISOString();
    }

    // Numeric fields
    if (['temperature', 'pressure', 'speed', 'thickness', 'length', 'width'].includes(fieldName)) {
      const num = parseFloat(strValue);
      return isNaN(num) ? strValue : num;
    }

    // Pass/Fail fields
    if (fieldName === 'result') {
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
      // Check if similar records already exist
      const sampleRecord = records[0];
      const query = `
        SELECT COUNT(*) as count
        FROM asbuilt_records
        WHERE project_id = $1
        AND domain = $2
        AND created_at > NOW() - INTERVAL '1 hour'
      `;

      const result = await this.pool.query(query, [
        projectId,
        sampleRecord.domain
      ]);

      const recentCount = parseInt(result.rows[0].count);
      
      // If there are recent imports of similar size, it might be a duplicate
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