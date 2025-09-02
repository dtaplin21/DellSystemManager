import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Panel, validatePanel } from '@/types/panel';
import { usePanelPositions } from './useLocalStorage';

interface UsePanelSyncOptions {
  externalPanels: Panel[];
  onPanelUpdate?: (panels: Panel[]) => void;
  enableDebugLogging?: boolean;
}

interface UsePanelSyncReturn {
  panels: Panel[];
  isLoading: boolean;
  error: string | null;
  syncWithExternal: (newPanels: Panel[]) => void;
  clearError: () => void;
}

/**
 * Custom hook for synchronizing external panel data with localStorage positions
 * Handles the complex logic of merging backend data with user-saved positions
 */
export function usePanelSync({
  externalPanels,
  onPanelUpdate,
  enableDebugLogging = false,
}: UsePanelSyncOptions): UsePanelSyncReturn {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { positions, updatePanelPosition, clearPositions } = usePanelPositions();

  const log = useCallback((message: string, data?: any) => {
    if (enableDebugLogging) {
      console.log(`[usePanelSync] ${message}`, data);
    }
  }, [enableDebugLogging]);

  // Apply localStorage positions to panels
  const applyStoredPositions = useCallback((panelsToProcess: Panel[]): Panel[] => {
    if (!panelsToProcess || panelsToProcess.length === 0) {
      log('No panels to process');
      return [];
    }

    const validPanels = panelsToProcess.filter(validatePanel);
    log('Valid panels after filtering', { 
      original: panelsToProcess.length, 
      valid: validPanels.length 
    });

    if (validPanels.length === 0) {
      log('No valid panels found');
      return [];
    }

    // Apply localStorage positions
    const panelsWithPositions = validPanels.map(panel => {
      const storedPosition = positions[panel.id];
      if (storedPosition) {
        log(`Applying stored position for panel ${panel.id}`, storedPosition);
        return {
          ...panel,
          x: storedPosition.x,
          y: storedPosition.y,
          rotation: storedPosition.rotation ?? panel.rotation,
          isValid: true,
        };
      }
      return panel;
    });

    log('Panels with positions applied', { 
      total: panelsWithPositions.length,
      withStoredPositions: panelsWithPositions.filter(p => positions[p.id]).length
    });

    return panelsWithPositions;
  }, [positions, log]);

  // Sync with external panels
  const syncWithExternal = useCallback((newPanels: Panel[]) => {
    log('Syncing with external panels', { count: newPanels?.length || 0 });
    
    setIsLoading(true);
    setError(null);

    try {
      if (!newPanels || !Array.isArray(newPanels)) {
        log('Invalid external panels data', newPanels);
        setPanels([]);
        onPanelUpdate?.([]);
        return;
      }

      const processedPanels = applyStoredPositions(newPanels);
      setPanels(processedPanels);
      onPanelUpdate?.(processedPanels);
      
      log('Sync completed successfully', { 
        external: newPanels.length, 
        processed: processedPanels.length 
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown sync error';
      log('Sync error', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [applyStoredPositions, onPanelUpdate, log]);

  // Auto-sync when external panels change
  useEffect(() => {
    if (externalPanels) {
      syncWithExternal(externalPanels);
    }
  }, [externalPanels, syncWithExternal]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Memoized panel statistics
  const panelStats = useMemo(() => {
    return {
      total: panels.length,
      valid: panels.filter(p => p.isValid).length,
      withStoredPositions: panels.filter(p => positions[p.id]).length,
      hasError: !!error,
      isLoading,
    };
  }, [panels, positions, error, isLoading]);

  // Debug logging for panel stats
  useEffect(() => {
    if (enableDebugLogging && panels.length > 0) {
      log('Panel statistics', panelStats);
    }
  }, [panelStats, enableDebugLogging, log]);

  return {
    panels,
    isLoading,
    error,
    syncWithExternal,
    clearError,
  };
}

/**
 * Hook for managing panel persistence
 * Handles saving panel positions to localStorage when they change
 */
export function usePanelPersistence(panels: Panel[], enableDebugLogging = false) {
  const { updatePanelPosition, clearPositions } = usePanelPositions();
  const lastSavedRef = useRef<string>('');

  const log = useCallback((message: string, data?: any) => {
    if (enableDebugLogging) {
      console.log(`[usePanelPersistence] ${message}`, data);
    }
  }, [enableDebugLogging]);

  // Save panel positions when they change
  useEffect(() => {
    if (!panels || panels.length === 0) return;

    // Create a hash of current panel positions
    const positionHash = panels
      .map(p => `${p.id}:${p.x},${p.y},${p.rotation || 0}`)
      .sort()
      .join('|');

    // Only save if positions have actually changed
    if (positionHash === lastSavedRef.current) {
      return;
    }

    try {
      // Update localStorage with current positions
      panels.forEach(panel => {
        if (panel.isValid) {
          updatePanelPosition(panel.id, {
            x: panel.x,
            y: panel.y,
            rotation: panel.rotation,
          });
        }
      });

      lastSavedRef.current = positionHash;
      log('Saved panel positions', { 
        panelCount: panels.length,
        hash: positionHash.substring(0, 50) + '...'
      });
    } catch (error) {
      log('Error saving panel positions', error);
    }
  }, [panels, updatePanelPosition, log]);

  // Clear all positions
  const clearAllPositions = useCallback(() => {
    clearPositions();
    lastSavedRef.current = '';
    log('Cleared all panel positions');
  }, [clearPositions, log]);

  return {
    clearAllPositions,
  };
}
