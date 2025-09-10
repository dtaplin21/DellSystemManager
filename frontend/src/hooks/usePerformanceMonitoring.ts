'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { WORLD_CONSTANTS, checkPerformanceThresholds } from '@/lib/world-coordinates';

interface PerformanceMetrics {
  fps: number;
  renderTime: number;
  memoryUsage: number;
  isLowPerf: boolean;
  isSlowRender: boolean;
  isHighMemory: boolean;
  frameCount: number;
  averageRenderTime: number;
}

interface PerformanceMonitoringOptions {
  enabled?: boolean;
  reportInterval?: number; // frames
  onPerformanceIssue?: (metrics: PerformanceMetrics) => void;
  onLowPerformance?: (metrics: PerformanceMetrics) => void;
}

/**
 * Hook for monitoring rendering performance
 * Tracks FPS, render times, and memory usage
 */
export function usePerformanceMonitoring(options: PerformanceMonitoringOptions = {}) {
  const {
    enabled = true,
    reportInterval = 60, // Report every 60 frames
    onPerformanceIssue,
    onLowPerformance
  } = options;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    renderTime: 0,
    memoryUsage: 0,
    isLowPerf: false,
    isSlowRender: false,
    isHighMemory: false,
    frameCount: 0,
    averageRenderTime: 0
  });

  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const renderTimesRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number>();
  const isMonitoringRef = useRef(false);

  // Calculate FPS
  const calculateFPS = useCallback(() => {
    const now = performance.now();
    const deltaTime = now - lastFrameTimeRef.current;
    const fps = deltaTime > 0 ? 1000 / deltaTime : 60;
    lastFrameTimeRef.current = now;
    return Math.min(60, Math.max(0, fps));
  }, []);

  // Get memory usage (if available)
  const getMemoryUsage = useCallback((): number => {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
    return 0;
  }, []);

  // Calculate average render time
  const calculateAverageRenderTime = useCallback((newRenderTime: number): number => {
    renderTimesRef.current.push(newRenderTime);
    
    // Keep only last 60 render times for rolling average
    if (renderTimesRef.current.length > 60) {
      renderTimesRef.current.shift();
    }
    
    const sum = renderTimesRef.current.reduce((acc, time) => acc + time, 0);
    return sum / renderTimesRef.current.length;
  }, []);

  // Performance monitoring loop
  const monitorPerformance = useCallback(() => {
    if (!enabled || isMonitoringRef.current) return;

    isMonitoringRef.current = true;
    frameCountRef.current = 0;

    const monitor = () => {
      frameCountRef.current++;
      
      if (frameCountRef.current % reportInterval === 0) {
        const fps = calculateFPS();
        const memoryUsage = getMemoryUsage();
        const averageRenderTime = calculateAverageRenderTime(metrics.renderTime);
        
        const newMetrics: PerformanceMetrics = {
          fps,
          renderTime: metrics.renderTime,
          memoryUsage,
          isLowPerf: fps < WORLD_CONSTANTS.LOW_FPS_THRESHOLD,
          isSlowRender: metrics.renderTime > WORLD_CONSTANTS.SLOW_RENDER_THRESHOLD_MS,
          isHighMemory: memoryUsage > WORLD_CONSTANTS.MEMORY_WARNING_THRESHOLD_MB,
          frameCount: frameCountRef.current,
          averageRenderTime
        };

        setMetrics(newMetrics);

        // Check for performance issues
        const thresholds = checkPerformanceThresholds(
          metrics.renderTime,
          fps,
          memoryUsage
        );

        if (thresholds.isSlowRender || thresholds.isLowFps || thresholds.isHighMemory) {
          onPerformanceIssue?.(newMetrics);
        }

        if (newMetrics.isLowPerf) {
          onLowPerformance?.(newMetrics);
        }

        // Log performance warnings in development
        if (process.env.NODE_ENV === 'development') {
          if (thresholds.isSlowRender) {
            console.warn(`Slow render detected: ${metrics.renderTime.toFixed(2)}ms`);
          }
          if (thresholds.isLowFps) {
            console.warn(`Low FPS detected: ${fps.toFixed(1)}fps`);
          }
          if (thresholds.isHighMemory) {
            console.warn(`High memory usage: ${memoryUsage.toFixed(1)}MB`);
          }
        }
      }

      if (enabled) {
        animationFrameRef.current = requestAnimationFrame(monitor);
      }
    };

    monitor();
  }, [enabled, reportInterval, calculateFPS, getMemoryUsage, calculateAverageRenderTime, metrics.renderTime, onPerformanceIssue, onLowPerformance]);

  // Start/stop monitoring
  useEffect(() => {
    if (enabled) {
      monitorPerformance();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      isMonitoringRef.current = false;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      isMonitoringRef.current = false;
    };
  }, [enabled, monitorPerformance]);

  // Function to record render time
  const recordRenderTime = useCallback((renderTime: number) => {
    setMetrics(prev => ({
      ...prev,
      renderTime
    }));
  }, []);

  // Function to reset metrics
  const resetMetrics = useCallback(() => {
    setMetrics({
      fps: 60,
      renderTime: 0,
      memoryUsage: 0,
      isLowPerf: false,
      isSlowRender: false,
      isHighMemory: false,
      frameCount: 0,
      averageRenderTime: 0
    });
    frameCountRef.current = 0;
    renderTimesRef.current = [];
  }, []);

  // Function to get current performance status
  const getPerformanceStatus = useCallback((): 'good' | 'warning' | 'critical' => {
    if (metrics.isLowPerf || metrics.isHighMemory) {
      return 'critical';
    }
    if (metrics.isSlowRender || metrics.averageRenderTime > WORLD_CONSTANTS.SLOW_RENDER_THRESHOLD_MS) {
      return 'warning';
    }
    return 'good';
  }, [metrics]);

  return {
    metrics,
    recordRenderTime,
    resetMetrics,
    getPerformanceStatus,
    isMonitoring: isMonitoringRef.current
  };
}

/**
 * Hook for performance-aware rendering
 * Automatically adjusts rendering quality based on performance
 */
export function usePerformanceAwareRendering() {
  const { metrics, getPerformanceStatus } = usePerformanceMonitoring({
    onLowPerformance: (metrics) => {
      console.warn('Low performance detected, consider reducing quality:', metrics);
    }
  });

  const performanceStatus = getPerformanceStatus();

  // Performance-based rendering settings
  const renderingSettings = {
    // Grid settings
    gridQuality: performanceStatus === 'good' ? 'high' : performanceStatus === 'warning' ? 'medium' : 'low',
    gridDensity: performanceStatus === 'good' ? 1 : performanceStatus === 'warning' ? 2 : 4,
    
    // Panel settings
    panelDetail: performanceStatus === 'good' ? 'high' : 'low',
    showPanelLabels: performanceStatus !== 'critical',
    
    // Animation settings
    enableAnimations: performanceStatus === 'good',
    animationDuration: performanceStatus === 'good' ? 300 : performanceStatus === 'warning' ? 150 : 0,
    
    // Culling settings
    cullingBuffer: performanceStatus === 'good' ? 1 : performanceStatus === 'warning' ? 2 : 4,
    maxVisiblePanels: performanceStatus === 'good' ? 1000 : performanceStatus === 'warning' ? 500 : 100
  };

  return {
    metrics,
    performanceStatus,
    renderingSettings,
    shouldReduceQuality: performanceStatus !== 'good'
  };
}

export default usePerformanceMonitoring;
