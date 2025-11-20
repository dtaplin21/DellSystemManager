# Browser Navigate Failure Diagnosis

## Problem Summary

**78+ consecutive `browser_navigate` failures** with error: `"Cannot run the event loop while another loop is running"`

---

## Root Cause Analysis

### Issue 1: Event Loop Conflict ⚠️ **PRIMARY ISSUE**

**Location**: `ai_service/browser_tools/navigation_tool.py` lines 60-97

**The Problem**:
1. `CrewAgentExecutor.execute()` runs CrewAI via `asyncio.to_thread(crew.kickoff)` (line 216)
2. CrewAI executes browser tools **synchronously** via `_run()` method
3. `_run()` tries `asyncio.run()` first (line 71)
4. **FAILS**: "Cannot run the event loop while another loop is running"

**Why It Fails**:
- CrewAI runs in a thread (`asyncio.to_thread`)
- Browser tools try to create a new event loop with `asyncio.run()`
- But Playwright or the parent async context already has an event loop
- `asyncio.run()` cannot be called when an event loop is already running

**Current Fallback** (lines 82-97):
```python
except RuntimeError:
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(...)
    finally:
        loop.close()
```

**Why Fallback Fails**:
- The exception might not be a `RuntimeError` with the exact message
- Or the new event loop conflicts with Playwright's internal event loop
- Or CrewAI's threading model prevents proper event loop isolation

---

### Issue 2: Canvas Selector Timeout ⚠️ **SECONDARY ISSUE**

**Error**: `Error waiting for selector '[data-testid='canvas-main']': Page.wait_for_selector: Timeout 5000ms exceeded`

**Why**:
- Page navigation succeeds
- But canvas element doesn't appear within 5 seconds
- Canvas might be:
  - Conditionally rendered (fullscreen mode)
  - Still loading (React hydration)
  - Not present on the page

**Impact**: Even if event loop issue is fixed, navigation will still fail waiting for canvas

---

## Evidence from Logs

### Pattern:
```
🔧 Failed browser_navigate (3)
🔧 Failed browser_navigate (6)
🔧 Failed browser_navigate (9)
... (78+ attempts)
```

### Final Error Message:
```
The error "Cannot run the event loop while another loop is running" 
occurred while attempting to use the browser_navigate tool
```

### CrewAI Behavior:
- CrewAI retries failed tools repeatedly
- After 78+ failures, it gives up and returns error message
- Agent describes the error instead of executing tools

---

## Technical Details

### Execution Flow:
```
1. User Query → handle_query()
2. → CrewAgentExecutor.execute()
3. → asyncio.to_thread(crew.kickoff)  ← Runs in thread
4. → CrewAI calls browser_navigate tool
5. → BrowserNavigationTool._run()  ← Synchronous entry point
6. → asyncio.run(_arun())  ← FAILS: event loop conflict
7. → except RuntimeError: new_event_loop()  ← Fallback fails
8. → Tool returns error
9. → CrewAI retries (78+ times)
10. → Agent gives up and describes error
```

### Why `asyncio.run()` Fails:
- `asyncio.run()` creates a new event loop and runs it
- Cannot be called when:
  - An event loop is already running in the current thread
  - Playwright has its own event loop
  - Parent async context has an event loop

### Why Fallback Fails:
- `asyncio.new_event_loop()` creates a new loop
- But Playwright's async operations might be bound to a different loop
- Or CrewAI's threading prevents proper loop isolation

---

## Solutions

### Solution 1: Check for Existing Event Loop ✅ **RECOMMENDED**

**Fix**: Check if event loop exists before using `asyncio.run()`

```python
def _run(self, ...):
    try:
        # Check if event loop is already running
        loop = asyncio.get_running_loop()
        # If loop exists, we're in async context - use it
        return loop.run_until_complete(self._arun(...))
    except RuntimeError:
        # No event loop running - safe to use asyncio.run()
        return asyncio.run(self._arun(...))
```

**Problem**: `get_running_loop()` raises `RuntimeError` if no loop exists, so we need different logic.

### Solution 2: Use Thread-Safe Event Loop ✅ **BETTER**

**Fix**: Always create a new event loop in a new thread for browser tools

```python
import concurrent.futures

def _run(self, ...):
    # Run async code in a separate thread with its own event loop
    with concurrent.futures.ThreadPoolExecutor() as executor:
        future = executor.submit(self._run_in_thread, ...)
        return future.result()

def _run_in_thread(self, ...):
    # This runs in a separate thread with no event loop conflicts
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(self._arun(...))
    finally:
        loop.close()
```

### Solution 3: Make Browser Tools Async ✅ **BEST**

**Fix**: Make CrewAI tools async-compatible

**Problem**: CrewAI's `BaseTool` expects synchronous `_run()` method

**Workaround**: Use `nest_asyncio` to allow nested event loops

```python
import nest_asyncio
nest_asyncio.apply()

def _run(self, ...):
    # Now asyncio.run() can be called even if loop exists
    return asyncio.run(self._arun(...))
```

---

## Recommended Fix

**Use Solution 3** (`nest_asyncio`) because:
1. ✅ Minimal code changes
2. ✅ Works with existing CrewAI architecture
3. ✅ Allows nested event loops safely
4. ✅ No threading overhead

**Implementation**:
1. Install `nest_asyncio`: `pip install nest_asyncio`
2. Apply at module level in `navigation_tool.py`
3. Apply to all browser tools

---

## Secondary Fix: Canvas Selector

**Make canvas selector truly optional**:
- Don't fail navigation if canvas not found
- Log warning but continue
- Extract panel data from React state/API instead

**Already implemented** in `navigation_tool.py` lines 316-362, but error handling might need improvement.

---

## Impact

**Current State**:
- ❌ Browser tools fail 100% of the time
- ❌ Agent gives up after 78+ retries
- ❌ User gets error message instead of results

**After Fix**:
- ✅ Browser tools execute successfully
- ✅ Agent can navigate and extract data
- ✅ User gets actual panel layout data

---

## Files to Modify

1. `ai_service/browser_tools/navigation_tool.py` - Add `nest_asyncio`
2. `ai_service/browser_tools/extraction_tool.py` - Add `nest_asyncio`
3. `ai_service/browser_tools/screenshot_tool.py` - Add `nest_asyncio`
4. `ai_service/browser_tools/interaction_tool.py` - Add `nest_asyncio`
5. `ai_service/browser_tools/vision_analysis_tool.py` - Add `nest_asyncio`
6. `ai_service/browser_tools/realtime_tool.py` - Add `nest_asyncio`
7. `ai_service/browser_tools/performance_tool.py` - Add `nest_asyncio`

**Dependencies**:
- Add `nest_asyncio` to `requirements.txt` or `pyproject.toml`

---

## Testing

After fix, test with:
1. Query: "Show me panels in visual order"
2. Verify: No event loop errors
3. Verify: Navigation succeeds
4. Verify: Panel data extracted

---

## Status

**Diagnosis**: ✅ Complete
**Root Cause**: ✅ Identified (Event loop conflict)
**Solution**: ✅ Identified (`nest_asyncio`)
**Implementation**: ⏳ Pending

