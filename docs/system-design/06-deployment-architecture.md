# Deployment Architecture

This document describes the infrastructure setup, service deployment on Render, environment configuration, CI/CD pipelines, and monitoring strategies.

## Infrastructure Overview

### Hosting Platform: Render

**Services Deployed**:
1. **Backend API**: Web service (Node.js)
2. **AI Service**: Web service (Python)
3. **Worker Service**: Background worker (Node.js)
4. **Redis**: Managed Redis service

**Region**: Oregon (all services must be in same region)

### Infrastructure as Code

**Configuration File**: `render.yaml`
**Location**: Project root
**Auto-Detection**: Render automatically detects and applies configuration

## Service Deployment

### 1. Backend API Service

#### Configuration
```yaml
- type: web
  name: geosynth-qc-backend
  env: node
  plan: starter
  rootDir: backend
  buildCommand: npm install
  startCommand: npm start
```

#### Environment Variables
- `NODE_ENV`: production
- `PORT`: 8003
- `DATABASE_URL`: PostgreSQL connection string
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key
- `AI_SERVICE_URL`: AI service URL
- `REDIS_URL`: Redis connection URL
- `JWT_SECRET`: JWT signing secret

#### Deployment Process
1. Push code to GitHub
2. Render detects changes
3. Builds Docker image
4. Runs `npm install`
5. Starts service with `npm start`
6. Health check validates deployment

#### Health Check
- **Endpoint**: `/health` (if implemented)
- **Method**: GET
- **Expected**: 200 OK

### 2. AI Service

#### Configuration
```yaml
- type: web
  name: quality-control-quality-assurance
  env: python
  pythonVersion: 3.11
  plan: starter
  rootDir: ai_service
  buildCommand: |
    pip install --upgrade pip
    # ... Rust toolchain setup ...
    pip install -r requirements.txt
  startCommand: python start_service.py
```

#### Environment Variables
- `PORT`: 5001
- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key (optional)
- `REDIS_HOST`: Redis hostname
- `REDIS_PORT`: Redis port
- `FLASK_ENV`: production
- `DEBUG`: false

#### Build Process
1. Install Rust toolchain (for Python dependencies)
2. Upgrade pip
3. Install Python dependencies
4. Start Flask application

#### Special Considerations
- **Rust Toolchain**: Required for some Python packages
- **Build Time**: Longer due to Rust compilation
- **Cold Starts**: 30-60 seconds (Render free tier)

### 3. Worker Service

#### Configuration
```yaml
- type: worker
  name: geosyntec-worker
  env: node
  plan: starter
  rootDir: backend
  buildCommand: npm install
  startCommand: node workers/start-worker.js
```

#### Environment Variables
- `NODE_ENV`: production
- `REDIS_URL`: Redis connection URL
- `DATABASE_URL`: PostgreSQL connection string
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key
- `AI_SERVICE_URL`: AI service URL

#### Worker Behavior
- **Graceful Exit**: Exits with code 0 if Redis unavailable
- **Job Processing**: Processes jobs from Redis queue
- **Error Handling**: Retries failed jobs up to 3 times
- **Status Updates**: Updates job status in database

### 4. Redis Service

#### Configuration
- **Type**: Managed Redis
- **Plan**: Starter (Free tier available)
- **Region**: Oregon
- **Persistence**: None (Free tier)

#### Connection
- **Internal URL**: `redis://red-xxxxx:6379`
- **External URL**: Available but not recommended
- **Authentication**: Password in URL (if configured)

#### Usage
- **Job Queue**: BullMQ queue storage
- **Caching**: Session and context data
- **TTL**: Managed by application

## Environment Configuration

### Environment Variable Management

#### Render Dashboard
- **Location**: Service → Environment
- **Method**: Manual entry or sync from `render.yaml`
- **Security**: Marked as "sync: false" for secrets

#### Required Variables

**Backend API**:
```
NODE_ENV=production
PORT=8003
DATABASE_URL=<supabase-connection-string>
SUPABASE_URL=<supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
AI_SERVICE_URL=<ai-service-url>
REDIS_URL=<redis-url>
JWT_SECRET=<jwt-secret>
```

**AI Service**:
```
PORT=5001
OPENAI_API_KEY=<openai-key>
REDIS_HOST=<redis-host>
REDIS_PORT=6379
FLASK_ENV=production
DEBUG=false
```

**Worker Service**:
```
NODE_ENV=production
REDIS_URL=<redis-url>
DATABASE_URL=<supabase-connection-string>
SUPABASE_URL=<supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
AI_SERVICE_URL=<ai-service-url>
```

### Environment-Specific Configuration

#### Development
- Local services (localhost)
- Development database
- Test API keys

#### Staging
- Render services
- Staging database
- Production-like configuration

#### Production
- Render services
- Production database
- Production API keys
- SSL/TLS enabled

## CI/CD Pipeline

### GitHub Actions

#### Workflows

**1. E2E Tests** (`.github/workflows/e2e-tests.yml`)
- **Trigger**: Push to `main`, `develop`, or PR
- **Steps**:
  1. Checkout code
  2. Setup Node.js
  3. Install dependencies
  4. Run Playwright tests
  5. Upload test results
  6. Comment on PR with results

