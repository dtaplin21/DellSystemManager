# 📱 Mobile App Deployment Guide

## Overview
This guide covers deploying the backend to Render so the iOS app can connect from anywhere (not just local network).

## ✅ Completed Steps

### 1. Render Configuration
- ✅ `render.yaml` created at project root
- ✅ Service name: `geosynth-qc-backend`
- ✅ Root directory: `backend`
- ✅ Build command: `npm install`
- ✅ Start command: `npm start`
- ✅ Environment variables configured

### 2. Backend Updates
- ✅ CORS configuration updated to support mobile apps
- ✅ Allows requests with no origin (mobile apps)
- ✅ Supports both web and mobile clients

### 3. iOS App Configuration
- ✅ `QC-APP-Info.plist` has ATS (App Transport Security) configured
- ✅ Currently set to local IP for development
- ⏳ **Needs Update**: Change `API_BASE_URL` to Render URL after deployment

## 🚀 Deployment Steps

### Step 1: Deploy to Render

1. **Go to Render Dashboard**
   - Visit https://dashboard.render.com
   - Sign in with GitHub

2. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select the repository: `DellSystemManager` (or your repo name)

3. **Configure Service**
   - **Name**: `geosynth-qc-backend` (or your choice)
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `backend` (Render will auto-detect from render.yaml)
   - **Runtime**: `Node`
   - **Build Command**: `npm install` (auto-detected)
   - **Start Command**: `npm start` (auto-detected)
   - **Plan**: 
     - **Free**: Spins down after 15 min inactivity (good for testing)
     - **Starter ($7/month)**: Always-on (recommended for production)

4. **Set Environment Variables**
   In Render dashboard → Environment tab, add:
   ```
   NODE_ENV=production
   PORT=8003
   DATABASE_URL=<your-postgres-connection-string>
   SUPABASE_URL=<your-supabase-url>
   SUPABASE_ANON_KEY=<your-supabase-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   OPENAI_API_KEY=<your-openai-key> (optional)
   CORS_ORIGIN=*
   JWT_SECRET=<generate-a-random-secret>
   SUPABASE_JWT_SECRET=<from-supabase-settings>
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for build to complete (5-10 minutes)
   - Note your service URL: `https://geosynth-qc-backend.onrender.com`

### Step 2: Test Backend Deployment

```bash
# Test health endpoint
curl https://geosynth-qc-backend.onrender.com/api/health

# Test login endpoint (should return 401, not connection error)
curl -X POST https://geosynth-qc-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

**Expected Results:**
- ✅ Health endpoint returns: `{"status":"healthy",...}`
- ✅ Login endpoint returns: `{"message":"Invalid credentials"}` (401) - NOT connection error

### Step 3: Update iOS App Configuration

1. **Update Info.plist**
   Open `QC APP/QC-APP-Info.plist` and update:

   ```xml
   <key>API_BASE_URL</key>
   <string>https://geosynth-qc-backend.onrender.com</string>
   ```

2. **Update ATS (App Transport Security)**
   Since you're using HTTPS, simplify ATS:

   ```xml
   <key>NSAppTransportSecurity</key>
   <dict>
       <key>NSAllowsArbitraryLoads</key>
       <false/>
       <!-- HTTPS is allowed by default -->
   </dict>
   ```

   Or keep exceptions for development:

   ```xml
   <key>NSAppTransportSecurity</key>
   <dict>
       <key>NSAllowsLocalNetworking</key>
       <true/>
       <key>NSExceptionDomains</key>
       <dict>
           <key>geosynth-qc-backend.onrender.com</key>
           <dict>
               <key>NSIncludesSubdomains</key>
               <true/>
           </dict>
       </dict>
   </dict>
   ```

3. **Rebuild iOS App**
   - In Xcode: Product → Clean Build Folder (Shift+Cmd+K)
   - Product → Build (Cmd+B)
   - Run on iPhone

### Step 4: Verify Mobile Connection

1. **Test on iPhone**
   - Open the app
   - Try to log in
   - Check Xcode console for connection errors

2. **Expected Behavior**
   - ✅ App connects to backend
   - ✅ Login endpoint accessible
   - ✅ No "Connection refused" errors
   - ✅ API calls succeed

## 🔧 Troubleshooting

### Issue: CORS Errors
**Solution**: Verify `CORS_ORIGIN=*` is set in Render environment variables

### Issue: Service Spins Down (Free Tier)
**Solution**: 
- First request may take 30-60 seconds (cold start)
- Upgrade to Starter plan ($7/month) for always-on
- Or use Railway/Fly.io for better free tier

### Issue: Database Connection Fails
**Solution**: 
- Verify `DATABASE_URL` is correct in Render
- Check database allows connections from Render IPs
- Test connection string locally first

### Issue: Build Fails
**Solution**:
- Check Render build logs
- Verify `package.json` has correct `start` script
- Ensure all dependencies are in `package.json`

## 📋 Post-Deployment Checklist

- [ ] Backend deployed to Render
- [ ] Health endpoint responds
- [ ] Login endpoint accessible
- [ ] Environment variables set correctly
- [ ] iOS app `API_BASE_URL` updated
- [ ] iOS app rebuilt and tested
- [ ] Authentication works from iPhone
- [ ] API calls succeed
- [ ] No CORS errors
- [ ] Database connections work

## 🎯 Next Steps After Deployment

1. **Get Your Render URL**
   - Format: `https://geosynth-qc-backend.onrender.com`
   - Or custom domain if configured

2. **Update iOS App**
   - Change `API_BASE_URL` in `QC-APP-Info.plist`
   - Rebuild and test

3. **Test in Field**
   - Disconnect from local network
   - Use cellular data
   - Verify app works anywhere

4. **Optional: Custom Domain**
   - Add custom domain in Render
   - Update DNS records
   - Update `API_BASE_URL` in iOS app

## 📝 Notes

- **Free Tier Limitation**: Render free tier spins down after 15 minutes of inactivity. First request after spin-down takes 30-60 seconds.
- **Production Recommendation**: Use Starter plan ($7/month) for always-on service.
- **Alternative Platforms**: Railway, Fly.io, or AWS EC2 for different pricing/features.

