// AI Service Hooks: Integrate Hybrid AI Architecture with React Components
// This provides hooks for all AI functionality in your frontend

import { useState, useCallback, useEffect } from 'react';
import { useToast } from './use-toast';

// Types for AI service responses
interface AIResponse {
  success: boolean;
  response?: string;
  error?: string;
  cost?: number;
  status?: string;
  optimized_layout?: any;
  analysis_result?: any;
  agents_used?: string[];
}

interface AIChatMessage {
  id: string;
  message: string;
  response: string;
  timestamp: Date;
  cost: number;
  context?: any;
}

interface LayoutOptimizationRequest {
  panels: any[];
  constraints: {
    max_width: number;
    max_height: number;
    [key: string]: any;
  };
}

interface DocumentAnalysisRequest {
  document_path: string;
  analysis_type: 'general' | 'technical' | 'qc' | 'extraction';
}

// AI Service Configuration
const AI_SERVICE_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:5001',
  endpoints: {
    chat: '/api/ai/chat',
    optimize: '/api/ai/panels/optimize',
    analyzeDocument: '/api/ai/documents/analyze',
    enhancePanel: '/api/ai/panels/enhance',
    createProject: '/api/ai/projects/create',
    websocket: '/api/ai/websocket',
    costs: '/api/ai/costs',
    health: '/api/ai/health',
    models: '/api/ai/models'
  }
};

