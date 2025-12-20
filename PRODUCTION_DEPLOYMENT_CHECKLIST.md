# Production Deployment Checklist

This document tracks all development-specific configurations that need to be changed for production deployment.

## 📱 iOS App Configuration

### Current Development Settings
- **API Base URL**: `http://192.168.22.170:8003` (local Mac IP)
- **Network**: Local Wi-Fi network
- **App Transport Security**: Allows insecure HTTP for local development

### Production Changes Required

#### 1. Update API Base URL
**File**: `QC APP/QC-APP-Info.plist`

**Current (Development)**:
```xml
<key>API_BASE_URL</key>
<string>http://192.168.22.170:8003</string>
```

**Production**:
```xml
<key>API_BASE_URL</key>
<string>https://geosyntec-backend.onrender.com</string>
```
*Or your production backend URL*

**Action**: Update `API_BASE_URL` in Info.plist before production build

---

#### 2. Update App Transport Security
**File**: `QC APP/QC-APP-Info.plist`

**Current (Development)**:
- Allows insecure HTTP (`NSExceptionAllowsInsecureHTTPLoads: true`)
- Includes local IP exceptions (`192.168.22.170`, `localhost`, `127.0.0.1`)

**Production**:
- Remove local IP exceptions (keep only production domain)
- Ensure HTTPS is enforced for production domain
- Remove `NSExceptionAllowsInsecureHTTPLoads` for production domain (use HTTPS)

**Action**: Clean up `NSExceptionDomains` section, keep only production domain

---

#### 3. Build Configuration
**File**: Xcode Project Settings

**Development**:
- Debug configuration uses development API URL
- Development signing certificate

**Production**:
- Release configuration uses production API URL
- Production/App Store signing certificate
- Enable App Store Connect API key

**Action**: Create separate build configurations or use build schemes

---

## 🖥️ Backend Configuration

### Current Development Settings
- **Port**: `8003`
- **Host**: `0.0.0.0` (allows local network access)
- **Database**: Supabase (development)
- **CORS**: Allows localhost and development origins
- **Auth**: Development bypass enabled (`x-dev-bypass` header)

### Production Changes Required

#### 1. Environment Variables
**File**: `backend/config/env.js` or Render dashboard

