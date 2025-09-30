# 🚀 Deployment Guide

## Frontend (Vercel)

### Environment Variables to Set in Vercel Dashboard:

```bash
# Backend API URL - Replace with your Render backend URL
NEXT_PUBLIC_BACKEND_URL=https://your-backend-app.onrender.com

# AI Service URL - Same as backend URL for this project
NEXT_PUBLIC_AI_SERVICE_URL=https://your-backend-app.onrender.com

# Supabase Configuration - Get from Supabase dashboard
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Application Configuration
NEXT_PUBLIC_APP_NAME=GeoSynth QC Pro
NEXT_PUBLIC_APP_VERSION=1.0.0

# OpenAI API Key - Get from OpenAI dashboard
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
```

### Vercel Configuration:
- **Framework Preset**: Next.js
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

## Backend (Render)

### Environment Variables to Set in Render Dashboard:

```bash
# Database Configuration
DATABASE_URL=your_postgresql_connection_string_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=8003
NODE_ENV=production

# CORS Configuration
CORS_ORIGIN=https://your-frontend-app.vercel.app
```

### Render Configuration:
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Root Directory**: `backend`

## Database Setup

### PostgreSQL Database (Required):
1. Create a PostgreSQL database (can use Supabase, Railway, or any PostgreSQL provider)
2. Run the migration script: `backend/db/migrations/001_create_asbuilt_tables.sql`
3. Set the `DATABASE_URL` environment variable

### Supabase Setup:
1. Create a new Supabase project
2. Get the URL and API keys from the project settings
3. Set the Supabase environment variables

## Deployment Steps

### 1. Deploy Backend to Render:
1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set the root directory to `backend`
4. Configure environment variables
5. Deploy

### 2. Deploy Frontend to Vercel:
1. Connect your GitHub repository to Vercel
2. Set the root directory to `frontend`
3. Configure environment variables (use the Render backend URL)
4. Deploy

### 3. Update CORS Settings:
1. After both deployments are complete
2. Update the `CORS_ORIGIN` in Render to match your Vercel URL
3. Redeploy the backend

## Testing Production Deployment

### Backend Health Check:
```bash
curl https://your-backend-app.onrender.com/api/health
```

### Frontend API Test:
```bash
curl https://your-frontend-app.vercel.app/api/test-backend
```

## Troubleshooting

### Common Issues:
1. **CORS Errors**: Ensure `CORS_ORIGIN` is set correctly in backend
2. **Database Connection**: Verify `DATABASE_URL` is correct
3. **Environment Variables**: Double-check all variables are set in both platforms
4. **Build Errors**: Check build logs in Vercel/Render dashboards

### Logs:
- **Vercel**: Check function logs in the Vercel dashboard
- **Render**: Check service logs in the Render dashboard
