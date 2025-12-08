# 500 Error Fix - Mobile Upload Endpoint

## Problem
The mobile app upload endpoint (`/api/mobile/upload-defect/:projectId`) is returning a 500 error, likely due to the AI service not being configured or accessible.

## Root Cause
The endpoint requires `AI_SERVICE_URL` environment variable to be set, but it's not configured in Render. When the backend tries to call the AI service, it fails and returns a 500 error.

## Fixes Applied

### 1. Enhanced Error Handling ✅
**File**: `backend/routes/mobile.js`

**Changes**:
- Added detailed logging for AI service calls
- Improved error messages with specific error codes
- Added validation for AI service response structure
- Better handling of connection errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
- More descriptive error messages for debugging

**Key Improvements**:
```javascript
// Now logs AI service URL and configuration
logger.info('[MOBILE] AI service configuration', {
  uploadId,
  aiServiceUrl: AI_SERVICE_URL,
  hasEnvVar: !!process.env.AI_SERVICE_URL
});

// Better error handling
if (aiError.code === 'ECONNREFUSED' || aiError.code === 'ETIMEDOUT' || aiError.code === 'ENOTFOUND') {
  return res.status(503).json({
    success: false,
    message: `AI service unavailable at ${AI_SERVICE_URL}. Please ensure the AI service is running and AI_SERVICE_URL is configured correctly.`,
    error: aiError.message,
    code: aiError.code
  });
}
```

### 2. Updated Render Configuration ✅
**File**: `render.yaml`

**Changes**:
- Added `AI_SERVICE_URL` to the environment variables list
- Marked as `sync: false` (must be set manually in Render dashboard)

## Required Action: Configure AI_SERVICE_URL in Render

### Step 1: Find Your AI Service URL
Based on your deployment, your AI service should be at:
- **Render Service**: `https://quality-control-quality-assurance.onrender.com`
- Or check your Render dashboard for the actual AI service URL

### Step 2: Set Environment Variable in Render
1. Go to https://dashboard.render.com
2. Navigate to your backend service: `geosynth-qc-backend`
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. Add:
   - **Key**: `AI_SERVICE_URL`
   - **Value**: `https://quality-control-quality-assurance.onrender.com` (or your actual AI service URL)
6. Click **Save Changes**
7. **Redeploy** the service (Render will auto-redeploy when you save)

### Step 3: Verify Configuration
After redeployment, check the logs:
1. Go to **Logs** tab in Render
2. Look for: `[MOBILE] AI service configuration`
3. Verify it shows the correct URL

## Testing the Fix

### 1. Check Backend Logs
After setting `AI_SERVICE_URL`, try uploading again and check logs for:
```
[MOBILE] AI service configuration
  uploadId: <uuid>
  aiServiceUrl: https://quality-control-quality-assurance.onrender.com
  hasEnvVar: true
```

### 2. Test Upload Flow
1. Fill out the form in the mobile app
2. Tap "Upload"
3. Check Xcode console for detailed logs
4. Check Render backend logs for error details

### 3. Expected Behavior
- **If AI service is accessible**: Upload should succeed
- **If AI service is not accessible**: You'll get a 503 error with a clear message
- **If AI service returns an error**: You'll get a 500 error with the AI service's error message

## Error Scenarios & Solutions

### Scenario 1: AI_SERVICE_URL Not Set
**Error**: 500 Internal Server Error  
**Log Message**: `AI service unavailable at http://localhost:5001`  
**Solution**: Set `AI_SERVICE_URL` in Render environment variables

### Scenario 2: AI Service Not Running
**Error**: 503 Service Unavailable  
**Log Message**: `ECONNREFUSED` or `ETIMEDOUT`  
**Solution**: Ensure AI service is deployed and running on Render

### Scenario 3: AI Service Returns Error
**Error**: 500 Internal Server Error  
**Log Message**: `AI service returned an error`  
**Solution**: Check AI service logs for the actual error

### Scenario 4: Network/DNS Error
**Error**: 503 Service Unavailable  
**Log Message**: `ENOTFOUND`  
**Solution**: Verify the AI service URL is correct and accessible

## Debugging Steps

### 1. Check Environment Variables
In Render dashboard → Environment tab, verify:
- ✅ `AI_SERVICE_URL` is set
- ✅ Value is a valid URL (starts with `https://`)
- ✅ No trailing slash

### 2. Test AI Service Directly
```bash
curl https://quality-control-quality-assurance.onrender.com/health
```
Should return a health check response.

### 3. Check Backend Logs
Look for these log entries:
- `[MOBILE] AI service configuration` - Shows if env var is set
- `[MOBILE] Calling AI service for defect detection` - Shows the request
- `[MOBILE] AI service error` - Shows the error details

### 4. Check AI Service Logs
In Render dashboard → AI service → Logs, look for:
- Incoming requests from the backend
- Any errors in the AI service

## Files Modified

1. **backend/routes/mobile.js**
   - Enhanced error handling
   - Added detailed logging
   - Better error messages
   - Response validation

2. **render.yaml**
   - Added `AI_SERVICE_URL` to environment variables

## Next Steps

1. ✅ **Set `AI_SERVICE_URL` in Render** (Required)
2. ✅ **Redeploy backend service** (Automatic when you save env var)
3. ✅ **Test upload from mobile app**
4. ✅ **Check logs for any remaining issues**

## Additional Notes

- The AI service must be deployed and running before the backend can use it
- The AI service URL should be the full URL (e.g., `https://quality-control-quality-assurance.onrender.com`)
- If the AI service is on a different Render account, make sure it's publicly accessible
- The backend will wait up to 2 minutes for the AI service to respond (timeout: 120000ms)

