# AI Service 404 Error Fix

## Problem
The AI service at `https://quality-control-quality-assurance.onrender.com` is returning 404 for `/api/ai/detect-defects`, even though the endpoint exists in the code.

## Root Cause
The AI service Flask app may not be running properly, or the routes aren't being registered. The health check is returning a different format than expected, suggesting the Flask app isn't serving requests correctly.

## Solution: Verify AI Service Deployment

### Step 1: Check AI Service in Render Dashboard
1. Go to https://dashboard.render.com
2. Find your AI service: `quality-control-quality-assurance`
3. Check the **Logs** tab for:
   - Flask app startup messages
   - Route registration messages
   - Any errors during startup

### Step 2: Verify Start Command
The AI service should be started with:
```bash
python start_service.py
```

Or if using gunicorn (recommended for production):
```bash
gunicorn -w 4 -b 0.0.0.0:5001 app:app
```

### Step 3: Check Environment Variables
In Render dashboard → AI service → Environment, verify:
- ✅ `OPENAI_API_KEY` is set
- ✅ `PORT` is set (should be 5001 or whatever Render assigns)
- ✅ `FLASK_APP=app.py` (if needed)

### Step 4: Verify Routes Are Registered
The Flask app should register routes in `app.py`. Check that:
- `@app.route('/api/ai/detect-defects', methods=['POST'])` exists (line 395)
- The app is actually running the Flask app, not a different service

### Step 5: Test Health Endpoint
The health endpoint should return:
```json
{
  "status": "ok",
  "ai_service": "OpenAI GPT-4o + Hybrid AI Architecture",
  ...
}
```

If it returns something different, the Flask app isn't running.

## Quick Fix: Redeploy AI Service

1. Go to Render dashboard → AI service
2. Click **Manual Deploy** → **Deploy latest commit**
3. Watch the logs for:
   - `🚀 Starting Flask service...`
   - `✅ Flask library available`
   - Route registration messages

## Alternative: Check if Different Service is Running

The health check returned:
```json
{"status":"healthy","database":"connected","timestamp":"..."}
```

This doesn't match the Flask app's health endpoint format. This suggests:
- A different service might be running
- The Flask app might not be the one serving requests
- There might be a reverse proxy or load balancer in front

## Next Steps

1. **Check Render logs** for the AI service startup
2. **Verify the start command** in Render is correct
3. **Redeploy the AI service** if needed
4. **Test the endpoint directly** after redeployment

## Expected Logs (When Working)

```
🚀 Starting AI Service...
✅ OpenAI library available
✅ Flask library available
✅ Environment configuration valid
🚀 Starting Flask service...
 * Running on http://0.0.0.0:5001
```

If you don't see these logs, the Flask app isn't starting properly.

