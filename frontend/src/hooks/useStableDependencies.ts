'use client';

import { useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * Hook to prevent infinite render loops by stabilizing dependencies
 * 
 * Common patterns that cause infinite loops:
 * 1. Objects/arrays in useEffect dependencies
 * 2. Functions recreated on every render
 * 3. Missing dependency arrays
 * 4. State updates during render
 */

interface StableDependenciesOptions {
  componentName?: string;
  enableDebugging?: boolean;
  maxRenderFrequency?: number; // ms between renders to trigger warning
}

export function useStableDependencies(options: StableDependenciesOptions = {}) {
  const {
    componentName = 'Component',
    enableDebugging = process.env.NODE_ENV === 'development',
    maxRenderFrequency = 100
  } = options;

  const renderCount = useRef(0);
  const lastRenderTime = useRef(0);
  renderCount.current++;

  // Track render frequency
  useEffect(() => {
    if (enableDebugging) {
      const now = Date.now();
      const timeSinceLastRender = now - lastRenderTime.current;
      
      if (timeSinceLastRender < maxRenderFrequency && lastRenderTime.current > 0) {
        console.warn(`⚠️ ${componentName} rendering too frequently!`, {
          timeSinceLastRender,
          renderCount: renderCount.current,
          timestamp: now
        });
      }
      
      lastRenderTime.current = now;
    }
  });

  return {
    renderCount: renderCount.current,
    isRenderingTooFrequently: enableDebugging && 
      lastRenderTime.current > 0 && 
      (Date.now() - lastRenderTime.current) < maxRenderFrequency
  };
}

/**
 * Stabilize object dependencies by extracting primitive values
 */
export function useStablePrimitives<T extends Record<string, any>>(obj: T): T {
  return useMemo(() => {
    const stable: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Extract primitive values from objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if ('id' in value) stable[`${key}Id`] = value.id;
        if ('name' in value) stable[`${key}Name`] = value.name;
        if ('value' in value) stable[`${key}Value`] = value.value;
        // Add more primitive extractions as needed
      } else {
        stable[key] = value;
      }
    }
    return stable;
  }, [JSON.stringify(obj)]);
}

/**
 * Create a stable callback that won't cause re-renders
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  dependencies: React.DependencyList = []
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    ((...args: any[]) => callbackRef.current(...args)) as T,
    dependencies
  );
}

/**
 * Debug hook to track what causes re-renders
 */
export function useRenderDebugger(componentName: string, props: Record<string, any>) {
  const prevProps = useRef<Record<string, any>>();
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const changedProps = Object.keys(props).reduce((acc, key) => {
        if (prevProps.current && prevProps.current[key] !== props[key]) {
          acc[key] = {
            from: prevProps.current[key],
            to: props[key]
          };
        }
        return acc;
      }, {} as Record<string, any>);

      if (Object.keys(changedProps).length > 0) {
        console.log(`🔄 ${componentName} re-render caused by:`, changedProps);
      }

      prevProps.current = props;
    }
  });
}

/**
 * Common patterns to avoid infinite loops
 */
export const AntiPatterns = {
  // BAD - object in dependencies
  badObjectDependency: `
    // DON'T DO THIS
    const config = { projectId, userId };
    useEffect(() => {
      loadData(config);
    }, [config]); // config is recreated every render!
  `,

  // GOOD - primitive values
  goodPrimitiveDependency: `
    // DO THIS INSTEAD
    useEffect(() => {
      loadData({ projectId, userId });
    }, [projectId, userId]); // primitive values are stable
  `,

  // BAD - missing dependency array
  badMissingDependencies: `
    // DON'T DO THIS
    useEffect(() => {
      setLoading(true);
      loadData();
    }); // runs on every render!
  `,

  // GOOD - proper dependency array
  goodDependencyArray: `
    // DO THIS INSTEAD
    useEffect(() => {
      setLoading(true);
      loadData();
    }, []); // runs only on mount
  `,

  // BAD - state update during render
  badStateUpdateInRender: `
    // DON'T DO THIS
    function Component({ data }) {
      if (!data) {
        setData(fetchData()); // causes infinite loop!
      }
      return <div>{data}</div>;
    }
  `,

  // GOOD - useEffect for side effects
  goodUseEffectForSideEffects: `
    // DO THIS INSTEAD
    function Component({ data }) {
      const [localData, setLocalData] = useState(data);
      
      useEffect(() => {
        if (!localData) {
          setLocalData(fetchData());
        }
      }, [localData]);
      
      return <div>{localData}</div>;
    }
  `
};

export default useStableDependencies;
