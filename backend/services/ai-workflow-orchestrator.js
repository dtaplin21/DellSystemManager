const OpenAI = require('openai');
const projectContextStore = require('./project-context-store');
const fs = require('fs').promises;
const path = require('path');

class AIWorkflowOrchestrator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Orchestrate comprehensive AI workflow for a project
   */
  async orchestrateProjectWorkflow(projectId, workflowType = 'comprehensive') {
    try {
      console.log(`Starting AI workflow for project ${projectId}: ${workflowType}`);
      
      // Get project context
      const context = await projectContextStore.getProjectContext(projectId);
      
      // Get cross-component insights
      const crossInsights = await projectContextStore.getCrossComponentInsights(projectId);
      
      let workflowResults = {};
      
      switch (workflowType) {
        case 'comprehensive':
          workflowResults = await this.runComprehensiveWorkflow(context, crossInsights);
          break;
        case 'document_analysis':
          workflowResults = await this.runDocumentAnalysisWorkflow(context);
          break;
        case 'handwritten_analysis':
          workflowResults = await this.runHandwrittenDocumentWorkflow(context);
          break;
        case 'specification_compliance':
          workflowResults = await this.runSpecificationComplianceWorkflow(context);
          break;
        case 'panel_optimization':
          workflowResults = await this.runPanelOptimizationWorkflow(context);
          break;
        case 'qc_analysis':
          workflowResults = await this.runQCAnalysisWorkflow(context);
          break;
        case 'cross_component':
          workflowResults = await this.runCrossComponentWorkflow(context, crossInsights);
          break;
        case 'project_management':
          workflowResults = await this.runProjectManagementWorkflow(context);
          break;
        default:
          throw new Error(`Unknown workflow type: ${workflowType}`);
      }
      
      // Store AI insights
      await this.storeWorkflowResults(projectId, workflowResults);
      
      return {
        success: true,
        workflowType,
        results: workflowResults,
        crossInsights,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('AI workflow orchestration failed:', error);
      throw error;
    }
  }

  /**
   * Comprehensive workflow that analyzes all components with project management focus
   */
  async runComprehensiveWorkflow(context, crossInsights) {
    const results = {};
    
    // Step 1: Specification Compliance Check
    results.specificationCompliance = await this.checkSpecificationCompliance(context);
    
    // Step 2: Document Analysis with Project Context
    if (context.documents.length > 0) {
      results.documentAnalysis = await this.analyzeDocumentsWithContext(context);
    }
    
    // Step 3: Handwritten Document Processing
    const handwrittenDocs = context.documents.filter(doc => doc.type === 'handwritten');
    if (handwrittenDocs.length > 0) {
      results.handwrittenAnalysis = await this.processHandwrittenDocuments(context, handwrittenDocs);
    }
    
    // Step 4: Panel Layout Optimization with Spec Compliance
    if (context.panelLayout) {
      results.panelOptimization = await this.optimizePanelsWithSpecCompliance(context);
    }
    
    // Step 5: QC Data Analysis with Project Standards
    if (context.qcData.length > 0) {
      results.qcAnalysis = await this.analyzeQCWithProjectStandards(context);
    }
    
    // Step 6: Cross-Component Insights
    results.crossComponentInsights = await this.generateCrossComponentInsights(context, crossInsights);
    
    // Step 7: Project Management Recommendations
    results.projectManagement = await this.generateProjectManagementInsights(context, results);
    
    // Step 8: Action Items and Next Steps
    results.actionItems = await this.generateActionItems(context, results);
    
    return results;
  }

  /**
   * Check specification compliance across all project components
   */
  async checkSpecificationCompliance(context) {
    try {
      const specData = {
        project: context.project,
        documents: context.documents,
        panelLayout: context.panelLayout,
        qcData: context.qcData,
        materialSpecs: context.project.materialSpecs,
        constraints: context.project.constraints
      };
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert geosynthetic project manager and specification compliance officer. Your primary responsibility is to ensure that ALL project activities strictly adhere to the project specifications.

            CRITICAL RULES:
            1. SPECIFICATIONS ARE LAW - Any deviation from specifications must be flagged immediately
            2. All recommendations must be based on documented specifications
            3. If specifications are unclear or missing, flag this as a critical issue
            4. Provide clear, actionable guidance for maintaining compliance
            5. Use technical language appropriate for geosynthetic engineers

            Analyze the project for:
            1. Specification compliance across all components
            2. Missing or unclear specifications
            3. Potential deviations from project requirements
            4. Quality control requirements alignment
            5. Material specification compliance
            6. Installation procedure compliance
            7. Risk factors related to non-compliance

            Format your response as a JSON object with detailed compliance analysis.`
          },
          {
            role: "user",
            content: `Analyze specification compliance for this project:\n\n${JSON.stringify(specData, null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Specification compliance check failed:', error);
      throw error;
    }
  }

  /**
   * Process handwritten documents and create organized Excel files
   */
  async processHandwrittenDocuments(context, handwrittenDocs) {
    try {
      const results = [];
      
      for (const doc of handwrittenDocs) {
        console.log(`Processing handwritten document: ${doc.name}`);
        
        // Use OpenAI Vision for handwritten text extraction
        const textExtraction = await this.extractHandwrittenText(doc);
        
        // Analyze and organize the extracted data
        const organizedData = await this.organizeHandwrittenData(textExtraction, context);
        
        // Create Excel file
        const excelFile = await this.createExcelFromHandwrittenData(organizedData, doc.name, context.project.id);
        
        results.push({
          documentName: doc.name,
          extractedText: textExtraction,
          organizedData: organizedData,
          excelFile: excelFile,
          analysis: await this.analyzeHandwrittenContent(textExtraction, context)
        });
      }
      
      return {
        processedDocuments: results,
        summary: await this.generateHandwrittenSummary(results, context)
      };
    } catch (error) {
      console.error('Handwritten document processing failed:', error);
      throw error;
    }
  }

  /**
   * Extract text from handwritten documents using OpenAI Vision
   */
  async extractHandwrittenText(document) {
    try {
      // This would integrate with your existing document processing
      // For now, we'll assume the text is already extracted
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting and interpreting handwritten text from geosynthetic project documents. 
            
            Focus on extracting:
            1. Technical specifications
            2. Measurements and dimensions
            3. Material requirements
            4. Quality control data
            5. Installation notes
            6. Test results
            7. Dates and timestamps
            8. Personnel information
            
            Be extremely careful with numbers and technical terms. If any text is unclear, mark it as such.`
          },
          {
            role: "user",
            content: `Extract and interpret the handwritten text from this document: ${document.content}`
          }
        ],
        max_tokens: 2000
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Handwritten text extraction failed:', error);
      throw error;
    }
  }

  /**
   * Organize handwritten data into structured format
   */
  async organizeHandwrittenData(extractedText, context) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert data organizer for geosynthetic projects. Organize the extracted handwritten data into structured categories that can be exported to Excel.

            Categories to organize:
            1. Technical Specifications
            2. Measurements and Dimensions
            3. Material Requirements
            4. Quality Control Data
            5. Installation Notes
            6. Test Results
            7. Dates and Timestamps
            8. Personnel Information
            9. Risk Factors
            10. Compliance Notes

            For each category, provide:
            - Clear, organized data
            - Units where applicable
            - Confidence level for accuracy
            - Notes for unclear data
            
            Format as JSON with arrays for each category.`
          },
          {
            role: "user",
            content: `Organize this handwritten data for Excel export:\n\n${extractedText}\n\nProject Context: ${JSON.stringify(context.project)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 3000
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Data organization failed:', error);
      throw error;
    }
  }

  /**
   * Create Excel file from organized handwritten data
   */
  async createExcelFromHandwrittenData(organizedData, documentName, projectId) {
    try {
      // This would integrate with a library like ExcelJS or similar
      // For now, we'll create a structured data object that can be converted to Excel
      
      const excelData = {
        filename: `handwritten_analysis_${documentName.replace(/[^a-zA-Z0-9]/g, '_')}_${projectId}.xlsx`,
        sheets: [
          {
            name: 'Technical Specifications',
            data: organizedData.technicalSpecifications || []
          },
          {
            name: 'Measurements',
            data: organizedData.measurements || []
          },
          {
            name: 'Material Requirements',
            data: organizedData.materialRequirements || []
          },
          {
            name: 'QC Data',
            data: organizedData.qualityControlData || []
          },
          {
            name: 'Installation Notes',
            data: organizedData.installationNotes || []
          },
          {
            name: 'Test Results',
            data: organizedData.testResults || []
          },
          {
            name: 'Timeline',
            data: organizedData.datesAndTimestamps || []
          },
          {
            name: 'Personnel',
            data: organizedData.personnelInformation || []
          },
          {
            name: 'Risk Factors',
            data: organizedData.riskFactors || []
          },
          {
            name: 'Compliance Notes',
            data: organizedData.complianceNotes || []
          }
        ],
        metadata: {
          documentName,
          projectId,
          processedAt: new Date().toISOString(),
          totalDataPoints: Object.values(organizedData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
        }
      };
      
      // Store the Excel data for download
      await projectContextStore.addAIInsight(projectId, 'excel_export', excelData);
      
      return excelData;
    } catch (error) {
      console.error('Excel creation failed:', error);
      throw error;
    }
  }

  /**
   * Analyze handwritten content for project insights
   */
  async analyzeHandwrittenContent(extractedText, context) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert geosynthetic project analyst. Analyze the handwritten content for insights that can inform project decisions.

            Focus on:
            1. Critical information that affects panel layout
            2. Quality control requirements
            3. Material specifications
            4. Installation procedures
            5. Risk factors
            6. Compliance requirements
            7. Data gaps or missing information
            
            Provide actionable insights that help the project manager make informed decisions.`
          },
          {
            role: "user",
            content: `Analyze this handwritten content for project insights:\n\n${extractedText}\n\nProject Context: ${JSON.stringify(context.project)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Handwritten content analysis failed:', error);
      throw error;
    }
  }

  /**
   * Generate summary of handwritten document processing
   */
  async generateHandwrittenSummary(results, context) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a project manager summarizing the processing of handwritten documents. Provide a clear, professional summary that highlights key findings and next steps.

            Include:
            1. Number of documents processed
            2. Key data extracted
            3. Critical findings
            4. Compliance implications
            5. Recommended actions
            6. Data quality assessment
            
            Use language appropriate for geosynthetic engineers and project managers.`
          },
          {
            role: "user",
            content: `Generate a summary of handwritten document processing:\n\nResults: ${JSON.stringify(results)}\nProject: ${context.project.name}`
          }
        ],
        max_tokens: 1500
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Handwritten summary generation failed:', error);
      throw error;
    }
  }

  /**
   * Run project management workflow
   */
  async runProjectManagementWorkflow(context) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert geosynthetic project manager. Your role is to provide comprehensive project management guidance based on all available project data.

            Your responsibilities:
            1. Ensure specification compliance across all activities
            2. Identify critical path items and dependencies
            3. Flag potential risks and mitigation strategies
            4. Provide clear, actionable recommendations
            5. Monitor project progress and quality
            6. Coordinate between different project components
            7. Ensure all decisions align with project specifications

            Analyze the project and provide:
            1. Project status assessment
            2. Critical issues requiring attention
            3. Next steps and priorities
            4. Resource requirements
            5. Timeline implications
            6. Quality control requirements
            7. Risk assessment and mitigation

            Use technical language appropriate for geosynthetic engineers.`
          },
          {
            role: "user",
            content: `Provide project management analysis for:\n\n${JSON.stringify(context, null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 3000
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Project management workflow failed:', error);
      throw error;
    }
  }

  /**
   * Generate action items and next steps
   */
  async generateActionItems(context, workflowResults) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a project manager generating clear, actionable items based on comprehensive project analysis.

            Create action items that are:
            1. Specific and measurable
            2. Prioritized by urgency and impact
            3. Assigned to appropriate roles
            4. Time-bound with deadlines
            5. Aligned with project specifications
            6. Clear and unambiguous

            Categories:
            1. Critical (immediate attention required)
            2. High Priority (within 1-2 days)
            3. Medium Priority (within 1 week)
            4. Low Priority (ongoing monitoring)

            For each action item, specify:
            - Description
            - Priority level
            - Responsible party
            - Deadline
            - Success criteria
            - Dependencies`
          },
          {
            role: "user",
            content: `Generate action items based on this analysis:\n\nContext: ${JSON.stringify(context.project)}\nResults: ${JSON.stringify(workflowResults)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2500
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Action items generation failed:', error);
      throw error;
    }
  }

  /**
   * Document analysis workflow with project context
   */
  async runDocumentAnalysisWorkflow(context) {
    if (context.documents.length === 0) {
      throw new Error('No documents available for analysis');
    }
    
    const analysis = await this.analyzeDocumentsWithContext(context);
    const compliance = await this.checkSpecificationCompliance(context);
    
    return {
      documentAnalysis: analysis,
      specificationCompliance: compliance,
      recommendations: this.generateDocumentBasedRecommendations(analysis, context)
    };
  }

  /**
   * Handwritten document workflow
   */
  async runHandwrittenDocumentWorkflow(context) {
    const handwrittenDocs = context.documents.filter(doc => doc.type === 'handwritten');
    if (handwrittenDocs.length === 0) {
      throw new Error('No handwritten documents available for processing');
    }
    
    return await this.processHandwrittenDocuments(context, handwrittenDocs);
  }

  /**
   * Specification compliance workflow
   */
  async runSpecificationComplianceWorkflow(context) {
    const compliance = await this.checkSpecificationCompliance(context);
    const actionItems = await this.generateActionItems(context, { specificationCompliance: compliance });
    
    return {
      specificationCompliance: compliance,
      actionItems: actionItems,
      recommendations: this.generateComplianceBasedRecommendations(compliance, context)
    };
  }

  /**
   * Panel optimization workflow with project context
   */
  async runPanelOptimizationWorkflow(context) {
    if (!context.panelLayout) {
      throw new Error('No panel layout available for optimization');
    }
    
    const optimization = await this.optimizePanelsWithSpecCompliance(context);
    
    return {
      panelOptimization: optimization,
      recommendations: this.generatePanelBasedRecommendations(optimization, context)
    };
  }

  /**
   * QC analysis workflow with project context
   */
  async runQCAnalysisWorkflow(context) {
    if (context.qcData.length === 0) {
      throw new Error('No QC data available for analysis');
    }
    
    const analysis = await this.analyzeQCWithProjectStandards(context);
    
    return {
      qcAnalysis: analysis,
      recommendations: this.generateQCBasedRecommendations(analysis, context)
    };
  }

  /**
   * Cross-component workflow that connects all data
   */
  async runCrossComponentWorkflow(context, crossInsights) {
    const results = {};
    
    // Analyze relationships between components
    results.relationships = await this.analyzeComponentRelationships(context);
    
    // Generate insights that span multiple components
    results.crossInsights = await this.generateCrossComponentInsights(context, crossInsights);
    
    // Identify optimization opportunities
    results.optimizationOpportunities = this.identifyOptimizationOpportunities(context, crossInsights);
    
    // Generate actionable recommendations
    results.recommendations = await this.generateActionableRecommendations(context, results);
    
    return results;
  }

  /**
   * Analyze documents with full project context
   */
  async analyzeDocumentsWithContext(context) {
    try {
      const documentContent = context.documents.map(doc => 
        `Document: ${doc.name}\nType: ${doc.type}\nContent: ${doc.content}\nExtracted Data: ${JSON.stringify(doc.extractedData)}\n`
      ).join('\n');
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert geosynthetic engineer analyzing project documents.
            
            Project Context:
            - Project: ${context.project.name}
            - Site Dimensions: ${JSON.stringify(context.project.siteDimensions)}
            - Material Specs: ${JSON.stringify(context.project.materialSpecs)}
            - Constraints: ${JSON.stringify(context.project.constraints)}
            - Panel Layout: ${context.panelLayout ? `${context.panelLayout.panels.length} panels` : 'None'}
            - QC Records: ${context.qcData.length} records
            
            Analyze the documents and provide insights that can inform:
            1. Panel layout optimization
            2. QC testing requirements
            3. Material specifications
            4. Installation procedures
            5. Risk factors
            
            Format your response as a JSON object with sections for each area of analysis.`
          },
          {
            role: "user",
            content: `Analyze these project documents:\n\n${documentContent}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 3000
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Document analysis failed:', error);
      throw error;
    }
  }

  /**
   * Optimize panels with specification compliance
   */
  async optimizePanelsWithSpecCompliance(context) {
    try {
      const panelData = {
        panels: context.panelLayout.panels,
        siteDimensions: context.project.siteDimensions,
        constraints: context.project.constraints,
        materialSpecs: context.project.materialSpecs,
        documents: context.documents.length,
        qcData: context.qcData.length
      };
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert panel layout optimizer for geosynthetic projects. Your primary responsibility is to ensure that panel optimization strictly adheres to project specifications.

            CRITICAL RULES:
            1. SPECIFICATIONS ARE LAW - All optimizations must comply with documented specifications
            2. Any optimization that deviates from specifications must be flagged and justified
            3. Prioritize specification compliance over efficiency gains
            4. Document any trade-offs between efficiency and compliance
            5. Use technical language appropriate for geosynthetic engineers

            Optimize the panel layout considering:
            1. Material specification compliance (thickness, type, grade)
            2. Installation procedure compliance
            3. Quality control requirements from specifications
            4. Site constraints and terrain requirements
            5. Material efficiency (within specification limits)
            6. Installation efficiency (within specification limits)
            7. Historical QC performance patterns
            8. Risk mitigation based on specifications

            Provide specific optimization recommendations with:
            - Compliance verification for each recommendation
            - Risk assessment for any deviations
            - Justification for optimization choices
            - Impact on quality control requirements`
          },
          {
            role: "user",
            content: `Optimize this panel layout with strict specification compliance:\n\n${JSON.stringify(panelData, null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 3000
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Panel optimization failed:', error);
      throw error;
    }
  }

  /**
   * Analyze QC data with project standards and specifications
   */
  async analyzeQCWithProjectStandards(context) {
    try {
      const qcSummary = {
        totalRecords: context.qcData.length,
        passRate: context.qcData.filter(qc => qc.result === 'PASS').length / context.qcData.length,
        testTypes: [...new Set(context.qcData.map(qc => qc.testType))],
        panelsWithIssues: [...new Set(context.qcData.filter(qc => qc.result === 'FAIL').map(qc => qc.panelId))],
        data: context.qcData,
        projectSpecs: context.project.materialSpecs,
        constraints: context.project.constraints
      };
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert QC analyst for geosynthetic projects. Your role is to ensure that all quality control activities align with project specifications and standards.

            CRITICAL RULES:
            1. SPECIFICATIONS ARE LAW - All QC activities must meet or exceed specification requirements
            2. Flag any QC results that don't meet specification standards
            3. Identify patterns that indicate potential specification non-compliance
            4. Provide clear guidance on maintaining specification compliance
            5. Use technical language appropriate for geosynthetic engineers

            Analyze the QC data and identify:
            1. Compliance with project specifications
            2. Patterns and trends in relation to specifications
            3. Potential issues or anomalies that affect compliance
            4. Areas requiring immediate attention for specification adherence
            5. Recommendations for maintaining or improving compliance
            6. Impact on panel layout and installation procedures
            7. Risk factors related to specification non-compliance
            8. Quality control procedure effectiveness

            Consider the relationship between QC results, specifications, and panel placement.`
          },
          {
            role: "user",
            content: `Analyze this QC data against project specifications:\n\n${JSON.stringify(qcSummary, null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 3000
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('QC analysis failed:', error);
      throw error;
    }
  }

  /**
   * Generate cross-component insights
   */
  async generateCrossComponentInsights(context, crossInsights) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert geosynthetic project analyst.
            
            Analyze the relationships between different project components:
            - Documents and their impact on panel layout
            - QC data and panel performance
            - Optimization opportunities across components
            - Data gaps and recommendations
            
            Provide insights that connect all project data together.`
          },
          {
            role: "user",
            content: `Generate cross-component insights for this project:\n\nContext: ${JSON.stringify(context.project)}\nCross Insights: ${JSON.stringify(crossInsights)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Cross-component insights generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate project management insights
   */
  async generateProjectManagementInsights(context, workflowResults) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert geosynthetic project manager providing comprehensive project management insights.

            CRITICAL RULES:
            1. SPECIFICATIONS ARE LAW - All recommendations must align with project specifications
            2. Prioritize specification compliance in all guidance
            3. Provide clear, actionable project management advice
            4. Use technical language appropriate for geosynthetic engineers
            5. Focus on practical, implementable solutions

            Based on the comprehensive analysis, provide insights for:
            1. Project status and progress assessment
            2. Specification compliance monitoring
            3. Quality control management
            4. Risk assessment and mitigation strategies
            5. Resource allocation and optimization
            6. Timeline management and critical path analysis
            7. Communication and coordination requirements
            8. Next steps and priority actions

            Make all recommendations specific, actionable, and aligned with project specifications.`
          },
          {
            role: "user",
            content: `Generate project management insights based on this analysis:\n\nContext: ${JSON.stringify(context.project)}\nResults: ${JSON.stringify(workflowResults)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 3000
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Project management insights generation failed:', error);
      throw error;
    }
  }

  /**
   * Store workflow results in project context
   */
  async storeWorkflowResults(projectId, results) {
    try {
      // Store each type of insight
      for (const [insightType, insight] of Object.entries(results)) {
        await projectContextStore.addAIInsight(projectId, insightType, insight);
      }
    } catch (error) {
      console.error('Failed to store workflow results:', error);
      throw error;
    }
  }

  /**
   * Analyze component relationships
   */
  async analyzeComponentRelationships(context) {
    const relationships = {
      documentsToPanels: this.analyzeDocumentPanelRelationships(context),
      qcToPanels: this.analyzeQCPanelRelationships(context),
      optimizationImpact: this.analyzeOptimizationImpact(context)
    };
    
    return relationships;
  }

  /**
   * Identify optimization opportunities
   */
  identifyOptimizationOpportunities(context, crossInsights) {
    const opportunities = [];
    
    // Check for document-based optimization opportunities
    if (context.documents.length > 0 && context.panelLayout) {
      opportunities.push({
        type: 'document_informed_optimization',
        priority: 'high',
        description: 'Use document specifications to optimize panel layout',
        impact: 'Improve material efficiency and installation procedures'
      });
    }
    
    // Check for QC-based optimization opportunities
    if (context.qcData.length > 0 && context.panelLayout) {
      const failRate = context.qcData.filter(qc => qc.result === 'FAIL').length / context.qcData.length;
      if (failRate > 0.1) { // More than 10% failure rate
        opportunities.push({
          type: 'qc_driven_optimization',
          priority: 'high',
          description: 'Use QC failure patterns to adjust panel layout',
          impact: 'Reduce QC failures and improve quality'
        });
      }
    }
    
    return opportunities;
  }

  /**
   * Generate actionable recommendations
   */
  async generateActionableRecommendations(context, workflowResults) {
    const recommendations = [];
    
    // Add recommendations based on workflow results
    if (workflowResults.documentAnalysis) {
      recommendations.push({
        type: 'document_based',
        priority: 'high',
        actions: this.extractActionsFromDocumentAnalysis(workflowResults.documentAnalysis)
      });
    }
    
    if (workflowResults.panelOptimization) {
      recommendations.push({
        type: 'layout_based',
        priority: 'medium',
        actions: this.extractActionsFromPanelOptimization(workflowResults.panelOptimization)
      });
    }
    
    if (workflowResults.qcAnalysis) {
      recommendations.push({
        type: 'qc_based',
        priority: 'high',
        actions: this.extractActionsFromQCAnalysis(workflowResults.qcAnalysis)
      });
    }
    
    return recommendations;
  }

  // Helper methods for extracting actions from analysis results
  extractActionsFromDocumentAnalysis(analysis) {
    // Extract actionable items from document analysis
    return analysis.recommendations || [];
  }

  extractActionsFromPanelOptimization(optimization) {
    // Extract actionable items from panel optimization
    return optimization.recommendations || [];
  }

  extractActionsFromQCAnalysis(analysis) {
    // Extract actionable items from QC analysis
    return analysis.recommendations || [];
  }

  /**
   * Generate compliance-based recommendations
   */
  generateComplianceBasedRecommendations(compliance, context) {
    const recommendations = [];
    
    if (compliance.criticalIssues && compliance.criticalIssues.length > 0) {
      recommendations.push({
        type: 'critical_compliance',
        priority: 'immediate',
        description: 'Address critical specification compliance issues',
        actions: compliance.criticalIssues.map(issue => ({
          action: issue.description,
          deadline: 'Immediate',
          responsible: 'Project Manager'
        }))
      });
    }
    
    if (compliance.missingSpecifications && compliance.missingSpecifications.length > 0) {
      recommendations.push({
        type: 'missing_specifications',
        priority: 'high',
        description: 'Obtain missing or unclear specifications',
        actions: compliance.missingSpecifications.map(spec => ({
          action: `Clarify specification: ${spec}`,
          deadline: 'Within 48 hours',
          responsible: 'Project Engineer'
        }))
      });
    }
    
    return recommendations;
  }

  /**
   * Analyze document-panel relationships
   */
  analyzeDocumentPanelRelationships(context) {
    const relationships = [];
    
    if (context.documents.length > 0 && context.panelLayout) {
      // Analyze how document specifications affect panel layout
      relationships.push({
        type: 'specification_impact',
        description: 'Document specifications influence panel layout decisions',
        impact: 'High',
        recommendations: [
          'Ensure panel layout aligns with material specifications',
          'Verify installation procedures match document requirements'
        ]
      });
    }
    
    return relationships;
  }

  /**
   * Analyze QC-panel relationships
   */
  analyzeQCPanelRelationships(context) {
    const relationships = [];
    
    if (context.qcData.length > 0 && context.panelLayout) {
      // Analyze how QC results affect panel performance
      const failRate = context.qcData.filter(qc => qc.result === 'FAIL').length / context.qcData.length;
      
      relationships.push({
        type: 'qc_performance_impact',
        description: 'QC results indicate panel performance patterns',
        impact: failRate > 0.1 ? 'High' : 'Medium',
        recommendations: [
          'Use QC failure patterns to optimize panel placement',
          'Adjust installation procedures based on QC results'
        ]
      });
    }
    
    return relationships;
  }

  /**
   * Analyze optimization impact
   */
  analyzeOptimizationImpact(context) {
    const impacts = [];
    
    if (context.panelLayout) {
      impacts.push({
        type: 'material_efficiency',
        description: 'Panel optimization affects material usage',
        potential_savings: '5-15% material reduction',
        risk_factors: ['Specification compliance', 'Quality control requirements']
      });
      
      impacts.push({
        type: 'installation_efficiency',
        description: 'Panel optimization affects installation procedures',
        potential_improvements: '10-20% installation time reduction',
        risk_factors: ['Worker safety', 'Quality control procedures']
      });
    }
    
    return impacts;
  }
}

module.exports = new AIWorkflowOrchestrator(); 