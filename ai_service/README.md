# Dell System Manager AI Service

A sophisticated AI service that combines OpenAI's cloud-based models with local models and a hybrid AI architecture for cost-effective, intelligent document analysis, panel optimization, and workflow automation.

## 🚀 Features

### Core AI Capabilities
- **Document Analysis**: OCR, text extraction, and intelligent analysis
- **Panel Layout Optimization**: AI-powered geosynthetic panel optimization
- **QC Data Extraction**: Automated quality control data processing
- **Handwriting Recognition**: Advanced OCR for handwritten content

### Hybrid AI Architecture
- **Multi-Model Routing**: Intelligent model selection based on task complexity
- **Cost Optimization**: Automatic routing to minimize API costs
- **Local Model Support**: Integration with Ollama for free local inference
- **Agent Orchestration**: CrewAI-powered multi-agent workflows
- **Tool Integration**: Seamless connection with existing system components

### Cost Optimization
- **User Tier Management**: Different cost limits per user tier
- **Smart Model Selection**: Route simple tasks to local models
- **Usage Tracking**: Monitor and control API costs
- **Fallback Strategies**: Graceful degradation when models are unavailable

### Advanced Workflows
- **Project Setup Automation**: AI-powered project configuration
- **Layout Optimization**: Intelligent panel placement and optimization
- **QC Data Analysis**: Automated quality control workflows
- **Multi-Agent Collaboration**: Specialized agents working together
- **Shared Memory & Delegation**: Agents reuse orchestrated context and delegate subtasks in real time

### Orchestrator Visibility
- **Workflow Manifest**: `ai_service/orchestrator_manifest.json` lists registered crews and capabilities
- **UI Integration**: Dashboard surfaces collaboration status via `/api/system/services`
- **Context Persistence**: Redis-backed store keeps cross-workflow history for each user

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Flask App     │    │  Integration     │    │  Hybrid AI      │
│                 │◄──►│     Layer        │◄──►│  Architecture   │
│  - REST API     │    │                  │    │                 │
│  - Endpoints    │    │  - Async Wrapper │    │  - Agents       │
│  - Fallbacks    │    │  - Error Handling│    │  - Workflows    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Model Router   │
                       │                  │
                       │  - Cost Optimizer│
                       │  - Tier Manager  │
                       │  - Model Selector│
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   AI Models      │
                       │                  │
                       │  - OpenAI GPT    │
                       │  - Claude        │
                       │  - Local Llama   │
                       └──────────────────┘
