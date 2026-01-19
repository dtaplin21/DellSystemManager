# Data Architecture

This document describes the database schema, data flow patterns, storage strategies, and caching approaches used in the system.

## Database Overview

### Technology
- **Database Engine**: PostgreSQL 15+
- **Hosting**: Supabase (managed PostgreSQL)
- **ORM**: Drizzle ORM (type-safe queries)
- **Migrations**: SQL migration files
- **Security**: Row-Level Security (RLS)

### Connection
- **Connection String**: `DATABASE_URL` environment variable
- **Format**: `postgresql://user:password@host:port/database`
- **SSL**: Required for production connections
- **Pool Size**: Managed by Supabase

## Core Schema

### Users Table
```sql
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  display_name TEXT,
  company TEXT,
  position TEXT,
  subscription VARCHAR(20) DEFAULT 'basic',
  is_admin BOOLEAN DEFAULT false,
  profile_image_url TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

**Purpose**: User account management and authentication
**Relationships**: Referenced by projects, asbuilt_records, qc_data

### Projects Table
```sql
projects (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  status VARCHAR(20) DEFAULT 'active',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  area DECIMAL,
  progress INTEGER DEFAULT 0,
  scale DECIMAL DEFAULT 1.0,
  layout_width INTEGER DEFAULT 15000,
  layout_height INTEGER DEFAULT 15000,
  cardinal_direction ENUM('north', 'south', 'east', 'west') DEFAULT 'north',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

**Purpose**: Project definitions and metadata
**Relationships**: Parent of panel_layouts, documents, asbuilt_records, qc_data

### Panel Layouts Table
```sql
panel_layouts (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  panels JSONB NOT NULL DEFAULT '[]',
  patches JSONB NOT NULL DEFAULT '[]',
  destructive_tests JSONB NOT NULL DEFAULT '[]',
  width DECIMAL NOT NULL DEFAULT 4000,
  height DECIMAL NOT NULL DEFAULT 4000,
  scale DECIMAL NOT NULL DEFAULT 1.0,
  cardinal_direction ENUM('north', 'south', 'east', 'west'),
  last_updated TIMESTAMP NOT NULL DEFAULT NOW()
)
```

**Purpose**: Panel layout visualization data
**JSONB Structure**:
- `panels`: Array of panel objects (rectangles)
- `patches`: Array of patch objects (circles)
- `destructive_tests`: Array of test objects (rectangles)

### Documents Table
```sql
documents (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  path TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL,
  uploaded_by VARCHAR(255) NOT NULL,
  text_content TEXT
)
```

**Purpose**: Document metadata and extracted text
**Relationships**: Referenced by asbuilt_records (source_doc_id)

### Asbuilt Records Table
```sql
asbuilt_records (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  panel_id UUID NOT NULL,
  domain ENUM(
    'panel_placement',
    'panel_seaming',
    'non_destructive',
    'trial_weld',
    'repairs',
    'destructive'
  ) NOT NULL,
  source_doc_id UUID,
  raw_data JSONB NOT NULL,
  mapped_data JSONB NOT NULL,
  ai_confidence DECIMAL(3,2) CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  requires_review BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  UNIQUE(project_id, panel_id, domain, source_doc_id, created_at)
)
```

**Purpose**: Form submission records across six QC domains
**JSONB Fields**:
- `raw_data`: Original extracted data
- `mapped_data`: Canonical field mapping

### QC Data Table
```sql
qc_data (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  type VARCHAR(50) NOT NULL,
  panel_id VARCHAR(255) NOT NULL,
  date TIMESTAMP NOT NULL,
  result VARCHAR(50) NOT NULL,
  technician VARCHAR(255),
  temperature DECIMAL,
  pressure DECIMAL,
  speed DECIMAL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL,
  created_by UUID REFERENCES users(id)
)
```

**Purpose**: Quality control test results

### Automation Jobs Table
```sql
automation_jobs (
  id UUID PRIMARY KEY,
  asbuilt_record_id UUID REFERENCES asbuilt_records(id),
  project_id UUID NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  progress INTEGER DEFAULT 0,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
)
```

**Purpose**: Track background automation job status
**Status Values**: `pending`, `processing`, `completed`, `failed`

## Entity Relationships

### Relationship Diagram
```
users
  ├── projects (1:N)
  │     ├── panel_layouts (1:1)
  │     ├── documents (1:N)
  │     ├── asbuilt_records (1:N)
  │     └── qc_data (1:N)
  │
  ├── asbuilt_records (created_by)
  └── qc_data (created_by)

asbuilt_records
  ├── automation_jobs (1:N)
  └── documents (source_doc_id)
```

### Key Relationships

1. **User → Projects**: One user can have many projects
2. **Project → Panel Layouts**: One-to-one relationship
3. **Project → Documents**: One project has many documents
4. **Project → Asbuilt Records**: One project has many form submissions
5. **Asbuilt Record → Automation Jobs**: One form can have multiple automation jobs

## Data Flow Patterns

### Form Upload Flow
```
Mobile App
    ↓ (Form image + metadata)
Backend API
    ↓ (Store in asbuilt_records)
    ↓ (raw_data: extracted JSON)
    ↓ (mapped_data: normalized fields)
Database
    ↓ (Persist record)
    ↓ (Create automation_job if needed)
Redis Queue
    ↓ (Job processing)
Worker Service
    ↓ (Update automation_job status)
Database
```

### Document Upload Flow
```
Frontend/Backend
    ↓ (Upload file)
Backend API
    ↓ (Store file metadata in documents)
    ↓ (Extract text content)
Database
    ↓ (Store document record)
    ↓ (text_content: extracted text)
AI Service
    ↓ (Analyze document)
    ↓ (Update document metadata)
Database
```

### Panel Layout Update Flow
```
Frontend
    ↓ (User edits panel layout)
Backend API
    ↓ (Update panel_layouts.panels JSONB)
Database
    ↓ (Store updated layout)
    ↓ (Trigger validation if needed)
Compliance Service
    ↓ (Validate layout)
    ↓ (Store compliance_validations)
Database
```

## Storage Strategies

### JSONB Usage

**When to Use JSONB**:
- ✅ Flexible schema (panels, patches, form data)
- ✅ Nested data structures
- ✅ Frequently updated together
- ✅ Query performance not critical

**Examples**:
- `panel_layouts.panels`: Array of panel objects
- `asbuilt_records.raw_data`: Original form data
- `asbuilt_records.mapped_data`: Normalized form fields
- `automation_jobs.result`: Job execution results

### Relational Tables

**When to Use Relational**:
- ✅ Structured, normalized data
- ✅ Foreign key relationships
- ✅ Complex queries with joins
- ✅ Data integrity requirements

**Examples**:
- `users`, `projects`, `documents`
- Foreign key relationships
- Indexed columns for performance

### Indexing Strategy

**Primary Indexes**:
- All tables: `id` (UUID primary key)
- Foreign keys: Automatic indexes

**Performance Indexes**:
```sql
-- Asbuilt records
CREATE INDEX idx_asbuilt_project_panel ON asbuilt_records(project_id, panel_id);
CREATE INDEX idx_asbuilt_domain ON asbuilt_records(domain);
CREATE INDEX idx_asbuilt_requires_review ON asbuilt_records(requires_review);

-- Documents
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_type ON documents(type);

-- Projects
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
```

**JSONB Indexes** (Future):
- GIN indexes for JSONB queries
- Specific path indexes for frequent queries

## Caching Strategy

### Redis Caching

#### Job Queue State
- **Purpose**: Track job status and progress
- **TTL**: 24 hours (completed jobs), 7 days (failed jobs)
- **Structure**: BullMQ queue data

#### Session Data
- **Purpose**: User session information
- **TTL**: 24 hours
- **Structure**: Key-value pairs

#### AI Context Storage
- **Purpose**: Conversation history and context
- **TTL**: 7 days
- **Structure**: JSON objects

### Application-Level Caching

#### Project Context
- **Purpose**: Frequently accessed project data
- **Location**: In-memory (Node.js)
- **TTL**: 5 minutes
- **Invalidation**: On project update

#### User Settings
- **Purpose**: User preferences
- **Location**: In-memory (Node.js)
- **TTL**: 15 minutes
- **Invalidation**: On settings update

## Data Migration Strategy

### Migration Files
- **Location**: `backend/db/migrations/`
- **Naming**: `NNN_description.sql`
- **Format**: SQL with idempotent operations

### Migration Process
1. Create migration file
2. Test locally
3. Apply to staging
4. Apply to production
5. Verify data integrity

### Example Migration
```sql
-- Migration: 001_create_asbuilt_tables.sql
-- IDEMPOTENT: Safe to run multiple times

DO $$ BEGIN
  CREATE TYPE asbuilt_domain AS ENUM (...);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS asbuilt_records (...);
```

## Data Integrity

### Constraints
- **Primary Keys**: UUID (gen_random_uuid())
- **Foreign Keys**: Cascade deletes where appropriate
- **Unique Constraints**: Prevent duplicates
- **Check Constraints**: Validate data ranges

### Validation
- **Application Level**: Drizzle ORM validation
- **Database Level**: Check constraints, NOT NULL
- **API Level**: Request validation middleware

## Backup and Recovery

### Backup Strategy
- **Platform**: Supabase automated backups
- **Frequency**: Daily backups
- **Retention**: 7 days (configurable)

### Recovery Process
1. Identify point-in-time recovery target
2. Restore from Supabase backup
3. Verify data integrity
4. Update application if needed

## Performance Optimization

### Query Optimization
- Use indexes for frequently queried columns
- Limit result sets with pagination
- Use JSONB operators efficiently
- Avoid N+1 queries

### Connection Pooling
- **Pool Size**: Managed by Supabase
- **Connection Reuse**: Reuse connections
- **Timeout**: 30 seconds

### Future Optimizations
- Materialized views for complex queries
- Read replicas for read-heavy workloads
- Partitioning for large tables

## Next Steps

- [Integration Architecture](./05-integration-architecture.md) - How data flows between services
- [Component Architecture](./03-component-architecture.md) - Database component details
- [System Diagrams](./10-system-diagrams.md) - Data flow diagrams

