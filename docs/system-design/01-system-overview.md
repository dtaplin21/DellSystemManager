# System Overview

## Purpose

GeoSynth QC Pro is an AI-powered quality control and project management platform specifically designed for geosynthetic liner installation projects. The system combines document analysis, form field extraction, panel layout optimization, and automated workflow orchestration to streamline QC processes in construction and engineering projects.

## Domain

**Geosynthetic Quality Control (QC)**: The system manages quality control processes for geosynthetic liner installations, including:
- Panel placement tracking
- Seaming operations
- Non-destructive testing
- Trial weld procedures
- Repair documentation
- Destructive testing

## High-Level Architecture

The system follows a **distributed microservices architecture** with the following layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Web App    │  │  Mobile App  │  │ Desktop App │          │
│  │  (Next.js)   │  │   (iOS)      │  │  (Electron)  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
          │         HTTPS/REST API              │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼──────────────────┐
│                    API Gateway Layer                             │
│              Backend API (Node.js/Express)                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • Authentication & Authorization                        │   │
│  │  • Request Routing & Validation                         │   │
│  │  • Business Logic Orchestration                         │   │
│  │  • Response Formatting                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────┬──────────────────┬──────────────────┬──────────────────┘
          │                  │                  │
          │         Service Communication      │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼──────────────────┐
│                    Service Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ AI Service   │  │   Worker     │  │   Database   │          │
│  │ (Python/Flask│  │   Service    │  │ (PostgreSQL) │          │
│  │  + CrewAI)   │  │ (Node.js)    │  │  + Supabase  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         │                  │                  │                  │
│  ┌──────▼──────────────────▼──────────────────▼──────┐          │
│  │         Redis (Job Queue & Caching)              │          │
│  └───────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

## Key Capabilities

### 1. Document Analysis & Extraction
- **OCR & Text Extraction**: Extract text from PDFs, images, and scanned documents
- **Form Field Extraction**: AI-powered extraction of structured data from form images
- **Handwriting Recognition**: Advanced OCR for handwritten content
- **Document Classification**: Automatic categorization of uploaded documents

### 2. Panel Layout Management
- **2D Panel Visualization**: Interactive canvas for geosynthetic panel placement
- **AI-Powered Optimization**: Intelligent panel layout suggestions
- **Panel Tracking**: Track panel numbers, locations, and installation status
- **Export Capabilities**: Generate DXF files and reports

### 3. Quality Control Workflows
- **Form Management**: Digital forms for six QC domains:
  - Panel Placement
  - Panel Seaming
  - Non-Destructive Testing
  - Trial Weld
  - Repairs
  - Destructive Testing
- **Automated Field Population**: AI extracts data from form images
- **Review & Approval Workflows**: Multi-stage approval processes
- **Compliance Tracking**: Track QC requirements and completion status

### 4. AI-Powered Automation
- **Multi-Agent Workflows**: Specialized AI agents for different tasks
- **Browser Automation**: AI agents can interact with the web interface
- **Workflow Orchestration**: Automated project setup and configuration
- **Intelligent Recommendations**: AI-powered insights and suggestions

### 5. Project Management
- **Project Organization**: Multi-project support with user access control
- **Document Management**: Centralized document storage and versioning
- **Team Collaboration**: Shared projects with role-based access
- **Reporting & Analytics**: Project insights and QC statistics

## User Personas

### 1. Field Technician
- **Primary Use**: Mobile app for form capture and upload
- **Key Features**: Camera integration, form field extraction, offline capability
- **Workflow**: Capture form image → AI extraction → Review → Submit

### 2. Project Manager
- **Primary Use**: Web dashboard for project oversight
- **Key Features**: Project dashboard, document review, approval workflows
- **Workflow**: Review submissions → Approve/reject → Monitor progress

### 3. QC Engineer
- **Primary Use**: Web application for detailed QC analysis
- **Key Features**: Document analysis, panel layout optimization, compliance tracking
- **Workflow**: Analyze documents → Optimize layouts → Generate reports

### 4. System Administrator
- **Primary Use**: System configuration and user management
- **Key Features**: User management, project configuration, system monitoring
- **Workflow**: Configure projects → Manage users → Monitor system health

## System Boundaries

### In Scope
- ✅ Document upload and processing
- ✅ Form field extraction and validation
- ✅ Panel layout visualization and optimization
- ✅ QC workflow management
- ✅ Project and user management
- ✅ AI-powered automation and recommendations
- ✅ Mobile form capture and submission

### Out of Scope
- ❌ Physical hardware integration (sensors, IoT devices)
- ❌ Real-time GPS tracking
- ❌ Direct integration with CAD software
- ❌ Financial/accounting systems
- ❌ Third-party project management tools (Jira, Asana, etc.)

## Key Design Principles

### 1. Microservices Architecture
- Services are independently deployable
- Each service has a single responsibility
- Services communicate via well-defined APIs

### 2. Stateless Design
- Backend services are stateless
- State is stored in database or Redis
- Enables horizontal scaling

### 3. Event-Driven Processing
- Long-running tasks use job queues
- Asynchronous processing for AI operations
- Real-time updates via polling/WebSockets

### 4. Security First
- Authentication via Supabase Auth
- JWT tokens for API access
- Row-level security in database
- HTTPS for all communications

### 5. Cost Optimization
- Intelligent AI model routing
- Caching to reduce API calls
- Efficient resource utilization
- User tier-based limits

## Technology Foundation

- **Frontend**: Next.js 15, React 18, TypeScript
- **Backend**: Node.js, Express.js
- **AI Service**: Python 3.11, Flask, CrewAI
- **Database**: PostgreSQL (via Supabase)
- **Job Queue**: Redis + BullMQ
- **Deployment**: Render (Infrastructure as Code)

## Next Steps

- [Component Architecture](./03-component-architecture.md) - Detailed component breakdown
- [Architecture Patterns](./02-architecture-patterns.md) - Design patterns used
- [System Diagrams](./10-system-diagrams.md) - Visual representations