```

### Agent Architecture
The service uses specialized AI agents for different tasks:

- **Layout Optimizer Agent**: Handles panel layout optimization
- **Document Intelligence Agent**: Processes and analyzes documents
- **Assistant Agent**: Provides general guidance and support
- **Project Config Agent**: Sets up and configures new projects
- **QC Analysis Agent**: Analyzes quality control data
- **Personalization Agent**: Customizes experiences per user

## 🛠️ Installation

### Prerequisites
- Python 3.11+
- Redis (for caching and cost tracking)
- Docker & Docker Compose (optional)
- Ollama (optional, for local models)

### Quick Start with Docker

1. **Clone and navigate to the service directory**
   ```bash
   cd ai_service
   ```

2. **Set environment variables**
   ```bash
   export OPENAI_API_KEY="your-openai-api-key"
   export ANTHROPIC_API_KEY="your-anthropic-api-key"  # Optional
   ```

3. **Start the service**
   ```bash
   # Start with Redis only
   docker-compose up -d
   
   # Start with local models (Ollama)
   docker-compose --profile local-models up -d
   ```

4. **Verify the service**
   ```bash
   curl http://localhost:5001/health
   ```

### Manual Installation

1. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start Redis**
   ```bash
   redis-server
   ```

3. **Set environment variables and start**
   ```bash
   export OPENAI_API_KEY="your-key"
   python start_service.py
   ```

## 📡 API Endpoints

### Core Endpoints

#### `GET /health`
Health check and service status
```json
{
  "status": "ok",
  "ai_service": "OpenAI GPT-4o + Hybrid AI Architecture",
  "hybrid_ai_status": {
    "hybrid_ai_available": true,
    "redis_connected": true,
    "service_health": "healthy"
  },
  "available_features": [
    "document_analysis",
    "handwriting_ocr",
    "panel_optimization",
    "qc_data_extraction",
    "hybrid_ai_workflows",
    "cost_optimized_routing",
    "multi_agent_orchestration"
  ]
}
```

#### `POST /analyze`
Analyze documents with AI - now supports hybrid AI architecture
```json
{
  "documents": [{"path": "/path/to/document.pdf"}],
  "question": "Extract key specifications from this document",
  "user_id": "user123",
  "user_tier": "paid_user",
  "use_hybrid": true
}
```

#### `POST /extract`
Extract structured data from documents
```json
{
  "document_path": "/path/to/document.pdf",
  "extraction_type": "qc_data",
  "user_id": "user123",
  "user_tier": "paid_user"
}
```

#### `POST /optimize-panels`
Optimize panel layouts using AI
```json
{
  "panels": [{"id": "P001", "dimensions": "40x100"}],
  "strategy": "balanced",
  "site_config": {"area": 1000, "constraints": []},
  "user_id": "user123",
  "user_tier": "paid_user"
}
```

### Hybrid AI Endpoints

#### `POST /hybrid/chat`
AI chat with hybrid architecture
```json
{
  "message": "Help me optimize my panel layout",
  "context": {"project_id": "proj123"},
  "user_id": "user123",
  "user_tier": "paid_user"
}
```

#### `POST /hybrid/project-setup`
AI-powered project setup workflow
```json
{
  "project_data": {
    "name": "Geosynthetic Project",
    "requirements": ["40x100 panels", "QC compliance"]
  },
  "user_id": "user123",
  "user_tier": "paid_user"
}
```

#### `GET /hybrid/status`
Hybrid AI architecture status
```json
{
  "hybrid_ai_available": true,
  "redis_connected": true,
  "service_health": "healthy"
}
```

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | Required | OpenAI API key |
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key |
| `REDIS_HOST` | localhost | Redis server host |
| `REDIS_PORT` | 6379 | Redis server port |
| `REDIS_PASSWORD` | None | Redis password |
| `ENABLE_HYBRID_AI` | true | Enable hybrid AI features |
| `ENABLE_LOCAL_MODELS` | true | Enable local model support |
| `DEBUG` | false | Enable debug mode |
| `LOG_LEVEL` | INFO | Logging level |

### User Tiers

| Tier | Max Cost/Request | Daily Limit | Available Models |
|------|------------------|-------------|------------------|
| Free | $0.01 | 10 | GPT-3.5, Llama3-8B |
| Paid | $0.10 | 100 | GPT-3.5, GPT-4, Claude, Llama3 |
| Enterprise | $1.00 | 1000 | All models |

### Model Configuration
The service automatically selects the optimal model based on:

- **Query Complexity**: Simple vs. complex tasks
- **User Tier**: Cost limits and feature access
- **Agent Type**: Specialized model selection per task
- **Cost Optimization**: Automatic routing to minimize expenses

## 🔧 Development

### Project Structure
```
ai_service/
├── app.py                 # Main Flask application
├── config.py              # Configuration management
├── start_service.py       # Service startup script
├── integration_layer.py   # Hybrid AI integration
├── hybrid_ai_architecture.py  # Core AI architecture
├── document_processor.py  # Document processing logic
├── openai_service.py      # OpenAI service wrapper
├── utils.py               # Utility functions
├── requirements.txt       # Python dependencies
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose setup
└── README.md             # This file
```

### Key Components

#### Hybrid AI Architecture (`hybrid_ai_architecture.py`)
- **CostOptimizer**: Intelligent model routing based on cost and complexity
- **HybridAgentFactory**: Creates specialized agents for different tasks
- **HybridWorkflowOrchestrator**: Manages multi-agent workflows
- **Tool Integration**: Connects with existing system components

#### Integration Layer (`integration_layer.py`)
- **Async Wrapper**: Handles asynchronous operations
- **Service Management**: Manages hybrid AI service availability
- **Error Handling**: Graceful fallbacks and error management

#### Document Processor (`document_processor.py`)
- **OCR Processing**: Text extraction from various document formats
- **AI Analysis**: Intelligent document analysis and insights
- **Format Support**: PDF, Excel, and other document types

### Running Tests
```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest tests/
```

### Local Development
```bash
# Install in development mode
pip install -e .

# Start with auto-reload
export FLASK_DEBUG=1
python start_service.py
```

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   export FLASK_ENV=production
   export DEBUG=false
   export LOG_LEVEL=WARNING
   ```

2. **Docker Production**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Systemd Service** (Linux)
   ```bash
   sudo cp ai-service.service /etc/systemd/system/
   sudo systemctl enable ai-service
   sudo systemctl start ai-service
   ```

### Monitoring and Logging

- **Health Checks**: `/health` endpoint for monitoring
- **Logging**: Structured logging with configurable levels
- **Metrics**: Cost tracking and usage monitoring
- **Error Handling**: Graceful fallbacks and error reporting

## 🔒 Security

- **API Key Management**: Secure environment variable handling
- **User Tier Isolation**: Cost and feature limits per user
- **Input Validation**: Comprehensive request validation
- **Error Sanitization**: Safe error message handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation
- Review the API endpoints
- Check the health status endpoint
- Review logs for error details

## 🔮 Roadmap

- [x] Enhanced local model support with Ollama
- [x] Advanced cost optimization algorithms
- [x] Multi-agent workflow orchestration
- [x] Tool integration with existing system
- [ ] Multi-language document support
- [ ] Real-time collaboration features
- [ ] Advanced workflow automation
- [ ] Integration with external CAD systems
- [ ] Enhanced monitoring and analytics
- [ ] Performance optimization and caching

## 📊 Performance & Scaling

### Cost Optimization
- **Local Model Routing**: Simple tasks use free local models
- **Smart Model Selection**: Complex tasks use appropriate cloud models
- **Usage Tracking**: Real-time cost monitoring per user tier
- **Fallback Strategies**: Graceful degradation when models are unavailable

### Scalability Features
- **Redis Caching**: Reduces redundant API calls
- **Async Processing**: Non-blocking operations for better performance
- **Agent Pooling**: Reusable agent instances for multiple requests
- **Load Balancing**: Automatic distribution of requests across available models

### Monitoring & Metrics
- **Health Endpoints**: Real-time service status monitoring
- **Cost Tracking**: Per-user and per-request cost monitoring
- **Performance Metrics**: Response time and success rate tracking
- **Error Reporting**: Detailed error logging and reporting
