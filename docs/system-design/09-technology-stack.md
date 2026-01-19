# Technology Stack

This document provides a comprehensive inventory of all technologies used in the system, including versions, purposes, and rationale for selection.

## Technology Overview

The system uses a diverse technology stack optimized for each component's specific requirements.

## Frontend Technologies

### Core Framework
- **Next.js**: 15.5.9
  - **Purpose**: React framework with SSR/SSG
  - **Rationale**: Performance, SEO, developer experience
  - **Features**: Server-side rendering, API routes, image optimization

- **React**: 18.2.0
  - **Purpose**: UI library
  - **Rationale**: Component-based architecture, ecosystem
  - **Features**: Hooks, Context API, Server Components

- **TypeScript**: 5.1.6
  - **Purpose**: Type-safe JavaScript
  - **Rationale**: Type safety, better IDE support
  - **Features**: Static type checking, interfaces

### UI Libraries
- **Tailwind CSS**: 3.3.0
  - **Purpose**: Utility-first CSS framework
  - **Rationale**: Rapid UI development, consistency
  - **Features**: Responsive design, dark mode support

- **Radix UI**: Various versions
  - **Purpose**: Accessible UI components
  - **Rationale**: Accessibility, customization
  - **Components**: Dialog, Dropdown, Select, Tabs, Toast

- **shadcn/ui**: 0.0.4
  - **Purpose**: Component library built on Radix UI
  - **Rationale**: Pre-built, customizable components
  - **Features**: Copy-paste components, Tailwind styling

- **Lucide React**: 0.260.0
  - **Purpose**: Icon library
  - **Rationale**: Consistent iconography
  - **Features**: Tree-shakeable icons

### Canvas & Visualization
- **Konva**: 9.3.20
  - **Purpose**: 2D canvas library
  - **Rationale**: Panel layout visualization
  - **Features**: Shapes, transforms, events

- **react-konva**: 19.0.6
  - **Purpose**: React bindings for Konva
  - **Rationale**: React integration
  - **Features**: React components for Konva

### Data Visualization
- **Chart.js**: 4.3.0
  - **Purpose**: Chart library
  - **Rationale**: Data visualization
  - **Features**: Various chart types

### File Processing
- **xlsx**: 0.18.5
  - **Purpose**: Excel file processing
  - **Rationale**: Import/export Excel files
  - **Features**: Read/write Excel files

- **file-saver**: 2.0.5
  - **Purpose**: File download
  - **Rationale**: Client-side file downloads
  - **Features**: Save files from browser

- **dxf-writer**: 1.18.4
  - **Purpose**: DXF file generation
  - **Rationale**: Export panel layouts to CAD
  - **Features**: Generate DXF files

### State Management
- **React Context API**: Built-in
  - **Purpose**: Global state management
  - **Rationale**: Built-in, no extra dependencies
  - **Usage**: Projects context, user context

### API Client
- **Axios**: 1.4.0
  - **Purpose**: HTTP client
  - **Rationale**: Promise-based, interceptors
  - **Features**: Request/response interceptors, automatic JSON

### Authentication
- **@supabase/auth-helpers-nextjs**: 0.8.7
  - **Purpose**: Supabase auth integration
  - **Rationale**: Simplified auth handling
  - **Features**: Server-side auth, middleware

- **@supabase/auth-helpers-react**: 0.4.2
  - **Purpose**: React auth hooks
  - **Rationale**: Client-side auth state
  - **Features**: useUser hook, auth state

- **@supabase/supabase-js**: 2.38.4
  - **Purpose**: Supabase client
  - **Rationale**: Database and auth operations
  - **Features**: Real-time subscriptions, RLS

### Payments
- **@stripe/stripe-js**: 1.54.1
  - **Purpose**: Stripe JavaScript SDK
  - **Rationale**: Payment processing
  - **Features**: Payment intents, subscriptions

- **@stripe/react-stripe-js**: 2.1.1
  - **Purpose**: React Stripe components
  - **Rationale**: React integration
  - **Features**: Payment form components

### Utilities
- **lodash**: 4.17.21
  - **Purpose**: Utility library
  - **Rationale**: Common utility functions
  - **Features**: Array, object manipulation

- **clsx**: 1.2.1
  - **Purpose**: Conditional class names
  - **Rationale**: Dynamic CSS classes
  - **Features**: Conditional class merging

- **tailwind-merge**: 1.13.2
  - **Purpose**: Merge Tailwind classes
  - **Rationale**: Resolve class conflicts
  - **Features**: Intelligent class merging

