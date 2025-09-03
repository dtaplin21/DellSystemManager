import { useState, useCallback, useEffect } from 'react';

interface UseLocalStorageOptions {
  enableLogging?: boolean;
  onError?: (error: Error, key: string) => void;
}

/**
 * Safe localStorage hook with proper error handling
 * Prevents crashes from localStorage failures and provides fallbacks
 */
export function useLocalStorage<T>(
  key: string, 
  defaultValue: T,
  options: UseLocalStorageOptions = {}
): [T, (value: T) => void, () => void] {
  const { enableLogging = false, onError } = options;

  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.log(`[useLocalStorage:${key}] ${message}`, data);
    }
  }, [key, enableLogging]);

  const handleError = useCallback((error: Error, operation: string) => {
    log(`Error during ${operation}:`, error);
    onError?.(error, key);
  }, [log, onError, key]);

  // Initialize state with safe localStorage read
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      log('Server-side rendering, using default value');
      return defaultValue;
    }

    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        log('No stored value found, using default');
        return defaultValue;
      }

      const parsed = JSON.parse(item);
      log('Successfully loaded from localStorage', parsed);
      return parsed;
    } catch (error) {
      handleError(error as Error, 'initialization');
      log('Failed to parse stored value, using default');
      return defaultValue;
    }
  });

  // Update localStorage when value changes
  const setValue = useCallback((value: T) => {
    try {
      setStoredValue(value);
      
      if (typeof window === 'undefined') {
        log('Server-side rendering, skipping localStorage write');
        return;
      }

      localStorage.setItem(key, JSON.stringify(value));
      log('Successfully saved to localStorage', value);
    } catch (error) {
      handleError(error as Error, 'save');
      // Still update the state even if localStorage fails
      setStoredValue(value);
    }
  }, [key, log, handleError]);

  // Clear localStorage
  const clearValue = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
        log('Successfully cleared localStorage');
      }
      setStoredValue(defaultValue);
    } catch (error) {
      handleError(error as Error, 'clear');
    }
  }, [key, defaultValue, log, handleError]);

  // Listen for changes from other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue);
          log('Storage changed from another tab', newValue);
          setStoredValue(newValue);
        } catch (error) {
          handleError(error as Error, 'storage change');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, log, handleError]);

  return [storedValue, setValue, clearValue];
}

/**
 * Specialized hook for panel positions
 */
export function usePanelPositions() {
  const [positions, setPositions, clearPositions] = useLocalStorage<Record<string, { x: number; y: number; rotation?: number }>>(
    'panelLayoutPositions',
    {},
    { enableLogging: process.env.NODE_ENV === 'development' }
  );

  const updatePanelPosition = useCallback((panelId: string, position: { x: number; y: number; rotation?: number }) => {
    const newPositions = { ...positions };
    newPositions[panelId] = position;
    setPositions(newPositions);
  }, [positions, setPositions]);

  const removePanelPosition = useCallback((panelId: string) => {
    const { [panelId]: removed, ...rest } = positions;
    setPositions(rest);
  }, [positions, setPositions]);

  const getPanelPosition = useCallback((panelId: string) => {
    return positions[panelId] || null;
  }, [positions]);

  return {
    positions,
    updatePanelPosition,
    removePanelPosition,
    getPanelPosition,
    clearPositions,
  };
}

/**
 * Specialized hook for canvas state
 */
export function useCanvasState() {
  const [canvasState, setCanvasState, clearCanvasState] = useLocalStorage<{
    worldScale: number;
    worldOffsetX: number;
    worldOffsetY: number;
  }>(
    'panelLayoutCanvasState',
    {
      worldScale: 1,
      worldOffsetX: 0,
      worldOffsetY: 0,
    },
    { enableLogging: process.env.NODE_ENV === 'development' }
  );

  const updateCanvasState = useCallback((updates: Partial<typeof canvasState>) => {
    const newState = { ...canvasState, ...updates };
    setCanvasState(newState);
  }, [canvasState, setCanvasState]);

  return {
    canvasState,
    updateCanvasState,
    clearCanvasState,
  };
}
