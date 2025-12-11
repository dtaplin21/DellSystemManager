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
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.request<{ success: boolean; destructiveTests: DestructiveTest[] }>(
        `/api/panels/${projectId}/destructive-tests`,
        { method: 'GET' }
      );
      
      if (response.success && Array.isArray(response.destructiveTests)) {
        const validTests = response.destructiveTests.filter(validateDestructiveTest);
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
    try {
      const response = await apiClient.request<{ success: boolean; destructiveTest: DestructiveTest }>(
        `/api/panels/${projectId}/destructive-tests/${testId}`,
        {
          method: 'PUT',
          body: updates
        }
      );
      
      if (response.success && response.destructiveTest) {
        await fetchDestructiveTests();
      }
    } catch (err: any) {
      console.error('Error updating destructive test:', err);
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

