# Component Architecture

This document provides a detailed breakdown of each system component, its responsibilities, technologies, and interactions.

## Component Overview

The system consists of seven main components:

1. **Frontend Service** (Next.js/React)
2. **Backend API Service** (Node.js/Express)
3. **AI Service** (Python/Flask)
4. **Worker Service** (Node.js)
5. **Mobile App** (iOS SwiftUI)
6. **Database** (PostgreSQL/Supabase)
7. **Redis** (Job Queue & Caching)

## 1. Frontend Service (Next.js)

### Technology Stack
- **Framework**: Next.js 15.5.9
- **UI Library**: React 18.2.0
- **Language**: TypeScript 5.1.6
- **Styling**: Tailwind CSS 3.3.0
- **UI Components**: Radix UI, shadcn/ui
- **State Management**: React Context API, React Hooks
- **API Client**: Axios, custom API utilities

### Key Responsibilities
- User interface rendering
- Client-side routing
- Form handling and validation
- Real-time UI updates
- Authentication state management
- File uploads and downloads

### Main Components

#### Pages
- `/dashboard` - Main dashboard
- `/dashboard/projects` - Project list
- `/dashboard/projects/:id` - Project detail
- `/dashboard/projects/:id/panel-layout` - Panel layout editor
- `/dashboard/projects/:id/documents` - Document management
- `/dashboard/forms` - Form review and approval
- `/dashboard/settings` - User settings

#### Key Features
- **Panel Layout Editor**: Interactive canvas using Konva.js
- **Document Viewer**: PDF and image viewing
- **Form Review Interface**: Table-based form management
- **AI Chat Interface**: Conversational AI assistant
- **Real-time Updates**: Polling for job status

### Architecture Patterns
- **Server-Side Rendering (SSR)**: Initial page load
- **Client-Side Rendering (CSR)**: Dynamic content
- **Component-Based**: Reusable React components
- **Context API**: Global state (projects, user)

