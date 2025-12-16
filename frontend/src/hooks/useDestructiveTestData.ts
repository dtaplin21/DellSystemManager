import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/apiClient';
import { DestructiveTest, validateDestructiveTest } from '@/types/destructiveTest';
import { logTelemetry } from '@/lib/telemetry';

interface UseDestructiveTestDataOptions {
  projectId: string;
}

interface UseDestructiveTestDataReturn {
  destructiveTests: DestructiveTest[];
  isLoading: boolean;
  error: string | null;
  addDestructiveTest: (test: Omit<DestructiveTest, 'id'>) => Promise<void>;
  updateDestructiveTest: (testId: string, updates: Partial<DestructiveTest>) => Promise<void>;
  removeDestructiveTest: (testId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';

export function useDestructiveTestData({ projectId }: UseDestructiveTestDataOptions): UseDestructiveTestDataReturn {
  const [destructiveTests, setDestructiveTests] = useState<DestructiveTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track latest request ID for each test to prevent out-of-order response race conditions
  const latestRequestIds = useRef<Map<string, number>>(new Map());

  const fetchDestructiveTests = useCallback(async () => {
    logTelemetry({
      location: 'useDestructiveTestData.ts:26',
      message: 'fetchDestructiveTests called',
      data: { projectId },
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'A'
    });
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.request<{ success: boolean; destructiveTests: DestructiveTest[] }>(
        `/api/panels/${projectId}/destructive-tests`,
        { method: 'GET' }
      );
      
      if (response.success && Array.isArray(response.destructiveTests)) {
        const validTests = response.destructiveTests.filter(validateDestructiveTest);
        
        logTelemetry({
          location: 'useDestructiveTestData.ts:38',
          message: 'Setting destructiveTests from fetch',
          data: {
            count: validTests.length,
            tests: validTests.map(t => ({ id: t.id, x: t.x, y: t.y }))
          },
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A'
        });
        
        setDestructiveTests(validTests);
      } else {
        setDestructiveTests([]);
      }
    } catch (err: any) {
      console.error('Error fetching destructive tests:', err);
      setError(err.message || 'Failed to fetch destructive tests');
      setDestructiveTests([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDestructiveTests();
  }, [fetchDestructiveTests]);

  const addDestructiveTest = useCallback(async (testData: Omit<DestructiveTest, 'id'>) => {
    try {
      const response = await apiClient.request<{ success: boolean; destructiveTest: DestructiveTest }>(
        `/api/panels/${projectId}/destructive-tests`,
        {
          method: 'POST',
          body: testData
        }
      );
      
      if (response.success && response.destructiveTest) {
        await fetchDestructiveTests();
      }
    } catch (err: any) {
      console.error('Error creating destructive test:', err);
      throw err;
    }
  }, [projectId, fetchDestructiveTests]);

  const updateDestructiveTest = useCallback(async (testId: string, updates: Partial<DestructiveTest>) => {
    // Generate unique request ID for this update
    const requestId = Date.now() + Math.random();
    latestRequestIds.current.set(testId, requestId);
    
    logTelemetry({
      location: 'useDestructiveTestData.ts:73',
      message: 'updateDestructiveTest called',
      data: { testId, updates, x: updates.x, y: updates.y, requestId },
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'A'
    });
    
    // Optimistic update - update local state immediately for responsive UI
    setDestructiveTests(prev => {
      const test = prev.find(t => t.id === testId);
      if (!test) {
        console.warn('⚠️ [updateDestructiveTest] Destructive test not found in local state:', testId);
        return prev;
      }
      
      const updated = prev.map(t => 
        t.id === testId 
          ? { ...t, ...updates, isValid: true }
          : t
      );
      
      const updatedTest = updated.find(t => t.id === testId);
      logTelemetry({
        location: 'useDestructiveTestData.ts:87',
        message: 'Optimistic update applied',
        data: {
          testId,
          oldPos: { x: test.x, y: test.y },
          newPos: { x: updatedTest?.x, y: updatedTest?.y },
          requestId
        },
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'A'
      });
      
      return updated;
    });
    
    try {
      logTelemetry({
        location: 'useDestructiveTestData.ts:95',
        message: 'API call starting',
        data: { testId, updates, requestId },
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'A'
      });
      
      const response = await apiClient.request<{ success: boolean; destructiveTest: DestructiveTest }>(
        `/api/panels/${projectId}/destructive-tests/${testId}`,
        {
          method: 'PUT',
          body: updates
        }
      );
      
      // Check if this response is from a superseded request
      const latestRequestId = latestRequestIds.current.get(testId);
      if (latestRequestId !== undefined && requestId < latestRequestId) {
        console.log(`⚠️ [updateDestructiveTest] Ignoring stale response for ${testId}. Request ID: ${requestId}, Latest: ${latestRequestId}`);
        logTelemetry({
          location: 'useDestructiveTestData.ts:104',
          message: 'Ignoring stale response',
          data: { testId, requestId, latestRequestId },
          sessionId: 'debug-session',
          runId: 'post-fix',
          hypothesisId: 'A'
        });
        return; // Ignore this stale response
      }
      
      logTelemetry({
        location: 'useDestructiveTestData.ts:104',
        message: 'API call completed',
        data: {
          testId,
          success: response.success,
          returnedPos: { x: response.destructiveTest?.x, y: response.destructiveTest?.y },
          requestedPos: { x: updates.x, y: updates.y },
          requestId
        },
        sessionId: 'debug-session',
        runId: 'post-fix',
        hypothesisId: 'A'
      });
      
      if (response.success && response.destructiveTest) {
        // CRITICAL FIX: Don't refetch immediately - this causes a race condition where
        // stale backend data overwrites the optimistic update. 
        // Instead, merge the response with our updates, prioritizing our updates
        // to avoid overwriting with stale backend data.
        setDestructiveTests(prev => {
          return prev.map(t => {
            if (t.id !== testId) return t;
            
            // Use response data (which should have our updates applied by backend)
            // Don't re-apply updates from closure as they may be stale
            const merged = {
              ...t,
              ...response.destructiveTest,
              isValid: true
            };
            
            logTelemetry({
              location: 'useDestructiveTestData.ts:140',
              message: 'Merging response (no stale updates)',
              data: {
                testId,
                responsePos: { x: response.destructiveTest.x, y: response.destructiveTest.y },
                finalPos: { x: merged.x, y: merged.y },
                requestId
              },
              sessionId: 'debug-session',
              runId: 'post-fix',
              hypothesisId: 'A'
            });
            
            return merged;
          });
        });
      }
    } catch (err: any) {
      // Only revert if this is still the latest request
      const latestRequestId = latestRequestIds.current.get(testId);
      if (latestRequestId === requestId) {
        logTelemetry({
          location: 'useDestructiveTestData.ts:115',
          message: 'Error in updateDestructiveTest',
          data: { testId, error: err.message, requestId },
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'D'
        });
        console.error('Error updating destructive test:', err);
        // On error, refresh from backend to restore correct state
        await fetchDestructiveTests();
      } else {
        console.log(`⚠️ [updateDestructiveTest] Ignoring error from stale request for ${testId}`);
      }
      throw err;
    }
  }, [projectId, fetchDestructiveTests]);

  const removeDestructiveTest = useCallback(async (testId: string) => {
    try {
      await apiClient.request<{ success: boolean }>(
        `/api/panels/${projectId}/destructive-tests/${testId}`,
        { method: 'DELETE' }
      );
      await fetchDestructiveTests();
    } catch (err: any) {
      console.error('Error deleting destructive test:', err);
      throw err;
    }
  }, [projectId, fetchDestructiveTests]);

  return {
    destructiveTests,
    isLoading,
    error,
    addDestructiveTest,
    updateDestructiveTest,
    removeDestructiveTest,
    refreshData: fetchDestructiveTests
  };
}

