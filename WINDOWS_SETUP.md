# Windows Setup Guide

This guide will help you set up and run the Dell System Manager application on Windows PCs.

## Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: Open Command Prompt and run `node --version`

2. **Python 3** (v3.8 or higher)
   - Download from: https://www.python.org/downloads/
   - **Important**: During installation, check "Add Python to PATH"
   - Verify installation: Open Command Prompt and run `python --version` or `python3 --version`

3. **Git** (optional, for cloning the repository)
   - Download from: https://git-scm.com/download/win

4. **PostgreSQL** (for database)
   - Download from: https://www.postgresql.org/download/windows/
   - Or use a cloud database service (Supabase, Railway, etc.)

## Quick Start

### Option 1: Using npm scripts (Recommended - Cross-platform)

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
   - Edit `ai_service/.env` and set your `OPENAI_API_KEY`
   - Edit `frontend/.env.local` and set your Supabase credentials

4. **Start all services:**
   ```bash
   npm run dev:all
   ```

   Or start individually:
   ```bash
   npm run dev:backend    # Backend API (port 8003)
   npm run dev:frontend   # Frontend (port 3000)
   npm run dev:ai         # AI Service (port 5001)
   ```

### Option 2: Using Windows Batch Files (Convenience)

1. **Double-click** `setup-ai-service.bat` to set up the AI service
2. **Double-click** `start-ai-service.bat` to start the AI service
3. Use `npm run dev:backend` and `npm run dev:frontend` for other services

### Option 3: Using PowerShell Scripts

1. **Right-click** `setup-ai-service.ps1` → "Run with PowerShell"
   - If you get an execution policy error, run:
     ```powershell
     Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
     ```

2. **Right-click** `start-ai-service.ps1` → "Run with PowerShell"

## Detailed Setup Steps

### 1. Clone/Download the Repository

If using Git:
```bash
git clone <repository-url>
cd DellSystemManager
```

Or download and extract the ZIP file.

### 2. Install Node.js Dependencies

Open Command Prompt or PowerShell in the project root:

```bash
npm install
cd backend
npm install
cd ../frontend
npm install
cd ..
```

### 3. Set Up Python Virtual Environment

The setup script will handle this automatically, but if you need to do it manually:

```bash
cd ai_service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Configure Environment Variables

#### AI Service (`ai_service/.env`):
```env
OPENAI_API_KEY=your_openai_api_key_here
REDIS_HOST=localhost
REDIS_PORT=6379
FLASK_ENV=development
FLASK_DEBUG=1
```

#### Frontend (`frontend/.env.local`):
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8003
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:5001
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

#### Backend (`.env` in root):
```env
DATABASE_URL=your_postgresql_connection_string
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=8003
```

### 5. Start the Services

**All services at once:**
```bash
npm run dev:all
```

**Individual services:**
```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend

# Terminal 3: AI Service
npm run dev:ai
```

## Troubleshooting

### Python Command Not Found

**Problem:** `python` or `python3` command not found

**Solution:**
1. Reinstall Python and check "Add Python to PATH" during installation
2. Or add Python to PATH manually:
   - Find Python installation (usually `C:\Python3x\` or `C:\Users\YourName\AppData\Local\Programs\Python\Python3x\`)
   - Add to System Environment Variables → Path

### PowerShell Execution Policy Error

**Problem:** "execution of scripts is disabled on this system"

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Port Already in Use

**Problem:** Port 3000, 5001, or 8003 is already in use

**Solution:**
1. Find the process using the port:
   ```bash
   netstat -ano | findstr :3000
   ```
2. Kill the process:
   ```bash
   taskkill /PID <process_id> /F
   ```
3. Or change the port in the respective `.env` files

### Virtual Environment Not Activating

**Problem:** `venv\Scripts\activate` doesn't work

**Solution:**
- Use `venv\Scripts\activate.bat` instead
- Or use the Node.js wrapper: `npm run dev:ai`

### Redis Not Running

**Problem:** Warning about Redis server not detected

**Solution:**
- Redis is optional but recommended
- Install Redis for Windows: https://github.com/microsoftarchive/redis/releases
- Or use a cloud Redis service (Redis Cloud, Upstash, etc.)

## File Paths on Windows

The application uses cross-platform path handling (`path.join()`), so file paths will automatically use Windows-style backslashes (`\`) when running on Windows.

## Development Workflow

1. **Start all services:** `npm run dev:all`
2. **Access the application:** http://localhost:3000
3. **Backend API:** http://localhost:8003
4. **AI Service:** http://localhost:5001

## Production Deployment

For production deployment on Windows Server:

1. Use PM2 or Windows Service to run Node.js processes
2. Use IIS or Nginx as a reverse proxy
3. Set `NODE_ENV=production` in environment variables
4. Use a process manager for Python (gunicorn, uwsgi, or Windows Service)

## Additional Resources

- [Node.js Windows Installation Guide](https://nodejs.org/en/download/)
- [Python Windows Installation Guide](https://www.python.org/downloads/windows/)
- [PostgreSQL Windows Installation](https://www.postgresql.org/download/windows/)

## Support

If you encounter issues:
1. Check the console output for error messages
2. Verify all prerequisites are installed correctly
3. Ensure all environment variables are set
4. Check that ports are not in use by other applications

