#!/bin/bash

# AI Service Setup Script for Dell System Manager
# This script automates the installation and configuration of the hybrid AI architecture

set -e  # Exit on any error

echo "🚀 Setting up Hybrid AI Architecture for Dell System Manager"
echo "=============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if running on macOS, Linux, or Windows
check_os() {
    print_status "Detecting operating system..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        print_success "Detected macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        print_success "Detected Linux"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Python
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_success "Python $PYTHON_VERSION found"
    else
        print_error "Python 3 is required but not installed"
        exit 1
    fi
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js $NODE_VERSION found"
    else
        print_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm $NPM_VERSION found"
    else
        print_error "npm is required but not installed"
        exit 1
    fi
}

# Install Redis
install_redis() {
    print_status "Installing Redis..."
    
    if command -v redis-server &> /dev/null; then
        print_success "Redis is already installed"
        return
    fi
    
    if [[ "$OS" == "macos" ]]; then
        if command -v brew &> /dev/null; then
            brew install redis
            brew services start redis
        else
            print_error "Homebrew is required to install Redis on macOS"
            print_status "Please install Homebrew first: https://brew.sh"
            exit 1
        fi
    elif [[ "$OS" == "linux" ]]; then
        sudo apt-get update
        sudo apt-get install -y redis-server
        sudo systemctl start redis-server
        sudo systemctl enable redis-server
    fi
    
    print_success "Redis installed and started"
}

# Install Ollama
install_ollama() {
    print_status "Installing Ollama..."
    
    if command -v ollama &> /dev/null; then
        print_success "Ollama is already installed"
    else
        if [[ "$OS" == "macos" ]]; then
            if command -v brew &> /dev/null; then
                brew install ollama
            else
                print_error "Homebrew is required to install Ollama on macOS"
                exit 1
            fi
        elif [[ "$OS" == "linux" ]]; then
            curl -fsSL https://ollama.ai/install.sh | sh
        fi
        print_success "Ollama installed"
    fi
    
    # Start Ollama service
    print_status "Starting Ollama service..."
    ollama serve &
    sleep 5
    
    # Pull required models
    print_status "Pulling AI models..."
    ollama pull llama3:8b
    print_success "Model llama3:8b downloaded"
    
    # Optional: Pull larger model for complex tasks
    read -p "Do you want to download llama3:70b for complex reasoning? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ollama pull llama3:70b
        print_success "Model llama3:70b downloaded"
    fi
}

# Install Python dependencies
install_python_deps() {
    print_status "Installing Python dependencies..."
    
    cd ai-service
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        print_success "Virtual environment created"
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install requirements
    pip install -r requirements.txt
    
    print_success "Python dependencies installed"
    
    cd ..
}

# Install Node.js dependencies
install_node_deps() {
    print_status "Installing Node.js dependencies..."
    
    cd frontend
    npm install
    print_success "Frontend dependencies installed"
    cd ..
    
    cd backend
    npm install
    print_success "Backend dependencies installed"
    cd ..
}

# Setup environment files
setup_env_files() {
    print_status "Setting up environment files..."
    
    # Frontend .env.local
    if [ ! -f "frontend/.env.local" ]; then
        cat > frontend/.env.local << EOF
# AI Service Configuration
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:5001

# API Keys (Add your actual keys here)
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_key_here
NEXT_PUBLIC_ANTHROPIC_API_KEY=your_anthropic_key_here

# Other Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
        print_success "Frontend .env.local created"
    else
        print_warning "Frontend .env.local already exists"
    fi
    
    # AI Service .env
    if [ ! -f "ai-service/.env" ]; then
        cat > ai-service/.env << EOF
# API Keys (Add your actual keys here)
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Service Configuration
DEBUG=true
LOG_LEVEL=INFO
EOF
        print_success "AI Service .env created"
    else
        print_warning "AI Service .env already exists"
    fi
}

# Test installations
test_installations() {
    print_status "Testing installations..."
    
    # Test Redis
    if redis-cli ping | grep -q "PONG"; then
        print_success "Redis connection successful"
    else
        print_error "Redis connection failed"
        exit 1
    fi
    
    # Test Ollama
    if ollama list | grep -q "llama3:8b"; then
        print_success "Ollama models available"
    else
        print_error "Ollama models not found"
        exit 1
    fi
    
    # Test Python environment
    cd ai-service
    source venv/bin/activate
    python3 -c "import crewai, langchain, redis; print('Python dependencies OK')"
    cd ..
    
    print_success "All installations tested successfully"
}

# Create startup scripts
create_startup_scripts() {
    print_status "Creating startup scripts..."
    
    # Start all services script
    cat > start-ai-services.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting AI Services for Dell System Manager"
echo "================================================"

# Start Redis (if not already running)
if ! redis-cli ping &> /dev/null; then
    echo "Starting Redis..."
    redis-server &
    sleep 2
fi

# Start Ollama (if not already running)
if ! pgrep -f "ollama serve" > /dev/null; then
    echo "Starting Ollama..."
    ollama serve &
    sleep 5
fi

# Start AI Service
echo "Starting AI Service..."
cd ai-service
source venv/bin/activate
python -m uvicorn app:app --reload --port 5001 &
cd ..

# Start Backend
echo "Starting Backend..."
cd backend
npm run dev &
cd ..

# Start Frontend
echo "Starting Frontend..."
cd frontend
npm run dev &
cd ..

echo "✅ All services started!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo "AI Service: http://localhost:5001"
echo ""
echo "Press Ctrl+C to stop all services"
wait
EOF

    chmod +x start-ai-services.sh
    print_success "Startup script created: start-ai-services.sh"
    
    # Stop all services script
    cat > stop-ai-services.sh << 'EOF'
#!/bin/bash

echo "🛑 Stopping AI Services..."

# Kill all related processes
pkill -f "uvicorn app:app"
pkill -f "npm run dev"
pkill -f "ollama serve"

echo "✅ All services stopped"
EOF

    chmod +x stop-ai-services.sh
    print_success "Stop script created: stop-ai-services.sh"
}

# Main setup function
main() {
    echo "Starting AI service setup..."
    
    check_os
    check_prerequisites
    install_redis
    install_ollama
    install_python_deps
    install_node_deps
    setup_env_files
    test_installations
    create_startup_scripts
    
    echo ""
    echo "🎉 Setup completed successfully!"
    echo "=================================="
    echo ""
    echo "Next steps:"
    echo "1. Edit the environment files with your API keys:"
    echo "   - frontend/.env.local"
    echo "   - ai-service/.env"
    echo ""
    echo "2. Start all services:"
    echo "   ./start-ai-services.sh"
    echo ""
    echo "3. Access your application:"
    echo "   Frontend: http://localhost:3000"
    echo "   AI Service: http://localhost:5001/api/ai/health"
    echo ""
    echo "4. Stop services when done:"
    echo "   ./stop-ai-services.sh"
    echo ""
    echo "For more information, see AI_INTEGRATION_GUIDE.md"
}

# Run main function
main "$@" 