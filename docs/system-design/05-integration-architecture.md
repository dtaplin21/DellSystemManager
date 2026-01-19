# Integration Architecture

This document describes how services communicate, API contracts, authentication flows, browser automation integration, and AI agent workflows.

## Service Communication Overview

The system uses multiple communication patterns depending on the use case:

1. **Synchronous HTTP/REST**: Real-time request-response
2. **Asynchronous Message Queue**: Background job processing
3. **Database Shared State**: Data persistence and coordination

## Service-to-Service Communication

### Frontend ↔ Backend API

**Protocol**: HTTPS/REST
**Authentication**: JWT Bearer tokens
**Format**: JSON

#### Request Flow
```
Frontend
    ↓ (HTTP Request with JWT token)
Backend API
    ↓ (Validate token)
    ↓ (Process request)
    ↓ (Query database)
    ↓ (Return JSON response)
Frontend
```

#### Example Request
```typescript
const response = await fetch('/api/projects', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

#### Example Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Project Name",
      "status": "active"
    }
  ]
}
```

### Backend API ↔ AI Service

**Protocol**: HTTPS/REST
**Authentication**: None (internal network)
**Format**: JSON
**Timeout**: 300 seconds (5 minutes)

#### Request Flow
```
Backend API
    ↓ (POST /api/ai/chat)
    ↓ (JSON payload with context)
AI Service
    ↓ (Process with AI agents)
    ↓ (Return response)
Backend API
```

#### Example Request
```javascript
const response = await axios.post(`${AI_SERVICE_URL}/api/ai/chat`, {
  projectId: 'uuid',
  user_id: 'user-id',
  user_tier: 'paid_user',
  message: 'User message',
  context: {
    projectId: 'uuid',
    projectInfo: {...},
    panelLayoutUrl: 'https://...',
    history: [...]
  }
}, {
  timeout: 300000 // 5 minutes
});
```

#### Example Response
```json
{
  "reply": "AI response text",
  "success": true,
  "conversation_id": "session-id",
  "session_id": "session-id",
  "model_used": "gpt-4o",
  "browser_tools_required": false
}
```

### Backend API ↔ Worker Service

**Protocol**: Redis Message Queue
**Format**: JSON job payload
**Pattern**: Producer-Consumer

#### Job Creation Flow
```
Backend API
    ↓ (Create job in Redis queue)
    ↓ (Store job metadata in database)
    ↓ (Return job ID immediately)
Worker Service
    ↓ (Pick up job from queue)
    ↓ (Process job)
    ↓ (Update job status in database)
```

#### Example Job Payload
```json
{
  "id": "job-uuid",
  "type": "browser-automation",
  "data": {
    "asbuiltRecordId": "record-uuid",
    "projectId": "project-uuid",
    "userId": "user-uuid",
    "domain": "panel_placement",
    "formData": {...}
  }
}
```

### Worker Service ↔ AI Service

**Protocol**: HTTPS/REST
**Authentication**: None (internal network)
**Format**: JSON
**Timeout**: 300 seconds

#### Request Flow
```
Worker Service
    ↓ (POST /api/ai/chat with automation context)
AI Service
    ↓ (Multi-agent workflow)
    ↓ (Browser automation)
    ↓ (Return results)
Worker Service
    ↓ (Update job status)
```

## API Contracts

### Authentication Contract

#### Request Headers
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

#### Token Validation
1. Extract token from `Authorization` header
2. Verify token with Supabase
3. Extract user information
4. Attach to request object (`req.user`)

#### Error Responses
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

### Project API Contract

#### List Projects
```
GET /api/projects
Response: {
  "success": true,
  "data": Project[]
}
```

#### Get Project
```
GET /api/projects/:id
Response: {
  "success": true,
  "data": Project
}
```

#### Create Project
```
POST /api/projects
Body: {
  "name": string,
  "description": string,
  "location": string
}
Response: {
  "success": true,
  "data": Project
}
```

### AI Chat API Contract

#### Request
```
POST /api/ai/chat
Body: {
  "projectId": string,
  "user_id": string,
  "user_tier": string,
  "message": string,
  "context": {
    "projectId": string,
    "projectInfo": object,
    "panelLayoutUrl": string,
    "history": Message[]
  }
}
```

#### Response
```
{
  "reply": string,
  "success": boolean,
  "conversation_id": string,
  "session_id": string,
  "model_used": string,
  "browser_tools_required": boolean,
  "preflight_automation": {
    "success": boolean,
    "error": string,
    "details": object
  }
}
```

### Form Extraction API Contract

#### Request
```
POST /api/mobile/extract-form-data/:projectId
Content-Type: multipart/form-data
Body: {
  "image": File,
  "formType": string
}
Headers: {
  "Authorization": "Bearer <token>"
}
```

#### Response
```
{
  "success": true,
  "data": {
    "fields": object,
    "confidence": number,
    "requiresReview": boolean
  }
}
```

## Authentication Flows

### User Login Flow
```
1. User submits credentials
   ↓
2. Frontend → Backend API (POST /api/auth/login)
   ↓
3. Backend → Supabase Auth (verify credentials)
   ↓
4. Supabase → JWT token
   ↓
5. Backend → Frontend (return token)
   ↓
6. Frontend stores token (localStorage/cookies)
   ↓
7. Frontend includes token in subsequent requests
```

