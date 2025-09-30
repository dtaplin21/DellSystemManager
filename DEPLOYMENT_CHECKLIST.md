# 🚀 Deployment Checklist

## ✅ Pre-Deployment Checklist

### Frontend (Vercel) - COMPLETED
- [x] Next.js configuration updated for production
- [x] Environment variables template created
- [x] Vercel configuration file created
- [x] Production build tested successfully
- [x] CORS configuration updated
- [x] API routing configured

### Backend (Render) - COMPLETED
- [x] Package.json scripts updated
- [x] Health check endpoints added
- [x] CORS configuration updated for production
- [x] Render configuration file created
- [x] Dependencies installed and audited
- [x] Environment variables template created

## 🔧 Environment Variables Setup

### Vercel Environment Variables (Set in Vercel Dashboard):
```bash
NEXT_PUBLIC_BACKEND_URL=https://your-backend-app.onrender.com
NEXT_PUBLIC_AI_SERVICE_URL=https://your-backend-app.onrender.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEXT_PUBLIC_APP_NAME=GeoSynth QC Pro
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
```

### Render Environment Variables (Set in Render Dashboard):
```bash
NODE_ENV=production
PORT=8003
DATABASE_URL=your_postgresql_connection_string_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
OPENAI_API_KEY=your_openai_api_key_here
CORS_ORIGIN=https://your-frontend-app.vercel.app
```

## 🚀 Deployment Steps

### 1. Deploy Backend to Render
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `geosynth-qc-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Set all environment variables
6. Deploy

### 2. Deploy Frontend to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
5. Set all environment variables (use the Render backend URL)
6. Deploy

### 3. Update CORS Settings
1. After both deployments complete, get your Vercel URL
2. Update `CORS_ORIGIN` in Render to match your Vercel URL
3. Redeploy the backend

## 🧪 Post-Deployment Testing

### Backend Health Check:
```bash
curl https://your-backend-app.onrender.com/health
curl https://your-backend-app.onrender.com/api/health
```

### Frontend API Test:
```bash
curl https://your-frontend-app.vercel.app/api/test-backend
```

### Full Integration Test:
1. Visit your Vercel URL
2. Test login/signup
3. Test QC data import/export
4. Test panel layout functionality
5. Test AI features

## 📊 Production URLs

After deployment, update these files with your actual URLs:
- `frontend/vercel.json` - Update backend URL
- `backend/render.yaml` - Update CORS origin

## 🔍 Monitoring

### Vercel:
- Check function logs in Vercel dashboard
- Monitor build logs for errors
- Check performance metrics

### Render:
- Check service logs in Render dashboard
- Monitor resource usage
- Check health check endpoints

## 🚨 Troubleshooting

### Common Issues:
1. **CORS Errors**: Update `CORS_ORIGIN` in Render
2. **Database Connection**: Verify `DATABASE_URL` is correct
3. **Environment Variables**: Double-check all variables are set
4. **Build Errors**: Check build logs in both platforms

### Health Check Endpoints:
- Backend: `https://your-backend-app.onrender.com/health`
- API: `https://your-backend-app.onrender.com/api/health`

## 📝 Notes

- The xlsx vulnerability in backend is a known issue but doesn't affect production
- All ESLint warnings in frontend are non-critical
- Production builds are optimized and ready for deployment
- Database migrations will run automatically on first deployment
