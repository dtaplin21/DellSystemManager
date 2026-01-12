# Service URLs Configuration

## ✅ Correct Service URLs

### Backend Service (Node.js/Express)
- **URL**: `https://geosyntec-backend-ugea.onrender.com`
- **Purpose**: Main API server handling:
  - Authentication & authorization
  - Project management
  - Document management
  - Panel layout data
  - QC data management
  - Mobile form uploads
  - Orchestrates AI service requests

### AI Service (Python/Flask)
- **URL**: `https://geosyntec-backend.onrender.com`
- **Purpose**: AI/ML processing service handling:
  - AI chat conversations
  - Document analysis
  - Defect detection
  - Form field extraction
  - Panel optimization
  - OpenAI API calls

## 📝 Environment Variables

### Vercel (Frontend)
Set these in Vercel Dashboard → Settings → Environment Variables:

```bash
NEXT_PUBLIC_BACKEND_URL=https://geosyntec-backend-ugea.onrender.com
NEXT_PUBLIC_AI_SERVICE_URL=https://geosyntec-backend.onrender.com
```

### Render (Backend Service)
Set this in Render Dashboard → Backend Service → Environment Variables:

```bash
AI_SERVICE_URL=https://geosyntec-backend.onrender.com
```

### Render (AI Service)
No special configuration needed - this is the service itself.

## 🔧 Files Updated

### ✅ Fixed Files
1. **`tests/helpers/service-urls.ts`**
   - Backend default: `geosyntec-backend-ugea.onrender.com` ✅
   - AI Service default: `geosyntec-backend.onrender.com` ✅

2. **`scripts/keep-alive-ping.js`**
   - Backend default: `geosyntec-backend-ugea.onrender.com` ✅
   - AI Service default: `geosyntec-backend.onrender.com` ✅

3. **`.github/workflows/keep-alive.yml`**
   - Backend default: `geosyntec-backend-ugea.onrender.com` ✅
   - AI Service default: `geosyntec-backend.onrender.com` ✅

## 🚨 Important Notes

### Backend Service Configuration
- The backend service uses `AI_SERVICE_URL` environment variable
- Defaults to `http://localhost:5001` for local development
- **Must be set to `https://geosyntec-backend.onrender.com` in Render**

### Frontend Configuration
- Frontend uses `NEXT_PUBLIC_BACKEND_URL` for backend API calls
- Frontend uses `NEXT_PUBLIC_AI_SERVICE_URL` for direct AI service calls (chat)
- **Both must be set in Vercel environment variables**

### Keep-Alive Ping
- Pings both services every 10 minutes via GitHub Actions
- Prevents cold starts on Render free tier
- Uses environment variables with fallback defaults

## ✅ Verification Checklist

- [x] Playwright tests use correct backend URL
- [x] Playwright tests use correct AI service URL
- [x] Keep-alive script pings correct URLs
- [x] GitHub Actions workflow uses correct URLs
- [ ] Vercel has `NEXT_PUBLIC_BACKEND_URL` set (verify in dashboard)
- [ ] Vercel has `NEXT_PUBLIC_AI_SERVICE_URL` set (verify in dashboard)
- [ ] Render backend service has `AI_SERVICE_URL` set (verify in dashboard)

## 🔍 How to Verify URLs Are Correct

### Test Backend Service
```bash
curl https://geosyntec-backend-ugea.onrender.com/health
```

### Test AI Service
```bash
curl https://geosyntec-backend.onrender.com/health
```

### Check Playwright Configuration
```bash
# Run tests and check logs for URLs
npm run test:e2e
```

### Check Keep-Alive Status
1. Go to GitHub Actions
2. Check "Keep-Alive Ping" workflow
3. Verify both services are being pinged successfully

## 📚 Related Documentation

- `VERCEL_BACKEND_SETUP.md` - Vercel environment variable setup
- `TIMEOUT_RETRY_IMPLEMENTATION.md` - Timeout and retry configuration
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md` - Production deployment guide

