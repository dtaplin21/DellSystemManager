# How to Clear AI Service Cache

This guide provides comprehensive instructions for clearing all types of caches in the AI service to ensure schema changes take effect.

---

## 🚀 Quick Method (Recommended)

Use the comprehensive cache clearing script:

```bash
cd ai_service
./clear_cache_comprehensive.sh
```

This script automatically clears:
- ✅ Python bytecode cache (`__pycache__/`)
- ✅ Compiled Python files (`.pyc`, `.pyo`)
- ✅ Redis cache (if running)
- ✅ pytest cache
- ✅ mypy cache
- ✅ Coverage files

---

## 📋 Manual Methods

### Method 1: Clear Python Bytecode Cache

**What it clears**: Python's compiled bytecode files that may contain old schema definitions.

```bash
cd ai_service

# Remove all __pycache__ directories
find . -type d -name "__pycache__" -exec rm -rf {} +

# Remove all .pyc files
find . -name "*.pyc" -delete

# Remove all .pyo files
find . -name "*.pyo" -delete
```

**Or use the existing script**:
```bash
cd ai_service
./clear_cache_and_restart.sh
```

---

### Method 2: Clear Python Import Cache

**What it clears**: Python's in-memory import cache (modules already imported).

**Note**: Python import cache is in-memory and is automatically cleared when you restart the Python process. To clear it:

1. **Stop the AI service**:
   ```bash
   # Find and kill running processes
   pkill -f "python.*app.py"
   pkill -f "python.*start_service.py"
   
   # Or if running in a terminal, press Ctrl+C
   ```

2. **Restart the service**:
   ```bash
   cd ai_service
   python3 app.py
   ```

---

### Method 3: Clear Pydantic Schema Cache

**What it clears**: Pydantic's internal schema cache.

**Note**: Pydantic caches schemas in memory. To clear it:

1. **Restart the Python process** (same as Method 2)
2. **Or use Python's importlib to reload modules**:
   ```python
   import importlib
   import sys
   
   # Reload specific modules
   if 'ai_service.browser_tools.vision_analysis_tool' in sys.modules:
       importlib.reload(sys.modules['ai_service.browser_tools.vision_analysis_tool'])
   ```

**Best practice**: Just restart the service - it's simpler and more reliable.

---

### Method 4: Clear Redis Cache

**What it clears**: Any cached data stored in Redis.

```bash
# If Redis is running
redis-cli FLUSHALL

# Or flush specific database
redis-cli FLUSHDB
```

**Note**: This only affects data cached in Redis, not Python import/schema caches.

---

### Method 5: Clear All Caches (Nuclear Option)

**Use this if nothing else works**:

```bash
cd ai_service

# 1. Stop all Python processes
pkill -f "python.*app.py"
pkill -f "python.*start_service.py"

# 2. Clear all Python caches
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -name "*.pyc" -delete
find . -name "*.pyo" -delete

# 3. Clear Redis (if running)
redis-cli FLUSHALL 2>/dev/null || echo "Redis not running"

# 4. Clear pytest cache
rm -rf .pytest_cache

# 5. Clear mypy cache
rm -rf .mypy_cache

# 6. Clear coverage files
find . -name ".coverage*" -delete

# 7. Restart the service
python3 app.py
```

---

## 🔍 Verify Cache is Cleared

After clearing cache and restarting, verify the service is using updated schemas:

```bash
# 1. Check service health
curl http://localhost:5001/health

# 2. Test schema validation (Python)
cd ai_service
python3 << 'EOF'
from browser_tools.vision_analysis_tool import BrowserVisionAnalysisToolSchema
schema = BrowserVisionAnalysisToolSchema()
print("✅ Schema created successfully")
print(f"   question: {schema.question}")
print(f"   user_id: {schema.user_id}")
EOF

# 3. Check for cached files
find . -name "*.pyc" -o -name "__pycache__" | head -5
# Should return nothing if cache is cleared
```

---

## 🐛 Troubleshooting

### Problem: Schema changes not taking effect

**Solution**:
1. ✅ Clear Python bytecode cache (Method 1)
2. ✅ Restart the service (Method 2)
3. ✅ Verify no old `.pyc` files exist

### Problem: Import errors after schema changes

**Solution**:
1. ✅ Clear all caches (Method 5)
2. ✅ Restart the service
3. ✅ Check Python path is correct

### Problem: Service won't start after clearing cache

**Solution**:
1. ✅ Check Python version: `python3 --version`
2. ✅ Reinstall dependencies: `pip install -r requirements.txt`
3. ✅ Check for syntax errors: `python3 -m py_compile app.py`

---

## 📝 Best Practices

1. **Always restart the service** after schema changes
2. **Clear cache before deployment** to ensure clean state
3. **Use the comprehensive script** for consistent cache clearing
4. **Verify changes** after clearing cache

---

## 🔗 Related Files

- `ai_service/clear_cache_comprehensive.sh` - Comprehensive cache clearing script
- `ai_service/clear_cache_and_restart.sh` - Original cache clearing script
- `ai_service/app.py` - Main Flask application
- `ai_service/start_service.py` - Service startup script

---

## ✅ Quick Reference

```bash
# Quick clear and restart
cd ai_service
./clear_cache_comprehensive.sh
pkill -f "python.*app.py"
python3 app.py

# Or use the start script
../start-ai-service.sh
```



