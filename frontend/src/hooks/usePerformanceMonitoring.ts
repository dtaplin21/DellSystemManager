'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  interactionDelay: number;
  cacheHitRatio: number;
  errorRate: number;
}

interface PerformanceThresholds {
  maxRenderTime: number;
  maxMemoryUsage: number;
  maxInteractionDelay: number;
  maxErrorRate: number;
  maxSidebarLoadTime: number;
}

interface PerformanceConfig {
  enabled: boolean;
  samplingRate: number;
  thresholds: PerformanceThresholds;
  monitoringInterval: number;
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  maxRenderTime: 16, // 60fps
  maxMemoryUsage: 200 * 1024 * 1024, // 200MB
  maxInteractionDelay: 100, // 100ms
  maxErrorRate: 0.01, // 1%
  maxSidebarLoadTime: 3000, // 3 seconds
};

const DEFAULT_CONFIG: PerformanceConfig = {
  enabled: process.env.NODE_ENV === 'development',
  samplingRate: 0.1, // Monitor 10% of users
  thresholds: DEFAULT_THRESHOLDS,
  monitoringInterval: 5000, // 5 seconds
};

export function usePerformanceMonitoring(config: Partial<PerformanceConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    interactionDelay: 0,
    cacheHitRatio: 0,
    errorRate: 0,
  });

  const renderStartTime = useRef<number>(0);
  const interactionStartTime = useRef<number>(0);
  const errorCount = useRef<number>(0);
  const totalRequests = useRef<number>(0);
  const cacheHits = useRef<number>(0);
  const lastRenderTime = useRef<number>(0);

  // Performance observer for measuring render times
  useEffect(() => {
    if (!finalConfig.enabled || typeof window === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'measure' && entry.name === 'render-time') {
          const renderTime = entry.duration;
          lastRenderTime.current = renderTime;
          
          if (renderTime > finalConfig.thresholds.maxRenderTime) {
            console.warn(`Performance warning: Render time ${renderTime}ms exceeds threshold ${finalConfig.thresholds.maxRenderTime}ms`);
          }
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });

    return () => observer.disconnect();
  }, [finalConfig.enabled, finalConfig.thresholds.maxRenderTime]);

  // Memory monitoring
  useEffect(() => {
    if (!finalConfig.enabled || typeof window === 'undefined') return;

    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const memoryUsage = memory.usedJSHeapSize;
        
        if (memoryUsage > finalConfig.thresholds.maxMemoryUsage) {
          console.warn(`Memory warning: ${memoryUsage / 1024 / 1024}MB exceeds threshold ${finalConfig.thresholds.maxMemoryUsage / 1024 / 1024}MB`);
        }
      }
    };

    const interval = setInterval(checkMemory, finalConfig.monitoringInterval);
    return () => clearInterval(interval);
  }, [finalConfig.enabled, finalConfig.thresholds.maxMemoryUsage, finalConfig.monitoringInterval]);

  // Start render timing
  const startRenderTiming = useCallback(() => {
    if (!finalConfig.enabled) return;
    renderStartTime.current = performance.now();
  }, [finalConfig.enabled]);

  // End render timing
  const endRenderTiming = useCallback(() => {
    if (!finalConfig.enabled || renderStartTime.current === 0) return;
    
    const renderTime = performance.now() - renderStartTime.current;
    performance.mark('render-end');
    performance.measure('render-time', 'render-start', 'render-end');
    
    setMetrics(prev => ({
      ...prev,
      renderTime,
    }));
    
    renderStartTime.current = 0;
  }, [finalConfig.enabled]);

  // Start interaction timing
  const startInteractionTiming = useCallback(() => {
    if (!finalConfig.enabled) return;
    interactionStartTime.current = performance.now();
  }, [finalConfig.enabled]);

  // End interaction timing
  const endInteractionTiming = useCallback(() => {
    if (!finalConfig.enabled || interactionStartTime.current === 0) return;
    
    const interactionDelay = performance.now() - interactionStartTime.current;
    
    if (interactionDelay > finalConfig.thresholds.maxInteractionDelay) {
      console.warn(`Interaction delay warning: ${interactionDelay}ms exceeds threshold ${finalConfig.thresholds.maxInteractionDelay}ms`);
    }
    
    setMetrics(prev => ({
      ...prev,
      interactionDelay,
    }));
    
    interactionStartTime.current = 0;
  }, [finalConfig.enabled, finalConfig.thresholds.maxInteractionDelay]);

  // Track errors
  const trackError = useCallback((error: Error) => {
    if (!finalConfig.enabled) return;
    
    errorCount.current += 1;
    totalRequests.current += 1;
    
    const errorRate = totalRequests.current > 0 ? errorCount.current / totalRequests.current : 0;
    
    if (errorRate > finalConfig.thresholds.maxErrorRate) {
      console.warn(`Error rate warning: ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(finalConfig.thresholds.maxErrorRate * 100).toFixed(2)}%`);
    }
    
    setMetrics(prev => ({
      ...prev,
      errorRate,
    }));
    
    // Send to monitoring service
    sendMetric('error', 1, { errorType: error.name, errorMessage: error.message });
  }, [finalConfig.enabled, finalConfig.thresholds.maxErrorRate]);

  // Track cache hits
  const trackCacheHit = useCallback(() => {
    if (!finalConfig.enabled) return;
    
    cacheHits.current += 1;
    totalRequests.current += 1;
    
    const cacheHitRatio = totalRequests.current > 0 ? cacheHits.current / totalRequests.current : 0;
    
    setMetrics(prev => ({
      ...prev,
      cacheHitRatio,
    }));
  }, [finalConfig.enabled]);

  // Track cache miss
  const trackCacheMiss = useCallback(() => {
    if (!finalConfig.enabled) return;
    
    totalRequests.current += 1;
    
    const cacheHitRatio = totalRequests.current > 0 ? cacheHits.current / totalRequests.current : 0;
    
    setMetrics(prev => ({
      ...prev,
      cacheHitRatio,
    }));
  }, [finalConfig.enabled]);

  // Send metrics to monitoring service
  const sendMetric = useCallback((metric: string, value: number, tags?: Record<string, string>) => {
    if (!finalConfig.enabled || Math.random() > finalConfig.samplingRate) return;
    
    // DataDog example
    if (typeof window !== 'undefined' && (window as any).DD_LOGS) {
      (window as any).DD_LOGS.logger.info('performance_metric', {
        metric,
        value,
        ...tags,
        timestamp: Date.now(),
      });
    }
    
    // LogRocket example
    if (typeof window !== 'undefined' && (window as any).LogRocket) {
      (window as any).LogRocket.track('Performance Metric', {
        metric,
        value,
        ...tags,
      });
    }
    
    // Custom analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'performance_metric', {
        metric_name: metric,
        metric_value: value,
        ...tags,
      });
    }
  }, [finalConfig.enabled, finalConfig.samplingRate]);

  // Get current memory usage
  const getMemoryUsage = useCallback(() => {
    if (typeof window === 'undefined' || !('memory' in performance)) return 0;
    
    const memory = (performance as any).memory;
    return memory.usedJSHeapSize;
  }, []);

  // Check if performance is within thresholds
  const isPerformanceHealthy = useCallback(() => {
    return (
      metrics.renderTime <= finalConfig.thresholds.maxRenderTime &&
      metrics.memoryUsage <= finalConfig.thresholds.maxMemoryUsage &&
      metrics.interactionDelay <= finalConfig.thresholds.maxInteractionDelay &&
      metrics.errorRate <= finalConfig.thresholds.maxErrorRate
    );
  }, [metrics, finalConfig.thresholds]);

  // Get performance score (0-100)
  const getPerformanceScore = useCallback(() => {
    const renderScore = Math.max(0, 100 - (metrics.renderTime / finalConfig.thresholds.maxRenderTime) * 100);
    const memoryScore = Math.max(0, 100 - (metrics.memoryUsage / finalConfig.thresholds.maxMemoryUsage) * 100);
    const interactionScore = Math.max(0, 100 - (metrics.interactionDelay / finalConfig.thresholds.maxInteractionDelay) * 100);
    const errorScore = Math.max(0, 100 - (metrics.errorRate / finalConfig.thresholds.maxErrorRate) * 100);
    
    return Math.round((renderScore + memoryScore + interactionScore + errorScore) / 4);
  }, [metrics, finalConfig.thresholds]);

  return {
    metrics,
    config: finalConfig,
    startRenderTiming,
    endRenderTiming,
    startInteractionTiming,
    endInteractionTiming,
    trackError,
    trackCacheHit,
    trackCacheMiss,
    sendMetric,
    getMemoryUsage,
    isPerformanceHealthy,
    getPerformanceScore,
  };
}

export default usePerformanceMonitoring;