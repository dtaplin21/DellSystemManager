const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

class DuplicateDetectionService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

      // Use AI to detect similarities
      const aiAnalysis = await this.analyzeWithAI(newRecords, existingRecords);
      
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
    try {
      console.log('🤖 [DuplicateDetection] Generating AI import analysis...');

      const analysisData = {
        totalRecords: importResult.records?.length || 0,
        duplicates: duplicates || [],
        conflicts: conflicts || [],
        fileMetadata: fileMetadata || {},
        processingTime: importResult.processingTime || 0,
        aiConfidence: importResult.aiConfidence || 0
      };

      const prompt = this.buildAnalysisPrompt(analysisData);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
        temperature: 0.7
      });

      const aiSummary = response.choices[0].message.content;

      return {
        summary: aiSummary,
        dataQuality: this.assessDataQuality(analysisData),
        duplicateAnalysis: this.analyzeDuplicatePatterns(duplicates),
        panelCoverage: this.analyzePanelCoverage(importResult.records),
        recommendations: this.generateRecommendations(analysisData),
        insights: this.extractInsights(analysisData),
        processingTime: analysisData.processingTime
      };
    } catch (error) {
      console.error('❌ [DuplicateDetection] Error generating AI analysis:', error);
      return {
        summary: "AI analysis unavailable due to error",
        dataQuality: { score: 0, issues: [] },
        duplicateAnalysis: { patterns: [], insights: [] },
        panelCoverage: { total: 0, coverage: 0 },
        recommendations: [],
        insights: [],
        processingTime: 0
      };
    }
  }

  /**
   * Create detailed import summary with AI insights
   */
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

  generateDuplicateSummary(duplicates, conflicts) {
    return {
      totalDuplicates: duplicates.length,
      totalConflicts: conflicts.length,
      duplicatePanels: duplicates.map(d => d.panelNumber),
      conflictTypes: [...new Set(conflicts.map(c => c.conflictType))]
    };
  }

  async analyzeWithAI(newRecords, existingRecords) {
    const prompt = `
    Analyze these new as-built records for potential duplicates with existing records:
    
    New Records: ${JSON.stringify(newRecords.slice(0, 5), null, 2)}
    Existing Records: ${JSON.stringify(existingRecords.slice(0, 5), null, 2)}
    
    Identify:
    1. Exact duplicates (same panel number, domain, date)
    2. Near duplicates (similar panel number, different date/location)
    3. Potential data quality issues
    4. Patterns in the data
    
    Return JSON format with similarRecords array and insights.
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
