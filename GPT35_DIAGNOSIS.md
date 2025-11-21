# GPT-3.5 Model Selection Issue - Diagnosis

## Problem
Despite updating all code to use GPT-4o, the system is still using GPT-3.5-turbo.

## Evidence from Logs
```
[AgentFactory] Selected model: gpt-3.5-turbo (tier: ModelTier.CLOUD_LITE)
[_create_llm] Creating LLM - model: gpt-3.5-turbo
LiteLLM completion() model= gpt-3.5-turbo
```

**Key Finding**: These log messages are NOT from our codebase - they're from CrewAI/LiteLLM internally.

## Root Cause Analysis

### 1. CrewAI Internal Model Selection
- CrewAI appears to have its own model selection logic
- The `[AgentFactory]` and `ModelTier.CLOUD_LITE` messages suggest CrewAI is overriding our `ChatOpenAI` model parameter
- CrewAI may be using LiteLLM internally for cost optimization

### 2. LiteLLM Cost Optimization
- LiteLLM has built-in cost optimization that can automatically select cheaper models
- It may be selecting GPT-3.5-turbo as a fallback or for cost savings
- LiteLLM caching might also be serving cached GPT-3.5 responses

### 3. Model Parameter Not Respected
- Even though we pass `model="gpt-4o"` to `ChatOpenAI`, CrewAI/LiteLLM may be:
  - Overriding it based on cost optimization
  - Using a default model configuration
  - Falling back to GPT-3.5 if GPT-4o is unavailable or too expensive

## Fixes Applied

### Code-Level Fixes
1. ✅ Force GPT-4o in `select_optimal_model()` - always returns "gpt-4o"
2. ✅ Force GPT-4o in `_create_agent_for_task()` - checks and overrides model
3. ✅ Force GPT-4o in `WorkflowOrchestrator` - checks and overrides model
4. ✅ Added explicit `openai_api_key` parameter to prevent fallback
5. ✅ Added model verification logging to detect mismatches

### Cache Clearing
1. ✅ Cleared Python bytecode cache (`__pycache__`, `.pyc` files)
2. ⚠️ Redis cache may need clearing: `redis-cli FLUSHALL`

## Next Steps to Diagnose

### 1. Check CrewAI/LiteLLM Configuration
```bash
# Check if CrewAI has a config file
find . -name "*crewai*" -o -name "*litellm*" -o -name "*.yaml" -o -name "*.yml" | grep -i config

# Check environment variables
env | grep -i "model\|gpt\|openai\|litellm\|crew"
```

### 2. Verify Model After Agent Creation
The new logging will show:
- What model we requested
- What model ChatOpenAI actually has
- What model the Agent has after creation

### 3. Check LiteLLM Settings
If CrewAI uses LiteLLM, we may need to:
- Set `LITELLM_MODEL=gpt-4o` environment variable
- Configure LiteLLM to not use cost optimization
- Disable LiteLLM caching

### 4. Monkey-Patch CrewAI (Last Resort)
If CrewAI is overriding the model, we may need to:
- Patch CrewAI's model selection logic
- Create a custom LLM wrapper that forces GPT-4o
- Use a different agent framework

## Immediate Actions

1. **Restart AI Service** - Clear any in-memory caches
2. **Check Logs** - Look for the new verification messages:
   - `[_create_agent_for_task] LLM created - requested: gpt-4o, actual: ...`
   - `[_create_agent_for_task] Agent LLM model after creation: ...`
3. **Clear Redis Cache** - `redis-cli FLUSHALL`
4. **Check Environment Variables** - Ensure no model overrides

## Expected Log Output (After Fix)
```
[CostOptimizer] Selecting GPT-4o (browser_tools=True, complexity=complex, user_tier=paid_user)
[handle_chat_message] Selected model: gpt-4o
[_create_agent_for_task] Creating LLM with model: gpt-4o
[_create_agent_for_task] LLM created - requested: gpt-4o, actual: gpt-4o
[_create_agent_for_task] Agent LLM model after creation: gpt-4o
```

## If Issue Persists

The problem is likely:
1. **CrewAI's internal model selection** - We may need to patch or configure CrewAI
2. **LiteLLM cost optimization** - We may need to disable it or set explicit model
3. **OpenAI API fallback** - GPT-4o might be unavailable, causing fallback to GPT-3.5