### API Integration
```typescript
// Example API call
const response = await fetch('/api/projects', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Deployment
- **Platform**: Vercel
- **Build**: `next build`
- **Start**: `next start`
- **Port**: 3000 (development), 443 (production)

## 2. Backend API Service (Node.js/Express)

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js 5.1.0
- **Language**: JavaScript (CommonJS)
- **Database Client**: pg (PostgreSQL), Drizzle ORM
- **Authentication**: Supabase Auth, JWT
- **Job Queue**: BullMQ, ioredis
- **File Processing**: multer, express-fileupload
- **Logging**: Winston

### Key Responsibilities
- API request handling and routing
- Authentication and authorization
- Business logic orchestration
- Database operations
- File upload handling
- Job queue management
- Service-to-service communication

### Main Routes

#### Authentication (`/api/auth`)
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Current user info

#### Projects (`/api/projects`)
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

#### Documents (`/api/documents`)
- `GET /api/documents/:projectId` - List documents
- `POST /api/documents/:projectId` - Upload document
- `DELETE /api/documents/:id` - Delete document

#### AI (`/api/ai`)
- `POST /api/ai/chat` - AI chat endpoint
- `POST /api/ai/query` - Document query
- `POST /api/ai/panels/optimize` - Panel optimization

#### Mobile (`/api/mobile`)
- `POST /api/mobile/extract-form-data/:projectId` - Form extraction
- `POST /api/mobile/upload-defect/:projectId` - Defect upload

#### Jobs (`/api/jobs`)
- `GET /api/jobs/:id` - Get job status
- `GET /api/jobs/record/:recordId` - Get job by record
- `POST /api/jobs/:id/retry` - Retry failed job

### Services Layer

#### Core Services
- `formReviewService.js` - Form approval workflows
- `formAutomationService.js` - Browser automation logic
- `jobQueue.js` - Job queue management
- `automationWorker.js` - Job processing
- `documentService.js` - Document operations
- `panelLayoutService.js` - Panel layout operations

### Middleware
- **Authentication**: JWT token validation
- **Authorization**: Role-based access control
- **Error Handling**: Centralized error handling
- **Logging**: Request/response logging
- **CORS**: Cross-origin resource sharing

### Database Integration
- **ORM**: Drizzle ORM for type-safe queries
- **Connection Pooling**: pg pool for connection management
- **Migrations**: SQL migration files
- **Row-Level Security**: Supabase RLS policies

### Deployment
- **Platform**: Render
- **Build**: `npm install`
- **Start**: `npm start` (runs `server.js`)
- **Port**: 8003

## 3. AI Service (Python/Flask)

### Technology Stack
- **Runtime**: Python 3.11
- **Framework**: Flask 3.0.0
- **AI Framework**: CrewAI 0.157.0
- **LLM**: OpenAI GPT-4o, LangChain
- **Browser Automation**: Playwright 1.42.0+
- **Data Processing**: pandas, numpy
- **Validation**: Pydantic 2.11.7
- **Logging**: structlog

### Key Responsibilities
- AI model inference
- Document analysis and extraction
- Multi-agent workflow orchestration
- Browser automation
- Form field extraction
- Panel layout optimization
- Cost optimization and model routing

### Main Endpoints

#### Health (`/health`)
- `GET /health` - Service health check

#### AI Operations (`/api/ai`)
- `POST /api/ai/chat` - Conversational AI
- `POST /api/ai/extract-asbuilt-fields` - Form extraction
- `POST /api/ai/documents/analyze` - Document analysis
- `POST /api/ai/documents/extract` - Data extraction
- `POST /api/ai/panels/optimize` - Panel optimization
- `POST /api/ai/qc/analyze` - QC data analysis

### Core Components

#### Hybrid AI Architecture
- **DellSystemAIService**: Main orchestrator
- **WorkflowOrchestrator**: Multi-agent coordination
- **CostOptimizer**: Model selection and routing
- **BrowserSessionManager**: Playwright session management

#### Browser Tools
- `BrowserNavigationTool` - Navigate to URLs
- `BrowserInteractionTool` - Click, type, interact
- `BrowserExtractionTool` - Extract data
- `BrowserScreenshotTool` - Capture screenshots
- `BrowserVisionAnalysisTool` - AI visual analysis
- `PanelManipulationTool` - Panel layout operations

#### Agents
- **Navigator Agent**: Browser navigation
- **Visual Analyst Agent**: Screenshot analysis
- **Interaction Executor Agent**: UI interactions
- **Validator Agent**: Result verification

### AI Model Integration
- **Primary Model**: GPT-4o (OpenAI)
- **Fallback Models**: Claude (Anthropic), Local models
- **Cost Optimization**: Route simple tasks to cheaper models
- **Token Management**: tiktoken for token counting

### Deployment
- **Platform**: Render
- **Build**: Custom build with Rust toolchain
- **Start**: `python start_service.py`
- **Port**: 5001

## 4. Worker Service (Node.js)

### Technology Stack
- **Runtime**: Node.js
- **Job Queue**: BullMQ 4.11.0
- **Redis Client**: ioredis 5.3.0
- **Database**: Same as Backend API
- **Logging**: Winston

### Key Responsibilities
- Process background jobs
- Browser automation execution
- Form automation processing
- Job status updates
- Error handling and retries

### Job Types

#### Browser Automation Jobs
- **Type**: `browser-automation`
- **Purpose**: Execute browser automation tasks
- **Payload**: Job data with automation instructions
- **Processor**: `AutomationWorker.processJob()`

#### Form Automation Jobs
- **Type**: `form-automation`
- **Purpose**: Process form automation requests
- **Payload**: Form data and automation config
- **Processor**: `AutomationWorker.processJob()`

### Job Lifecycle
```
Created → Waiting → Active → Completed/Failed
                          ↓
                    Retry (if failed)
