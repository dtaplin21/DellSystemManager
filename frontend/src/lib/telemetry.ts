/**
 * Frontend Telemetry Integration
 * Initializes and provides telemetry services for the frontend
 */

import { 
  initializeTelemetry, 
  getTelemetry,
  captureError,
  trackPerformance,
  trackCost,
  trackEvent,
  type TelemetryConfig,
  type ErrorContext,
  type PerformanceMetric,
  type CostMetric,
} from '../../../shared/telemetry';

// Initialize telemetry on module load
const telemetryConfig: TelemetryConfig = {
  enabled: process.env.NEXT_PUBLIC_TELEMETRY_ENABLED !== 'false',
  environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  errorTracking: {
    enabled: true,
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.NEXT_PUBLIC_ERROR_TRACKING_ENDPOINT,
    sampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0.1, // 100% in prod, 10% in dev
  },
  performanceMonitoring: {
    enabled: true,
    sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
  },
  analytics: {
    enabled: true,
    endpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || '/api/telemetry/analytics',
  },
};

// Initialize if enabled
if (typeof window !== 'undefined' && telemetryConfig.enabled) {
  initializeTelemetry(telemetryConfig);
}

// Export convenience functions
export {
  captureError,
  trackPerformance,
  trackCost,
  trackEvent,
  getTelemetry,
};

export type { ErrorContext, PerformanceMetric, CostMetric };

