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

  const clearHistory = useCallback(() => {
    setOptimizationHistory([]);
  }, []);

  return {
    optimizePanels,
    isOptimizing,
    optimizationHistory,
    clearHistory
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
          documentText: documentText.substring(0, 100) + '...',
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

  const clearHistory = useCallback(() => {
    setAnalysisHistory([]);
  }, []);

  return {
    analyzeDocument,
    isAnalyzing,
    analysisHistory,
    clearHistory
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
          documentText: documentText.substring(0, 100) + '...',
          extractionType,
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

  const clearHistory = useCallback(() => {
    setExtractionHistory([]);
  }, []);

  return {
    extractData,
    isExtracting,
    extractionHistory,
    clearHistory
  };
};

// Hook for QC Data Analysis
export const useQCAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const { toast } = useToast();

  const analyzeQCData = useCallback(async (
    qcData: any[],
    analysisType: string = 'comprehensive'
  ): Promise<AIResponse> => {
    setIsAnalyzing(true);
    
    try {
      const result = await callAIService(
        AI_SERVICE_CONFIG.endpoints.analyzeQC,
        { qc_data: qcData, analysis_type: analysisType }
      );

      if (result.success) {
        const analysis = {
          qcDataCount: qcData.length,
          analysisType,
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

  const clearHistory = useCallback(() => {
    setAnalysisHistory([]);
  }, []);

  return {
    analyzeQCData,
    isAnalyzing,
    analysisHistory,
    clearHistory
  };
};

// Hook for Project Recommendations
export const useProjectRecommendations = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendationHistory, setRecommendationHistory] = useState<any[]>([]);
  const { toast } = useToast();

  const generateRecommendations = useCallback(async (
    projectData: any,
    recommendationType: string = 'general'
  ): Promise<AIResponse> => {
    setIsGenerating(true);
    
    try {
      const result = await callAIService(
        AI_SERVICE_CONFIG.endpoints.recommendations,
        { project_data: projectData, recommendation_type: recommendationType }
      );

      if (result.success) {
        const recommendation = {
          projectData: projectData,
          recommendationType,
          result: result.result,
          timestamp: new Date()
        };

        setRecommendationHistory(prev => [...prev, recommendation]);

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

  const clearHistory = useCallback(() => {
    setRecommendationHistory([]);
  }, []);

  return {
    generateRecommendations,
    isGenerating,
    recommendationHistory,
    clearHistory
  };
};

// Hook for AI Service Health Check
export const useAIServiceHealth = () => {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  const checkHealth = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    
    try {
      const response = await fetch(`${AI_SERVICE_CONFIG.baseUrl}${AI_SERVICE_CONFIG.endpoints.health}`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const result = await response.json();
      setHealthStatus(result);

      if (result.status === 'healthy') {
        toast({
          title: "AI Service Healthy",
          description: "All AI services are operational",
        });
        return true;
      } else {
        toast({
          title: "AI Service Issues",
          description: "Some AI services may have issues",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "AI Service Unavailable",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [toast]);

  const getAvailableModels = useCallback(async (): Promise<any[]> => {
    try {
      const response = await fetch(`${AI_SERVICE_CONFIG.baseUrl}${AI_SERVICE_CONFIG.endpoints.models}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get models: ${response.status}`);
      }

      const result = await response.json();
      return result.models ? Object.values(result.models) : [];
    } catch (error) {
      console.error('Failed to get available models:', error);
      return [];
    }
  }, []);

  return {
    checkHealth,
    getAvailableModels,
    healthStatus,
    isChecking
  };
};

// All hooks are already exported individually above 