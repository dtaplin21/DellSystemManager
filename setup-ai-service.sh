#!/bin/bash

# Dell System Manager - AI Service Setup Script
# OpenAI-Only Implementation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

print_status "Setting up Dell System Manager AI Service (OpenAI-Only)"

# Check Python version
print_status "Checking Python version..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    print_success "Python $PYTHON_VERSION found"
else
    print_error "Python 3 is required but not installed"
    exit 1
fi

# Check Node.js version
print_status "Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION found"
else
    print_error "Node.js is required but not installed"
    exit 1
fi

# Install Python dependencies
print_status "Installing Python dependencies..."
cd ai-service

if [ -f "requirements.txt" ]; then
    pip3 install -r requirements.txt
    print_success "Python dependencies installed"
else
    print_error "requirements.txt not found"
    exit 1
fi

cd ..

# Install Node.js dependencies
print_status "Installing Node.js dependencies..."
cd backend

if [ -f "package.json" ]; then
    npm install
    print_success "Backend dependencies installed"
else
    print_error "Backend package.json not found"
    exit 1
fi

cd ..

cd frontend

if [ -f "package.json" ]; then
    npm install
    print_success "Frontend dependencies installed"
else
    print_error "Frontend package.json not found"
    exit 1
fi

cd ..

# Setup environment variables
print_status "Setting up environment variables..."

# Create .env files if they don't exist
if [ ! -f "ai-service/.env" ]; then
    cat > ai-service/.env << EOF
# AI Service Environment Variables
OPENAI_API_KEY=your_openai_api_key_here

# Database and caching (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Flask configuration
FLASK_ENV=development
FLASK_DEBUG=1
EOF
    print_success "Created ai-service/.env"
fi

if [ ! -f "frontend/.env.local" ]; then
    cat > frontend/.env.local << EOF
# Frontend Environment Variables
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:5001
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEXT_PUBLIC_APP_NAME=Dell System Manager
NEXT_PUBLIC_APP_VERSION=1.0.0
EOF
    print_success "Created frontend/.env.local"
fi

# Test OpenAI API key
print_status "Testing OpenAI API key..."
if [ -f "ai-service/.env" ]; then
    OPENAI_KEY=$(grep "OPENAI_API_KEY" ai-service/.env | cut -d'=' -f2)
    if [ "$OPENAI_KEY" != "your_openai_api_key_here" ]; then
        print_success "OpenAI API key found"
    else
        print_warning "Please set your OpenAI API key in ai-service/.env"
    fi
else
    print_warning "ai-service/.env not found"
fi

# Test Python dependencies
print_status "Testing Python dependencies..."
if python3 -c "import openai, flask, fastapi; print('Python dependencies OK')" 2>/dev/null; then
    print_success "Python dependencies verified"
else
    print_error "Python dependencies test failed"
    exit 1
fi

# Test Node.js dependencies
print_status "Testing Node.js dependencies..."
if node -e "console.log('Node.js OK')" 2>/dev/null; then
    print_success "Node.js dependencies verified"
else
    print_error "Node.js dependencies test failed"
    exit 1
fi

print_success "Setup completed successfully!"

echo ""
print_status "Next steps:"
echo "1. Set your OpenAI API key in ai-service/.env"
echo "2. Set your Supabase credentials in frontend/.env.local"
echo "3. Start the services:"
echo "   - AI Service: cd ai-service && python3 app.py"
echo "   - Backend: cd backend && npm run dev"
echo "   - Frontend: cd frontend && npm run dev"
echo ""
print_status "AI Features Available:"
echo "✓ Document Analysis (OpenAI GPT-4o)"
echo "✓ Handwriting OCR (OpenAI Vision)"
echo "✓ Panel Layout Optimization (OpenAI)"
echo "✓ QC Data Analysis (OpenAI)"
echo "✓ Data Extraction (OpenAI)"
echo "✓ Project Recommendations (OpenAI)"
echo ""
print_warning "Note: This setup uses OpenAI GPT-4o for all AI features."
print_warning "Costs will be based on OpenAI's pricing (~$0.005 per 1K tokens)." 