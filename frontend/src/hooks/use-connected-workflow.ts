import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';

interface WorkflowStatus {
  projectId: string;
  context: {
    documents: number;
    panels: number;
    qcRecords: number;
    lastUpdated: string;
  };
  crossInsights: any;
  aiInsights: string[];
  availableWorkflows: string[];
}

interface WorkflowResult {
  success: boolean;
  workflowType: string;
  results: any;
  crossInsights: any;
  timestamp: string;
}

interface AIInsights {
  [key: string]: any;
}

interface Recommendations {
  projectManagement: any;
  actionItems: any;
  specificationCompliance: any;
  categories: {
    critical: any[];
    high: any[];
    medium: any[];
    low: any[];
  };
}

interface ExcelExport {
  filename: string;
  sheets: Array<{
    name: string;
    data: any[];
  }>;
  metadata: {
    documentName: string;
    projectId: string;
    processedAt: string;
    totalDataPoints: number;
  };
}

export const useConnectedWorkflow = (projectId: string) => {
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastWorkflowResult, setLastWorkflowResult] = useState<WorkflowResult | null>(null);
  const [insights, setInsights] = useState<AIInsights>({});
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [excelExports, setExcelExports] = useState<ExcelExport[]>([]);
  const { toast } = useToast();

  // Get workflow status
  const getStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/connected-workflow/status/${projectId}`);
      const data = await response.json();
      
      if (data.success) {
        setStatus(data);
      } else {
        throw new Error(data.error || 'Failed to get workflow status');
      }
    } catch (error) {
      console.error('Error getting workflow status:', error);
      toast({
        title: 'Error',
        description: 'Failed to get workflow status',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toast]);

  // Trigger specific workflow
  const triggerWorkflow = useCallback(async (workflowType: string, triggerSource?: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/connected-workflow/trigger/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowType,
          triggerSource: triggerSource || 'manual'
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLastWorkflowResult(data);
        toast({
          title: 'Success',
          description: `${workflowType} workflow completed successfully`,
        });
        
        // Refresh status and insights
        await getStatus();
        await getInsights();
        await getRecommendations();
        
        return data;
      } else {
        throw new Error(data.error || 'Workflow failed');
      }
    } catch (error) {
      console.error('Error triggering workflow:', error);
      toast({
        title: 'Error',
        description: `Failed to trigger ${workflowType} workflow`,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toast, getStatus]);

  // Auto-trigger workflows based on data changes
  const autoTriggerWorkflows = useCallback(async (changeType: string, componentType: string, data: any) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/connected-workflow/auto-trigger/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changeType,
          componentType,
          data
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'AI Analysis',
          description: `Triggered ${result.triggeredWorkflows.length} workflows automatically`,
        });
        
        // Refresh status and insights
        await getStatus();
        await getInsights();
        await getRecommendations();
        
        return result;
      } else {
        throw new Error(result.error || 'Auto-trigger failed');
      }
    } catch (error) {
      console.error('Error in auto-trigger:', error);
      toast({
        title: 'Error',
        description: 'Failed to auto-trigger workflows',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toast, getStatus]);

  // Get AI insights
  const getInsights = useCallback(async (insightType?: string) => {
    try {
      const url = insightType 
        ? `/api/connected-workflow/insights/${projectId}?insightType=${insightType}`
        : `/api/connected-workflow/insights/${projectId}`;
        
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        if (insightType) {
          setInsights(prev => ({ ...prev, [insightType]: data.insights }));
        } else {
          setInsights(data.insights);
        }
        return data.insights;
      } else {
        throw new Error(data.error || 'Failed to get insights');
      }
    } catch (error) {
      console.error('Error getting insights:', error);
      toast({
        title: 'Error',
        description: 'Failed to get AI insights',
        variant: 'destructive',
      });
    }
  }, [projectId, toast]);

  // Get recommendations
  const getRecommendations = useCallback(async (category?: string) => {
    try {
      const url = category 
        ? `/api/connected-workflow/recommendations/${projectId}?category=${category}`
        : `/api/connected-workflow/recommendations/${projectId}`;
        
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setRecommendations(data.recommendations);
        return data.recommendations;
      } else {
        throw new Error(data.error || 'Failed to get recommendations');
      }
    } catch (error) {
      console.error('Error getting recommendations:', error);
      toast({
        title: 'Error',
        description: 'Failed to get recommendations',
        variant: 'destructive',
      });
    }
  }, [projectId, toast]);

  // Get Excel exports for handwritten documents
  const getExcelExports = useCallback(async (documentName?: string) => {
    try {
      const url = documentName 
        ? `/api/connected-workflow/excel-export/${projectId}?documentName=${encodeURIComponent(documentName)}`
        : `/api/connected-workflow/excel-export/${projectId}`;
        
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        if (documentName) {
          setExcelExports([data.excelData]);
        } else {
          setExcelExports(Array.isArray(data.excelData) ? data.excelData : [data.excelData]);
        }
        return data.excelData;
      } else {
        throw new Error(data.error || 'Failed to get Excel exports');
      }
    } catch (error) {
      console.error('Error getting Excel exports:', error);
      toast({
        title: 'Error',
        description: 'Failed to get Excel exports',
        variant: 'destructive',
      });
    }
  }, [projectId, toast]);

  // Update project context and trigger workflows
  const updateContext = useCallback(async (componentType: string, data: any, action: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/connected-workflow/update-context/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          componentType,
          data,
          action
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Context Updated',
          description: `Updated ${componentType} and triggered workflows`,
        });
        
        // Refresh status and insights
        await getStatus();
        await getInsights();
        await getRecommendations();
        
        return result;
      } else {
        throw new Error(result.error || 'Context update failed');
      }
    } catch (error) {
      console.error('Error updating context:', error);
      toast({
        title: 'Error',
        description: 'Failed to update project context',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toast, getStatus]);

  // Convenience methods for specific workflows
  const triggerDocumentAnalysis = useCallback(() => 
    triggerWorkflow('document_analysis', 'document_analysis'), [triggerWorkflow]);
    
  const triggerHandwrittenAnalysis = useCallback(() => 
    triggerWorkflow('handwritten_analysis', 'handwritten_analysis'), [triggerWorkflow]);
    
  const triggerSpecificationCompliance = useCallback(() => 
    triggerWorkflow('specification_compliance', 'specification_compliance'), [triggerWorkflow]);
    
  const triggerPanelOptimization = useCallback(() => 
    triggerWorkflow('panel_optimization', 'panel_optimization'), [triggerWorkflow]);
    
  const triggerQCAnalysis = useCallback(() => 
    triggerWorkflow('qc_analysis', 'qc_analysis'), [triggerWorkflow]);
    
  const triggerProjectManagement = useCallback(() => 
    triggerWorkflow('project_management', 'project_management'), [triggerWorkflow]);
    
  const triggerComprehensiveWorkflow = useCallback(() => 
    triggerWorkflow('comprehensive', 'comprehensive'), [triggerWorkflow]);

  // Initialize on mount
  useEffect(() => {
    if (projectId) {
      getStatus();
      getInsights();
      getRecommendations();
    }
  }, [projectId, getStatus, getInsights, getRecommendations]);

  return {
    // State
    status,
    isLoading,
    lastWorkflowResult,
    insights,
    recommendations,
    excelExports,
    
    // Methods
    getStatus,
    triggerWorkflow,
    autoTriggerWorkflows,
    getInsights,
    getRecommendations,
    getExcelExports,
    updateContext,
    
    // Convenience methods
    triggerDocumentAnalysis,
    triggerHandwrittenAnalysis,
    triggerSpecificationCompliance,
    triggerPanelOptimization,
    triggerQCAnalysis,
    triggerProjectManagement,
    triggerComprehensiveWorkflow,
    
    // Helper methods
    hasData: () => status !== null,
    hasDocuments: () => (status?.context?.documents || 0) > 0,
    hasPanels: () => (status?.context?.panels || 0) > 0,
    hasQCData: () => (status?.context?.qcRecords || 0) > 0,
    getAvailableWorkflows: () => status?.availableWorkflows || [],
    getCriticalRecommendations: () => recommendations?.categories?.critical || [],
    getHighPriorityRecommendations: () => recommendations?.categories?.high || [],
    getMediumPriorityRecommendations: () => recommendations?.categories?.medium || [],
    getLowPriorityRecommendations: () => recommendations?.categories?.low || [],
  };
}; 