**2. Keep-Alive Ping** (`.github/workflows/keep-alive.yml`)
- **Trigger**: Scheduled (every 5 minutes)
- **Purpose**: Prevent Render cold starts
- **Steps**:
  1. Ping backend service
  2. Ping AI service
  3. Log results

#### Secrets Configuration
- `PLAYWRIGHT_TEST_BASE_URL`: Test environment URL
- `TEST_USER_EMAIL`: Test user email
- `TEST_USER_PASSWORD`: Test user password
- `BACKEND_URL`: Backend service URL
- `AI_SERVICE_URL`: AI service URL

### Deployment Flow

```
Developer
    ↓ (git push)
GitHub
    ↓ (webhook)
Render
    ↓ (detect changes)
    ↓ (build service)
    ↓ (deploy)
    ↓ (health check)
Service Live
```

### Manual Deployment

**Process**:
1. Render Dashboard → Service
2. Manual Deploy → Deploy latest commit
3. Monitor build logs
4. Verify deployment

## Monitoring and Logging

### Render Logs

**Access**: Service → Logs tab
**Features**:
- Real-time log streaming
- Log search and filtering
- Historical logs
- Error highlighting

### Application Logging

#### Backend API
- **Library**: Winston
- **Format**: Structured JSON
- **Levels**: DEBUG, INFO, WARN, ERROR
- **Output**: stdout (captured by Render)

#### AI Service
- **Library**: structlog
- **Format**: Structured JSON
- **Levels**: DEBUG, INFO, WARN, ERROR
- **Output**: stdout (captured by Render)

#### Worker Service
- **Library**: Winston
- **Format**: Structured JSON
- **Levels**: INFO, WARN, ERROR
- **Output**: stdout (captured by Render)

### Health Monitoring

#### Health Check Endpoints
- **Backend**: `/health` (if implemented)
- **AI Service**: `/health`
- **Worker**: Log-based (no endpoint)

#### Health Check Response
```json
{
  "status": "ok",
  "service": "AI Service",
  "version": "1.0.0"
}
```

### Error Monitoring

#### Current Implementation
- Log-based error tracking
- Render logs for error visibility
- No external error tracking service

#### Future Considerations
- Sentry or similar error tracking
- Performance monitoring (New Relic, Datadog)
- Uptime monitoring

## Scaling Strategy

### Horizontal Scaling

#### Backend API
- **Current**: Single instance
- **Scaling**: Can scale to multiple instances
- **Considerations**: Stateless design supports scaling

#### AI Service
- **Current**: Single instance
- **Scaling**: Can scale to multiple instances
- **Considerations**: Browser session management

#### Worker Service
- **Current**: Single instance
- **Scaling**: Can scale to multiple instances
- **Considerations**: Job distribution via Redis

### Vertical Scaling

#### Current Plan: Starter
- **CPU**: 0.5 CPU
- **RAM**: 512 MB
- **Cost**: $7/month per service

#### Upgrade Options
- **Standard**: More CPU/RAM
- **Pro**: Even more resources
- **Enterprise**: Custom resources

### Auto-Scaling (Future)
- Scale based on queue depth
- Scale based on CPU/memory usage
- Scale based on request rate

## Disaster Recovery

### Backup Strategy

#### Database
- **Platform**: Supabase automated backups
- **Frequency**: Daily
- **Retention**: 7 days (configurable)

#### Code
- **Platform**: GitHub
- **Backup**: Git repository
- **Retention**: Permanent

### Recovery Procedures

#### Service Failure
1. Check Render dashboard for service status
2. Review logs for error details
3. Restart service if needed
4. Verify health check

#### Database Failure
1. Contact Supabase support
2. Restore from backup
3. Verify data integrity
4. Update application if needed

#### Redis Failure
1. Check Redis service status
2. Restart Redis if needed
3. Requeue failed jobs
4. Verify job processing

## Security Considerations

### Network Security
- **HTTPS**: All external communications
- **Internal Network**: Services communicate via Render's private network
- **Firewall**: Render-managed firewall rules

### Secrets Management
- **Storage**: Render environment variables
- **Access**: Service-specific access
- **Rotation**: Manual rotation process

### Access Control
- **Render Dashboard**: Account-based access
- **Services**: No direct SSH access
- **Logs**: Account-based log access

## Performance Optimization

### Cold Start Mitigation
- **Keep-Alive Ping**: GitHub Actions workflow
- **Frequency**: Every 5 minutes
- **Purpose**: Prevent service sleep

### Build Optimization
- **Dependency Caching**: Render caches dependencies
- **Build Time**: Optimized build commands
- **Parallel Builds**: Services build independently

### Runtime Optimization
- **Connection Pooling**: Database connection pooling
- **Caching**: Redis caching layer
- **Lazy Loading**: Services load on demand

## Next Steps

- [Scalability & Performance](./07-scalability-performance.md) - Detailed scaling strategies
- [Security Architecture](./08-security-architecture.md) - Security deployment considerations
- [System Diagrams](./10-system-diagrams.md) - Deployment diagrams

