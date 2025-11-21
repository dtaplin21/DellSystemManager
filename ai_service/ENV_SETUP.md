# AI Service Environment Variables Setup

## Critical: LiteLLM Model Configuration

**YES, the AI service needs its own environment variables**, especially for LiteLLM (used by CrewAI).

### Why Environment Variables Are Needed

CrewAI uses LiteLLM internally, and **LiteLLM reads environment variables at import time**. Setting them in Python code may be too late. They must be set **BEFORE** CrewAI/LiteLLM is imported.

## Required Environment Variables

### 1. LiteLLM Model Configuration (CRITICAL)
```bash
export LITELLM_MODEL=gpt-4o
export OPENAI_MODEL=gpt-4o
```

These force LiteLLM to use GPT-4o instead of GPT-3.5-turbo.

### 2. OpenAI API Key (Required)
```bash
export OPENAI_API_KEY=your-openai-api-key-here
```

### 3. Optional Configuration
```bash
# Anthropic API (for Claude models)
export ANTHROPIC_API_KEY=your-anthropic-api-key

# Redis Configuration
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=

# Service Configuration
export PORT=5001
export HOST=0.0.0.0
export DEBUG=false
export LOG_LEVEL=INFO

# AI Model Configuration
export DEFAULT_AI_MODEL=gpt-4o
export FALLBACK_AI_MODEL=gpt-4o

# Supabase (for browser automation)
export SUPABASE_URL=your-supabase-url
export SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Setup Methods

### Method 1: Export Before Starting Service (Recommended)
```bash
export LITELLM_MODEL=gpt-4o
export OPENAI_MODEL=gpt-4o
export OPENAI_API_KEY=your-key
python3 start_service.py
```

### Method 2: Create .env File (if using python-dotenv)
Create `ai_service/.env`:
```
LITELLM_MODEL=gpt-4o
OPENAI_MODEL=gpt-4o
OPENAI_API_KEY=your-key
```

Then load it:
```python
from dotenv import load_dotenv
load_dotenv()  # Must be called BEFORE importing CrewAI
```

### Method 3: System Environment Variables
Set in your shell profile (`~/.zshrc`, `~/.bashrc`):
```bash
export LITELLM_MODEL=gpt-4o
export OPENAI_MODEL=gpt-4o
```

## Current Implementation

The code now sets these variables in:
1. **`start_service.py`** - Sets them in `setup_environment()` before imports
2. **`app.py`** - Sets them at the top before importing CrewAI
3. **`hybrid_ai_architecture.py`** - Sets them at module load and before each LLM creation

## Verification

After starting the service, check logs for:
```
LiteLLM Model: gpt-4o
OpenAI Model: gpt-4o
```

If you see `not set`, the environment variables weren't loaded properly.

## Troubleshooting

### If GPT-3.5 is still being used:

1. **Check environment variables are set BEFORE service starts:**
   ```bash
   echo $LITELLM_MODEL
   echo $OPENAI_MODEL
   ```

2. **Restart the service** - Environment variables are read at startup

3. **Check logs** - Look for:
   - `LiteLLM Model: gpt-4o` (should NOT say "not set")
   - `[_create_agent_for_task] LiteLLM environment variables set`

4. **Clear caches:**
   ```bash
   find ai_service -type d -name "__pycache__" -exec rm -r {} +
   redis-cli FLUSHALL  # if using Redis
   ```

