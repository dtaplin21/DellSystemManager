'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  fps: number;
  renderTime: number;
  memoryUsage: number;
  isLowPerf: boolean;
  isSlowRender: boolean;
  averageRenderTime: number;
}

interface PerformanceMonitoringOptions {
  onPerformanceIssue?: (metrics: PerformanceMetrics) => void;
  lowFpsThreshold?: number;
  slowRenderThreshold?: number;
  updateInterval?: number;
}

export function usePerformanceMonitoring({
  onPerformanceIssue,
  lowFpsThreshold = 30,
  slowRenderThreshold = 16,
  updateInterval = 1000
}: PerformanceMonitoringOptions = {}): {
  metrics: PerformanceMetrics;
  recordRenderTime: (renderTime: number) => void;
  reset: () => void;
} {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    renderTime: 0,
    memoryUsage: 0,
    isLowPerf: false,
    isSlowRender: false,
    averageRenderTime: 0
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const renderTimesRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number>();

  // Record render time
  const recordRenderTime = useCallback((renderTime: number) => {
    renderTimesRef.current.push(renderTime);
    
    // Keep only last 60 render times for average calculation
    if (renderTimesRef.current.length > 60) {
      renderTimesRef.current.shift();
    }
  }, []);

  // Calculate average render time
  const calculateAverageRenderTime = useCallback(() => {
    if (renderTimesRef.current.length === 0) return 0;
    
    const sum = renderTimesRef.current.reduce((acc, time) => acc + time, 0);
    return sum / renderTimesRef.current.length;
  }, []);

  // Performance monitoring loop
  useEffect(() => {
    let lastUpdateTime = performance.now();
    
    const monitor = () => {
      const now = performance.now();
      const deltaTime = now - lastUpdateTime;
      
      // Update every updateInterval milliseconds
      if (deltaTime >= updateInterval) {
        frameCountRef.current++;
        
        // Calculate FPS
        const fps = (frameCountRef.current * 1000) / deltaTime;
        
        // Get memory usage (if available)
        const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
        const memoryUsageMB = memoryUsage / (1024 * 1024);
        
        // Calculate average render time
        const averageRenderTime = calculateAverageRenderTime();
        
        // Determine if performance is low
        const isLowPerf = fps < lowFpsThreshold;
        const isSlowRender = averageRenderTime > slowRenderThreshold;
        
        const newMetrics: PerformanceMetrics = {
          fps: parseFloat(fps.toFixed(1)),
          renderTime: averageRenderTime,
          memoryUsage: parseFloat(memoryUsageMB.toFixed(2)),
          isLowPerf,
          isSlowRender,
          averageRenderTime: parseFloat(averageRenderTime.toFixed(2))
        };
        
        setMetrics(newMetrics);
        
        // Notify about performance issues
        if (onPerformanceIssue && (isLowPerf || isSlowRender)) {
          onPerformanceIssue(newMetrics);
        }
        
        // Reset counters
        frameCountRef.current = 0;
        lastUpdateTime = now;
      }
      
      animationFrameRef.current = requestAnimationFrame(monitor);
    };
    
    animationFrameRef.current = requestAnimationFrame(monitor);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [onPerformanceIssue, lowFpsThreshold, slowRenderThreshold, updateInterval, calculateAverageRenderTime]);

  // Reset function
  const reset = useCallback(() => {
    frameCountRef.current = 0;
    lastTimeRef.current = performance.now();
    renderTimesRef.current = [];
    
    setMetrics({
      fps: 60,
      renderTime: 0,
      memoryUsage: 0,
      isLowPerf: false,
      isSlowRender: false,
      averageRenderTime: 0
    });
  }, []);

  return {
    metrics,
    recordRenderTime,
    reset
  };
}

export default usePerformanceMonitoring;