# GeoSynth QC Pro

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-181717?logo=github)](https://github.com/dtaplin21/DellSystemManager)
[![E2E Tests](https://github.com/dtaplin21/DellSystemManager/workflows/E2E%20Tests/badge.svg)](https://github.com/dtaplin21/DellSystemManager/actions/workflows/e2e-tests.yml)
[![Keep-Alive Ping](https://github.com/dtaplin21/DellSystemManager/workflows/Keep-Alive%20Ping/badge.svg)](https://github.com/dtaplin21/DellSystemManager/actions/workflows/keep-alive.yml)

> AI-powered quality control and project management platform for geosynthetic liner installation projects.

**Repository**: [github.com/dtaplin21/DellSystemManager](https://github.com/dtaplin21/DellSystemManager)

This is a monorepo with frontend and backend applications.

## Platform Support

✅ **Cross-platform compatible** - Works on Windows, macOS, and Linux

- **Windows**: Full support with batch files and PowerShell scripts
- **macOS/Linux**: Uses shell scripts and npm scripts
- **All platforms**: Node.js wrapper scripts provide unified experience

See [WINDOWS_SETUP.md](./WINDOWS_SETUP.md) for detailed Windows setup instructions.

## Quick Start

### Prerequisites
- Node.js (v18+)
- Python 3 (v3.8+)
- PostgreSQL database

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..
   ```

2. **Set up AI service:**
   ```bash
   npm run setup:ai
   ```

3. **Configure environment variables:**
   - Edit `ai_service/.env` with your OpenAI API key
   - Edit `frontend/.env.local` with your Supabase credentials
   - Create `.env` in root with database and Supabase config

4. **Start all services:**
   ```bash
   npm run dev:all
   ```

### Available Scripts

- `npm run dev:all` - Start all services (Redis, Frontend, Backend, AI, Worker)
- `npm run dev:frontend` - Start frontend only (port 3000)
- `npm run dev:backend` - Start backend only (port 8003)
- `npm run dev:ai` - Start AI service only (port 5001)
- `npm run setup:ai` - Set up AI service dependencies and environment

### Windows Users

**Option 1: Use npm scripts (Recommended)**
```bash
npm run dev:ai
npm run setup:ai
```

**Option 2: Use batch files**
- Double-click `start-ai-service.bat` to start AI service
- Double-click `setup-ai-service.bat` to set up AI service

**Option 3: Use PowerShell**
- Right-click `start-ai-service.ps1` → "Run with PowerShell"
- Right-click `setup-ai-service.ps1` → "Run with PowerShell"

## Frontend (Next.js)
The frontend application is located in the `frontend/` directory.

## Backend (Node.js/Express)
The backend application is located in the `backend/` directory.

## AI Service (Python/Flask)
The AI service is located in the `ai_service/` directory and uses OpenAI GPT-4o for various AI features.

## Deployment
- **Frontend**: Deploy from `frontend/` directory
- **Backend**: Deploy from `backend/` directory
- **AI Service**: Deploy from `ai_service/` directory

## Vercel Configuration
This project uses Vercel for frontend deployment. The `vercel.json` configuration points to the frontend directory.

## Cross-Platform Scripts

All scripts use Node.js wrappers for cross-platform compatibility:
- `scripts/start-ai-service.js` - Cross-platform AI service starter
- `scripts/setup-ai-service.js` - Cross-platform AI service setup

These scripts automatically detect the platform and use the appropriate commands (python vs python3, etc.).

## 📚 Documentation

### System Design Documentation
Comprehensive system design documentation is available in the [`docs/system-design/`](./docs/system-design/) directory:

- **[System Overview](./docs/system-design/01-system-overview.md)** - High-level system architecture
- **[Architecture Patterns](./docs/system-design/02-architecture-patterns.md)** - Design patterns used
- **[Component Architecture](./docs/system-design/03-component-architecture.md)** - Detailed component breakdown
- **[Data Architecture](./docs/system-design/04-data-architecture.md)** - Database schema and data flow
- **[Integration Architecture](./docs/system-design/05-integration-architecture.md)** - Service communication
- **[Deployment Architecture](./docs/system-design/06-deployment-architecture.md)** - Infrastructure setup
- **[Scalability & Performance](./docs/system-design/07-scalability-performance.md)** - Scaling strategies
- **[Security Architecture](./docs/system-design/08-security-architecture.md)** - Security design
- **[Technology Stack](./docs/system-design/09-technology-stack.md)** - Complete technology inventory
- **[System Diagrams](./docs/system-design/10-system-diagrams.md)** - Visual representations

### Other Documentation
- **[Browser Tool Reference](./docs/browser_tool_reference.md)** - Browser automation tools
- **[CI/CD Documentation](./docs/ci-cd/README.md)** - Continuous integration setup
- **[QA Documentation](./docs/qa/test-planning.md)** - Testing strategies
- **[Deployment Guide](./docs/deployment/redis-connection-setup.md)** - Redis setup

## 🔗 GitHub Resources

### Repository Links
- **Main Repository**: [github.com/dtaplin21/DellSystemManager](https://github.com/dtaplin21/DellSystemManager)
- **Issues**: [GitHub Issues](https://github.com/dtaplin21/DellSystemManager/issues)
- **Pull Requests**: [GitHub Pull Requests](https://github.com/dtaplin21/DellSystemManager/pulls)
- **Actions**: [GitHub Actions](https://github.com/dtaplin21/DellSystemManager/actions)

### GitHub Actions Workflows
- **[E2E Tests](./.github/workflows/e2e-tests.yml)** - End-to-end test automation
  - [View Workflow Runs](https://github.com/dtaplin21/DellSystemManager/actions/workflows/e2e-tests.yml)
- **[Keep-Alive Ping](./.github/workflows/keep-alive.yml)** - Service keep-alive automation
  - [View Workflow Runs](https://github.com/dtaplin21/DellSystemManager/actions/workflows/keep-alive.yml)

### Branch Information
- **Main Branch**: `main` (production-ready code)
- **Development Branch**: `develop` (active development)
- **Default Branch**: `main`

### Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [Contributing Guidelines](https://github.com/dtaplin21/DellSystemManager/blob/main/CONTRIBUTING.md) for more details (if available).

## 🏗️ Project Structure

```
DellSystemManager/
├── frontend/          # Next.js frontend application
├── backend/           # Node.js/Express backend API
├── ai_service/        # Python/Flask AI service
├── mobile/            # iOS mobile application
├── desktop/           # Electron desktop application
├── tests/             # E2E tests (Playwright)
├── docs/              # Documentation
│   ├── system-design/ # System design documentation
│   ├── ci-cd/         # CI/CD documentation
│   ├── deployment/    # Deployment guides
│   └── qa/            # QA documentation
├── scripts/           # Utility scripts
└── .github/           # GitHub Actions workflows
    └── workflows/     # CI/CD workflows
```
