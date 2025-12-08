# AI Service 500 Error Debugging Guide

## Current Issue
The backend is successfully receiving upload requests, but when it tries to call the AI service at `/api/ai/detect-defects`, the AI service returns a 500 error.

## Error Flow
1. ✅ Mobile app sends upload request → Backend receives it
2. ✅ Backend validates request → Success
3. ✅ Backend calls AI service → `POST ${AI_SERVICE_URL}/api/ai/detect-defects`
4. ❌ AI service returns 500 error → "Failed to detect defects in image"

## Root Cause Analysis

The AI service endpoint `/api/ai/detect-defects` exists and should work, but it's returning a 500 error. Common causes:

### 1. OpenAI API Key Missing or Invalid
**Most Likely Cause**
- The AI service needs `OPENAI_API_KEY` to call GPT-4o vision model
- If the key is missing or invalid, the service will return 500

**Check**: Render dashboard → AI service → Environment variables → `OPENAI_API_KEY`

### 2. AI Service Not Fully Started
- The service might be starting up or crashed
- Check if the service is running in Render

**Check**: Render dashboard → AI service → Logs → Look for startup errors

### 3. Image Processing Error
- The image might be too large or in an unsupported format
- The base64 encoding might be corrupted

**Check**: Backend logs for image size and format

### 4. Async Function Error
- The `detect_defects_in_image()` function might be throwing an exception
- Check AI service logs for Python traceback

**Check**: AI service logs for Python errors

## Debugging Steps

### Step 1: Check AI Service Health
```bash
curl https://quality-control-quality-assurance.onrender.com/health
```

**Expected**: Should return JSON with status "ok"

**If fails**: AI service is not running or not accessible

### Step 2: Check AI Service Logs in Render
1. Go to Render dashboard
2. Navigate to your AI service: `quality-control-quality-assurance`
3. Click **Logs** tab
4. Look for:
   - Error messages when `/api/ai/detect-defects` is called
   - Python tracebacks
   - OpenAI API errors
   - Missing environment variables

**Look for**:
```
Error detecting defects: ...
Traceback (most recent call last):
  ...
```

### Step 3: Check Backend Logs in Render
1. Go to Render dashboard
2. Navigate to your backend: `geosynth-qc-backend`
3. Click **Logs** tab
4. Look for:
   - `[MOBILE] AI service configuration` - Shows if AI_SERVICE_URL is set
   - `[MOBILE] AI service HTTP error` - Shows the actual error from AI service
   - `[MOBILE] Calling AI service for defect detection` - Shows the request

**Look for**:
```
[MOBILE] AI service HTTP error
  status: 500
  data: { error: "..." }
```

### Step 4: Verify Environment Variables

#### Backend Service (geosynth-qc-backend)
- ✅ `AI_SERVICE_URL` should be: `https://quality-control-quality-assurance.onrender.com`

#### AI Service (quality-control-quality-assurance)
- ✅ `OPENAI_API_KEY` should be set (required)
- ✅ `REDIS_HOST` (if using Redis)
- ✅ `REDIS_PORT` (if using Redis)

### Step 5: Test AI Service Endpoint Directly

Create a test script to call the AI service:

```bash
# Test with a small base64 image
curl -X POST https://quality-control-quality-assurance.onrender.com/api/ai/detect-defects \
  -H "Content-Type: application/json" \
  -d '{
    "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "project_id": "test-project"
  }'
```

**Expected**: Should return defect detection results or a clear error message

**If 500 error**: Check AI service logs for the actual error

## Common Fixes

### Fix 1: Set OPENAI_API_KEY in AI Service
1. Go to Render dashboard → AI service
2. Environment tab
3. Add/Update: `OPENAI_API_KEY` = `sk-...` (your OpenAI API key)
4. Save and redeploy

### Fix 2: Verify AI_SERVICE_URL in Backend
1. Go to Render dashboard → Backend service
2. Environment tab
3. Verify: `AI_SERVICE_URL` = `https://quality-control-quality-assurance.onrender.com`
4. No trailing slash!

### Fix 3: Check AI Service Startup
1. Go to Render dashboard → AI service
2. Logs tab
3. Look for startup errors
4. Check if service is actually running

### Fix 4: Check Image Size
The image is 704KB compressed, which should be fine. But if the AI service has limits:
- Check AI service logs for "image too large" errors
- Consider reducing image size further

## Enhanced Error Messages

I've updated the backend to provide more detailed error messages. The new error response includes:
- The actual error from the AI service
- HTTP status code
- Suggestions for what might be wrong

## Next Steps

1. **Check AI Service Logs** - This will show the actual Python error
2. **Verify OPENAI_API_KEY** - Most likely cause
3. **Test AI Service Directly** - Use curl to test the endpoint
4. **Check Backend Logs** - See the detailed error from AI service

## Expected Log Output

### Successful Request
```
[MOBILE] AI service configuration
  aiServiceUrl: https://quality-control-quality-assurance.onrender.com
  hasEnvVar: true

[MOBILE] Calling AI service for defect detection
  url: https://quality-control-quality-assurance.onrender.com/api/ai/detect-defects

[MOBILE] AI service response received
  status: 200
  hasData: true

[MOBILE] Defect detection completed
  defectsFound: 2
```

### Failed Request (Current Issue)
```
[MOBILE] AI service HTTP error
  status: 500
  data: { error: "..." }
  errorMessage: "..."
```

The `error` field in the response will tell you exactly what's wrong!