// Base AI service function
const callAIService = async (
  endpoint: string,
  data: any,
  user_id: string = 'anonymous',
  user_tier: string = 'free_user'
): Promise<AIResponse> => {
  try {
    const response = await fetch(`${AI_SERVICE_CONFIG.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        user_id,
        user_tier
      })
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

// Hook for AI Chat functionality
export const useAIChat = (user_id?: string, user_tier?: string) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sendMessage = useCallback(async (
    message: string,
    context?: any
  ): Promise<AIResponse> => {
    setIsLoading(true);
    
    try {
      const result = await callAIService(
        AI_SERVICE_CONFIG.endpoints.chat,
        { message, context },
        user_id,
        user_tier
      );

      if (result.success) {
        const newMessage: AIChatMessage = {
          id: Date.now().toString(),
          message,
          response: result.response || '',
          timestamp: new Date(),
          cost: result.cost || 0,
          context
        };

        setMessages(prev => [...prev, newMessage]);
        
        toast({
          title: "AI Response",
          description: "Message processed successfully",
        });
      } else {
        toast({
          title: "AI Error",
          description: result.error || "Failed to process message",
          variant: "destructive",
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "AI Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [user_id, user_tier, toast]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    clearMessages,
    isLoading
  };
};

// Hook for Layout Optimization
export const useLayoutOptimization = (user_id?: string, user_tier?: string) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [lastOptimization, setLastOptimization] = useState<any>(null);
  const { toast } = useToast();

  const optimizeLayout = useCallback(async (
    layoutData: LayoutOptimizationRequest
  ): Promise<AIResponse> => {
    setIsOptimizing(true);
    
    try {
      const result = await callAIService(
        AI_SERVICE_CONFIG.endpoints.optimize,
        { layout_data: layoutData },
        user_id,
        user_tier
      );

      if (result.success) {
        setLastOptimization({
          original: layoutData,
          optimized: result.optimized_layout,
          cost: result.cost,
          agents_used: result.agents_used,
          timestamp: new Date()
        });

        toast({
          title: "Layout Optimized",
          description: `Optimization completed with ${result.agents_used?.length || 0} AI agents`,
        });
      } else {
        toast({
          title: "Optimization Failed",
          description: result.error || "Failed to optimize layout",
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
  }, [user_id, user_tier, toast]);

  return {
    optimizeLayout,
    isOptimizing,
    lastOptimization
  };
};

// Hook for Document Analysis
export const useDocumentAnalysis = (user_id?: string, user_tier?: string) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const { toast } = useToast();

  const analyzeDocument = useCallback(async (
    documentPath: string,
    analysisType: string = 'general'
  ): Promise<AIResponse> => {
    setIsAnalyzing(true);
    
    try {
      const result = await callAIService(
        AI_SERVICE_CONFIG.endpoints.analyzeDocument,
        { document_path: documentPath, analysis_type: analysisType },
        user_id,
        user_tier
      );

      if (result.success) {
        const analysis = {
          document_path: documentPath,
          analysis_type: analysisType,
          result: result.analysis_result,
          cost: result.cost,
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
  }, [user_id, user_tier, toast]);

  return {
    analyzeDocument,
    isAnalyzing,
    analysisHistory
  };
};

// Hook for Panel Enhancement
export const usePanelEnhancement = (user_id?: string, user_tier?: string) => {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const { toast } = useToast();

  const enhancePanel = useCallback(async (
    action: 'create' | 'update' | 'get',
    panelData: any
  ): Promise<AIResponse> => {
    setIsEnhancing(true);
    
    try {
      const result = await callAIService(
        AI_SERVICE_CONFIG.endpoints.enhancePanel,
        { action, panel_data: panelData },
        user_id,
        user_tier
      );

      if (result.success) {
        toast({
          title: "Panel Enhanced",
          description: `Panel ${action} completed with AI suggestions`,
        });
      } else {
        toast({
          title: "Enhancement Failed",
          description: result.error || "Failed to enhance panel",
          variant: "destructive",
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Enhancement Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsEnhancing(false);
    }
  }, [user_id, user_tier, toast]);

  return {
    enhancePanel,
    isEnhancing
  };
};

// Hook for Project Creation with AI
export const useAIProjectCreation = (user_id?: string, user_tier?: string) => {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const createProjectWithAI = useCallback(async (
    projectData: any
  ): Promise<AIResponse> => {
    setIsCreating(true);
    
    try {
      const result = await callAIService(
        AI_SERVICE_CONFIG.endpoints.createProject,
        { project_data: projectData },
        user_id,
        user_tier
      );

      if (result.success) {
        toast({
          title: "Project Created",
          description: "Project created with AI assistance",
        });
      } else {
        toast({
          title: "Project Creation Failed",
          description: result.error || "Failed to create project",
          variant: "destructive",
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Project Creation Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsCreating(false);
    }
  }, [user_id, user_tier, toast]);

  return {
    createProjectWithAI,
    isCreating
  };
};

// Hook for AI Service Health and Status
export const useAIServiceStatus = () => {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${AI_SERVICE_CONFIG.baseUrl}${AI_SERVICE_CONFIG.endpoints.health}`);
      const status = await response.json();
      setHealthStatus(status);
      return status;
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus({ error: 'Health check failed' });
      return { error: 'Health check failed' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAvailableModels = useCallback(async () => {
    try {
      const response = await fetch(`${AI_SERVICE_CONFIG.baseUrl}${AI_SERVICE_CONFIG.endpoints.models}`);
      const models = await response.json();
      return models;
    } catch (error) {
      console.error('Failed to get models:', error);
      return {};
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return {
    healthStatus,
    checkHealth,
    getAvailableModels,
    isLoading
  };
};

// Hook for Cost Tracking
export const useAICostTracking = (user_id?: string, user_tier?: string) => {
  const [costs, setCosts] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getCosts = useCallback(async () => {
    if (!user_id) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `${AI_SERVICE_CONFIG.baseUrl}${AI_SERVICE_CONFIG.endpoints.costs}/${user_id}?user_tier=${user_tier || 'free_user'}`
      );
      const costData = await response.json();
      setCosts(costData);
      return costData;
    } catch (error) {
      console.error('Failed to get costs:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user_id, user_tier]);

  useEffect(() => {
    getCosts();
  }, [getCosts]);

  return {
    costs,
    getCosts,
    isLoading
  };
};

// Combined hook for all AI functionality
export const useAIService = (user_id?: string, user_tier?: string) => {
  const chat = useAIChat(user_id, user_tier);
  const layoutOptimization = useLayoutOptimization(user_id, user_tier);
  const documentAnalysis = useDocumentAnalysis(user_id, user_tier);
  const panelEnhancement = usePanelEnhancement(user_id, user_tier);
  const projectCreation = useAIProjectCreation(user_id, user_tier);
  const serviceStatus = useAIServiceStatus();
  const costTracking = useAICostTracking(user_id, user_tier);

  return {
    chat,
    layoutOptimization,
    documentAnalysis,
    panelEnhancement,
    projectCreation,
    serviceStatus,
    costTracking
  };
}; 