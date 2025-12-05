/**
 * Centralized Telemetry Service
 * Provides error tracking, performance monitoring, and analytics
 */

export interface TelemetryConfig {
  enabled: boolean;
  environment: 'development' | 'staging' | 'production';
  errorTracking?: {
    enabled: boolean;
    dsn?: string;
    sampleRate?: number;
  };
  performanceMonitoring?: {
    enabled: boolean;
    sampleRate?: number;
  };
  analytics?: {
    enabled: boolean;
    endpoint?: string;
  };
}

export interface ErrorContext {
  userId?: string;
  userTier?: string;
  projectId?: string;
  component?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent';
  tags?: Record<string, string>;
  timestamp?: number;
}

export interface CostMetric {
  userId: string;
  userTier: string;
  service: string;
  model?: string;
  cost: number;
  tokens?: number;
  metadata?: Record<string, any>;
}

class TelemetryService {
  private config: TelemetryConfig;
  private errorQueue: Array<{ error: Error; context: ErrorContext }> = [];
  private metricQueue: Array<PerformanceMetric> = [];
  private costQueue: Array<CostMetric> = [];
  private flushInterval: ReturnType<typeof setTimeout> | null = null;

  constructor(config: TelemetryConfig) {
    this.config = config;
    
    if (config.enabled) {
      this.startFlushInterval();
      this.initializeErrorTracking();
    }
  }

  private initializeErrorTracking() {
    if (!this.config.errorTracking?.enabled) return;

    // Global error handlers
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.captureError(new Error(event.message), {
          component: 'global',
          operation: 'unhandled_error',
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error 
          ? event.reason 
          : new Error(String(event.reason));
        this.captureError(error, {
          component: 'global',
          operation: 'unhandled_promise_rejection',
        });
      });
    }
  }

  private startFlushInterval() {
    // Flush queues every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 5000);
  }

  /**
   * Capture and report errors
   */
  captureError(error: Error, context: ErrorContext = {}) {
    if (!this.config.enabled || !this.config.errorTracking?.enabled) {
      return;
    }

    // Apply sample rate
    if (this.config.errorTracking.sampleRate && 
        Math.random() > this.config.errorTracking.sampleRate) {
      return;
    }

    this.errorQueue.push({ error, context });

    // Log to console in development
    if (this.config.environment === 'development') {
      console.error('[Telemetry] Error captured:', {
        message: error.message,
        stack: error.stack,
        context,
      });
    }

    // Flush immediately for critical errors
    if (error.name === 'CriticalError' || context.metadata?.critical) {
      this.flush();
    }
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metric: PerformanceMetric) {
    if (!this.config.enabled || !this.config.performanceMonitoring?.enabled) {
      return;
    }

    // Apply sample rate
    if (this.config.performanceMonitoring.sampleRate && 
        Math.random() > this.config.performanceMonitoring.sampleRate) {
      return;
    }

    this.metricQueue.push({
      ...metric,
      timestamp: metric.timestamp || Date.now(),
    });
  }

  /**
   * Track cost/usage metrics
   */
  trackCost(cost: CostMetric) {
    if (!this.config.enabled) return;

    this.costQueue.push({
      ...cost,
    });

    // Send cost metrics immediately (they're important)
    this.flushCostMetrics();
  }

  /**
   * Track user events/analytics
   */
  trackEvent(eventName: string, properties?: Record<string, any>) {
    if (!this.config.enabled || !this.config.analytics?.enabled) {
      return;
    }

    // Send to analytics endpoint
    if (this.config.analytics.endpoint) {
      fetch(this.config.analytics.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: eventName,
          properties,
          timestamp: Date.now(),
          environment: this.config.environment,
        }),
      }).catch(() => {
        // Silently fail - analytics shouldn't break the app
      });
    }
  }

  /**
   * Flush all pending telemetry data
   */
  private async flush() {
    if (this.errorQueue.length > 0) {
      await this.flushErrors();
    }
    if (this.metricQueue.length > 0) {
      await this.flushMetrics();
    }
  }

  private async flushErrors() {
    const errors = this.errorQueue.splice(0, this.errorQueue.length);
    
    if (errors.length === 0) return;

    // Send to error tracking service
    if (this.config.errorTracking?.dsn) {
      try {
        await fetch(this.config.errorTracking.dsn, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            errors: errors.map(({ error, context }) => ({
              message: error.message,
              stack: error.stack,
              name: error.name,
              context,
              timestamp: Date.now(),
              environment: this.config.environment,
            })),
          }),
        });
      } catch (err) {
        // Silently fail - error tracking shouldn't break the app
        console.warn('[Telemetry] Failed to send errors:', err);
      }
    }
  }

  private async flushMetrics() {
    const metrics = this.metricQueue.splice(0, this.metricQueue.length);
    
    if (metrics.length === 0) return;

    // Send to metrics endpoint (if configured)
    // For now, just log in development
    if (this.config.environment === 'development') {
      console.log('[Telemetry] Performance metrics:', metrics);
    }
  }

  private async flushCostMetrics() {
    const costs = this.costQueue.splice(0, this.costQueue.length);
    
    if (costs.length === 0) return;

    // Send cost metrics to backend
    try {
      await fetch('/api/telemetry/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costs }),
      });
    } catch (err) {
      console.warn('[Telemetry] Failed to send cost metrics:', err);
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

// Singleton instance
let telemetryInstance: TelemetryService | null = null;

export function initializeTelemetry(config: TelemetryConfig): TelemetryService {
  if (telemetryInstance) {
    return telemetryInstance;
  }

  telemetryInstance = new TelemetryService(config);
  return telemetryInstance;
}

export function getTelemetry(): TelemetryService | null {
  return telemetryInstance;
}

export function captureError(error: Error, context?: ErrorContext) {
  getTelemetry()?.captureError(error, context);
}

export function trackPerformance(metric: PerformanceMetric) {
  getTelemetry()?.trackPerformance(metric);
}

export function trackCost(cost: CostMetric) {
  getTelemetry()?.trackCost(cost);
}

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  getTelemetry()?.trackEvent(eventName, properties);
}