- **class-variance-authority**: 0.6.1
  - **Purpose**: Component variants
  - **Rationale**: Type-safe component variants
  - **Features**: Variant management

## Backend Technologies

### Core Runtime
- **Node.js**: v18+
  - **Purpose**: JavaScript runtime
  - **Rationale**: Non-blocking I/O, ecosystem
  - **Features**: Event loop, async/await

### Web Framework
- **Express.js**: 5.1.0
  - **Purpose**: Web application framework
  - **Rationale**: Minimal, flexible, ecosystem
  - **Features**: Routing, middleware, error handling

### Database
- **PostgreSQL**: 15+ (via Supabase)
  - **Purpose**: Relational database
  - **Rationale**: ACID compliance, JSONB support
  - **Features**: JSONB, full-text search, extensions

- **pg**: 8.16.3
  - **Purpose**: PostgreSQL client
  - **Rationale**: Official PostgreSQL client
  - **Features**: Connection pooling, prepared statements

- **Drizzle ORM**: 0.43.1
  - **Purpose**: Type-safe ORM
  - **Rationale**: Type safety, SQL-like queries
  - **Features**: Type inference, migrations

### Authentication & Authorization
- **@supabase/supabase-js**: 2.50.0
  - **Purpose**: Supabase client
  - **Rationale**: Auth and database operations
  - **Features**: JWT validation, RLS

- **jsonwebtoken**: 9.0.2
  - **Purpose**: JWT handling
  - **Rationale**: Token verification
  - **Features**: Sign, verify tokens

- **bcrypt**: 6.0.0
  - **Purpose**: Password hashing
  - **Rationale**: Secure password storage
  - **Features**: Salted hashing

### Job Queue
- **bull**: 4.11.0
  - **Purpose**: Job queue library
  - **Rationale**: Redis-based job processing
  - **Features**: Job scheduling, retries, events

- **ioredis**: 5.3.0
  - **Purpose**: Redis client
  - **Rationale**: Redis connection and operations
  - **Features**: Connection pooling, pub/sub

### File Processing
- **multer**: 2.0.1
  - **Purpose**: File upload middleware
  - **Rationale**: Multipart form handling
  - **Features**: File upload, memory/disk storage

- **express-fileupload**: 1.5.2
  - **Purpose**: File upload alternative
  - **Rationale**: Simpler file upload
  - **Features**: File handling, validation

- **pdf-parse**: 1.1.1
  - **Purpose**: PDF text extraction
  - **Rationale**: Extract text from PDFs
  - **Features**: Text extraction, metadata

- **mammoth**: 1.7.0
  - **Purpose**: DOCX to HTML conversion
  - **Rationale**: Word document processing
  - **Features**: Convert DOCX to HTML

- **exceljs**: 4.4.0
  - **Purpose**: Excel file processing
  - **Rationale**: Read/write Excel files
  - **Features**: Read/write, formatting

- **xlsx**: 0.18.5
  - **Purpose**: Excel alternative
  - **Rationale**: Lightweight Excel processing
  - **Features**: Read/write Excel files

### HTTP Client
- **axios**: 1.12.2
  - **Purpose**: HTTP client
  - **Rationale**: Promise-based, interceptors
  - **Features**: Request/response interceptors

- **node-fetch**: 2.7.0
  - **Purpose**: Fetch API for Node.js
  - **Rationale**: Standard fetch API
  - **Features**: Fetch-compatible API

### Security
- **helmet**: 8.1.0
  - **Purpose**: Security headers
  - **Rationale**: HTTP security headers
  - **Features**: XSS protection, CSP, HSTS

- **cors**: 2.8.5
  - **Purpose**: CORS middleware
  - **Rationale**: Cross-origin requests
  - **Features**: CORS configuration

### Logging
- **Winston**: (via custom logger)
  - **Purpose**: Logging library
  - **Rationale**: Structured logging
  - **Features**: Multiple transports, log levels

- **morgan**: 1.10.1
  - **Purpose**: HTTP request logger
  - **Rationale**: Request logging middleware
  - **Features**: Request/response logging

### Utilities
- **uuid**: 8.3.2
  - **Purpose**: UUID generation
  - **Rationale**: Unique identifier generation
  - **Features**: UUID v4 generation

- **cookie-parser**: 1.4.7
  - **Purpose**: Cookie parsing
  - **Rationale**: Parse cookies from requests
  - **Features**: Cookie parsing, signing

- **dotenv**: 16.5.0
  - **Purpose**: Environment variables
  - **Rationale**: Load .env files
  - **Features**: Environment variable loading

