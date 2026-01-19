# System Diagrams

This document contains visual representations of the system architecture, component interactions, data flows, and deployment topology.

## High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                 │
│                                                                       │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      │
│  │   Web App    │      │  Mobile App  │      │ Desktop App  │      │
│  │  (Next.js)   │      │   (iOS)      │      │  (Electron)  │      │
│  │  Port: 3000  │      │   Native     │      │  Cross-OS    │      │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘      │
│         │                      │                      │              │
│         └──────────────────────┼──────────────────────┘              │
│                                │                                      │
│                        HTTPS/REST API                                 │
│                                │                                      │
└────────────────────────────────┼──────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   API Gateway Layer        │
                    │  Backend API (Express)     │
                    │      Port: 8003            │
                    │                            │
                    │  • Authentication          │
                    │  • Request Routing         │
                    │  • Business Logic          │
                    │  • Response Formatting     │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
        ┌───────────▼──┐  ┌───────▼──────┐  ┌──▼──────────┐
        │  AI Service   │  │   Worker      │  │  Database   │
        │  (Python/Flask│  │   Service      │  │ (PostgreSQL)│
        │  + CrewAI)    │  │  (Node.js)     │  │ + Supabase  │
        │  Port: 5001   │  │  Background    │  │             │
        └───────┬───────┘  └───────┬───────┘  └──────┬──────┘
                │                  │                  │
                │                  │                  │
        ┌───────▼──────────────────▼──────────────────▼──────┐
        │         Redis (Job Queue & Caching)               │
        │         Port: 6379                                 │
        └────────────────────────────────────────────────────┘
```

## Component Interaction Diagram

### Form Upload Flow
```
┌─────────────┐
│ Mobile App  │
└──────┬──────┘
       │
       │ POST /api/mobile/extract-form-data/:projectId
       │ (multipart/form-data: image, formType)
       │
       ▼
┌─────────────────┐
│  Backend API    │
│                 │
│ 1. Validate auth │
│ 2. Create record │
│ 3. Create job    │
└──────┬──────────┘
       │
       ├───► Database (store record)
       │
       └───► Redis Queue (add job)
            │
            │ Return job_id immediately
            │
            ▼
       ┌─────────────┐
       │ Mobile App  │
       │ (polls status)
       └─────────────┘

       ┌─────────────┐
       │   Worker    │
       │   Service   │
       └──────┬──────┘
              │
              │ Pick up job
              │
              ▼
       ┌─────────────┐
       │  AI Service │
       │             │
       │ 1. Extract  │
       │ 2. Validate │
       │ 3. Return   │
       └──────┬──────┘
              │
              │ Update job status
              │
              ▼
       ┌─────────────┐
       │  Database   │
       │ (update record)
       └─────────────┘
```

### AI Chat Flow
```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
       │ POST /api/ai/chat
       │ (message, context)
       │
       ▼
┌─────────────────┐
│  Backend API    │
│                 │
│ 1. Validate auth │
│ 2. Build context│
│ 3. Forward      │
└──────┬──────────┘
       │
       │ POST /api/ai/chat
       │ (timeout: 5 min)
       │
       ▼
┌─────────────────┐
│   AI Service    │
│                 │
│ 1. Route request│
│ 2. Select agent │
│ 3. Execute      │
└──────┬──────────┘
       │
       ├───► Single Agent (simple tasks)
       │     └─► GPT-4o → Response
       │
       └───► Multi-Agent (complex tasks)
             │
             ├─► Navigator Agent
             ├─► Visual Analyst Agent
             ├─► Interaction Executor Agent
             └─► Validator Agent
                  │
                  └─► Response
       │
       ▼
┌─────────────────┐
│  Backend API    │
│ (format response)│
└──────┬──────────┘
       │
       ▼
┌─────────────┐
│   Frontend  │
│ (display)   │
└─────────────┘
```

## Data Flow Diagrams

### Document Upload and Analysis Flow
```
User Uploads Document
    ↓
Frontend/Backend API
    ↓ (Store file metadata)
Database (documents table)
    ↓ (Extract text content)
Document Processor
    ↓ (Store text_content)
Database (documents.text_content)
    ↓
User Requests Analysis
    ↓
Backend API
    ↓ (POST /api/ai/query)
