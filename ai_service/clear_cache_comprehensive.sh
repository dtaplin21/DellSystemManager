#!/bin/bash
# Comprehensive Cache Clearing Script for AI Service
# This script clears all Python caches, import caches, and restarts the service

set -e  # Exit on error

echo "=" | tr -d '\n'
for i in {1..80}; do echo -n "="; done
echo ""
echo "🧹 COMPREHENSIVE AI SERVICE CACHE CLEARING"
echo "=" | tr -d '\n'
for i in {1..80}; do echo -n "="; done
echo ""
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 Working directory: $SCRIPT_DIR"
echo ""

# 1. Clear Python bytecode cache
echo "1️⃣  Clearing Python bytecode cache (__pycache__)..."
PYCACHE_COUNT=$(find . -type d -name "__pycache__" 2>/dev/null | wc -l | tr -d ' ')
if [ "$PYCACHE_COUNT" -gt 0 ]; then
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
    echo "   ✅ Removed $PYCACHE_COUNT __pycache__ directories"
else
    echo "   ℹ️  No __pycache__ directories found"
fi

PYC_COUNT=$(find . -name "*.pyc" 2>/dev/null | wc -l | tr -d ' ')
if [ "$PYC_COUNT" -gt 0 ]; then
    find . -name "*.pyc" -delete 2>/dev/null
    echo "   ✅ Removed $PYC_COUNT .pyc files"
else
    echo "   ℹ️  No .pyc files found"
fi

PYO_COUNT=$(find . -name "*.pyo" 2>/dev/null | wc -l | tr -d ' ')
if [ "$PYO_COUNT" -gt 0 ]; then
    find . -name "*.pyo" -delete 2>/dev/null
    echo "   ✅ Removed $PYO_COUNT .pyo files"
else
    echo "   ℹ️  No .pyo files found"
fi
echo ""

# 2. Clear Python import cache (if running)
echo "2️⃣  Clearing Python import cache..."
# Note: Python import cache is in-memory, cleared by restarting Python
echo "   ℹ️  Python import cache will be cleared when service restarts"
echo ""

# 3. Clear Pydantic schema cache
echo "3️⃣  Clearing Pydantic schema cache..."
# Pydantic caches schemas in memory, cleared by restarting Python
echo "   ℹ️  Pydantic schema cache will be cleared when service restarts"
echo ""

# 4. Clear Redis cache (if Redis is running)
echo "4️⃣  Clearing Redis cache..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &>/dev/null; then
        redis-cli FLUSHALL &>/dev/null && echo "   ✅ Redis cache cleared" || echo "   ⚠️  Redis FLUSHALL failed"
    else
        echo "   ℹ️  Redis server not running (skipping)"
    fi
else
    echo "   ℹ️  redis-cli not found (skipping Redis cache clear)"
fi
echo ""

# 5. Clear any .pytest_cache
echo "5️⃣  Clearing pytest cache..."
if [ -d ".pytest_cache" ]; then
    rm -rf .pytest_cache
    echo "   ✅ Removed .pytest_cache directory"
else
    echo "   ℹ️  No .pytest_cache directory found"
fi
echo ""

# 6. Clear any .mypy_cache
echo "6️⃣  Clearing mypy cache..."
if [ -d ".mypy_cache" ]; then
    rm -rf .mypy_cache
    echo "   ✅ Removed .mypy_cache directory"
else
    echo "   ℹ️  No .mypy_cache directory found"
fi
echo ""

# 7. Clear any .coverage files
echo "7️⃣  Clearing coverage files..."
COVERAGE_COUNT=$(find . -name ".coverage" -o -name ".coverage.*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$COVERAGE_COUNT" -gt 0 ]; then
    find . -name ".coverage" -delete 2>/dev/null
    find . -name ".coverage.*" -delete 2>/dev/null
    echo "   ✅ Removed $COVERAGE_COUNT coverage files"
else
    echo "   ℹ️  No coverage files found"
fi
echo ""

# 8. Check for running Python processes
echo "8️⃣  Checking for running AI service processes..."
AI_SERVICE_PIDS=$(pgrep -f "python.*app.py\|python.*start_service.py" 2>/dev/null || true)
if [ -n "$AI_SERVICE_PIDS" ]; then
    echo "   ⚠️  Found running AI service processes:"
    ps -p $AI_SERVICE_PIDS -o pid,cmd --no-headers 2>/dev/null | sed 's/^/      /'
    echo ""
    echo "   💡 To stop these processes, run:"
    echo "      pkill -f 'python.*app.py'"
    echo "      pkill -f 'python.*start_service.py'"
else
    echo "   ✅ No running AI service processes found"
fi
echo ""

# Summary
echo "=" | tr -d '\n'
for i in {1..80}; do echo -n "="; done
echo ""
echo "✅ CACHE CLEARING COMPLETE"
echo "=" | tr -d '\n'
for i in {1..80}; do echo -n "="; done
echo ""
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Stop any running AI service processes:"
echo "   pkill -f 'python.*app.py'"
echo "   pkill -f 'python.*start_service.py'"
echo ""
echo "2. Restart the AI service:"
echo "   python3 app.py"
echo "   OR"
echo "   python3 start_service.py"
echo "   OR"
echo "   ../start-ai-service.sh"
echo ""
echo "3. Verify the service is using updated schemas:"
echo "   curl http://localhost:5001/health"
echo ""
echo "=" | tr -d '\n'
for i in {1..80}; do echo -n "="; done
echo ""



