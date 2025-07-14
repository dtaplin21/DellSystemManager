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
  async updateProjectContext(projectId, componentType, data, action) {
    try {
      // Invalidate cache
      this.contextCache.delete(projectId);
      
      // Update specific sections based on component type
      switch (componentType) {
        case 'documents':
          await this.updateDocuments(projectId, data, action);
          break;
        case 'panel_layout':
          await this.updatePanelLayout(projectId, data, action);
          break;
        case 'qc_data':
          await this.updateQCData(projectId, data, action);
          break;
        case 'project':
          await this.updateProject(projectId, data, action);
          break;
        default:
          console.warn(`Unknown component type: ${componentType}`);
      }
      
      // Refresh context
      return await this.getProjectContext(projectId);
    } catch (error) {
      console.error('Error updating project context:', error);
      throw error;
    }
  }

  /**
   * Update documents for a project
   */
  async updateDocuments(projectId, data, action) {
    try {
      switch (action) {
        case 'add':
          // Add new document
          await db.insert(documents).values({
            projectId,
            name: data.name,
            type: data.type,
            size: data.size,
            path: data.path,
            uploadedAt: new Date(),
            uploadedBy: data.uploadedBy
          });
          break;
        case 'update':
          // Update existing document
          await db.update(documents)
            .set({
              name: data.name,
              type: data.type,
              size: data.size,
              path: data.path
            })
            .where(eq(documents.id, data.id));
          break;
        case 'delete':
          // Delete document
          await db.delete(documents)
            .where(eq(documents.id, data.id));
          break;
        default:
          console.warn(`Unknown action for documents: ${action}`);
      }
    } catch (error) {
      console.error('Error updating documents:', error);
      throw error;
    }
  }

  /**
   * Update panel layout for a project
   */
  async updatePanelLayout(projectId, data, action) {
    try {
      switch (action) {
        case 'create':
        case 'update':
          // Insert or update panel layout
          await db.insert(panels).values({
            projectId,
            panels: JSON.stringify(data.panels),
            width: data.width,
            height: data.height,
            scale: data.scale || 1,
            lastUpdated: new Date()
          }).onConflictDoUpdate({
            target: panels.projectId,
            set: {
              panels: JSON.stringify(data.panels),
              width: data.width,
              height: data.height,
              scale: data.scale || 1,
              lastUpdated: new Date()
            }
          });
          break;
        case 'delete':
          // Delete panel layout
          await db.delete(panels)
            .where(eq(panels.projectId, projectId));
          break;
        default:
          console.warn(`Unknown action for panel layout: ${action}`);
      }
    } catch (error) {
      console.error('Error updating panel layout:', error);
      throw error;
    }
  }

  /**
   * Update QC data for a project
   */
  async updateQCData(projectId, data, action) {
    try {
      switch (action) {
        case 'add':
          // Add new QC record
          await db.insert(qcData).values({
            projectId,
            type: data.type,
            panelId: data.panelId,
            date: data.date,
            result: data.result,
            technician: data.technician,
            temperature: data.temperature,
            pressure: data.pressure,
            speed: data.speed,
            notes: data.notes,
            createdAt: new Date(),
            createdBy: data.createdBy
          });
          break;
        case 'update':
          // Update existing QC record
          await db.update(qcData)
            .set({
              type: data.type,
              panelId: data.panelId,
              date: data.date,
              result: data.result,
              technician: data.technician,
              temperature: data.temperature,
              pressure: data.pressure,
              speed: data.speed,
              notes: data.notes
            })
            .where(eq(qcData.id, data.id));
          break;
        case 'delete':
          // Delete QC record
          await db.delete(qcData)
            .where(eq(qcData.id, data.id));
          break;
        default:
          console.warn(`Unknown action for QC data: ${action}`);
      }
    } catch (error) {
      console.error('Error updating QC data:', error);
      throw error;
    }
  }

  /**
   * Update project information
   */
  async updateProject(projectId, data, action) {
    try {
      switch (action) {
        case 'update':
          // Update project details
          await db.update(projects)
            .set({
              name: data.name,
              description: data.description,
              location: data.location,
              status: data.status,
              startDate: data.startDate,
              endDate: data.endDate,
              area: data.area,
              progress: data.progress,
              scale: data.scale,
              layoutWidth: data.layoutWidth,
              layoutHeight: data.layoutHeight,
              updatedAt: new Date()
            })
            .where(eq(projects.id, projectId));
          break;
        default:
          console.warn(`Unknown action for project: ${action}`);
      }
    } catch (error) {
      console.error('Error updating project:', error);
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
      
      // Store AI insights in memory cache (since they're not persisted to DB yet)
      this.contextCache.set(projectId, context);
      
      return context;
    } catch (error) {
      console.error('Error adding AI insight:', error);
      throw error;
    }
  }

  /**
   * Get AI insights for a project
   */
  async getAIInsights(projectId) {
    try {
      const context = await this.getProjectContext(projectId);
      return context.aiInsights;
    } catch (error) {
      console.error('Error getting AI insights:', error);
      throw error;
    }
  }

  /**
   * Get specific AI insight type
   */
  async getAIInsight(projectId, insightType) {
    try {
      const context = await this.getProjectContext(projectId);
      return context.aiInsights[insightType] || [];
    } catch (error) {
      console.error('Error getting AI insight:', error);
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