### Validation
- **zod**: 3.25.76
  - **Purpose**: Schema validation
  - **Rationale**: Type-safe validation
  - **Features**: Schema definition, validation

### WebSockets
- **ws**: 8.18.3
  - **Purpose**: WebSocket server
  - **Rationale**: Real-time communication
  - **Features**: WebSocket server, client

### Payments
- **stripe**: 19.0.0
  - **Purpose**: Stripe SDK
  - **Rationale**: Payment processing
  - **Features**: Payments, subscriptions, webhooks

### Machine Learning
- **onnxruntime-node**: 1.20.1
  - **Purpose**: ONNX model runtime
  - **Rationale**: Run ML models in Node.js
  - **Features**: Model inference

## AI Service Technologies

### Core Runtime
- **Python**: 3.11
  - **Purpose**: Python runtime
  - **Rationale**: AI/ML ecosystem
  - **Features**: Async/await, type hints

### Web Framework
- **Flask**: 3.0.0
  - **Purpose**: Web framework
  - **Rationale**: Lightweight, flexible
  - **Features**: Routing, middleware, extensions

- **flask-cors**: 4.0.0
  - **Purpose**: CORS support
  - **Rationale**: Cross-origin requests
  - **Features**: CORS configuration

### AI/ML Framework
- **CrewAI**: 0.157.0
  - **Purpose**: Multi-agent framework
  - **Rationale**: Agent orchestration
  - **Features**: Agents, tools, workflows

- **LangChain**: 0.2.x
  - **Purpose**: LLM framework
  - **Rationale**: LLM integration
  - **Features**: Chains, agents, memory

- **langchain-core**: 0.2.x
  - **Purpose**: LangChain core
  - **Rationale**: Core LangChain functionality
  - **Features**: Base classes, utilities

- **langchain-openai**: 0.1.x
  - **Purpose**: OpenAI integration
  - **Rationale**: OpenAI model integration
  - **Features**: OpenAI models, embeddings

### AI Models
- **openai**: >=1.0.0,<2.0.0
  - **Purpose**: OpenAI SDK
  - **Rationale**: GPT-4o integration
  - **Features**: Chat completions, vision, embeddings

- **@anthropic-ai/sdk**: 0.65.0 (Node.js)
  - **Purpose**: Anthropic SDK
  - **Rationale**: Claude model integration
  - **Features**: Claude API access

### Browser Automation
- **playwright**: >=1.42.0,<2.0.0
  - **Purpose**: Browser automation
  - **Rationale**: Cross-browser automation
  - **Features**: Chromium, Firefox, WebKit

- **nest-asyncio**: >=1.6.0,<2.0.0
  - **Purpose**: Async event loop
  - **Rationale**: Nest async event loops
  - **Features**: Event loop management

### Data Processing
- **pandas**: >=2.0.0,<3.0.0
  - **Purpose**: Data analysis
  - **Rationale**: Data manipulation
  - **Features**: DataFrames, data analysis

- **numpy**: >=1.24.0,<2.0.0
  - **Purpose**: Numerical computing
  - **Rationale**: Array operations
  - **Features**: Arrays, mathematical operations

- **pydantic**: 2.11.7
  - **Purpose**: Data validation
  - **Rationale**: Type-safe data validation
  - **Features**: Schema validation, type coercion

### File Processing
- **PyMuPDF**: >=1.23.0,<2.0.0
  - **Purpose**: PDF processing
  - **Rationale**: PDF text extraction
  - **Features**: PDF parsing, text extraction

- **openpyxl**: >=3.1.0,<4.0.0
  - **Purpose**: Excel processing
  - **Rationale**: Excel file handling
  - **Features**: Read/write Excel files

- **python-multipart**: >=0.0.6,<1.0.0
  - **Purpose**: Multipart form parsing
  - **Rationale**: File upload handling
  - **Features**: Form data parsing

- **aiofiles**: >=23.0.0,<25.0.0
  - **Purpose**: Async file operations
  - **Rationale**: Non-blocking file I/O
  - **Features**: Async file read/write

### Database/Caching
- **redis**: >=5.0.0,<6.0.0
  - **Purpose**: Redis client
  - **Rationale**: Caching and job queue
  - **Features**: Redis operations, pub/sub

### Token Counting
- **tiktoken**: >=0.7.0,<1.0.0
  - **Purpose**: Token counting
  - **Rationale**: Count tokens for cost estimation
  - **Features**: Token counting for OpenAI models

### Logging
- **structlog**: >=23.0.0,<25.0.0
  - **Purpose**: Structured logging
  - **Rationale**: Structured log output
  - **Features**: Structured logging, context

