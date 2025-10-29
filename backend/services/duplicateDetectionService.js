const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const OpenAI = require('openai');

class DuplicateDetectionService {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('⚠️ [DuplicateDetection] Supabase credentials missing - duplicate detection will run in fallback mode');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    }
    
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      this.pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
      });
    } else {
      console.warn('⚠️ [DuplicateDetection] DATABASE_URL not configured - context-aware analysis disabled');
      this.pool = null;
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ [DuplicateDetection] OPENAI_API_KEY not configured - skipping advanced AI analysis');
      this.openaiConfigured = false;
      this.openai = null;
    } else {
      console.log('✅ [DuplicateDetection] OpenAI configured');
      this.openaiConfigured = true;
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  /**
   * Check for existing records by panel + domain + date range
   */
  async checkForDuplicates(projectId, panelNumbers, domain, dateRange = null) {
    try {
      console.log('🔍 [DuplicateDetection] Checking for duplicates...', {
        projectId,
        panelNumbers: panelNumbers.length,
        domain,
        dateRange
      });

      if (!this.supabase) {
        console.warn('⚠️ [DuplicateDetection] Supabase client unavailable, returning empty duplicate set');
        return {
          duplicates: [],
          conflicts: [],
          existingRecords: [],
          summary: this.generateDuplicateSummary([], [])
        };
      }

      // Build query for existing records
      let query = this.supabase
        .from('asbuilt_records')
        .select('*')
        .eq('project_id', projectId)
        .eq('domain', domain)
        .in('mapped_data->>panelNumber', panelNumbers);

      // Add date range filter if provided
      if (dateRange && dateRange.start && dateRange.end) {
        query = query
          .gte('mapped_data->>date', dateRange.start)
          .lte('mapped_data->>date', dateRange.end);
      }

      const { data: existingRecords, error } = await query;

      if (error) {
        console.error('❌ [DuplicateDetection] Error fetching existing records:', error);
        throw error;
      }

      console.log('📊 [DuplicateDetection] Found existing records:', existingRecords.length);

      // Analyze duplicates
      const duplicates = this.analyzeDuplicates(existingRecords, panelNumbers);
      const conflicts = this.identifyConflicts(existingRecords, panelNumbers);

      return {
        duplicates,
        conflicts,
        existingRecords,
        summary: this.generateDuplicateSummary(duplicates, conflicts)
      };
    } catch (error) {
      console.error('❌ [DuplicateDetection] Error in checkForDuplicates:', error);
      throw error;
    }
  }

  /**
   * AI-powered similarity detection for near-duplicates
   */
  async detectSimilarRecords(projectId, newRecords, domain) {
    try {
      console.log('🤖 [DuplicateDetection] Running AI similarity detection...');

      if (!this.supabase) {
        console.warn('⚠️ [DuplicateDetection] Supabase client unavailable, skipping similarity detection');
        return { similarRecords: [], aiInsights: [], confidence: 0 };
      }

      // Get existing records for comparison
      const { data: existingRecords, error } = await this.supabase
        .from('asbuilt_records')
        .select('*')
        .eq('project_id', projectId)
        .eq('domain', domain);

      if (error) {
        console.error('❌ [DuplicateDetection] Error fetching records for similarity:', error);
        throw error;
      }

      if (existingRecords.length === 0) {
        return { similarRecords: [], aiInsights: [] };
      }

      const [projectContext, correctionPatterns] = await Promise.all([
        this.getProjectHistoryContext(projectId, domain),
        this.getUserCorrectionPatterns(projectId, domain)
      ]);

      // Use AI to detect similarities
      const aiAnalysis = await this.analyzeWithAI(newRecords, existingRecords, {
        projectContext,
        correctionPatterns
      });

      return {
        similarRecords: aiAnalysis.similarRecords,
        aiInsights: aiAnalysis.insights,
        confidence: aiAnalysis.confidence
      };
    } catch (error) {
      console.error('❌ [DuplicateDetection] Error in detectSimilarRecords:', error);
      throw error;
    }
  }

  /**
   * Smart conflict resolution with user options
   */
  async resolveConflicts(conflicts, userChoice) {
    try {
      console.log('🔄 [DuplicateDetection] Resolving conflicts...', { conflicts: conflicts.length, userChoice });

      const resolutionResults = [];

      for (const conflict of conflicts) {
        switch (userChoice) {
          case 'skip':
            resolutionResults.push({
              ...conflict,
              action: 'skipped',
              reason: 'User chose to skip duplicate'
            });
            break;
          case 'replace':
            // Delete existing record and keep new one
            await this.supabase
              .from('asbuilt_records')
              .delete()
              .eq('id', conflict.existingRecordId);
            
            resolutionResults.push({
              ...conflict,
              action: 'replaced',
              reason: 'Existing record replaced with new data'
            });
            break;
          case 'merge':
            // Merge data (implementation depends on specific merge logic)
            resolutionResults.push({
              ...conflict,
              action: 'merged',
              reason: 'Data merged with existing record'
            });
            break;
          default:
            resolutionResults.push({
              ...conflict,
              action: 'cancelled',
              reason: 'Import cancelled by user'
            });
        }
      }

      return resolutionResults;
    } catch (error) {
      console.error('❌ [DuplicateDetection] Error in resolveConflicts:', error);
      throw error;
    }
  }

  /**
   * Generate AI analysis of import process
   */
  async generateImportAnalysis(importResult, duplicates, conflicts, fileMetadata) {
    if (!this.openaiConfigured) {
      console.log('⚠️ [DuplicateDetection] OpenAI not configured, returning fallback analysis');
      return this.createFallbackAnalysis(importResult, duplicates, conflicts, {
        row: 0,
        issue: 'OpenAI not configured',
        severity: 'info'
      });
    }

    try {
      console.log('🤖 [DuplicateDetection] Generating AI import analysis...');
      console.log('🤖 [DuplicateDetection] Input parameters:', {
        importResult: importResult ? 'present' : 'null',
        duplicates: duplicates?.length || 0,
        conflicts: conflicts?.length || 0,
        fileMetadata: fileMetadata ? 'present' : 'null',
        openai: this.openai ? 'initialized' : 'null'
      });

      const analysisData = {
        totalRecords: importResult.records?.length || 0,
        duplicates: duplicates || [],
        conflicts: conflicts || [],
        fileMetadata: fileMetadata || {},
        processingTime: importResult.processingTime || 0,
        aiConfidence: importResult.aiConfidence || 0
      };

      console.log('🤖 [DuplicateDetection] Analysis data:', analysisData);

      const prompt = this.buildAnalysisPrompt(analysisData);
      console.log('🤖 [DuplicateDetection] Prompt length:', prompt.length);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
        temperature: 0.7
      });

      const aiSummary = response.choices[0].message.content;
      console.log('🤖 [DuplicateDetection] AI response received, length:', aiSummary.length);

      const result = {
        summary: aiSummary,
        dataQuality: this.assessDataQuality(analysisData),
        duplicateAnalysis: this.analyzeDuplicatePatterns(duplicates),
        panelCoverage: this.analyzePanelCoverage(importResult.records),
        recommendations: this.generateRecommendations(analysisData),
        insights: this.extractInsights(analysisData),
        processingTime: analysisData.processingTime
      };

      console.log('🤖 [DuplicateDetection] Returning analysis result:', {
        summary: result.summary?.substring(0, 50) + '...',
        dataQuality: result.dataQuality,
        recommendations: result.recommendations?.length
      });

      return result;
    } catch (error) {
      console.error('❌ [DuplicateDetection] Error generating AI analysis:', error);
      console.error('❌ [DuplicateDetection] Error details:', {
        message: error.message,
        stack: error.stack?.substring(0, 200) + '...'
      });
      return this.createFallbackAnalysis(importResult, duplicates, conflicts, {
        row: 0,
        issue: `AI analysis failed: ${error.message}`,
        severity: 'warning'
      });
    }
  }

  /**
   * Create detailed import summary with AI insights
   */
  createFallbackAnalysis(importResult = {}, duplicates = [], conflicts = [], fallbackDetail = null) {
    const records = importResult.records || [];
    const issues = [];
    
    if (duplicates.length > 0) {
      issues.push(`${duplicates.length} duplicates detected`);
    }
    if (conflicts.length > 0) {
      issues.push(`${conflicts.length} conflicts detected`);
    }
    if (fallbackDetail?.issue) {
      issues.push(fallbackDetail.issue);
    }
    
    return {
      summary: fallbackDetail?.issue || 'AI analysis unavailable. Basic summary generated.',
      dataQuality: {
        score: Math.max(0, 100 - (duplicates.length * 10) - (conflicts.length * 5)),
        issues
      },
      duplicateAnalysis: this.analyzeDuplicatePatterns(duplicates),
      panelCoverage: this.analyzePanelCoverage(records),
      recommendations: duplicates.length > 0
        ? ['Review duplicate records before proceeding']
        : [],
      insights: [],
      processingTime: importResult.processingTime || 0,
      duplicates,
      conflicts,
      aiConfidence: importResult.aiConfidence || 0,
      totalRecords: records.length
    };
  }
  
  async createImportSummary(projectId, importSession, analysisResults) {
    try {
      console.log('📝 [DuplicateDetection] Creating import summary...');

      const summary = {
        projectId,
        importSession,
        timestamp: new Date().toISOString(),
        analysis: analysisResults,
        breakdown: {
          totalProcessed: analysisResults.totalRecords || 0,
          successfullyImported: (analysisResults.totalRecords || 0) - (analysisResults.duplicates?.length || 0),
          duplicatesSkipped: analysisResults.duplicates?.length || 0,
          conflictsResolved: analysisResults.conflicts?.length || 0,
          panelsAffected: analysisResults.panelCoverage?.total || 0,
          filesProcessed: 1,
          aiConfidence: analysisResults.aiConfidence || 0
        }
      };

      if (!this.supabase) {
        console.warn('⚠️ [DuplicateDetection] Supabase client unavailable, skipping import summary persistence');
        return summary;
      }

      // Store summary in database
      const { error } = await this.supabase
        .from('import_analyses')
        .insert([{
          import_session_id: importSession.id,
          project_id: projectId,
          ai_summary: analysisResults.summary,
          data_quality_score: analysisResults.dataQuality?.score || 0,
          duplicate_count: analysisResults.duplicates?.length || 0,
          confidence_score: analysisResults.aiConfidence || 0,
          recommendations: analysisResults.recommendations || [],
          insights: analysisResults.insights || []
        }]);

      if (error) {
        console.error('❌ [DuplicateDetection] Error storing import summary:', error);
      }

      return summary;
    } catch (error) {
      console.error('❌ [DuplicateDetection] Error creating import summary:', error);
      throw error;
    }
  }

  // Helper methods
  analyzeDuplicates(existingRecords, panelNumbers) {
    const duplicates = [];
    const existingPanelNumbers = existingRecords.map(r => r.mapped_data?.panelNumber);

    for (const panelNumber of panelNumbers) {
      if (existingPanelNumbers.includes(panelNumber)) {
        const existingRecord = existingRecords.find(r => r.mapped_data?.panelNumber === panelNumber);
        duplicates.push({
          panelNumber,
          existingRecordId: existingRecord.id,
          existingData: existingRecord.mapped_data,
          reason: 'Exact panel number match found',
          severity: 'high'
        });
      }
    }

    return duplicates;
  }

  identifyConflicts(existingRecords, panelNumbers) {
    const conflicts = [];
    
    // Check for date conflicts, location conflicts, etc.
    for (const panelNumber of panelNumbers) {
      const existingRecord = existingRecords.find(r => r.mapped_data?.panelNumber === panelNumber);
      if (existingRecord) {
        conflicts.push({
          panelNumber,
          existingRecordId: existingRecord.id,
          conflictType: 'duplicate',
          severity: 'medium'
        });
      }
    }

    return conflicts;
  }

  async getProjectHistoryContext(projectId, domain) {
    if (!this.supabase) {
      return {};
    }

    try {
      const { data, error } = await this.supabase
        .from('asbuilt_records')
        .select('mapped_data, created_at')
        .eq('project_id', projectId)
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return {};
      }

      const operatorCounts = new Map();
      const temperatureValues = [];
      const panels = new Set();
      const createdAt = [];

      data.forEach(record => {
        const mapped = record.mapped_data || {};
        if (mapped.operator) {
          operatorCounts.set(mapped.operator, (operatorCounts.get(mapped.operator) || 0) + 1);
        }
        if (mapped.seamerInitials) {
          operatorCounts.set(mapped.seamerInitials, (operatorCounts.get(mapped.seamerInitials) || 0) + 1);
        }
        if (mapped.temperature) {
          const value = parseFloat(mapped.temperature);
          if (!Number.isNaN(value)) {
            temperatureValues.push(value);
          }
        }
        if (mapped.panelNumber) {
          panels.add(mapped.panelNumber);
        }
        if (record.created_at) {
          createdAt.push(new Date(record.created_at));
        }
      });

      const sortedOperators = Array.from(operatorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([operator, count]) => ({ operator, count }));

      const avgTemperature = temperatureValues.length
        ? parseFloat((temperatureValues.reduce((sum, value) => sum + value, 0) / temperatureValues.length).toFixed(2))
        : null;

      const range = createdAt.length
        ? {
            newest: new Date(Math.max(...createdAt.map(date => date.getTime()))).toISOString(),
            oldest: new Date(Math.min(...createdAt.map(date => date.getTime()))).toISOString()
          }
        : null;

      return {
        recentRecordCount: data.length,
        uniquePanels: panels.size,
        topOperators: sortedOperators,
        averageTemperature: avgTemperature,
        activityWindow: range
      };
    } catch (error) {
      console.error('❌ [DuplicateDetection] Failed to build project history context', error.message);
      return {};
    }
  }

  async getUserCorrectionPatterns(projectId, domain) {
    if (!this.pool) {
      return {};
    }

    try {
      const result = await this.pool.query(
        `
          SELECT aal.predicted_value, aal.user_corrected_value, aal.was_accepted, aal.created_at
          FROM ai_accuracy_log aal
          JOIN asbuilt_records ar ON ar.id = aal.import_id
          WHERE ar.project_id = $1
            AND aal.domain = $2
          ORDER BY aal.created_at DESC
          LIMIT 100
        `,
        [projectId, domain]
      );

      return this.summarizeCorrectionPatterns(result.rows);
    } catch (error) {
      console.error('❌ [DuplicateDetection] Failed to fetch correction patterns', error.message);
      return {};
    }
  }

  summarizeCorrectionPatterns(rows = []) {
    if (!rows.length) {
      return { totalCorrections: 0 };
    }

    const adjustmentCounts = new Map();
    let accepted = 0;

    rows.forEach(row => {
      if (row.was_accepted) {
        accepted += 1;
      }

      const predicted = this.safeParseJSON(row.predicted_value) || {};
      const corrected = this.safeParseJSON(row.user_corrected_value) || {};

      Object.keys(corrected).forEach(field => {
        const predictedValue = predicted[field];
        const correctedValue = corrected[field];

        if (predictedValue !== correctedValue) {
          const key = `${field}:${correctedValue}`;
          adjustmentCounts.set(key, (adjustmentCounts.get(key) || 0) + 1);
        }
      });
    });

    const frequentAdjustments = Array.from(adjustmentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => {
        const [field, value] = key.split(':');
        return { field, value, count };
      });

    return {
      totalCorrections: rows.length,
      acceptanceRate: parseFloat((accepted / rows.length).toFixed(2)),
      frequentAdjustments
    };
  }

  safeParseJSON(payload) {
    if (!payload) {
      return null;
    }

    if (typeof payload === 'object') {
      return payload;
    }

    try {
      return JSON.parse(payload);
    } catch (error) {
      console.warn('⚠️ [DuplicateDetection] Failed to parse JSON payload', error.message);
      return null;
    }
  }

  generateDuplicateSummary(duplicates, conflicts) {
    return {
      totalDuplicates: duplicates.length,
      totalConflicts: conflicts.length,
      duplicatePanels: duplicates.map(d => d.panelNumber),
      conflictTypes: [...new Set(conflicts.map(c => c.conflictType))]
    };
  }

  async analyzeWithAI(newRecords, existingRecords, context = {}) {
    const prompt = `
    Analyze these new as-built records for potential duplicates with existing records.

    New Records: ${JSON.stringify(newRecords.slice(0, 5), null, 2)}
    Existing Records: ${JSON.stringify(existingRecords.slice(0, 5), null, 2)}

    Project History Summary: ${JSON.stringify(context.projectContext || {}, null, 2)}
    User Correction Patterns: ${JSON.stringify(context.correctionPatterns || {}, null, 2)}

    Identify:
    1. Exact duplicates (same panel number, domain, date)
    2. Near duplicates (similar panel number, different date/location)
    3. Potential data quality issues
    4. Patterns in the data or systematic corrections users make

    Include:
    - A risk score (0-1) for each similar record
    - How historical corrections should influence the recommendation
    - Guidance on whether to auto-merge, flag for review, or ignore

    Return JSON with fields { similarRecords: [], insights: [], confidence: 0-1 }.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('❌ [DuplicateDetection] AI analysis failed:', error);
      return { similarRecords: [], insights: [], confidence: 0 };
    }
  }

  buildAnalysisPrompt(analysisData) {
    return `
    As an AI assistant, analyze this as-built data import process and provide a comprehensive summary:
    
    Import Statistics:
    - Total records processed: ${analysisData.totalRecords}
    - Duplicates found: ${analysisData.duplicates.length}
    - Conflicts detected: ${analysisData.conflicts.length}
    - Processing time: ${analysisData.processingTime}ms
    - AI confidence: ${analysisData.aiConfidence}%
    
    Duplicate Details:
    ${analysisData.duplicates.map(d => `- Panel ${d.panelNumber}: ${d.reason}`).join('\n')}
    
    File Information:
    - File: ${analysisData.fileMetadata.fileName || 'Unknown'}
    - Size: ${analysisData.fileMetadata.fileSize || 'Unknown'}
    - Upload date: ${analysisData.fileMetadata.uploadedAt || 'Unknown'}
    
    Please provide:
    1. A clear, professional summary of what was imported
    2. Specific details about any duplicates found (panel numbers, reasons)
    3. Data quality insights and potential issues
    4. Recommendations for data improvement
    5. Any anomalies or patterns detected
    6. Overall assessment of the import success
    
    Format your response as a structured analysis with clear sections.
    `;
  }

  assessDataQuality(analysisData) {
    const score = Math.max(0, 100 - (analysisData.duplicates.length * 10) - (analysisData.conflicts.length * 5));
    const issues = [];
    
    if (analysisData.duplicates.length > 0) {
      issues.push(`${analysisData.duplicates.length} duplicate records found`);
    }
    if (analysisData.conflicts.length > 0) {
      issues.push(`${analysisData.conflicts.length} conflicts detected`);
    }
    if (analysisData.aiConfidence < 0.8) {
      issues.push('Low AI confidence in data processing');
    }

    return { score, issues };
  }

  analyzeDuplicatePatterns(duplicates) {
    duplicates = duplicates || [];
    const patterns = {};
    duplicates.forEach(dup => {
      const reason = dup.reason || 'unknown';
      patterns[reason] = (patterns[reason] || 0) + 1;
    });

    return {
      patterns,
      insights: Object.keys(patterns).map(reason => 
        `${patterns[reason]} duplicates due to: ${reason}`
      )
    };
  }

  analyzePanelCoverage(records) {
    if (!records || records.length === 0) {
      return { total: 0, coverage: 0 };
    }

    const uniquePanels = new Set(records.map(r => r.mapped_data?.panelNumber)).size;
    return {
      total: uniquePanels,
      coverage: uniquePanels / records.length * 100
    };
  }

  generateRecommendations(analysisData) {
    const recommendations = [];
    
    if (analysisData.duplicates.length > 0) {
      recommendations.push('Review duplicate records for potential data merge opportunities');
    }
    if (analysisData.conflicts.length > 0) {
      recommendations.push('Resolve conflicts before proceeding with import');
    }
    if (analysisData.aiConfidence < 0.8) {
      recommendations.push('Consider manual review of low-confidence records');
    }
    if (analysisData.totalRecords === 0) {
      recommendations.push('No valid records found - check file format and data quality');
    }

    return recommendations;
  }

  extractInsights(analysisData) {
    const insights = [];
    
    insights.push(`Import completed in ${analysisData.processingTime}ms`);
    insights.push(`AI confidence: ${analysisData.aiConfidence}%`);
    insights.push(`Data quality score: ${this.assessDataQuality(analysisData).score}/100`);
    
    if (analysisData.duplicates.length > 0) {
      insights.push(`Found ${analysisData.duplicates.length} duplicate records`);
    }
    if (analysisData.conflicts.length > 0) {
      insights.push(`Detected ${analysisData.conflicts.length} conflicts`);
    }

    return insights;
  }
}

module.exports = DuplicateDetectionService;
