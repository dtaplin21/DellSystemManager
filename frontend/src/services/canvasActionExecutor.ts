import { supabase, getCurrentSession } from '@/lib/supabase';

const BACKEND_URL = 'http://localhost:8003';

// Helper function to make authenticated API calls
const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
  try {
    const session = await getCurrentSession();
    const headers = {
      'Content-Type': 'application/json',
      ...(session?.access_token && {
        'Authorization': `Bearer ${session.access_token}`
      }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    return response;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};

export interface AILayoutAction {
  type: 'CREATE_PANEL' | 'MOVE_PANEL' | 'DELETE_PANEL' | 'BATCH_CREATE';
  id: string;
  payload: {
    position?: { x: number; y: number };
    dimensions?: { width: number; height: number };
    rotation?: number;
    panelId?: string;
    newPosition?: { x: number; y: number; rotation?: number };
    properties?: {
      material?: string;
      thickness?: number;
      seamsType?: string;
      location?: string;
      notes?: string;
      fill?: string;
      color?: string;
      shape?: string;
    };
  };
}

export interface ExecutionResult {
  success: boolean;
  actionId: string;
  type: string;
  panel?: any;
  result?: any;
  error?: string;
}

export class CanvasActionExecutor {
  private projectId: string;
  private onProgress?: (currentAction: number, totalActions: number, action: AILayoutAction) => void;
  private onComplete?: (results: ExecutionResult[]) => void;
  private onError?: (error: string) => void;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: (currentAction: number, totalActions: number, action: AILayoutAction) => void) {
    this.onProgress = callback;
  }

  /**
   * Set completion callback
   */
  setCompleteCallback(callback: (results: ExecutionResult[]) => void) {
    this.onComplete = callback;
  }

  /**
   * Set error callback
   */
  setErrorCallback(callback: (error: string) => void) {
    this.onError = callback;
  }

  /**
   * Execute AI-generated layout actions
   */
  async executeActions(actions: AILayoutAction[]): Promise<ExecutionResult[]> {
    try {
      const results: ExecutionResult[] = [];
      
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        
        // Report progress
        if (this.onProgress) {
          this.onProgress(i + 1, actions.length, action);
        }

        try {
          const result = await this.executeSingleAction(action);
          results.push(result);
          
          // Add delay for visual feedback
          await this.delay(200);
          
        } catch (error) {
          const errorResult: ExecutionResult = {
            success: false,
            actionId: action.id,
            type: action.type,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          results.push(errorResult);
        }
      }

      // Report completion
      if (this.onComplete) {
        this.onComplete(results);
      }

      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to execute actions';
      
      if (this.onError) {
        this.onError(errorMessage);
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Execute a single action
   */
  private async executeSingleAction(action: AILayoutAction): Promise<ExecutionResult> {
    try {
      switch (action.type) {
        case 'CREATE_PANEL':
          return await this.createPanel(action);
          
        case 'MOVE_PANEL':
          return await this.movePanel(action);
          
        case 'DELETE_PANEL':
          return await this.deletePanel(action);
          
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      throw new Error(`Failed to execute ${action.type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a panel via API
   */
  private async createPanel(action: AILayoutAction): Promise<ExecutionResult> {
    try {
      const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/panel-layout/create-panel`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: this.projectId,
          panelData: action.payload
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create panel');
      }

      const result = await response.json();

      return {
        success: true,
        actionId: action.id,
        type: action.type,
        panel: result.panel
      };

    } catch (error) {
      throw new Error(`Create panel failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Move a panel via API
   */
  private async movePanel(action: AILayoutAction): Promise<ExecutionResult> {
    try {
      if (!action.payload.panelId || !action.payload.newPosition) {
        throw new Error('Missing panelId or newPosition');
      }

      const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/panel-layout/move-panel`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: this.projectId,
          panelId: action.payload.panelId,
          newPosition: action.payload.newPosition
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to move panel');
      }

      const result = await response.json();

      return {
        success: true,
        actionId: action.id,
        type: action.type,
        panel: result.panel
      };

    } catch (error) {
      throw new Error(`Move panel failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a panel via API
   */
  private async deletePanel(action: AILayoutAction): Promise<ExecutionResult> {
    try {
      if (!action.payload.panelId) {
        throw new Error('Missing panelId');
      }

      const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/panel-layout/delete-panel`, {
        method: 'DELETE',
        body: JSON.stringify({
          projectId: this.projectId,
          panelId: action.payload.panelId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete panel');
      }

      const result = await response.json();

      return {
        success: true,
        actionId: action.id,
        type: action.type,
        result: result.result
      };

    } catch (error) {
      throw new Error(`Delete panel failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute actions via batch API endpoint
   */
  async executeActionsBatch(actions: AILayoutAction[]): Promise<ExecutionResult[]> {
    try {
      const response = await makeAuthenticatedRequest(`${BACKEND_URL}/api/ai/execute-ai-layout`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: this.projectId,
          actions: actions
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute batch actions');
      }

      const result = await response.json();

      // Convert API results to our format
      const results: ExecutionResult[] = result.results.map((apiResult: any) => ({
        success: apiResult.success,
        actionId: apiResult.actionId,
        type: apiResult.type,
        panel: apiResult.panel,
        error: apiResult.error
      }));

      if (this.onComplete) {
        this.onComplete(results);
      }

      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to execute batch actions';
      
      if (this.onError) {
        this.onError(errorMessage);
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Simulate mouse events for visual feedback (for future use)
   */
  private simulateMouseEvents(element: HTMLElement, coords: { start: { x: number; y: number }; end: { x: number; y: number } }) {
    const mouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      clientX: coords.start.x,
      clientY: coords.start.y
    });
    
    const mouseMove = new MouseEvent('mousemove', {
      bubbles: true,
      clientX: coords.end.x,
      clientY: coords.end.y
    });
    
    const mouseUp = new MouseEvent('mouseup', {
      bubbles: true,
      clientX: coords.end.x,
      clientY: coords.end.y
    });
    
    element.dispatchEvent(mouseDown);
    element.dispatchEvent(mouseMove);
    element.dispatchEvent(mouseUp);
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate actions before execution
   */
  validateActions(actions: AILayoutAction[]): { valid: AILayoutAction[]; invalid: { action: AILayoutAction; error: string }[] } {
    const valid: AILayoutAction[] = [];
    const invalid: { action: AILayoutAction; error: string }[] = [];

    actions.forEach(action => {
      try {
        this.validateSingleAction(action);
        valid.push(action);
      } catch (error) {
        invalid.push({
          action,
          error: error instanceof Error ? error.message : 'Unknown validation error'
        });
      }
    });

    return { valid, invalid };
  }

  /**
   * Validate a single action
   */
  private validateSingleAction(action: AILayoutAction): void {
    if (!action.type || !action.payload) {
      throw new Error('Action missing required fields');
    }

    const validTypes = ['CREATE_PANEL', 'MOVE_PANEL', 'DELETE_PANEL'];
    if (!validTypes.includes(action.type)) {
      throw new Error(`Invalid action type: ${action.type}`);
    }

    switch (action.type) {
      case 'CREATE_PANEL':
        if (!action.payload.position || !action.payload.dimensions) {
          throw new Error('CREATE_PANEL missing position or dimensions');
        }
        if (action.payload.position.x < 0 || action.payload.position.y < 0) {
          throw new Error('Panel position cannot be negative');
        }
        if (action.payload.dimensions.width <= 0 || action.payload.dimensions.height <= 0) {
          throw new Error('Panel dimensions must be positive');
        }
        break;

      case 'MOVE_PANEL':
        if (!action.payload.panelId || !action.payload.newPosition) {
          throw new Error('MOVE_PANEL missing panelId or newPosition');
        }
        break;

      case 'DELETE_PANEL':
        if (!action.payload.panelId) {
          throw new Error('DELETE_PANEL missing panelId');
        }
        break;
    }
  }
}

/**
 * Hook for using the canvas action executor
 */
export const useCanvasActionExecutor = (projectId: string) => {
  const executor = new CanvasActionExecutor(projectId);

  const executeActions = async (
    actions: AILayoutAction[],
    options?: {
      onProgress?: (currentAction: number, totalActions: number, action: AILayoutAction) => void;
      onComplete?: (results: ExecutionResult[]) => void;
      onError?: (error: string) => void;
      useBatch?: boolean;
    }
  ) => {
    if (options?.onProgress) {
      executor.setProgressCallback(options.onProgress);
    }
    if (options?.onComplete) {
      executor.setCompleteCallback(options.onComplete);
    }
    if (options?.onError) {
      executor.setErrorCallback(options.onError);
    }

    if (options?.useBatch) {
      return await executor.executeActionsBatch(actions);
    } else {
      return await executor.executeActions(actions);
    }
  };

  return {
    executeActions,
    validateActions: (actions: AILayoutAction[]) => executor.validateActions(actions)
  };
}; 