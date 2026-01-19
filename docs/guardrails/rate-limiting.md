# Rate Limiting Guide

## Overview

Rate limiting protects the API from abuse and ensures fair resource usage. Different endpoints have different rate limits based on their resource intensity.

## Rate Limiters

### General API Limiter
- **Limit**: 100 requests per 15 minutes per IP
- **Applies to**: All `/api/*` endpoints (except health checks)
- **Environment Variable**: `RATE_LIMIT_MAX`

### Authentication Limiter
- **Limit**: 5 requests per 15 minutes per IP
- **Applies to**: `/api/auth/*` endpoints
- **Environment Variable**: `RATE_LIMIT_AUTH_MAX`
- **Purpose**: Prevent brute force attacks

### AI Endpoint Limiter
- **Limit**: 20 requests per hour per IP
- **Applies to**: `/api/ai/*` endpoints
- **Environment Variable**: `RATE_LIMIT_AI_MAX`
- **Purpose**: Control expensive AI operations

### File Upload Limiter
- **Limit**: 10 uploads per hour per IP
- **Applies to**: `/api/mobile/*`, `/api/documents/*` endpoints
- **Environment Variable**: `RATE_LIMIT_UPLOAD_MAX`
- **Purpose**: Prevent storage abuse

## Rate Limit Headers

All rate-limited endpoints include these headers:

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1640995200
```

## Error Response

When rate limit is exceeded:

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests from this IP, please try again later.",
  "retryAfter": "15 minutes"
}
```

HTTP Status: `429 Too Many Requests`

## Configuration

Update rate limits in `backend/middlewares/rateLimiter.js` or via environment variables.

## Bypassing Rate Limits

Rate limits can be bypassed for:
- Health check endpoints (`/api/health`, `/health`)
- Internal service-to-service communication (if configured)

## Monitoring

Rate limit violations are logged:
- Level: `WARN`
- Includes: IP address, path, method, user agent

## Best Practices

1. **Handle 429 Errors Gracefully**: Implement retry logic with exponential backoff
2. **Cache Responses**: Reduce API calls by caching results
3. **Batch Requests**: Combine multiple operations into single requests when possible
4. **Monitor Usage**: Track rate limit hits to optimize usage patterns

