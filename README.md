# GeoSynth QC Pro

[![E2E Tests](https://github.com/dtaplin21/DellSystemManager/workflows/E2E%20Tests/badge.svg)](https://github.com/dtaplin21/DellSystemManager/actions/workflows/e2e-tests.yml)
[![Keep-Alive Ping](https://github.com/dtaplin21/DellSystemManager/workflows/Keep-Alive%20Ping/badge.svg)](https://github.com/dtaplin21/DellSystemManager/actions/workflows/keep-alive.yml)

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
