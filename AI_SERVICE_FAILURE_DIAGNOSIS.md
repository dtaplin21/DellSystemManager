# AI Service Failure Diagnosis

## Error Summary

**Error Code**: `ECONNREFUSED`  
**Error Message**: Connection refused to Python AI service  
**Service URL**: `http://localhost:5001`  
**Endpoint**: `/api/ai/chat`  
**Timestamp**: 2025-11-19T21:29:33.711Z

## Root Cause

**The Python AI service is not running.**

The backend is attempting to connect to `http://localhost:5001/api/ai/chat`, but the connection is being refused because nothing is listening on port 5001.

## Workflow Analysis

### 1. Request Flow
```
Frontend (Chat) 
  → Backend `/api/ai/chat` (backend/routes/ai.js:318)
  → Attempts Python AI Service (line 395)
  → Connection fails with ECONNREFUSED (line 469)
  → Falls back to backend route handling (line 496)
```

### 2. Configuration

**Backend Configuration** (`backend/routes/ai.js:11`):
```javascript
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 
                       process.env.PYTHON_AI_SERVICE_URL || 
                       'http://localhost:5001';
```

**Python Service Configuration** (`ai-service/app.py:636`):
```python
port = int(os.getenv("PORT", 5001))
app.run(host='0.0.0.0', port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
```

**Expected Port**: `5001` (default)

### 3. Fallback Mechanism

The backend has a fallback system:
- **Line 469**: Detects `ECONNREFUSED` or `ETIMEDOUT`
- **Line 470**: Logs error and continues to backend route
- **Line 496**: Falls back to backend route handling (uses OpenAI directly)

**Current Behavior**: The fallback is working - requests continue to backend route, but without browser tools and advanced AI features.

## Impact

### What's Working
✅ Backend fallback route is functioning  
✅ Basic AI chat responses work (using OpenAI directly)  
✅ Panel manipulation commands work (via backend)

### What's Not Working
❌ Browser automation tools (navigation, screenshots, extraction)  
❌ Advanced AI workflows (MCP agents, multi-agent orchestration)  
❌ Visual panel layout inspection via browser tools  
❌ Real-time browser-based panel manipulation

## Diagnosis Steps

### Step 1: Check if Python Service is Running
```bash
# Check if port 5001 is in use
lsof -i :5001
# OR
netstat -an | grep 5001
# OR (macOS)
sudo lsof -i :5001
```

### Step 2: Check Python Service Process
```bash
# Check for Python processes
ps aux | grep python
ps aux | grep flask
ps aux | grep "app.py"
```

### Step 3: Check Environment Variables
```bash
# In backend directory
echo $AI_SERVICE_URL
echo $PYTHON_AI_SERVICE_URL
echo $PORT

# In ai-service directory
echo $PORT
echo $FLASK_DEBUG
```

### Step 4: Verify Service Health Endpoint
```bash
# Try to reach the health endpoint
curl http://localhost:5001/health
# Expected: {"status":"ok"}
# Actual: Connection refused
```

## Solutions

### Solution 1: Start Python AI Service (Recommended)

**Navigate to ai-service directory:**
```bash
cd ai-service
```

**Install dependencies (if not already done):**
```bash
pip install -r requirements.txt
```

**Start the service:**
```bash
# Option A: Direct Python execution
python app.py

# Option B: Using Flask CLI
export PORT=5001
export FLASK_DEBUG=0
flask run --host=0.0.0.0 --port=5001

# Option C: Using Python module
python -m flask run --host=0.0.0.0 --port=5001
```

**Verify it's running:**
```bash
curl http://localhost:5001/health
# Should return: {"status":"ok"}
```

### Solution 2: Check for Port Conflicts

If port 5001 is already in use:
```bash
# Find what's using port 5001
lsof -i :5001

# Kill the process if needed
kill -9 <PID>

# OR use a different port
export PORT=5002
# Update backend .env: AI_SERVICE_URL=http://localhost:5002
```

### Solution 3: Verify Dependencies

**Required Python packages:**
- flask>=3.0.0
- flask-cors>=4.0.0
- playwright>=1.42.0 (for browser tools)
- redis>=5.0.0 (optional, for caching)
- openai>=1.0.0
- crewai>=0.28.0

**Install Playwright browsers:**
```bash
playwright install
```

### Solution 4: Check Logs

**Start Python service with verbose logging:**
```bash
export FLASK_DEBUG=1
python app.py
```

**Look for:**
- Service startup messages
- Port binding confirmation
- Browser tools initialization
- Redis connection status (optional)

## Expected Startup Output

When the Python AI service starts successfully, you should see:
```
[INFO] Flask app starting on 0.0.0.0:5001
[INFO] Browser automation enabled: True
[INFO] Browser tools available: True
[INFO] Redis connection successful (or warning if Redis not available)
[INFO] ✅ Browser tools are ready
```

## Verification Checklist

- [ ] Python service is running (`ps aux | grep python`)
- [ ] Port 5001 is listening (`lsof -i :5001`)
- [ ] Health endpoint responds (`curl http://localhost:5001/health`)
- [ ] Backend can connect (check backend logs for successful connection)
- [ ] Browser tools are initialized (check Python service logs)
- [ ] Environment variables are set correctly

## Next Steps After Starting Service

1. **Test Health Endpoint:**
   ```bash
   curl http://localhost:5001/health
   ```

2. **Test Chat Endpoint:**
   ```bash
   curl -X POST http://localhost:5001/api/ai/chat \
     -H "Content-Type: application/json" \
     -d '{"projectId":"test","message":"test","user_id":"test"}'
   ```

3. **Check Backend Logs:**
   - Should see successful connection instead of ECONNREFUSED
   - Should see Python AI service response received

4. **Test Frontend:**
   - Try sending a chat message
   - Should use Python AI service instead of fallback
   - Browser tools should be available

## Additional Notes

- The fallback mechanism ensures the system continues to work without the Python service
- However, advanced features (browser automation, MCP agents) require the Python service
- The Python service provides browser tools for visual panel layout inspection
- Redis is optional but recommended for caching and cost tracking

## Related Files

- **Backend Route**: `backend/routes/ai.js` (lines 318-868)
- **Python Service**: `ai-service/app.py` (lines 634-637)
- **Service Configuration**: `backend/routes/ai.js` (line 11)
- **Error Handling**: `backend/routes/ai.js` (lines 452-496)

