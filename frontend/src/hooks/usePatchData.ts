import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Patch, validatePatch } from '@/types/patch';

interface UsePatchDataOptions {
  projectId: string;
}

interface UsePatchDataReturn {
  patches: Patch[];
  isLoading: boolean;
  error: string | null;
  addPatch: (patch: Omit<Patch, 'id'>) => Promise<void>;
  updatePatch: (patchId: string, updates: Partial<Patch>) => Promise<void>;
  removePatch: (patchId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';

export function usePatchData({ projectId }: UsePatchDataOptions): UsePatchDataReturn {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatches = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.request<{ success: boolean; patches: Patch[] }>(
        `/api/panels/${projectId}/patches`,
        { method: 'GET' }
      );
      
      if (response.success && Array.isArray(response.patches)) {
        const validPatches = response.patches.filter(validatePatch);
        setPatches(validPatches);
      } else {
        setPatches([]);
      }
    } catch (err: any) {
      console.error('Error fetching patches:', err);
      setError(err.message || 'Failed to fetch patches');
      setPatches([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPatches();
  }, [fetchPatches]);

  const addPatch = useCallback(async (patchData: Omit<Patch, 'id'>) => {
    try {
      const response = await apiClient.request<{ success: boolean; patch: Patch }>(
        `/api/panels/${projectId}/patches`,
        {
          method: 'POST',
          body: patchData
        }
      );
      
      if (response.success && response.patch) {
        await fetchPatches();
      }
    } catch (err: any) {
      console.error('Error creating patch:', err);
      throw err;
    }
  }, [projectId, fetchPatches]);

  const updatePatch = useCallback(async (patchId: string, updates: Partial<Patch>) => {
    // Optimistic update - update local state immediately for responsive UI
    setPatches(prev => {
      const patch = prev.find(p => p.id === patchId);
      if (!patch) {
        console.warn('⚠️ [updatePatch] Patch not found in local state:', patchId);
        return prev;
      }
      
      return prev.map(p => 
        p.id === patchId 
          ? { ...p, ...updates, isValid: true }
          : p
      );
    });
    
    try {
      const response = await apiClient.request<{ success: boolean; patch: Patch }>(
        `/api/panels/${projectId}/patches/${patchId}`,
        {
          method: 'PUT',
          body: updates
        }
      );
      
      if (response.success && response.patch) {
        // CRITICAL FIX: Don't refetch immediately - this causes snap-back where
        // stale backend data overwrites the optimistic update.
        // Instead, merge the response with our updates, prioritizing our updates
        // to avoid overwriting with stale backend data.
        setPatches(prev => {
          return prev.map(p => {
            if (p.id !== patchId) return p;
            
            // Merge: start with current state, apply response, then prioritize our updates
            // This ensures our position updates (x, y) take priority over stale backend data
            const merged = {
              ...p,
              ...response.patch,
              ...updates, // Our updates take priority (especially x, y)
              isValid: true
            };
            
            return merged;
          });
        });
      }
    } catch (err: any) {
      console.error('Error updating patch:', err);
      // Don't refetch on error during drag - it causes snap-back
      // Just log and continue with optimistic update
      // Only throw error so caller can handle if needed
      throw err;
    }
  }, [projectId]);

  const removePatch = useCallback(async (patchId: string) => {
    try {
      await apiClient.request<{ success: boolean }>(
        `/api/panels/${projectId}/patches/${patchId}`,
        { method: 'DELETE' }
      );
      await fetchPatches();
    } catch (err: any) {
      console.error('Error deleting patch:', err);
      throw err;
    }
  }, [projectId, fetchPatches]);

  return {
    patches,
    isLoading,
    error,
    addPatch,
    updatePatch,
    removePatch,
    refreshData: fetchPatches
  };
}

