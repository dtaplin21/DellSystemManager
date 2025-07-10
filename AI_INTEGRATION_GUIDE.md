# Hybrid AI Architecture Integration Guide
# Complete Setup and Deployment for Dell System Manager

## Overview

This guide provides step-by-step instructions for integrating the hybrid AI architecture into your Dell System Manager project. The system combines cost-efficient local models with cloud-based AI services, providing intelligent automation for panel layout optimization, document analysis, and user assistance.

## Architecture Components

### 1. Core AI Service (`ai-service/`)
- **`hybrid_ai_architecture.py`**: Main AI orchestration system
- **`integration_layer.py`**: Bridges AI service with existing components
- **`document_processor.py`**: Enhanced document analysis
- **`openai_service.py`**: OpenAI integration
- **`utils.py`**: Utility functions

### 2. Backend Integration (`backend/routes/`)
- **`ai_enhanced.py`**: Enhanced API routes with AI capabilities

### 3. Frontend Integration (`frontend/src/hooks/`)
- **`use-ai-service.ts`**: React hooks for AI functionality

## Prerequisites

### System Requirements
- Python 3.9+
- Node.js 18+
- Redis server
- Ollama (for local models)

### API Keys Required
- OpenAI API key (for GPT models)
- Anthropic API key (for Claude models) - Optional
- Redis connection details

## Installation Steps

### Step 1: Install AI Service Dependencies

```bash
cd ai-service
pip install -r requirements.txt
```

### Step 2: Install Ollama (for Local Models)

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

### Step 3: Pull Required Models

```bash
# Pull local models
ollama pull llama3:8b
ollama pull llama3:70b  # Optional, for complex reasoning
```

### Step 4: Install Frontend Dependencies

```bash
cd frontend
npm install
```

### Step 5: Setup Environment Variables

Create `.env.local` in the frontend directory:

```env
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:5001
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_key_here
NEXT_PUBLIC_ANTHROPIC_API_KEY=your_anthropic_key_here
```

Create `.env` in the ai-service directory:

```env
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Configuration

### Model Configuration

The system supports multiple AI models with different cost tiers:

```python
# Local Models (Free)
- llama3:8b: Basic chat and reasoning
- llama3:70b: Complex reasoning and analysis

# Cloud Models (Paid)
- gpt-3.5-turbo: Cost-effective for simple tasks
- gpt-4-turbo: High-performance for complex tasks
- claude-3-haiku: Excellent for document analysis
- claude-3-sonnet: Advanced reasoning capabilities
```

### Cost Optimization

The system automatically routes requests based on:
- Query complexity
- User tier (free_user, paid_user, enterprise)
- Cost thresholds
- Model availability

## Deployment

### Development Setup

1. **Start Redis Server**
```bash
redis-server
```

2. **Start AI Service**
```bash
cd ai-service
python -m uvicorn app:app --reload --port 5001
```

3. **Start Backend**
```bash
cd backend
npm run dev
```

4. **Start Frontend**
```bash
cd frontend
npm run dev
```

### Production Deployment

1. **Docker Setup** (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  ai-service:
    build: ./ai-service
    ports:
      - "5001:5001"
    environment:
      - REDIS_HOST=redis
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - redis

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - AI_SERVICE_URL=http://ai-service:5001
    depends_on:
      - ai-service

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:5001

volumes:
  redis_data:
```

2. **Deploy with Docker Compose**
```bash
docker-compose up -d
```

## Integration with Existing Components

### 1. Panel Layout Optimization

**Before AI Integration:**
```typescript
// Manual panel placement
const handlePanelPlacement = (panel) => {
  // Basic placement logic
  setPanels([...panels, panel]);
};
```

**After AI Integration:**
```typescript
import { useLayoutOptimization } from '../hooks/use-ai-service';

const { optimizeLayout, isOptimizing } = useLayoutOptimization(userId, userTier);

const handlePanelPlacement = async (panel) => {
  const result = await optimizeLayout({
    panels: [...panels, panel],
    constraints: { max_width: 100, max_height: 100 }
  });
  
  if (result.success) {
    setPanels(result.optimized_layout.panels);
  }
};
```

### 2. Document Analysis

**Before AI Integration:**
```typescript
// Basic file upload
const handleFileUpload = (file) => {
  // Simple file storage
  uploadFile(file);
};
```

**After AI Integration:**
```typescript
import { useDocumentAnalysis } from '../hooks/use-ai-service';

const { analyzeDocument, isAnalyzing } = useDocumentAnalysis(userId, userTier);

const handleFileUpload = async (file) => {
  const uploadResult = await uploadFile(file);
  
  if (uploadResult.success) {
    const analysis = await analyzeDocument(
      uploadResult.path, 
      'technical'
    );
    
    if (analysis.success) {
      // Auto-populate project fields from document
      setProjectData(analysis.analysis_result);
    }
  }
};
```

### 3. AI Chat Integration

**Before AI Integration:**
```typescript
// Static help system
const helpText = "Click here for help...";
```

**After AI Integration:**
```typescript
import { useAIChat } from '../hooks/use-ai-service';

const { sendMessage, messages, isLoading } = useAIChat(userId, userTier);

const handleChatMessage = async (message) => {
  const response = await sendMessage(message, {
    current_panels: panels,
    project_context: projectData
  });
  
  // Response is automatically added to messages array
};
```

