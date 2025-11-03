#!/bin/bash

# Start AI Service Script
# This starts the Python Flask AI service on port 5001

echo "🚀 Starting AI Service..."
echo ""

# Navigate to ai-service directory
cd "$(dirname "$0")/ai-service" || exit 1

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed or not in PATH"
    exit 1
fi

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/upgrade dependencies
echo "📥 Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Check if Redis is running (optional but recommended)
if ! pgrep -x "redis-server" > /dev/null; then
    echo "⚠️  Warning: Redis server not detected. Some features may not work."
    echo "   To start Redis: redis-server"
fi

# Set environment variables
export PORT=${PORT:-5001}
export FLASK_APP=app.py
export FLASK_ENV=development
export FLASK_DEBUG=1

# Set AI service URL for backend
export AI_SERVICE_URL=http://localhost:5001

# Check for required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set. Some features may not work."
fi

echo ""
echo "✅ Starting AI Service on port $PORT..."
echo "   Health check: http://localhost:$PORT/health"
echo "   Press Ctrl+C to stop"
echo ""

# Start the Flask app
python3 app.py