AI Service
    ↓ (Analyze with GPT-4o)
    ↓ (Return insights)
Backend API
    ↓ (Format response)
Frontend
    ↓ (Display results)
User
```

### Panel Layout Update Flow
```
User Edits Panel Layout
    ↓
Frontend (Konva canvas)
    ↓ (POST /api/panel-layouts/:id)
Backend API
    ↓ (Validate data)
    ↓ (Update JSONB)
Database (panel_layouts.panels)
    ↓ (Trigger validation if enabled)
Compliance Service
    ↓ (Validate layout)
    ↓ (Store validation results)
Database (compliance_validations)
    ↓
Frontend
    ↓ (Display validation results)
User
```

### Form Automation Flow
```
Form Submitted/Approved
    ↓
Backend API
    ↓ (Check automation settings)
    ↓ (Create automation job)
Redis Queue
    ↓ (Job queued)
Backend API
    ↓ (Return job_id)
Frontend/Mobile
    ↓ (Poll job status)
Worker Service
    ↓ (Pick up job)
    ↓ (POST /api/ai/chat with automation context)
AI Service
    ↓ (Multi-agent workflow)
    ├─► Navigator: Navigate to panel layout
    ├─► Visual Analyst: Analyze current layout
    ├─► Interaction Executor: Add panels/patches
    └─► Validator: Verify changes
    ↓ (Return results)
Worker Service
    ↓ (Update job status)
Database (automation_jobs)
    ↓
Frontend/Mobile
    ↓ (Display automation results)
User
```

## Sequence Diagrams

### Form Extraction Sequence
```
Mobile App          Backend API         AI Service        Database
    │                   │                   │                │
    │──POST /extract───►│                   │                │
    │                   │──Validate auth───│                │
    │                   │                   │                │
    │                   │──Create record───┼───────────────►│
    │                   │                   │                │
    │                   │──Create job──────┼──►Redis        │
    │                   │                   │                │
    │◄──job_id──────────│                   │                │
    │                   │                   │                │
    │                   │                   │                │
    │──Poll status──────►│                   │                │
    │                   │                   │                │
    │                   │                   │◄──Worker picks─┤
    │                   │                   │    up job      │
    │                   │                   │                │
    │                   │◄──POST /extract───│                │
    │                   │                   │                │
    │                   │                   │──GPT-4o API───┤
    │                   │                   │                │
    │                   │                   │◄──Response───┤
    │                   │                   │                │
    │                   │◄──Extracted───────│                │
    │                   │    fields         │                │
    │                   │                   │                │
    │                   │──Update job──────┼──►Redis        │
    │                   │──Update record───┼───────────────►│
    │                   │                   │                │
    │◄──Job completed───│                   │                │
    │                   │                   │                │
    │──Get results──────►│                   │                │
    │                   │──Query DB────────┼───────────────►│
    │                   │◄──Record─────────┼────────────────┤
    │◄──Form data───────│                   │                │
    │                   │                   │                │
```

### AI Chat with Browser Automation Sequence
```
Frontend          Backend API         AI Service        Browser
    │                 │                   │                │
    │──POST /chat─────►│                   │                │
    │                 │──Validate auth───│                │
    │                 │                   │                │
    │                 │──POST /chat──────►│                │
    │                 │                   │                │
    │                 │                   │──Orchestrator──┤
    │                 │                   │                │
    │                 │                   │──Navigator─────┼──Navigate─►
    │                 │                   │                │                │
    │                 │                   │◄──Page loaded──┤                │
    │                 │                   │                │                │
    │                 │                   │──Visual───────┼──Screenshot─►
    │                 │                   │  Analyst       │                │
    │                 │                   │                │                │
    │                 │                   │◄──Screenshot──┤                │
    │                 │                   │                │                │
    │                 │                   │──Vision───────┼──Analyze─────►
    │                 │                   │  Analysis      │                │
    │                 │                   │                │                │
    │                 │                   │◄──Analysis─────┤                │
    │                 │                   │                │                │
    │                 │                   │──Interaction───┼──Click/Type──►
    │                 │                   │  Executor      │                │
    │                 │                   │                │                │
    │                 │                   │◄──Action───────┤                │
    │                 │                   │    completed    │                │
    │                 │                   │                │                │
    │                 │                   │──Validator─────┼──Verify───────►
    │                 │                   │                │                │
    │                 │                   │◄──Validation───┤                │
    │                 │                   │    result       │                │
    │                 │                   │                │                │
    │                 │◄──Response────────│                │                │
    │◄──Formatted─────│                   │                │                │
    │   response      │                   │                │                │
    │                 │                   │                │                │
