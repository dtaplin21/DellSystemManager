const { db } = require('../db/connection');
const { projects, documents, panels, qcData } = require('../db/schema');
const { eq } = require('drizzle-orm');

class ProjectContextStore {
  constructor() {
    this.contextCache = new Map(); // In-memory cache for active projects
  }

  /**
   * Get comprehensive project context for AI workflows
   */
  async getProjectContext(projectId) {
    try {
      // Check cache first
      if (this.contextCache.has(projectId)) {
        return this.contextCache.get(projectId);
      }

      // Fetch all project data
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

      if (!project) {
        throw new Error('Project not found');
      }

      // Fetch related documents
      const documents = await db
        .select()
        .from(documents)
        .where(eq(documents.projectId, projectId));

      // Fetch panel layout
      const [panelLayout] = await db
        .select()
        .from(panels)
        .where(eq(panels.projectId, projectId));

      // Fetch QC data
      const qcRecords = await db
        .select()
        .from(qcData)
        .where(eq(qcData.projectId, projectId));

      // Build comprehensive context
      const context = {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          siteDimensions: project.siteDimensions,
          materialSpecs: project.materialSpecs,
          constraints: project.constraints,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        },
        documents: documents.map(doc => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          content: doc.text,
          extractedData: doc.extractedData,
          analysis: doc.analysis,
          uploadedAt: doc.uploadedAt
        })),
        panelLayout: panelLayout ? {
          id: panelLayout.id,
          panels: JSON.parse(panelLayout.panels || '[]'),
          width: panelLayout.width,
          height: panelLayout.height,
          optimizationHistory: JSON.parse(panelLayout.optimizationHistory || '[]'),
          lastOptimized: panelLayout.lastOptimized
        } : null,
        qcData: qcRecords.map(qc => ({
          id: qc.id,
          panelId: qc.panelId,
          testType: qc.testType,
          testValue: qc.testValue,
          result: qc.result,
          date: qc.testDate,
          operator: qc.operator,
          notes: qc.notes
        })),
        aiInsights: {
          documentAnalysis: [],
          panelRecommendations: [],
          qcPatterns: [],
          projectRecommendations: []
        },
        lastUpdated: new Date().toISOString()
      };

      // Cache the context
      this.contextCache.set(projectId, context);
      
      return context;
    } catch (error) {
      console.error('Error getting project context:', error);
      throw error;
    }
  }

  /**
   * Update project context when data changes
   */
  async updateProjectContext(projectId, updates) {
    try {
      // Invalidate cache
      this.contextCache.delete(projectId);
      
      // Update specific sections
      if (updates.documents) {
        await this.updateDocuments(projectId, updates.documents);
      }
      
      if (updates.panelLayout) {
        await this.updatePanelLayout(projectId, updates.panelLayout);
      }
      
      if (updates.qcData) {
        await this.updateQCData(projectId, updates.qcData);
      }
      
      if (updates.aiInsights) {
        await this.updateAIInsights(projectId, updates.aiInsights);
      }
      
      // Refresh context
      return await this.getProjectContext(projectId);
    } catch (error) {
      console.error('Error updating project context:', error);
      throw error;
    }
  }

  /**
   * Add AI insights to project context
   */
  async addAIInsight(projectId, insightType, insight) {
    try {
      const context = await this.getProjectContext(projectId);
      
      if (!context.aiInsights[insightType]) {
        context.aiInsights[insightType] = [];
      }
      
      context.aiInsights[insightType].push({
        ...insight,
        timestamp: new Date().toISOString(),
        id: Date.now().toString()
      });
      
      await this.updateProjectContext(projectId, { aiInsights: context.aiInsights });
      
      return context;
    } catch (error) {
      console.error('Error adding AI insight:', error);
      throw error;
    }
  }

  /**
   * Get cross-component insights
   */
  async getCrossComponentInsights(projectId) {
    try {
      const context = await this.getProjectContext(projectId);
      
      const insights = {
        documentToPanel: this.analyzeDocumentPanelRelationships(context),
        qcToPanel: this.analyzeQCPanelRelationships(context),
        optimizationOpportunities: this.identifyOptimizationOpportunities(context),
        dataGaps: this.identifyDataGaps(context),
        recommendations: this.generateCrossComponentRecommendations(context)
      };
      
      return insights;
    } catch (error) {
      console.error('Error getting cross-component insights:', error);
      throw error;
    }
  }

  /**
   * Analyze relationships between documents and panel layout
   */
  analyzeDocumentPanelRelationships(context) {
    const insights = [];
    
    // Check if documents contain panel specifications
    const panelSpecs = context.documents.filter(doc => 
      doc.content?.toLowerCase().includes('panel') || 
      doc.extractedData?.panels
    );
    
    if (panelSpecs.length > 0 && context.panelLayout) {
      insights.push({
        type: 'document_panel_alignment',
        message: `${panelSpecs.length} documents contain panel specifications that can inform layout optimization`,
        documents: panelSpecs.map(doc => doc.id),
        panels: context.panelLayout.panels.length
      });
    }
    
    return insights;
  }

  /**
   * Analyze relationships between QC data and panel layout
   */
  analyzeQCPanelRelationships(context) {
    const insights = [];
    
    if (context.qcData.length > 0 && context.panelLayout) {
      // Find panels with QC issues
      const panelsWithIssues = context.qcData
        .filter(qc => qc.result === 'FAIL')
        .map(qc => qc.panelId);
      
      if (panelsWithIssues.length > 0) {
        insights.push({
          type: 'qc_panel_issues',
          message: `${panelsWithIssues.length} panels have QC failures that may require layout adjustments`,
          affectedPanels: panelsWithIssues,
          recommendations: ['Review panel placement', 'Consider material changes', 'Adjust installation sequence']
        });
      }
    }
    
    return insights;
  }

  /**
   * Identify optimization opportunities across components
   */
  identifyOptimizationOpportunities(context) {
    const opportunities = [];
    
    // Check if we have enough data for optimization
    if (context.documents.length > 0 && context.panelLayout) {
      opportunities.push({
        type: 'layout_optimization',
        priority: 'high',
        message: 'Sufficient data available for AI-powered panel layout optimization',
        dataPoints: {
          documents: context.documents.length,
          panels: context.panelLayout.panels.length,
          qcRecords: context.qcData.length
        }
      });
    }
    
    // Check for document analysis opportunities
    if (context.documents.length > 0 && context.aiInsights.documentAnalysis.length === 0) {
      opportunities.push({
        type: 'document_analysis',
        priority: 'medium',
        message: 'Documents available for AI analysis to extract specifications and requirements'
      });
    }
    
    return opportunities;
  }

  /**
   * Identify data gaps that could improve AI insights
   */
  identifyDataGaps(context) {
    const gaps = [];
    
    if (!context.panelLayout) {
      gaps.push({
        type: 'missing_panel_layout',
        message: 'No panel layout data available for optimization',
        impact: 'Cannot perform layout optimization or QC analysis'
      });
    }
    
    if (context.qcData.length === 0) {
      gaps.push({
        type: 'missing_qc_data',
        message: 'No QC data available for quality analysis',
        impact: 'Cannot identify patterns or issues in quality control'
      });
    }
    
    return gaps;
  }

  /**
   * Generate cross-component recommendations
   */
  generateCrossComponentRecommendations(context) {
    const recommendations = [];
    
    // If we have documents but no analysis
    if (context.documents.length > 0 && context.aiInsights.documentAnalysis.length === 0) {
      recommendations.push({
        type: 'analyze_documents',
        priority: 'high',
        message: 'Run AI document analysis to extract specifications and requirements',
        action: 'document_analysis',
        data: { documentIds: context.documents.map(d => d.id) }
      });
    }
    
    // If we have panel layout but no optimization
    if (context.panelLayout && context.aiInsights.panelRecommendations.length === 0) {
      recommendations.push({
        type: 'optimize_layout',
        priority: 'medium',
        message: 'Run AI panel layout optimization for better efficiency',
        action: 'panel_optimization',
        data: { panelLayout: context.panelLayout }
      });
    }
    
    // If we have QC data but no pattern analysis
    if (context.qcData.length > 0 && context.aiInsights.qcPatterns.length === 0) {
      recommendations.push({
        type: 'analyze_qc_patterns',
        priority: 'medium',
        message: 'Run AI QC analysis to identify patterns and issues',
        action: 'qc_analysis',
        data: { qcData: context.qcData }
      });
    }
    
    return recommendations;
  }

  /**
   * Clear cache for a project
   */
  clearProjectCache(projectId) {
    this.contextCache.delete(projectId);
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.contextCache.clear();
  }
}

module.exports = new ProjectContextStore(); 