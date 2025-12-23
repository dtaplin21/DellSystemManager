import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { AsbuiltRecord } from '@/types/asbuilt';

interface UseFormDataOptions {
  projectId: string;
  asbuiltRecordId?: string; // Direct link - the form that created the item
  panelId?: string; // Indirect link - all forms linked to the panel
}

interface UseFormDataReturn {
  forms: AsbuiltRecord[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch form data for panels/patches/destructs
 * Fetches forms linked via:
 * - Direct link: asbuiltRecordId (the form that created the item)
 * - Indirect link: panelId (all forms linked to the panel)
 */
export function useFormData({ 
  projectId, 
  asbuiltRecordId, 
  panelId 
}: UseFormDataOptions): UseFormDataReturn {
  const [forms, setForms] = useState<AsbuiltRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForms = useCallback(async () => {
    if (!projectId) {
      setForms([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const allForms: AsbuiltRecord[] = [];

      // Fetch direct link form (if asbuiltRecordId provided)
      if (asbuiltRecordId) {
        try {
          const directResponse = await apiClient.request<{ success: boolean; record: AsbuiltRecord }>(
            `/api/asbuilt/records/${asbuiltRecordId}`,
            { method: 'GET' }
          );
          
          if (directResponse.success && directResponse.record) {
            allForms.push(directResponse.record);
          }
        } catch (err) {
          console.warn('Error fetching direct form link:', err);
          // Don't fail - continue with indirect links
        }
      }

      // Fetch indirect link forms (if panelId provided)
      if (panelId) {
        try {
          const params = new URLSearchParams();
          params.append('projectId', projectId);
          params.append('panelId', panelId);
          
          const indirectResponse = await apiClient.request<{ success: boolean; records: AsbuiltRecord[] }>(
            `/api/asbuilt/records?${params.toString()}`,
            { method: 'GET' }
          );
          
          if (indirectResponse.success && Array.isArray(indirectResponse.records)) {
            // Filter out duplicate if direct link was already added
            const indirectForms = indirectResponse.records.filter(
              form => !asbuiltRecordId || form.id !== asbuiltRecordId
            );
            allForms.push(...indirectForms);
          }
        } catch (err) {
          console.warn('Error fetching indirect form links:', err);
          // Don't fail - we may still have direct link forms
        }
      }

      // If no specific links, fetch all forms for the project
      if (!asbuiltRecordId && !panelId) {
        try {
          const params = new URLSearchParams();
          params.append('projectId', projectId);
          
          const projectResponse = await apiClient.request<{ success: boolean; records: AsbuiltRecord[] }>(
            `/api/asbuilt/records?${params.toString()}`,
            { method: 'GET' }
          );
          
          if (projectResponse.success && Array.isArray(projectResponse.records)) {
            allForms.push(...projectResponse.records);
          }
        } catch (err) {
          console.warn('Error fetching project forms:', err);
        }
      }

      setForms(allForms);
    } catch (err: any) {
      console.error('Error fetching form data:', err);
      setError(err.message || 'Failed to fetch form data');
      setForms([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, asbuiltRecordId, panelId]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  return {
    forms,
    isLoading,
    error,
    refresh: fetchForms
  };
}