```

### Job Configuration
- **Max Attempts**: 3
- **Backoff**: Exponential (2s, 4s, 8s)
- **Timeout**: 5 minutes
- **Retention**: 24 hours (completed), 7 days (failed)

### Redis Integration
- **Connection**: Redis URL or host/port
- **Queue Name**: `browser-automation`
- **Events**: completed, failed, stalled, progress

### Deployment
- **Platform**: Render (Worker service)
- **Build**: `npm install`
- **Start**: `node workers/start-worker.js`
- **Scaling**: Single instance (can scale horizontally)

## 5. Mobile App (iOS SwiftUI)

### Technology Stack
- **Platform**: iOS
- **Framework**: SwiftUI
- **Language**: Swift
- **Networking**: URLSession
- **Image Processing**: UIKit, AVFoundation

### Key Responsibilities
- Form capture via camera
- Image upload to backend
- Form field display and editing
- Offline capability (future)
- User authentication

### Main Features

#### Form Capture
- Camera integration
- Image preview
- Form type selection
- Field extraction display
- Form submission

#### Form Types Supported
1. Panel Placement
2. Panel Seaming
3. Non-Destructive Testing
4. Trial Weld
5. Repairs
6. Destructive Testing

### API Integration
```swift
// Example API call
let url = URL(string: "\(baseURL)/api/mobile/extract-form-data/\(projectId)")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
// ... multipart form data
```

### Deployment
- **Platform**: iOS App Store, TestFlight
- **Build**: Xcode
- **Distribution**: App Store Connect

## 6. Database (PostgreSQL/Supabase)

### Technology Stack
- **Database**: PostgreSQL
- **Hosting**: Supabase
- **ORM**: Drizzle ORM
- **Migrations**: SQL migration files
- **Security**: Row-Level Security (RLS)

### Key Tables

#### Core Tables
- `users` - User accounts
- `projects` - Project definitions
- `panel_layouts` - Panel layout data
- `documents` - Document metadata
- `asbuilt_records` - Form submission records
- `qc_data` - QC test results

#### Supporting Tables
- `notifications` - User notifications
- `user_settings` - User preferences
- `automation_jobs` - Job tracking
- `panel_layout_requirements` - Panel requirements
- `plan_geometry_models` - Plan geometry data
- `layout_transforms` - Layout transformations
- `compliance_operations` - Compliance tracking
- `compliance_validations` - Validation results

### Schema Characteristics
- **Primary Keys**: UUID (gen_random_uuid())
- **Foreign Keys**: UUID references
- **JSONB**: Flexible data storage (panels, patches, etc.)
- **Timestamps**: Created/updated tracking
- **Indexes**: Performance optimization

### Security
- **Row-Level Security**: Enabled on all tables
- **Policies**: User-based access control
- **Service Role**: Backend service access
- **Anon Key**: Public access (limited)

### Connection
- **Connection String**: `DATABASE_URL` environment variable
- **Pool Size**: Configurable via Supabase
- **SSL**: Required for production

## 7. Redis (Job Queue & Caching)

### Technology Stack
- **Service**: Redis (Render)
- **Client**: ioredis 5.3.0
- **Queue Library**: BullMQ 4.11.0

### Key Responsibilities
- Job queue storage
- Job state management
- Session data caching
- AI context storage
- Shared state between services

### Configuration
- **Connection**: Redis URL or host/port
- **Database**: 0 (default)
- **Timeout**: 5 seconds
- **Retry Strategy**: Exponential backoff

### Usage Patterns

#### Job Queue
- **Queue Name**: `browser-automation`
- **Job Storage**: Redis lists
- **State Tracking**: Redis hashes

#### Caching
- **Session Data**: User sessions
- **AI Context**: Conversation history
- **Project Data**: Frequently accessed data

### Deployment
- **Platform**: Render (Redis service)
- **Region**: Oregon (must match worker)
- **Plan**: Starter (Free tier available)

## Component Interactions

### Request Flow Example: Form Upload
```
Mobile App
    ↓ (POST /api/mobile/extract-form-data/:projectId)
Backend API
    ↓ (Validate request, authenticate user)
    ↓ (Create asbuilt record in database)
    ↓ (Create job in Redis queue)
    ↓ (Return job ID)
Mobile App
    ↓ (Poll /api/jobs/:id)
Worker Service
    ↓ (Pick up job from Redis)
    ↓ (Call AI Service for extraction)
AI Service
    ↓ (Process with GPT-4o)
    ↓ (Return extracted fields)
Worker Service
    ↓ (Update job status)
    ↓ (Update database record)
Backend API
    ↓ (Return job status)
Mobile App
    ↓ (Display results)
```

## Component Dependencies

### Frontend Dependencies
- Backend API (all operations)
- Supabase Auth (authentication)

### Backend API Dependencies
- Database (data persistence)
- AI Service (AI operations)
- Redis (job queue)
- Supabase Auth (authentication)

### AI Service Dependencies
- OpenAI API (model inference)
- Redis (context storage, optional)
- Database (via Backend API)

### Worker Service Dependencies
- Redis (job queue)
- Database (job status)
- AI Service (automation tasks)
- Backend API (some operations)

## Next Steps

- [Integration Architecture](./05-integration-architecture.md) - How components communicate
- [Data Architecture](./04-data-architecture.md) - Database schema details
- [System Diagrams](./10-system-diagrams.md) - Visual component representations

