/**
 * Telemetry logging helper for debug/development purposes
 * Only sends telemetry if explicitly enabled via environment variable
 */

const TELEMETRY_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TELEMETRY === 'true';
const TELEMETRY_URL = 'http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893';

interface TelemetryData {
  location: string;
  message: string;
  data?: any;
  timestamp?: number;
  sessionId?: string;
  runId?: string;
  hypothesisId?: string;
}

export interface ErrorContext {
  component: string;
  operation: string;
  metadata?: Record<string, any>;
}

/**
 * Log telemetry data (only if telemetry is enabled)
 * Silently fails if telemetry service is unavailable
 */
export function logTelemetry(data: TelemetryData): void {
  // Only send telemetry if explicitly enabled
  if (!TELEMETRY_ENABLED) {
    return;
  }

  // Ensure timestamp is set
  const telemetryData = {
    ...data,
    timestamp: data.timestamp || Date.now(),
  };

  // Send telemetry asynchronously - don't block execution
  fetch(TELEMETRY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(telemetryData),
  }).catch(() => {
    // Silently fail - telemetry is optional and shouldn't break the app
  });
}

/**
 * Capture an error to telemetry (only if telemetry is enabled)
 */
export function captureError(error: unknown, context: ErrorContext): void {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);

  const stack = error instanceof Error ? error.stack : undefined;

  logTelemetry({
    location: `${context.component}.${context.operation}`,
    message,
    data: {
      ...context.metadata,
      stack,
    },
  });
}
