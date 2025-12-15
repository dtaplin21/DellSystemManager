import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { DestructiveTest, validateDestructiveTest } from '@/types/destructiveTest';

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

  const fetchDestructiveTests = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDestructiveTestData.ts:26',message:'fetchDestructiveTests called',data:{projectId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.request<{ success: boolean; destructiveTests: DestructiveTest[] }>(
        `/api/panels/${projectId}/destructive-tests`,
        { method: 'GET' }
      );
      
      if (response.success && Array.isArray(response.destructiveTests)) {
        const validTests = response.destructiveTests.filter(validateDestructiveTest);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDestructiveTestData.ts:38',message:'Setting destructiveTests from fetch',data:{count:validTests.length,tests:validTests.map(t=>({id:t.id,x:t.x,y:t.y}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDestructiveTestData.ts:73',message:'updateDestructiveTest called',data:{testId,updates,x:updates.x,y:updates.y},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
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
      
      // #region agent log
      const updatedTest = updated.find(t => t.id === testId);
      fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDestructiveTestData.ts:87',message:'Optimistic update applied',data:{testId,oldPos:{x:test.x,y:test.y},newPos:{x:updatedTest?.x,y:updatedTest?.y}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      return updated;
    });
    
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDestructiveTestData.ts:95',message:'API call starting',data:{testId,updates},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      const response = await apiClient.request<{ success: boolean; destructiveTest: DestructiveTest }>(
        `/api/panels/${projectId}/destructive-tests/${testId}`,
        {
          method: 'PUT',
          body: updates
        }
      );
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDestructiveTestData.ts:104',message:'API call completed',data:{testId,success:response.success,returnedPos:{x:response.destructiveTest?.x,y:response.destructiveTest?.y},requestedPos:{x:updates.x,y:updates.y}},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      if (response.success && response.destructiveTest) {
        // CRITICAL FIX: Don't refetch immediately - this causes a race condition where
        // stale backend data overwrites the optimistic update. 
        // Instead, merge ONLY the fields we sent in updates with the response,
        // prioritizing our updates to avoid overwriting with stale backend data.
        setDestructiveTests(prev => {
          return prev.map(t => {
            if (t.id !== testId) return t;
            
            // Merge: start with current state, apply our updates, then apply response
            // but prioritize our updates for position fields to avoid stale data
            const merged = {
              ...t,
              ...response.destructiveTest,
              ...updates, // Our updates take priority (especially x, y)
              isValid: true
            };
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDestructiveTestData.ts:140',message:'Merging response with updates (updates prioritized)',data:{testId,updates,responsePos:{x:response.destructiveTest.x,y:response.destructiveTest.y},finalPos:{x:merged.x,y:merged.y}},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            return merged;
          });
        });
      }
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDestructiveTestData.ts:115',message:'Error in updateDestructiveTest',data:{testId,error:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.error('Error updating destructive test:', err);
      // On error, refresh from backend to restore correct state
      await fetchDestructiveTests();
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

