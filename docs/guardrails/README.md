# Guardrails Documentation

This directory contains documentation for all guardrails and safety measures implemented in the system.

## Overview

Guardrails are safety measures and constraints that protect the system from:
- **Cost overruns**: AI API costs exceeding budgets
- **Security threats**: Prompt injection, XSS, unauthorized access
- **Code quality issues**: Bugs, vulnerabilities, inconsistencies
- **Performance degradation**: Rate limiting, resource exhaustion

## Implemented Guardrails

### 1. API Rate Limiting ✅

**Location**: `backend/middlewares/rateLimiter.js`

**Features**:
- General API: 100 requests per 15 minutes per IP
- Authentication: 5 requests per 15 minutes per IP
- AI endpoints: 20 requests per hour per IP
- File uploads: 10 uploads per hour per IP

**Configuration**:
- Environment variables: `RATE_LIMIT_MAX`, `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_AI_MAX`, `RATE_LIMIT_UPLOAD_MAX`

**Documentation**: See [Rate Limiting Guide](./rate-limiting.md)

### 2. Code Quality Checks ✅

**Location**: `.eslintrc.json`, `.prettierrc.json`, `.husky/pre-commit`

**Features**:
- ESLint: Code linting and error detection
- Prettier: Code formatting
- Pre-commit hooks: Automatic checks before commits

**Usage**:
```bash
npm run lint          # Check for linting errors
npm run lint:fix      # Fix linting errors
npm run format        # Format code with Prettier
npm run format:check  # Check formatting
```

**Documentation**: See [Code Quality Guide](./code-quality.md)

### 3. Branch Protection ✅

**Location**: `docs/guardrails/branch-protection.md`, `scripts/setup-branch-protection.sh`

**Features**:
- Requires E2E tests to pass before merging
- Requires code reviews
- Prevents force pushes
- Prevents branch deletion

**Setup**: See [Branch Protection Guide](./branch-protection.md)

### 4. Content Safety Checks ✅

**Location**: `ai_service/content_safety.py`

**Features**:
- Prompt injection detection
- Dangerous content filtering
- Sensitive data detection
- Output sanitization
- Response quality validation

**Documentation**: See [Content Safety Guide](./content-safety.md)

### 5. Cost Monitoring & Alerting ✅

**Location**: `backend/services/costMonitor.js`

**Features**:
- Daily/weekly/monthly cost tracking
- Per-user cost limits
- Per-request cost limits
- Email alerts (configurable)
- Cost statistics API

**Configuration**:
- Environment variables: `COST_THRESHOLD_DAILY`, `COST_THRESHOLD_WEEKLY`, `COST_THRESHOLD_MONTHLY`, `COST_ALERT_EMAILS`

**Documentation**: See [Cost Monitoring Guide](./cost-monitoring.md)

### 6. AI Safety Guardrails ✅

**Location**: `ai_service/config.py`, `ai_service/hybrid_ai_architecture.py`

**Features**:
- Cost limits per request
- User tier-based limits
- Model selection optimization
- Workflow timeout limits
- Max workflow agents limit

**Configuration**: See `ai_service/config.py`

## Configuration

### Environment Variables

Add these to your `.env` files:

```bash
# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_AI_MAX=20
RATE_LIMIT_UPLOAD_MAX=10

# Cost Monitoring
COST_THRESHOLD_DAILY=50.00
COST_THRESHOLD_WEEKLY=300.00
COST_THRESHOLD_MONTHLY=1000.00
COST_THRESHOLD_PER_USER_DAILY=10.00
COST_THRESHOLD_PER_REQUEST=1.00
COST_ALERT_EMAILS=admin@example.com,team@example.com
COST_ALERT_COOLDOWN=60

# Content Safety (Python)
ENABLE_CONTENT_SAFETY=true
```

## Monitoring

### View Cost Statistics

```bash
# Via API (if endpoint exists)
curl http://localhost:8003/api/cost/stats?period=day
```

### View Rate Limit Status

Rate limit headers are included in API responses:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Remaining requests
- `RateLimit-Reset`: Time when limit resets

## Troubleshooting

### Rate Limit Errors

**Error**: `429 Too Many Requests`

**Solution**:
- Wait for the rate limit window to reset
- Reduce request frequency
- Contact admin to increase limits (if needed)

### Content Safety Errors

**Error**: `Invalid input detected`

**Solution**:
- Rephrase your request
- Remove any special characters or code-like syntax
- Contact support if issue persists

### Cost Alerts

**Alert**: Cost threshold exceeded

**Solution**:
- Review cost statistics
- Optimize AI model usage
- Adjust thresholds if needed
- Investigate unusual usage patterns

## Best Practices

1. **Monitor Costs Regularly**: Check cost statistics weekly
2. **Review Alerts Promptly**: Respond to cost and security alerts
3. **Keep Guardrails Updated**: Review and update thresholds as needed
4. **Test Guardrails**: Verify guardrails work in staging before production
5. **Document Changes**: Update documentation when modifying guardrails

## Related Documentation

- [System Design - Security Architecture](../system-design/08-security-architecture.md)
- [System Design - Scalability & Performance](../system-design/07-scalability-performance.md)
- [CI/CD Documentation](../ci-cd/README.md)

