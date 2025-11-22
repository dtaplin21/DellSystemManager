# Browser Tools Process Type Fix - Critical Issue

## Problem Identified

**Root Cause**: Hierarchical process being used with single agent

### The Issue Chain

1. **Line 311-312** (`analyze_task_complexity`):
   ```python
   if requires_browser_tools:
       logger.info(f"[CostOptimizer] Browser tools required - forcing COMPLEX complexity")
       return TaskComplexity.COMPLEX
   ```
   - Browser tools force `TaskComplexity.COMPLEX`

2. **Line 528** (`_create_agent_for_task`):
   ```python
   process = Process.hierarchical if complexity in (TaskComplexity.COMPLEX, TaskComplexity.EXPERT) else Process.sequential
   ```
   - COMPLEX complexity → `Process.hierarchical`

3. **Line 226-227** (`CrewAgentExecutor.execute`):
   ```python
   crew = Crew(
       agents=[self.agent],  # ← ONLY ONE AGENT!
       tasks=[task],
       process=self.process,  # ← Could be Process.hierarchical
   )
   ```
   - Crew has only ONE agent
   - But process is set to `hierarchical`

4. **CrewAI Requirement**:
   - Hierarchical processes REQUIRE:
     - Multiple agents, OR
     - A manager LLM/agent
   - Single agent + hierarchical = FAILURE

### Why This Breaks Browser Tools

- Browser tool tasks → COMPLEX complexity → hierarchical process
- Single agent crew → Cannot use hierarchical
- Result: Browser tools fail to execute or return errors

## Solution Options

### Option 1: Always Use Sequential for Single Agent (Quick Fix)

**File**: `ai_service/hybrid_ai_architecture.py`
**Line**: 528

**Change**:
```python
# BEFORE:
process = Process.hierarchical if complexity in (TaskComplexity.COMPLEX, TaskComplexity.EXPERT) else Process.sequential

# AFTER:
# NEVER use hierarchical with single agent - always sequential
# Hierarchical requires multiple agents or manager LLM
process = Process.sequential  # Always sequential for single agent
```

**Pros**:
- Quick fix
- Browser tools will work immediately
- No architectural changes

**Cons**:
- Doesn't leverage hierarchical process benefits
- Single agent for all tasks

### Option 2: Route Browser Tools to Workflow (Recommended)

**File**: `ai_service/hybrid_ai_architecture.py`
**Line**: 560-870 (`handle_chat_message`)

**Change**: Route browser tool tasks to `web_automation` workflow

**Implementation**:
```python
# In handle_chat_message(), when requires_browser_tools is True:
if requires_browser_tools:
    # Route to web_automation workflow (has proper sequential process)
    orchestrator = self.get_orchestrator(user_id, user_tier)
    
    workflow_result = await orchestrator.execute_workflow(
        "web_automation",
        payload={
            "url": panel_layout_url,
            "actions": ["navigate", "screenshot", "extract"],
            "user_id": user_id,
            "session_id": session_id,
            "message": message,
            "context": enhanced_context
        },
        metadata={
            "trigger": "chat",
            "source": "handle_chat_message"
        }
    )
    
    return {
        "reply": workflow_result.get("output", ""),
        "response": workflow_result.get("output", ""),
        "success": True,
        "model_used": "gpt-4o",
        "workflow_used": "web_automation",
        # ... rest of response
    }
else:
    # Use single agent for non-browser tasks
    agent = self._create_agent_for_task(optimal_model, complexity, requires_browser_tools)
    response = await agent.execute(enhanced_query, enhanced_context)
    # ... rest of logic
```

**Pros**:
- Uses proper workflow architecture
- `web_automation` workflow already configured correctly (sequential process)
- Better separation of concerns
- Can leverage multiple agents in workflow if needed later

**Cons**:
- Requires more code changes
- Need to ensure workflow payload matches expected format

### Option 3: Hybrid Approach (Best)

**Combine both fixes**:
1. Fix process type to always use sequential for single agent (Option 1)
2. Route browser tools to workflow (Option 2)

This ensures:
- Single agent tasks work correctly (fallback)
- Browser tools use proper workflow architecture
- No breaking changes

## Recommended Implementation

### Step 1: Quick Fix (Immediate)

Fix the process type selection:

```python
# ai_service/hybrid_ai_architecture.py, line 528
# Replace:
process = Process.hierarchical if complexity in (TaskComplexity.COMPLEX, TaskComplexity.EXPERT) else Process.sequential

# With:
# NEVER use hierarchical with single agent - always sequential
# Hierarchical requires multiple agents or manager LLM
process = Process.sequential  # Always sequential for single agent
```

### Step 2: Route Browser Tools to Workflow (Better Architecture)

Update `handle_chat_message()` to route browser tools:

```python
# ai_service/hybrid_ai_architecture.py, around line 725-813

# After detecting requires_browser_tools and doing pre-flight automation:

if requires_browser_tools:
    # Route to web_automation workflow instead of single agent
    logger.info(f"[handle_chat_message] Routing browser tool task to web_automation workflow")
    
    orchestrator = self.get_orchestrator(user_id, user_tier)
    
    workflow_payload = {
        "url": panel_layout_url,
        "actions": ["navigate", "screenshot", "extract"],
        "user_id": user_id,
        "session_id": session_id,
        "message": message,
        "context": enhanced_context,
        "preflight_automation": {
            "success": preflight_success,
            "details": automation_details
        }
    }
    
    try:
        workflow_result = await orchestrator.execute_workflow(
            "web_automation",
            payload=workflow_payload,
            metadata={
                "trigger": "chat",
                "source": "handle_chat_message",
                "user_id": user_id,
                "user_tier": user_tier
            }
        )
        
        response = workflow_result.get("output", "") if isinstance(workflow_result, dict) else str(workflow_result)
        
        return {
            "reply": response,
            "response": response,
            "success": True,
            "timestamp": time.time(),
            "user_id": user_id,
            "model_used": optimal_model,
            "workflow_used": "web_automation",
            "browser_tools_required": True,
            "preflight_automation": {
                "success": preflight_success,
                "error": preflight_error,
                "details": automation_details
            }
        }
    except Exception as workflow_error:
        logger.error(f"[handle_chat_message] Workflow execution failed: {workflow_error}")
        # Fallback to single agent (with sequential process)
        logger.warning(f"[handle_chat_message] Falling back to single agent")
        agent = self._create_agent_for_task(optimal_model, complexity, requires_browser_tools)
        response = await agent.execute(enhanced_query, enhanced_context)
        # ... continue with existing logic
else:
    # Non-browser tasks: use single agent
    agent = self._create_agent_for_task(optimal_model, complexity, requires_browser_tools)
    response = await agent.execute(enhanced_query, enhanced_context)
    # ... continue with existing logic
```

## Testing

After implementing the fix:

1. **Test browser tool execution**:
   - Send chat message requiring browser tools
   - Verify tools are actually executed (not just described)
   - Check logs for tool execution

2. **Verify process type**:
   - Check logs for process type being used
   - Should see `Process.sequential` for single agent
   - Should see workflow execution for browser tools

3. **Verify no errors**:
   - No "Attribute manager_llm or manager_agent is required" errors
   - No hierarchical process errors with single agent

## Success Criteria

- ✅ Browser tools execute properly (no process type errors)
- ✅ Single agent tasks use sequential process
- ✅ Browser tool tasks use web_automation workflow (or sequential single agent)
- ✅ No more hierarchical process errors with single agent
- ✅ Tools are actually executed, not just described

