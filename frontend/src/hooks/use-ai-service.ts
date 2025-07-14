// AI Service Hooks: Integrate Hybrid AI Architecture with React Components
// This provides hooks for all AI functionality in your frontend

import { useState, useCallback } from 'react';
import { useToast } from './use-toast';

// Types
interface AIResponse {
  success: boolean;
  result?: any;
  error?: string;
  cost?: number;
}

// AI Service Configuration
const AI_SERVICE_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:5001',
  endpoints: {
    optimize: '/api/ai/panels/optimize',
    analyzeDocument: '/api/ai/documents/analyze',
    extractData: '/api/ai/documents/extract',
    analyzeQC: '/api/ai/qc/analyze',
    recommendations: '/api/ai/projects/recommendations',
    health: '/api/ai/health',
    models: '/api/ai/models'
  }
};

// Base AI service function
const callAIService = async (
  endpoint: string,
  data: any
): Promise<AIResponse> => {
  try {
    const response = await fetch(`${AI_SERVICE_CONFIG.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('AI service call failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Hook for Panel Layout Optimization
export const usePanelOptimization = () => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationHistory, setOptimizationHistory] = useState<any[]>([]);
  const { toast } = useToast();

  const optimizePanels = useCallback(async (
    panels: any[],
    strategy: string = 'balanced',
    siteConfig: any = {}
  ): Promise<AIResponse> => {
    setIsOptimizing(true);
    
    try {
      const result = await callAIService(
        AI_SERVICE_CONFIG.endpoints.optimize,
        { panels, strategy, site_config: siteConfig }
      );

      if (result.success) {
        const optimization = {
          panels,
          strategy,
          result: result.result,
          timestamp: new Date()
        };

        setOptimizationHistory(prev => [...prev, optimization]);

        toast({
          title: "Panel Layout Optimized",
          description: "Optimization completed successfully",
        });
      } else {
        toast({
          title: "Optimization Failed",
          description: result.error || "Failed to optimize panel layout",
          variant: "destructive",
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Optimization Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsOptimizing(false);
    }
  }, [toast]);

  return {
    optimizePanels,
    isOptimizing,
    optimizationHistory
  };
};

// Hook for Document Analysis
export const useDocumentAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const { toast } = useToast();

  const analyzeDocument = useCallback(async (
    documentText: string,
    question: string = 'Provide a comprehensive analysis of this document'
  ): Promise<AIResponse> => {
    setIsAnalyzing(true);
    
    try {
      const result = await callAIService(
        AI_SERVICE_CONFIG.endpoints.analyzeDocument,
        { document_text: documentText, question }
      );

      if (result.success) {
        const analysis = {
          document_text: documentText,
          question,
          result: result.result,
          timestamp: new Date()
        };

        setAnalysisHistory(prev => [...prev, analysis]);

        toast({
          title: "Document Analyzed",
          description: "Analysis completed successfully",
        });
      } else {
        toast({
          title: "Analysis Failed",
          description: result.error || "Failed to analyze document",
          variant: "destructive",
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Analysis Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsAnalyzing(false);
    }
  }, [toast]);

  return {
    analyzeDocument,
    isAnalyzing,
    analysisHistory
  };
};

// Hook for Data Extraction
export const useDataExtraction = () => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionHistory, setExtractionHistory] = useState<any[]>([]);
  const { toast } = useToast();

  const extractData = useCallback(async (
    documentText: string,
    extractionType: string = 'qc_data'
  ): Promise<AIResponse> => {
    setIsExtracting(true);
    
    try {
      const result = await callAIService(
        AI_SERVICE_CONFIG.endpoints.extractData,
        { document_text: documentText, extraction_type: extractionType }
      );

      if (result.success) {
        const extraction = {
          document_text: documentText,
          extraction_type: extractionType,
          result: result.result,
          timestamp: new Date()
        };

        setExtractionHistory(prev => [...prev, extraction]);

        toast({
          title: "Data Extracted",
          description: "Data extraction completed successfully",
        });
      } else {
        toast({
          title: "Extraction Failed",
          description: result.error || "Failed to extract data",
          variant: "destructive",
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Extraction Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsExtracting(false);
    }
  }, [toast]);

  return {
    extractData,
    isExtracting,
    extractionHistory
  };
};

// Hook for QC Analysis
export const useQCAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const { toast } = useToast();

  const analyzeQCData = useCallback(async (
    qcData: any[]
  ): Promise<AIResponse> => {
    setIsAnalyzing(true);
    
    try {
      const result = await callAIService(
        AI_SERVICE_CONFIG.endpoints.analyzeQC,
        { qc_data: qcData }
      );

      if (result.success) {
        const analysis = {
          qc_data: qcData,
          result: result.result,
          timestamp: new Date()
        };

        setAnalysisHistory(prev => [...prev, analysis]);

        toast({
          title: "QC Data Analyzed",
          description: "QC analysis completed successfully",
        });
      } else {
        toast({
          title: "QC Analysis Failed",
          description: result.error || "Failed to analyze QC data",
          variant: "destructive",
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "QC Analysis Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsAnalyzing(false);
    }
  }, [toast]);

  return {
    analyzeQCData,
    isAnalyzing,
    analysisHistory
  };
};

// Hook for Project Recommendations
export const useProjectRecommendations = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendationsHistory, setRecommendationsHistory] = useState<any[]>([]);
  const { toast } = useToast();

  const generateRecommendations = useCallback(async (
    projectData: any
  ): Promise<AIResponse> => {
    setIsGenerating(true);
    
    try {
      const result = await callAIService(
        AI_SERVICE_CONFIG.endpoints.recommendations,
        { project_data: projectData }
      );

      if (result.success) {
        const recommendations = {
          project_data: projectData,
          result: result.result,
          timestamp: new Date()
        };

        setRecommendationsHistory(prev => [...prev, recommendations]);

        toast({
          title: "Recommendations Generated",
          description: "Project recommendations completed successfully",
        });
      } else {
        toast({
          title: "Recommendations Failed",
          description: result.error || "Failed to generate recommendations",
          variant: "destructive",
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Recommendations Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return {
    generateRecommendations,
    isGenerating,
    recommendationsHistory
  };
};

// Hook for AI Service Health Check
export const useAIServiceHealth = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const { toast } = useToast();

  const checkHealth = useCallback(async (): Promise<AIResponse> => {
    setIsChecking(true);
    
    try {
      const response = await fetch(`${AI_SERVICE_CONFIG.baseUrl}${AI_SERVICE_CONFIG.endpoints.health}`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const result = await response.json();
      setHealthStatus(result);

      toast({
        title: "AI Service Status",
        description: result.ai_service === 'healthy' ? 'AI service is operational' : 'AI service has issues',
        variant: result.ai_service === 'healthy' ? 'default' : 'destructive',
      });

      return { success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Health Check Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsChecking(false);
    }
  }, [toast]);

  return {
    checkHealth,
    isChecking,
    healthStatus
  };
}; 