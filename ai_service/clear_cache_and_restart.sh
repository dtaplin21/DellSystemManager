#!/bin/bash
# Script to clear all caches and restart AI service

echo "🧹 Clearing Python cache..."
find . -type d -name "__pycache__" -exec rm -r {} + 2>/dev/null
find . -name "*.pyc" -delete 2>/dev/null
echo "✅ Python cache cleared"

echo ""
echo "🔄 Clearing Redis cache (if Redis is running)..."
if command -v redis-cli &> /dev/null; then
    redis-cli FLUSHALL 2>/dev/null && echo "✅ Redis cache cleared" || echo "⚠️ Redis not accessible (may not be running)"
else
    echo "⚠️ redis-cli not found - skipping Redis cache clear"
fi

echo ""
echo "📝 Summary of changes:"
echo "  - All GPT-3.5 references updated to GPT-4o"
echo "  - Model enforcement added in _create_agent_for_task()"
echo "  - Python cache cleared"
echo ""
echo "🚀 Please restart the AI service for changes to take effect:"
echo "   python3 app.py"
echo "   OR"
echo "   python3 start_service.py"

