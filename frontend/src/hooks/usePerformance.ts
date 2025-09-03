import { useCallback, useRef, useMemo } from 'react';

/**
 * Debounce hook for performance optimization
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;

  return debouncedCallback;
}

/**
 * Throttle hook for performance optimization
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallRef.current;

    if (timeSinceLastCall >= delay) {
      lastCallRef.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now();
        callback(...args);
      }, delay - timeSinceLastCall);
    }
  }, [callback, delay]) as T;

  return throttledCallback;
}

/**
 * Hook for frame-rate limited operations
 */
export function useFrameRateLimit<T extends (...args: any[]) => any>(
  callback: T,
  targetFPS: number = 60
): T {
  const lastFrameRef = useRef<number>(0);
  const frameInterval = 1000 / targetFPS;

  const frameLimitedCallback = useCallback((...args: Parameters<T>) => {
    const now = performance.now();
    const timeSinceLastFrame = now - lastFrameRef.current;

    if (timeSinceLastFrame >= frameInterval) {
      lastFrameRef.current = now;
      callback(...args);
    }
  }, [callback, frameInterval]) as T;

  return frameLimitedCallback;
}

/**
 * Hook for memoizing expensive calculations
 */
export function useExpensiveCalculation<T, D extends readonly unknown[]>(
  calculation: (...deps: D) => T,
  deps: D,
  options: {
    maxAge?: number; // Maximum age in milliseconds
    equalityFn?: (a: D, b: D) => boolean;
  } = {}
): T {
  const { maxAge = 1000, equalityFn } = options;
  const cacheRef = useRef<{
    result: T;
    deps: D;
    timestamp: number;
  }>();

  return useMemo(() => {
    const now = Date.now();
    const cached = cacheRef.current;

    // Check if we have a valid cached result
    if (cached && 
        (now - cached.timestamp) < maxAge &&
        (equalityFn ? equalityFn(cached.deps, deps) : 
         cached.deps.every((dep, index) => dep === deps[index]))) {
      return cached.result;
    }

    // Calculate new result
    const result = calculation(...deps);
    
    // Cache the result
    cacheRef.current = {
      result,
      deps: [...deps] as unknown as D,
      timestamp: now,
    };

    return result;
  }, deps);
}

/**
 * Hook for batching state updates
 */
export function useBatchedUpdates() {
  const batchRef = useRef<(() => void)[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const batchUpdate = useCallback((update: () => void) => {
    batchRef.current.push(update);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const updates = batchRef.current;
      batchRef.current = [];
      
      // Execute all batched updates
      updates.forEach(update => update());
    }, 0);
  }, []);

  return batchUpdate;
}

/**
 * Hook for measuring performance
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef<number>(0);
  const renderTimesRef = useRef<number[]>([]);

  const measureRender = useCallback(() => {
    const now = performance.now();
    const renderTime = now - lastRenderTimeRef.current;
    
    renderCountRef.current += 1;
    renderTimesRef.current.push(renderTime);
    
    // Keep only last 10 render times
    if (renderTimesRef.current.length > 10) {
      renderTimesRef.current.shift();
    }
    
    lastRenderTimeRef.current = now;

    if (process.env.NODE_ENV === 'development') {
      const avgRenderTime = renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length;
      console.log(`[${componentName}] Render #${renderCountRef.current}, Time: ${renderTime.toFixed(2)}ms, Avg: ${avgRenderTime.toFixed(2)}ms`);
    }
  }, [componentName]);

  return {
    measureRender,
    renderCount: renderCountRef.current,
    averageRenderTime: renderTimesRef.current.length > 0 
      ? renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length 
      : 0,
  };
}

/**
 * Hook for optimizing canvas operations
 */
export function useCanvasOptimization() {
  const lastRenderTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(60);

  const shouldRender = useCallback((force = false) => {
    const now = performance.now();
    const deltaTime = now - lastRenderTimeRef.current;
    
    // Target 60 FPS
    const targetFrameTime = 1000 / 60;
    
    if (force || deltaTime >= targetFrameTime) {
      lastRenderTimeRef.current = now;
      frameCountRef.current += 1;
      
      // Calculate FPS every 60 frames
      if (frameCountRef.current % 60 === 0) {
        fpsRef.current = 1000 / deltaTime;
      }
      
      return true;
    }
    
    return false;
  }, []);

  const getFPS = useCallback(() => fpsRef.current, []);

  return {
    shouldRender,
    getFPS,
    frameCount: frameCountRef.current,
  };
}
