# Development Setup

## Quick Start (All Services)

Start all services with one command:

```bash
npm run dev:all
```

This starts:
- **Frontend** (port 3000) - Next.js app
- **Backend** (port 8003) - Node.js/Express API
- **AI Service** (port 5001) - Python Flask service with AI tools

## Individual Services

Start services individually:

```bash
# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend

# AI Service only
npm run dev:ai
```

## Requirements

- **Node.js** (v18+)
- **Python 3** (v3.8+)
- **Redis** (optional, but recommended for AI service)
- **PostgreSQL** database

## Environment Variables

Make sure you have:
- `OPENAI_API_KEY` - Required for AI features
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` - For auth

## Stopping Services

Press `Ctrl+C` once to stop all services when using `dev:all`.

