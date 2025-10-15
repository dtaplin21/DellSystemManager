const OpenAI = require('openai');

class ImportAnalysisService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Generate comprehensive import analysis
   */
  async analyzeImportResults(importData) {
    try {
      console.log('🤖 [ImportAnalysis] Starting comprehensive analysis...');

      const analysis = {
        // Data quality insights
        dataQuality: await this.analyzeDataQuality(importData),
        
        // Duplicate analysis
        duplicateAnalysis: await this.analyzeDuplicates(importData.duplicates),
        
        // Panel coverage analysis
        panelCoverage: await this.analyzePanelCoverage(importData.panels),
        
        // File processing insights
        fileProcessing: await this.analyzeFileProcessing(importData.fileMetadata),
        
        // AI confidence analysis
        confidenceAnalysis: await this.analyzeConfidence(importData.records),
        
        // Recommendations
        recommendations: await this.generateRecommendations(importData)
      };

      return await this.generateAISummary(analysis, importData);
    } catch (error) {
      console.error('❌ [ImportAnalysis] Error in analyzeImportResults:', error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Generate human-readable AI summary
   */
  async generateAISummary(analysis, importData) {
    try {
      console.log('🤖 [ImportAnalysis] Generating AI summary...');

      const prompt = this.buildSummaryPrompt(analysis, importData);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.7
      });

      const aiSummary = response.choices[0].message.content;

      return {
        ...analysis,
        summary: aiSummary,
        generatedAt: new Date().toISOString(),
        model: "gpt-3.5-turbo"
      };
    } catch (error) {
      console.error('❌ [ImportAnalysis] Error generating AI summary:', error);
      return {
        ...analysis,
        summary: "AI analysis unavailable due to error",
        generatedAt: new Date().toISOString(),
        model: "error"
      };
    }
  }

  /**
   * Analyze data quality
   */
  async analyzeDataQuality(importData) {
    const records = importData.records || [];
    const duplicates = importData.duplicates || [];
    const conflicts = importData.conflicts || [];

    // Calculate quality score
    let score = 100;
    const issues = [];

    // Deduct points for duplicates
    score -= duplicates.length * 10;
    if (duplicates.length > 0) {
      issues.push(`${duplicates.length} duplicate records found`);
    }

    // Deduct points for conflicts
    score -= conflicts.length * 15;
    if (conflicts.length > 0) {
      issues.push(`${conflicts.length} conflicts detected`);
    }

    // Check for missing required fields
    const missingFields = this.checkMissingFields(records);
    if (missingFields.length > 0) {
      score -= missingFields.length * 5;
      issues.push(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Check for data consistency
    const consistencyIssues = this.checkDataConsistency(records);
    if (consistencyIssues.length > 0) {
      score -= consistencyIssues.length * 3;
      issues.push(`Data consistency issues: ${consistencyIssues.join(', ')}`);
    }

    // Check AI confidence
    const avgConfidence = this.calculateAverageConfidence(records);
    if (avgConfidence < 0.8) {
      score -= 20;
      issues.push(`Low AI confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    }

    return {
      score: Math.max(0, score),
      issues,
      averageConfidence: avgConfidence,
      missingFields,
      consistencyIssues
    };
  }

  /**
   * Analyze duplicates
   */
  async analyzeDuplicates(duplicates) {
    if (!duplicates || duplicates.length === 0) {
      return {
        patterns: {},
        insights: [],
        recommendations: []
      };
    }

    const patterns = {};
    const panelNumbers = [];
    const reasons = [];

    duplicates.forEach(dup => {
      const reason = dup.reason || 'unknown';
      patterns[reason] = (patterns[reason] || 0) + 1;
      panelNumbers.push(dup.panelNumber);
      reasons.push(reason);
    });

    const insights = Object.keys(patterns).map(reason => 
      `${patterns[reason]} duplicates due to: ${reason}`
    );

    const recommendations = [];
    if (patterns['Exact panel number match found'] > 0) {
      recommendations.push('Review exact duplicates for potential data merge opportunities');
    }
    if (patterns['Similar panel number, different date'] > 0) {
      recommendations.push('Investigate similar panel numbers for data consistency');
    }

    return {
      patterns,
      insights,
      recommendations,
      duplicatePanels: panelNumbers,
      totalDuplicates: duplicates.length
    };
  }

  /**
   * Analyze panel coverage
   */
  async analyzePanelCoverage(panels) {
    if (!panels || panels.length === 0) {
      return {
        total: 0,
        coverage: 0,
        insights: []
      };
    }

    const uniquePanels = new Set(panels).size;
    const coverage = (uniquePanels / panels.length) * 100;

    const insights = [];
    if (coverage < 100) {
      insights.push(`${panels.length - uniquePanels} duplicate panel numbers detected`);
    }
    if (uniquePanels > 50) {
      insights.push(`Large dataset with ${uniquePanels} unique panels`);
    }

    return {
      total: uniquePanels,
      coverage,
      insights,
      totalProcessed: panels.length
    };
  }

  /**
   * Analyze file processing
   */
  async analyzeFileProcessing(fileMetadata) {
    if (!fileMetadata) {
      return {
        insights: ['No file metadata available'],
        recommendations: []
      };
    }

    const insights = [];
    const recommendations = [];

    // File size analysis
    if (fileMetadata.fileSize) {
      const sizeMB = fileMetadata.fileSize / (1024 * 1024);
      if (sizeMB > 10) {
        insights.push(`Large file processed: ${sizeMB.toFixed(2)}MB`);
        recommendations.push('Consider splitting large files for better performance');
      }
    }

    // File type analysis
    if (fileMetadata.fileType) {
      insights.push(`File type: ${fileMetadata.fileType}`);
      if (fileMetadata.fileType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        recommendations.push('Ensure Excel format for optimal processing');
      }
    }

    // Processing time analysis
    if (fileMetadata.processingTime) {
      insights.push(`Processing time: ${fileMetadata.processingTime}ms`);
      if (fileMetadata.processingTime > 10000) {
        recommendations.push('Consider optimizing file size for faster processing');
      }
    }

    return {
      insights,
      recommendations,
      fileSize: fileMetadata.fileSize,
      fileType: fileMetadata.fileType,
      processingTime: fileMetadata.processingTime
    };
  }

  /**
   * Analyze AI confidence
   */
  async analyzeConfidence(records) {
    if (!records || records.length === 0) {
      return {
        average: 0,
        distribution: {},
        insights: [],
        recommendations: []
      };
    }

    const confidences = records.map(r => r.ai_confidence || 0);
    const average = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;

    // Distribution analysis
    const distribution = {
      high: confidences.filter(c => c >= 0.8).length,
      medium: confidences.filter(c => c >= 0.5 && c < 0.8).length,
      low: confidences.filter(c => c < 0.5).length
    };

    const insights = [];
    const recommendations = [];

    if (average >= 0.9) {
      insights.push('Excellent AI confidence across all records');
    } else if (average >= 0.7) {
      insights.push('Good AI confidence with some variability');
    } else if (average >= 0.5) {
      insights.push('Moderate AI confidence - manual review recommended');
      recommendations.push('Review low-confidence records for accuracy');
    } else {
      insights.push('Low AI confidence - manual review required');
      recommendations.push('Consider improving data quality or file format');
    }

    if (distribution.low > 0) {
      insights.push(`${distribution.low} records have low confidence (<50%)`);
      recommendations.push('Focus on improving data quality for low-confidence records');
    }

    return {
      average,
      distribution,
      insights,
      recommendations,
      totalRecords: records.length
    };
  }

  /**
   * Generate recommendations
   */
  async generateRecommendations(importData) {
    const recommendations = [];
    const records = importData.records || [];
    const duplicates = importData.duplicates || [];
    const conflicts = importData.conflicts || [];

    // Duplicate recommendations
    if (duplicates.length > 0) {
      recommendations.push({
        type: 'duplicate',
        priority: 'high',
        message: `Review ${duplicates.length} duplicate records for potential data merge`,
        action: 'Review duplicates in the UI and decide on merge strategy'
      });
    }

    // Conflict recommendations
    if (conflicts.length > 0) {
      recommendations.push({
        type: 'conflict',
        priority: 'high',
        message: `Resolve ${conflicts.length} conflicts before proceeding`,
        action: 'Review conflicts and choose resolution strategy'
      });
    }

    // Data quality recommendations
    const avgConfidence = this.calculateAverageConfidence(records);
    if (avgConfidence < 0.8) {
      recommendations.push({
        type: 'quality',
        priority: 'medium',
        message: `Improve data quality (AI confidence: ${(avgConfidence * 100).toFixed(1)}%)`,
        action: 'Review low-confidence records and improve data format'
      });
    }

    // Performance recommendations
    if (records.length > 100) {
      recommendations.push({
        type: 'performance',
        priority: 'low',
        message: `Large dataset imported (${records.length} records)`,
        action: 'Consider pagination for better UI performance'
      });
    }

    return recommendations;
  }

  // Helper methods
  checkMissingFields(records) {
    const requiredFields = ['panelNumber', 'date', 'location'];
    const missingFields = [];

    records.forEach(record => {
      const mappedData = record.mapped_data || {};
      requiredFields.forEach(field => {
        if (!mappedData[field]) {
          missingFields.push(field);
        }
      });
    });

    return [...new Set(missingFields)];
  }

  checkDataConsistency(records) {
    const issues = [];
    
    // Check for consistent date formats
    const dates = records.map(r => r.mapped_data?.date).filter(Boolean);
    if (dates.length > 0) {
      const dateFormats = dates.map(d => typeof d);
      if (new Set(dateFormats).size > 1) {
        issues.push('Inconsistent date formats');
      }
    }

    // Check for consistent panel number formats
    const panelNumbers = records.map(r => r.mapped_data?.panelNumber).filter(Boolean);
    if (panelNumbers.length > 0) {
      const formats = panelNumbers.map(p => p.match(/^P\d+$/) ? 'standard' : 'non-standard');
      if (new Set(formats).size > 1) {
        issues.push('Inconsistent panel number formats');
      }
    }

    return issues;
  }

  calculateAverageConfidence(records) {
    if (!records || records.length === 0) return 0;
    
    const confidences = records.map(r => r.ai_confidence || 0);
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  buildSummaryPrompt(analysis, importData) {
    return `
    As an AI assistant, analyze this as-built data import process and provide a comprehensive summary:
    
    Import Statistics:
    - Total records processed: ${importData.records?.length || 0}
    - Duplicates found: ${importData.duplicates?.length || 0}
    - Conflicts detected: ${importData.conflicts?.length || 0}
    - Processing time: ${importData.processingTime || 0}ms
    - AI confidence: ${(analysis.confidenceAnalysis?.average || 0) * 100}%
    
    Data Quality Analysis:
    - Quality score: ${analysis.dataQuality?.score || 0}/100
    - Issues found: ${analysis.dataQuality?.issues?.length || 0}
    - Missing fields: ${analysis.dataQuality?.missingFields?.join(', ') || 'None'}
    
    Duplicate Analysis:
    ${analysis.duplicateAnalysis?.insights?.map(insight => `- ${insight}`).join('\n') || 'No duplicates found'}
    
    Panel Coverage:
    - Unique panels: ${analysis.panelCoverage?.total || 0}
    - Coverage: ${analysis.panelCoverage?.coverage?.toFixed(1) || 0}%
    
    File Processing:
    ${analysis.fileProcessing?.insights?.map(insight => `- ${insight}`).join('\n') || 'No file insights'}
    
    Please provide:
    1. A clear, professional summary of what was imported
    2. Specific details about any duplicates found (panel numbers, reasons)
    3. Data quality insights and potential issues
    4. Recommendations for data improvement
    5. Any anomalies or patterns detected
    6. Overall assessment of the import success
    
    Format your response as a structured analysis with clear sections and actionable insights.
    `;
  }

  getDefaultAnalysis() {
    return {
      summary: "Import analysis unavailable due to error",
      dataQuality: { score: 0, issues: [], averageConfidence: 0 },
      duplicateAnalysis: { patterns: {}, insights: [], recommendations: [] },
      panelCoverage: { total: 0, coverage: 0, insights: [] },
      fileProcessing: { insights: [], recommendations: [] },
      confidenceAnalysis: { average: 0, distribution: {}, insights: [] },
      recommendations: [],
      generatedAt: new Date().toISOString(),
      model: "error"
    };
  }
}

module.exports = ImportAnalysisService;