**Check**:
- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` points to production database
- [ ] `SUPABASE_URL` is production Supabase instance
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is production key
- [ ] `JWT_SECRET` is production secret (different from dev)
- [ ] `CORS_ORIGIN` is restricted to production frontend URL
- [ ] `OPENAI_API_KEY` is production key
- [ ] `AI_SERVICE_URL` points to production AI service

**Action**: Verify all environment variables in production environment

---

#### 2. CORS Configuration
**File**: `backend/server.js`

**Current (Development)**:
```javascript
const allowedOrigins = [
  'https://dellsystemmanager.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];
```

**Production**:
- Remove `localhost` origins
- Add production frontend URL
- Restrict to specific production domains only

**Action**: Update CORS allowed origins list

---

#### 3. Authentication Middleware
**File**: `backend/middlewares/auth.js`

**Current (Development)**:
- Development bypass enabled (`x-dev-bypass` header)
- Allows mock authentication in development

**Production**:
- Disable development bypass
- Require valid Supabase tokens only
- Remove fallback authentication

**Action**: Ensure `config.isDevelopment` is false in production

---

#### 4. Database Migrations
**Files**: `backend/db/migrations/*.sql`

**Check**:
- [ ] All migrations have been run on production database
- [ ] Database schema matches development
- [ ] Indexes are created
- [ ] Foreign key constraints are in place

**Action**: Run migration script on production database

---

## 🤖 AI Service Configuration

### Current Development Settings
- **Port**: `5001`
- **Host**: `localhost`
- **Model**: GPT-4o (development)

### Production Changes Required

#### 1. Environment Variables
**File**: `ai_service/config.py` or Render dashboard

**Check**:
- [ ] `OPENAI_API_KEY` is production key
- [ ] `ANTHROPIC_API_KEY` is set (if used)
- [ ] `REDIS_HOST` points to production Redis
- [ ] `REDIS_PORT` is production port
- [ ] `REDIS_PASSWORD` is production password
- [ ] `FLASK_ENV=production`
- [ ] `DEBUG=false`

**Action**: Verify all environment variables in production

---

#### 2. API Endpoints
**File**: `ai_service/app.py`

**Check**:
- [ ] CORS is configured for production frontend
- [ ] Rate limiting is enabled
- [ ] Error handling doesn't expose sensitive info
- [ ] Logging is configured for production

**Action**: Review and update CORS/security settings

---

## 🌐 Frontend Configuration

### Current Development Settings
- **Backend URL**: `http://localhost:8003` (via Next.js rewrites)
- **API Client**: Uses `NEXT_PUBLIC_BACKEND_URL` or defaults to localhost

### Production Changes Required

#### 1. Environment Variables
**File**: `.env.production` or Vercel dashboard

**Check**:
- [ ] `NEXT_PUBLIC_BACKEND_URL` points to production backend
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is production Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is production key
- [ ] `NODE_ENV=production`

**Action**: Set production environment variables in Vercel/deployment platform

---

#### 2. API Client Configuration
**File**: `frontend/src/lib/apiClient.ts`

**Current (Development)**:
- Uses `process.env.NEXT_PUBLIC_BACKEND_URL` or defaults to `http://localhost:8003`
- May include `x-dev-bypass` header

**Production**:
- Uses production backend URL from environment variable
- Removes development bypass header
- Uses HTTPS for all requests

**Action**: Verify `apiClient` uses production URL (should be automatic via env var)

---

#### 3. Next.js Configuration
**File**: `frontend/next.config.js`

**Check**:
- [ ] Rewrites are disabled in production (only for development)
- [ ] Output file tracing is configured correctly
- [ ] Webpack configuration is production-optimized

**Action**: Verify rewrites are development-only

---

## 🔐 Security Checklist

### Before Production Deployment

- [ ] All API keys are production keys (not development keys)
- [ ] Database credentials are production credentials
- [ ] JWT secrets are unique and secure
- [ ] CORS is restricted to production domains only
- [ ] Development bypass headers are disabled
- [ ] HTTPS is enforced everywhere
- [ ] Error messages don't expose sensitive information
- [ ] Rate limiting is enabled
- [ ] Input validation is in place
- [ ] SQL injection protection is verified
- [ ] XSS protection is enabled

---

## 📊 Monitoring & Logging

### Production Setup Required

- [ ] Error tracking is configured (e.g., Sentry)
- [ ] Application logging is set up
- [ ] Performance monitoring is enabled
- [ ] Database query logging is configured
- [ ] API request logging is enabled
- [ ] Uptime monitoring is configured

---

## 🚀 Deployment Steps

### Pre-Deployment

1. [ ] Review all items in this checklist
2. [ ] Update all configuration files
3. [ ] Run tests in staging environment
4. [ ] Verify database migrations
5. [ ] Check environment variables
6. [ ] Review security settings

### Deployment

1. [ ] Deploy backend to Render/production server
2. [ ] Deploy AI service to Render/production server
3. [ ] Deploy frontend to Vercel/production server
4. [ ] Run database migrations on production
5. [ ] Verify all services are running
6. [ ] Test API endpoints
7. [ ] Test frontend connectivity
8. [ ] Test iOS app connectivity

### Post-Deployment

1. [ ] Verify iOS app can connect to production backend
2. [ ] Test authentication flow
3. [ ] Test form submission
4. [ ] Test image uploads
5. [ ] Monitor error logs
6. [ ] Check performance metrics
7. [ ] Verify SSL certificates
8. [ ] Test on physical devices

---

## 📝 Configuration File Summary

### Files That Need Updates for Production

1. **iOS App**:
   - `QC APP/QC-APP-Info.plist` - API URL and ATS settings

2. **Backend**:
   - `backend/config/env.js` - Environment variables
   - `backend/server.js` - CORS configuration
   - `backend/middlewares/auth.js` - Auth bypass removal

3. **Frontend**:
   - `.env.production` - Environment variables
   - `frontend/next.config.js` - Rewrites configuration

4. **AI Service**:
   - `ai_service/config.py` - Environment variables
   - `ai_service/app.py` - CORS and security settings

---

## 🔄 Quick Switch Script (Future Enhancement)

Consider creating a script to switch between development and production configurations:

```bash
# scripts/switch-to-production.sh
# - Updates Info.plist API URL
# - Updates environment files
# - Validates configuration
```

---

## 📅 Last Updated

- **Date**: 2025-12-20
- **Current Development IP**: `192.168.22.170`
- **Production Backend URL**: `https://geosyntec-backend.onrender.com` (verify)
- **Production Frontend URL**: `https://dellsystemmanager.vercel.app` (verify)

---

## ⚠️ Important Notes

1. **Never commit production API keys to git** - Use environment variables
2. **Always test in staging first** - Don't deploy directly to production
3. **Keep this checklist updated** - Add new configuration items as they're added
4. **Document any manual steps** - Some changes may require manual intervention
5. **Version control** - Tag releases and document what changed

---

## 🆘 Rollback Plan

If production deployment fails:

1. [ ] Revert to previous backend version
2. [ ] Revert to previous frontend version
3. [ ] Revert iOS app to previous build
4. [ ] Restore database backup if needed
5. [ ] Verify rollback was successful
6. [ ] Document what went wrong
7. [ ] Fix issues before retrying