## API Endpoints

### AI Service Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/chat` | POST | AI chat with context |
| `/api/ai/panels/optimize` | POST | Layout optimization |
| `/api/ai/documents/analyze` | POST | Document analysis |
| `/api/ai/panels/enhance` | POST | Panel enhancement |
| `/api/ai/projects/create` | POST | AI-assisted project creation |
| `/api/ai/websocket` | POST | Real-time AI interactions |
| `/api/ai/costs/{user_id}` | GET | Cost tracking |
| `/api/ai/health` | GET | Service health check |
| `/api/ai/models` | GET | Available models |

### Example API Usage

```bash
# Chat with AI
curl -X POST http://localhost:5001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "user_tier": "paid_user",
    "message": "How can I optimize this layout?",
    "context": {"panels": [{"width": 10, "height": 10}]}
  }'

# Optimize layout
curl -X POST http://localhost:5001/api/ai/panels/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "user_tier": "paid_user",
    "layout_data": {
      "panels": [{"width": 10, "height": 10, "x": 0, "y": 0}],
      "constraints": {"max_width": 100, "max_height": 100}
    }
  }'
```

## Cost Management

### Cost Tiers

| User Tier | Cost Limit | Model Access |
|-----------|------------|--------------|
| free_user | $0.01/request | Local models + GPT-3.5 |
| paid_user | $0.10/request | All models |
| enterprise | $1.00/request | All models + priority |

### Cost Tracking

```typescript
import { useAICostTracking } from '../hooks/use-ai-service';

const { costs, getCosts } = useAICostTracking(userId, userTier);

// Display cost information
console.log(`Current usage: $${costs?.current_usage || 0}`);
console.log(`Limit: $${costs?.cost_threshold || 0}`);
```

## Monitoring and Debugging

### Health Checks

```bash
# Check AI service health
curl http://localhost:5001/api/ai/health

# Response:
{
  "ai_service": "healthy",
  "redis_connection": "healthy",
  "available_models": ["llama3:8b", "gpt-3.5-turbo", "gpt-4-turbo"]
}
```

### Logging

The system provides comprehensive logging:

```python
import logging
logging.basicConfig(level=logging.INFO)

# Logs include:
# - Model selection decisions
# - Cost tracking
# - Error handling
# - Performance metrics
```

### Debug Mode

Enable debug mode for development:

```bash
# Set environment variable
export AI_DEBUG=true

# Or in .env file
AI_DEBUG=true
```

## Troubleshooting

### Common Issues

1. **Ollama Connection Failed**
   ```bash
   # Check if Ollama is running
   ollama list
   
   # Start Ollama service
   ollama serve
   ```

2. **Redis Connection Failed**
   ```bash
   # Check Redis status
   redis-cli ping
   
   # Start Redis
   redis-server
   ```

3. **Model Not Available**
   ```bash
   # Pull missing model
   ollama pull llama3:8b
   ```

4. **API Key Issues**
   ```bash
   # Verify API keys
   echo $OPENAI_API_KEY
   echo $ANTHROPIC_API_KEY
   ```

### Performance Optimization

1. **Use Local Models for Simple Tasks**
   - Layout optimization
   - Basic QC analysis
   - Simple chat responses

2. **Cache Frequently Used Results**
   - Redis automatically caches responses
   - Implement client-side caching for UI

3. **Batch Requests**
   - Group multiple operations
   - Reduce API calls

## Security Considerations

1. **API Key Management**
   - Use environment variables
   - Rotate keys regularly
   - Monitor usage

2. **User Authentication**
   - Validate user tiers
   - Implement rate limiting
   - Log all AI interactions

3. **Data Privacy**
   - Sanitize user inputs
   - Don't log sensitive data
   - Implement data retention policies

## Scaling Considerations

1. **Horizontal Scaling**
   - Multiple AI service instances
   - Load balancer configuration
   - Redis cluster setup

2. **Model Optimization**
   - Model quantization
   - GPU acceleration
   - Model caching

3. **Cost Optimization**
   - Implement usage quotas
   - Model selection algorithms
   - Cost monitoring dashboards

## Future Enhancements

1. **Advanced Features**
   - Multi-modal AI (image + text)
   - Real-time collaboration
   - Advanced analytics

2. **Model Improvements**
   - Fine-tuned models for construction
   - Domain-specific training
   - Custom model deployment

3. **Integration Extensions**
   - CAD software integration
   - BIM system connectivity
   - IoT sensor data analysis

## Support and Maintenance

### Regular Maintenance

1. **Update Dependencies**
   ```bash
   pip install --upgrade -r requirements.txt
   npm update
   ```

2. **Monitor Costs**
   - Daily cost reports
   - Usage analytics
   - Budget alerts

3. **Performance Monitoring**
   - Response time tracking
   - Error rate monitoring
   - User satisfaction metrics

### Getting Help

- Check logs for error details
- Review API documentation
- Monitor system health endpoints
- Contact support with specific error messages

---

This guide provides a comprehensive foundation for integrating AI capabilities into your Dell System Manager project. The hybrid architecture ensures cost efficiency while providing powerful AI features for panel layout optimization, document analysis, and user assistance. 