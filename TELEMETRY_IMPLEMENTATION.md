# Telemetry Implementation Guide

This document describes the comprehensive telemetry system implemented across the GeoSynth QC Pro application.

## Overview

The telemetry system provides centralized error tracking, performance monitoring, cost analytics, and user behavior tracking across all platforms (web, mobile, and backend services).

## Architecture

### Components

1. **Shared Telemetry Service** (`shared/telemetry.ts`)
   - Core telemetry functionality
   - Error tracking, performance metrics, cost tracking
   - Event analytics

2. **Frontend Integration** (`frontend/src/lib/telemetry.ts`)
   - React/Next.js integration
   - Automatic error boundary integration
   - Performance monitoring hooks

3. **Backend API** (`backend/routes/telemetry.js`)
   - REST endpoints for telemetry data
   - Database storage
   - Analytics queries

4. **AI Service Integration** (`ai_service/telemetry.py`)
   - Python telemetry service
   - Cost tracking for AI operations
   - Error tracking

5. **Mobile Integration** (`mobile/ios/.../TelemetryService.swift`)
   - iOS telemetry service
   - Error tracking
   - Performance metrics

## Features

### 1. Error Tracking

**Frontend:**
```typescript
import { captureError } from '@/lib/telemetry';

try {
  // Your code
} catch (error) {
  captureError(error, {
    component: 'PanelLayout',
    operation: 'saveLayout',
    userId: user.id
  });
}
```

**Backend:**
```javascript
// Automatic via error handler middleware
// Or manually:
const telemetry = require('./lib/telemetry');
telemetry.captureError(error, { endpoint: '/api/panels' });
```

**AI Service:**
```python
from telemetry import get_telemetry

telemetry = get_telemetry()
telemetry.track_error(error, context={'endpoint': '/analyze'})
```

**Mobile:**
```swift
TelemetryService.shared.trackError(error, context: [
    "component": "ImageUpload",
    "operation": "upload"
])
```

### 2. Performance Monitoring

**Frontend:**
```typescript
import { trackPerformance } from '@/lib/telemetry';

trackPerformance({
  name: 'panel_render',
  value: renderTime,
  unit: 'ms',
  tags: { panelCount: panels.length }
});
```

**AI Service:**
```python
telemetry.track_performance(
    metric_name='document_analysis',
    value=duration_ms,
    unit='ms',
    component='ai_service'
)
```

### 3. Cost Tracking

**Frontend:**
```typescript
import { trackCost } from '@/lib/telemetry';

trackCost({
  userId: user.id,
  userTier: user.tier,
  service: 'ai_service',
  cost: 0.05,
  model: 'gpt-4o',
  tokens: 1000
});
```

**AI Service:**
```python
telemetry.track_cost(
    user_id=user_id,
    user_tier=user_tier,
    service='ai_service',
    cost=cost,
    model=model,
    tokens=tokens
)
```

### 4. Analytics Events

**Frontend:**
```typescript
import { trackEvent } from '@/lib/telemetry';

trackEvent('panel_created', {
  panelId: panel.id,
  projectId: project.id
});
```

## Database Schema

### Tables

1. **cost_metrics** - Tracks AI service costs
   - user_id, user_tier, service, model
   - cost, tokens, metadata
   - created_at

2. **error_logs** - Stores error information
   - error_message, error_stack, error_name
   - context (JSONB), environment, user_id
   - created_at

3. **analytics_events** - User behavior tracking
   - event_name, properties (JSONB)
   - environment, created_at

4. **performance_metrics** - Performance data
   - metric_name, metric_value, metric_unit
   - tags (JSONB), user_id, component
   - created_at

## Configuration

### Environment Variables

**Frontend:**
```env
NEXT_PUBLIC_TELEMETRY_ENABLED=true
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn (optional)
NEXT_PUBLIC_ANALYTICS_ENDPOINT=/api/telemetry/analytics
```

**Backend:**
```env
TELEMETRY_ENABLED=true
ENVIRONMENT=production
```

**AI Service:**
```env
TELEMETRY_ENABLED=true
BACKEND_URL=http://localhost:8003
ENVIRONMENT=production
```

## API Endpoints

### POST /api/telemetry/cost
Track cost metrics
```json
{
  "costs": [{
    "userId": "user123",
    "userTier": "paid",
    "service": "ai_service",
    "cost": 0.05,
    "model": "gpt-4o",
    "tokens": 1000
  }]
}
```

### POST /api/telemetry/errors
Track errors
```json
{
  "errors": [{
    "message": "Error message",
    "stack": "Stack trace",
    "name": "ErrorType",
    "context": {},
    "environment": "production"
  }]
}
```

### POST /api/telemetry/analytics
Track analytics events
```json
{
  "event": "panel_created",
  "properties": {},
  "environment": "production"
}
```

### GET /api/telemetry/cost/summary
Get cost summary
```
?userId=user123&startDate=2024-01-01&endDate=2024-12-31
```

### GET /api/telemetry/errors/summary
Get error summary
```
?startDate=2024-01-01&endDate=2024-12-31&environment=production
```

## Setup

### 1. Run Database Migration

```bash
psql -d your_database -f backend/db/migrations/005_telemetry_tables.sql
```

### 2. Install Dependencies

**Backend:**
```bash
npm install  # Already included
```

**AI Service:**
```bash
pip install -r ai_service/requirements.txt  # requests added
```

### 3. Configure Environment Variables

Add telemetry configuration to your `.env` files.

### 4. Initialize Telemetry

**Frontend:** Automatically initialized on module load.

**Backend:** Routes are automatically registered.

**AI Service:** Import and use:
```python
from telemetry import get_telemetry
telemetry = get_telemetry()
```

**Mobile:** Use singleton:
```swift
TelemetryService.shared.trackError(...)
```

## Best Practices

1. **Error Tracking:**
   - Always include context (component, operation)
   - Don't log sensitive data
   - Use appropriate error levels

2. **Performance Monitoring:**
   - Sample appropriately (10% in production)
   - Track key user-facing operations
   - Monitor critical paths

3. **Cost Tracking:**
   - Track all AI service calls
   - Include model and token information
   - Monitor per-user costs

4. **Analytics:**
   - Track meaningful user actions
   - Include relevant properties
   - Don't track PII without consent

## Privacy & Security

- Sensitive data is automatically obfuscated
- User IDs are optional
- No PII is stored without explicit consent
- Telemetry can be disabled via environment variables
- All data is stored securely in the database

## Monitoring & Alerts

### Cost Monitoring
- Monitor daily costs per user tier
- Alert on cost spikes
- Track model usage patterns

### Error Monitoring
- Track error rates by component
- Alert on new error types
- Monitor error frequency

### Performance Monitoring
- Track response times
- Monitor render performance
- Alert on performance degradation

## Future Enhancements

- [ ] Real-time dashboards
- [ ] Automated alerting
- [ ] Cost optimization recommendations
- [ ] Performance regression detection
- [ ] User behavior analytics
- [ ] A/B testing integration

