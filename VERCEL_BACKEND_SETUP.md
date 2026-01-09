# Vercel Frontend → Render Backend Connection

## Problem
The frontend deployed on Vercel needs to connect to the Node.js backend deployed on Render.

## Solution: Set `NEXT_PUBLIC_BACKEND_URL` in Vercel

### Steps:

1. **Go to Vercel Dashboard**
   - Navigate to: https://vercel.com/dashboard
   - Select your project: `dellsystemmanager` (or your project name)

2. **Open Project Settings**
   - Click **Settings** tab
   - Click **Environment Variables** in the left sidebar

3. **Add Environment Variable**
   - Click **Add New**
   - **Name**: `NEXT_PUBLIC_BACKEND_URL`
   - **Value**: `https://geosyntec-backend-ugea.onrender.com`
   - **Environment**: Select all (Production, Preview, Development)
   - Click **Save**

4. **Redeploy**
   - After adding the variable, go to **Deployments** tab
   - Click the **⋯** menu on the latest deployment
   - Click **Redeploy**
   - Or push a new commit to trigger a new deployment

### Verification

After redeploying, verify the connection:

1. Open your deployed frontend: https://dellsystemmanager.vercel.app
2. Open browser DevTools (F12)
3. Go to **Console** tab
4. Look for API requests - they should go to `https://geosyntec-backend-ugea.onrender.com`

### Alternative: Quick Test

You can test if the backend is accessible:

```bash
curl https://geosyntec-backend-ugea.onrender.com/health
```

Should return: `{"status":"ok"}` or similar.

## Current Backend URL

- **Render Backend**: `https://geosyntec-backend-ugea.onrender.com`
- **AI Service**: `https://quality-control-quality-assurance.onrender.com`
- **Frontend**: `https://dellsystemmanager.vercel.app`

## Troubleshooting

If the frontend still can't connect:

1. **Check Vercel Environment Variables**
   - Ensure `NEXT_PUBLIC_BACKEND_URL` is set correctly
   - Ensure it's available for the environment you're testing (Production/Preview)

2. **Check Render Backend Status**
   - Go to Render Dashboard
   - Verify the backend service is **Live** (not Failed/Stopped)
   - Check logs for any errors

3. **Check CORS**
   - The backend should allow requests from `https://dellsystemmanager.vercel.app`
   - Check `backend/server.js` for CORS configuration

4. **Check Network Tab**
   - Open DevTools → Network tab
   - Look for failed requests to the backend
   - Check error messages (CORS, 404, 500, etc.)