```

## Deployment Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Render Platform                         │
│                         (Oregon Region)                         │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Backend API Service                          │   │
│  │              geosynth-qc-backend                          │   │
│  │              Type: Web Service                            │   │
│  │              Port: 8003                                   │   │
│  │              Plan: Starter                                │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              AI Service                                    │   │
│  │              quality-control-quality-assurance            │   │
│  │              Type: Web Service                            │   │
│  │              Port: 5001                                   │   │
│  │              Plan: Starter                                │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Worker Service                                │   │
│  │              geosyntec-worker                             │   │
│  │              Type: Background Worker                      │   │
│  │              Plan: Starter                                 │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Redis Service                                 │   │
│  │              geosyntec-redis                               │   │
│  │              Type: Redis                                  │   │
│  │              Port: 6379                                    │   │
│  │              Plan: Starter                                │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                    Supabase Platform                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              PostgreSQL Database                          │  │
│  │              • Users                                      │  │
│  │              • Projects                                   │  │
│  │              • Documents                                  │  │
│  │              • Asbuilt Records                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Supabase Auth                                │  │
│  │              • User Authentication                        │  │
│  │              • JWT Token Generation                      │  │
│  │              • Row-Level Security                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                    Vercel Platform                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Frontend Service                             │  │
│  │              Next.js Application                          │  │
│  │              Domain: dellsystemmanager.vercel.app         │  │
│  │              Port: 443 (HTTPS)                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Network Topology

```
Internet
    │
    ├──► Vercel (Frontend)
    │         │
    │         └──► HTTPS ──► Render Backend API
    │
    ├──► Render Services (Private Network)
    │         │
    │         ├──► Backend API ──► AI Service (HTTPS)
    │         │
    │         ├──► Backend API ──► Database (SSL)
    │         │
    │         ├──► Worker ──► Redis (Internal)
    │         │
    │         └──► Worker ──► AI Service (HTTPS)
    │
    └──► External Services
              │
              ├──► OpenAI API (HTTPS)
              │
              └──► Supabase (HTTPS)
```

## Database Schema Diagram

```
┌─────────────┐
│    users    │
│─────────────│
│ id (PK)     │
│ email       │
│ ...         │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────────┐
│   projects     │
│────────────────│
│ id (PK)        │
│ user_id (FK)   │
│ name           │
│ ...            │
└──────┬─────────┘
       │
       ├─── 1:1 ──► panel_layouts
       │
       ├─── 1:N ──► documents
       │
       ├─── 1:N ──► asbuilt_records
       │
       └─── 1:N ──► qc_data

┌─────────────────┐
│ asbuilt_records │
│─────────────────│
│ id (PK)         │
│ project_id (FK) │
│ domain          │
│ raw_data (JSONB)│
│ mapped_data     │
│ ...             │
└──────┬──────────┘
       │
       │ 1:N
       │
┌──────▼──────────────┐
│ automation_jobs    │
│────────────────────│
│ id (PK)            │
│ asbuilt_record_id  │
│ status             │
│ result (JSONB)     │
│ ...                │
└────────────────────┘
```

## Job Queue Flow Diagram

```
┌──────────────┐
│ Backend API  │
└──────┬───────┘
       │
       │ Add Job
       │
       ▼
┌──────────────┐
│ Redis Queue  │
│              │
│ [Job 1]      │
│ [Job 2]      │
│ [Job 3]      │
└──────┬───────┘
       │
       │ Worker picks up
       │
       ▼
┌──────────────┐
│   Worker     │
│   Service    │
│              │
│ Process Job  │
└──────┬───────┘
       │
       │ Update Status
       │
       ▼
┌──────────────┐
│   Database   │
│ (job status) │
└──────────────┘
```

## Next Steps

- [System Overview](./01-system-overview.md) - High-level system understanding
- [Component Architecture](./03-component-architecture.md) - Detailed component information
- [Integration Architecture](./05-integration-architecture.md) - Service communication details

