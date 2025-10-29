#!/bin/bash

# Setup script for ML infrastructure
# Run this after pulling the ML implementation

echo "🔧 Setting up ML Infrastructure..."
echo ""

# Check if .env file exists
if [ ! -f "../../.env" ]; then
  echo "⚠️  .env file not found. Creating template..."
  echo "# Add these to your .env file:"
  echo ""
  echo "# ML Server Configuration (optional)"
  echo "ML_SERVICE_URL=http://localhost:5001"
  echo "ML_SERVER_PORT=5001"
  echo ""
else
  echo "✅ .env file found"
fi

# Check Python
if command -v python3 &> /dev/null; then
  PYTHON_VERSION=$(python3 --version)
  echo "✅ Python found: $PYTHON_VERSION"
else
  echo "❌ Python 3 not found. Please install Python 3.8+"
  exit 1
fi

# Check if virtual environment should be created
if [ ! -d "../../backend/ml_models/.venv" ]; then
  echo ""
  echo "📦 Creating Python virtual environment..."
  cd backend/ml_models
  python3 -m venv .venv
  echo "✅ Virtual environment created"
  echo ""
  echo "To activate:"
  echo "  cd backend/ml_models && source .venv/bin/activate"
  echo ""
else
  echo "✅ Python virtual environment exists"
fi

# Check if dependencies are installed
if [ -d "../../backend/ml_models/.venv" ]; then
  echo ""
  echo "📦 Installing Python dependencies..."
  cd backend/ml_models
  source .venv/bin/activate
  pip install -r requirements.txt
  echo "✅ Python dependencies installed"
fi

# Run database migration check
echo ""
echo "📊 Checking database migration..."
echo ""
echo "⚠️  Don't forget to run the database migration:"
echo "  psql \$DATABASE_URL -f backend/db/migrations/004_ml_infrastructure.sql"
echo ""

# Run verification
echo "🧪 Running verification..."
cd ../..
node backend/scripts/verify-ml-setup.js

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start Python ML server: cd backend/ml_models && python3 server.py"
echo "  2. Start backend server: cd backend && node server.js"
echo "  3. Test with an Excel import to verify prompt templates work"