### Testing
- **pytest**: >=7.0.0,<9.0.0
  - **Purpose**: Testing framework
  - **Rationale**: Python testing
  - **Features**: Test discovery, fixtures

- **pytest-asyncio**: >=0.21.0,<1.0.0
  - **Purpose**: Async test support
  - **Rationale**: Async test support
  - **Features**: Async test execution

### Code Quality
- **black**: >=23.0.0,<25.0.0
  - **Purpose**: Code formatter
  - **Rationale**: Consistent code style
  - **Features**: Code formatting

- **flake8**: >=6.0.0,<8.0.0
  - **Purpose**: Linter
  - **Rationale**: Code quality checks
  - **Features**: Style checking, error detection

## Infrastructure Technologies

### Hosting
- **Render**: Infrastructure platform
  - **Purpose**: Service hosting
  - **Services**: Web services, workers, Redis
  - **Features**: Auto-deploy, SSL, monitoring

- **Vercel**: Frontend hosting
  - **Purpose**: Next.js hosting
  - **Features**: Edge network, automatic deployments

- **Supabase**: Database and auth
  - **Purpose**: Managed PostgreSQL and auth
  - **Features**: RLS, real-time, storage

### Version Control
- **Git**: Version control
- **GitHub**: Repository hosting
  - **Features**: CI/CD, issue tracking, PRs

### CI/CD
- **GitHub Actions**: CI/CD platform
  - **Purpose**: Automated testing and deployment
  - **Workflows**: E2E tests, keep-alive pings
  - **Features**: Matrix builds, artifacts

### Testing
- **Playwright**: E2E testing
  - **Purpose**: Browser automation testing
  - **Features**: Cross-browser, screenshots, videos

## Development Tools

### Type Checking
- **TypeScript**: 5.1.6 (Frontend), 5.8.3 (Backend)
  - **Purpose**: Static type checking
  - **Rationale**: Type safety, IDE support

### Build Tools
- **Next.js Build**: Built-in
  - **Purpose**: Frontend build
  - **Features**: Optimization, code splitting

- **Node.js**: Runtime
  - **Purpose**: Backend runtime
  - **Features**: npm, package management

### Package Management
- **npm**: Node.js package manager
- **pip**: Python package manager

### Code Quality
- **ESLint**: Code linting (Next.js)
- **Prettier**: Code formatting (implicit)
- **Black**: Python code formatting
- **Flake8**: Python linting

## Technology Selection Rationale

### Why Next.js?
- Server-side rendering for SEO
- Built-in API routes
- Excellent developer experience
- Strong ecosystem

### Why Express.js?
- Minimal and flexible
- Large ecosystem
- Well-documented
- Performance

### Why Python for AI Service?
- Rich AI/ML ecosystem
- CrewAI and LangChain support
- Easy integration with OpenAI
- Playwright support

### Why PostgreSQL?
- ACID compliance
- JSONB for flexible data
- Strong performance
- Supabase integration

### Why Redis?
- Fast in-memory storage
- Job queue support (BullMQ)
- Caching capabilities
- Pub/sub support

### Why Render?
- Simple deployment
- Auto-scaling
- Managed services
- Cost-effective

## Version Compatibility

### Node.js
- **Minimum**: v18.0.0
- **Recommended**: v18.x or v20.x
- **Features**: ES modules, async/await, fetch API

### Python
- **Version**: 3.11
- **Rationale**: Latest stable, performance improvements
- **Features**: Pattern matching, improved error messages

### PostgreSQL
- **Version**: 15+
- **Rationale**: JSONB performance, features
- **Features**: JSONB, full-text search

## Dependency Management

### Frontend
- **Package Manager**: npm
- **Lock File**: package-lock.json
- **Updates**: Regular security updates

### Backend
- **Package Manager**: npm
- **Lock File**: package-lock.json
- **Updates**: Regular security updates

### AI Service
- **Package Manager**: pip
- **Requirements**: requirements.txt
- **Updates**: Regular security updates

## Security Considerations

### Dependency Vulnerabilities
- **Monitoring**: npm audit, pip check
- **Updates**: Regular dependency updates
- **Patching**: Security patches applied promptly

### Version Pinning
- **Strategy**: Pin major versions, allow minor/patch
- **Rationale**: Balance stability and updates
- **Example**: `"express": "^5.1.0"` (allows 5.x.x)

## Next Steps

- [Component Architecture](./03-component-architecture.md) - How technologies are used
- [System Diagrams](./10-system-diagrams.md) - Technology stack visualization
- [Deployment Architecture](./06-deployment-architecture.md) - Technology deployment

