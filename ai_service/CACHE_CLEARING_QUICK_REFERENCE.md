# Quick Reference: Clear AI Service Cache

## 🚀 Fastest Method

```bash
cd ai_service
./clear_cache_comprehensive.sh
pkill -f "python.*app.py"
python3 app.py
```

---

## 📋 Step-by-Step Manual Method

### Step 1: Stop Running Service
```bash
# Find and kill running processes
pkill -f "python.*app.py"
pkill -f "python.*start_service.py"
```

### Step 2: Clear Python Cache
```bash
cd ai_service
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -name "*.pyc" -delete
find . -name "*.pyo" -delete
```

### Step 3: Clear Redis (if running)
```bash
redis-cli FLUSHALL
```

### Step 4: Restart Service
```bash
python3 app.py
# OR
python3 start_service.py
# OR
../start-ai-service.sh
```

---

## ✅ Verify Cache Cleared

```bash
# Check no cache files exist
find ai_service -name "*.pyc" -o -name "__pycache__" | wc -l
# Should return: 0

# Test schema works
cd ai_service
python3 -c "from browser_tools.vision_analysis_tool import BrowserVisionAnalysisToolSchema; s = BrowserVisionAnalysisToolSchema(); print('✅ Schema works')"
```

---

## 🔍 What Gets Cleared

- ✅ Python bytecode (`__pycache__/`, `.pyc`, `.pyo`)
- ✅ Python import cache (via restart)
- ✅ Pydantic schema cache (via restart)
- ✅ Redis cache (if running)
- ✅ pytest cache
- ✅ mypy cache
- ✅ Coverage files

---

## 📚 Full Documentation

See `CLEAR_AI_SERVICE_CACHE.md` for detailed instructions.