### Token Refresh Flow
```
1. Token expires
   ↓
2. Frontend detects 401 response
   ↓
3. Frontend → Backend API (POST /api/auth/refresh)
   ↓
4. Backend → Supabase (refresh token)
   ↓
5. Backend → Frontend (new token)
   ↓
6. Frontend updates stored token
   ↓
7. Retry original request
```

### Service-to-Service Authentication

**Backend → AI Service**: No authentication (internal network)
**Backend → Database**: Service role key (Supabase)
**Worker → Redis**: Connection string authentication

## Browser Automation Integration

### Architecture
```
AI Service
    ↓ (BrowserSessionManager)
Playwright
    ↓ (Browser instance)
Web Application
    ↓ (DOM interaction)
Results
```

### Browser Tools Available

1. **Navigation**: Navigate to URLs, reload, back/forward
2. **Interaction**: Click, type, select, drag-and-drop
3. **Extraction**: Extract text, HTML, links, panel data
4. **Screenshot**: Capture page or element screenshots
5. **Vision Analysis**: AI-powered visual analysis
6. **Performance**: Get metrics, network, console logs

### Security Configuration

**Allowed Domains**: Configurable via `BROWSER_ALLOWED_DOMAINS`
**Default**: Application's own domain
**Restrictions**: 
- Cannot navigate to external sites
- Cannot access localhost (except configured)
- Screenshot capture can be disabled

### Browser Session Management

**Session Pool**: Shared Playwright sessions
**Session Lifecycle**:
1. Create session on first use
2. Reuse session for same user/context
3. Close session on timeout or completion

## AI Agent Workflows

### Multi-Agent Workflow Pattern

```
User Request
    ↓
Orchestrator
    ↓
Agent 1: Navigator
    ├─ Navigate to page
    ├─ Verify page loaded
    └─ Pass context to next agent
    ↓
Agent 2: Visual Analyst
    ├─ Capture screenshot
    ├─ Analyze visual layout
    └─ Extract panel data
    ↓
Agent 3: Interaction Executor
    ├─ Perform requested actions
    ├─ Update panel layout
    └─ Verify changes
    ↓
Agent 4: Validator
    ├─ Verify results
    ├─ Check for errors
    └─ Return final result
    ↓
Response to User
```

### Agent Communication

**Shared Context**: Redis-backed context store
**Delegation**: Agents can delegate subtasks
**State Management**: Context persists across agent calls

### Workflow Types

1. **Single Agent**: Simple tasks (document analysis)
2. **Multi-Agent**: Complex tasks (browser automation)
3. **Orchestrated**: Multiple workflows chained

## Event-Driven Patterns

### Job Queue Pattern

**Producer**: Backend API
**Consumer**: Worker Service
**Broker**: Redis

#### Job Creation
```javascript
const job = await automationQueue.add('browser-automation', {
  asbuiltRecordId: 'uuid',
  projectId: 'uuid',
  userId: 'uuid',
  domain: 'panel_placement',
  formData: {...}
});
```

#### Job Processing
```javascript
automationQueue.process('browser-automation', async (job) => {
  // Process job
  // Update status
  // Return result
});
```

### Event Types

**Job Events**:
- `completed`: Job finished successfully
- `failed`: Job failed with error
- `stalled`: Job stuck (timeout)
- `progress`: Job progress update

## Error Handling Patterns

### API Error Response Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

### Error Propagation

**Frontend → Backend**:
- Network errors: Retry with exponential backoff
- 401 errors: Refresh token and retry
- 500 errors: Show error message to user

**Backend → AI Service**:
- Timeout errors: Return error, don't retry
- Service errors: Log and return error
- Network errors: Retry up to 3 times

**Worker → AI Service**:
- Errors: Update job status, retry job
- Timeouts: Mark job as failed
- Network errors: Retry with backoff

## Service Discovery

### Current Implementation
- **Static URLs**: Environment variables
- **Backend URL**: `BACKEND_URL` or `NEXT_PUBLIC_BACKEND_URL`
- **AI Service URL**: `AI_SERVICE_URL` or `NEXT_PUBLIC_AI_SERVICE_URL`
- **Redis URL**: `REDIS_URL`

### Service URLs (Production)
- **Backend**: `https://geosyntec-backend-ugea.onrender.com`
- **AI Service**: `https://geosyntec-backend.onrender.com`
- **Frontend**: `https://dellsystemmanager.vercel.app`

## Rate Limiting

### Current Implementation
- **User Tier-Based**: Different limits per tier
- **AI Service**: Cost-based limits
- **API Endpoints**: No explicit rate limiting (future)

### Future Considerations
- Implement rate limiting middleware
- Per-user rate limits
- Per-endpoint rate limits
- Rate limit headers in responses

## Monitoring and Observability

### Logging
- **Structured Logging**: JSON format
- **Request IDs**: Track requests across services
- **Log Levels**: DEBUG, INFO, WARN, ERROR

### Health Checks
- **Backend**: `GET /health`
- **AI Service**: `GET /health`
- **Worker**: Log-based health monitoring

### Metrics (Future)
- Request count and latency
- Error rates
- Job queue depth
- Database query performance

## Next Steps

- [Deployment Architecture](./06-deployment-architecture.md) - Infrastructure setup
- [System Diagrams](./10-system-diagrams.md) - Visual integration flows
- [Security Architecture](./08-security-architecture.md) - Security integration details

