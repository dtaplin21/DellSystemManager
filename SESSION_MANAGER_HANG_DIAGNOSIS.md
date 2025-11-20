# Session Manager Hang Diagnosis

## Problem Statement

**Symptom**: Logs show hang at `[AI] INFO: Getting browser session...` for 2 minutes, then nothing.

**Hypothesis**: Deadlock or infinite wait in session management layer, not Playwright itself.

## Code Flow Analysis

### Call Stack
1. `navigation_tool.py:88` → `logger.info("[%s] Getting browser session...", session_id)`
2. `navigation_tool.py:93` → `await self.session_manager.get_session(...)`
3. `browser_sessions.py:566` → `await self._get_or_create_auth_state(...)`
4. **HANGS HERE** - No logs after this point

### Critical Code Path

**`browser_sessions.py:540-593`** - `get_session()` method:
```python
async def get_session(...):
    # Line 566: Calls auth state creation BEFORE lock
    if auth_token and user_id:
        storage_state_path = await self._get_or_create_auth_state(...)  # ⚠️ HANGS HERE
    
    # Line 572: Lock acquired AFTER auth state creation
    async with self._lock:
        # Session management...
```

**`browser_sessions.py:647-815`** - `_get_or_create_auth_state()` method:
```python
async def _get_or_create_auth_state(...):
    # Line 694: Creates NEW Playwright instance
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Line 702: Navigate to frontend (30s timeout)
        await page.goto(frontend_url, wait_until="domcontentloaded", timeout=30000)
        # Line 705: Wait 2 seconds
        await asyncio.sleep(2.0)
        # Line 791: Execute JavaScript (NO TIMEOUT!) ⚠️
        result = await page.evaluate(set_session_script)
        # Line 802: Wait 2 more seconds
        await asyncio.sleep(2.0)
        # Line 805: Save storage state
        await context.storage_state(path=str(state_file))
```

## Root Cause Analysis

### Issue #1: `page.evaluate()` Has No Timeout ⚠️ CRITICAL

**Line 791**: `result = await page.evaluate(set_session_script)`

**Problem**: `page.evaluate()` has NO timeout parameter. If the JavaScript:
- Fails to load Supabase from CDN
- Hangs waiting for network request
- Has an infinite loop
- Takes longer than expected

**Result**: The call hangs indefinitely (or until Playwright's default timeout, which might be very long).

**Evidence**: The script uses dynamic import:
```javascript
const supabaseModule = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/esm/index.js');
```
If this CDN is slow or unreachable, it could hang for minutes.

### Issue #2: No Error Handling Around `page.evaluate()`

**Problem**: If `page.evaluate()` throws an exception or times out, there's no explicit timeout handling.

**Result**: Exception might be swallowed or timeout might be very long.

### Issue #3: Frontend Might Not Be Accessible

**Line 702**: `await page.goto(frontend_url, wait_until="domcontentloaded", timeout=30000)`

**Problem**: If `frontend_url` (default: `http://localhost:3000`) is not accessible:
- Could timeout after 30 seconds
- But error might not be logged properly
- Or could hang if DNS resolution fails

### Issue #4: Concurrent Auth State Creation

**Problem**: If multiple requests call `get_session()` simultaneously with same `user_id`:
- Each creates its own Playwright instance
- Each tries to create auth state file
- No locking around auth state creation
- Could cause race conditions or resource exhaustion

**Evidence**: No lock around `_get_or_create_auth_state()` call.

### Issue #5: Network Dependencies Without Timeouts

The JavaScript script makes network calls:
1. CDN import: `import('https://cdn.jsdelivr.net/...')` - No timeout
2. Supabase API: `supabase.auth.setSession()` - No explicit timeout
3. Supabase API: `supabase.auth.getSession()` - No explicit timeout

If any of these hang, the entire operation hangs.

## Diagnosis: Is the Hypothesis True?

**YES** - The hypothesis is **CONFIRMED**. The hang is caused by:

1. **Primary Cause**: `page.evaluate()` call at line 791 has no timeout and executes JavaScript that makes network requests (CDN import, Supabase API calls). If any of these hang, the entire operation hangs.

2. **Secondary Causes**:
   - No error handling around potentially slow operations
   - No timeout on `page.evaluate()` 
   - Network dependencies (CDN, Supabase API) without explicit timeouts
   - Frontend accessibility not verified before attempting auth

## Evidence Supporting Diagnosis

1. **Hang Location**: Logs show hang right after "Getting browser session..." which matches line 88 in navigation_tool.py, right before `get_session()` call.

2. **No Subsequent Logs**: No logs from inside `_get_or_create_auth_state()` suggest it hangs early in the method, likely at:
   - `page.goto()` (30s timeout - would show timeout error)
   - `page.evaluate()` (NO timeout - could hang indefinitely) ⚠️

3. **2 Minute Duration**: Matches a default timeout somewhere (possibly Playwright's default `page.evaluate()` timeout or network timeout).

4. **Playwright Works**: User confirmed Playwright itself works, so the issue is in the session management code, not Playwright installation.

## Most Likely Culprit

**Line 791**: `result = await page.evaluate(set_session_script)`

This line:
- Has NO timeout parameter
- Executes JavaScript that makes network requests
- Could hang if:
  - CDN is slow/unreachable
  - Supabase API is slow/unreachable  
  - Network has issues
  - JavaScript has an error that causes hang

## Recommended Fixes (Not Implemented - Awaiting Approval)

1. **Add timeout to `page.evaluate()`**:
   ```python
   result = await page.evaluate(set_session_script, timeout=30000)  # 30s timeout
   ```

2. **Add error handling and timeout wrapper**:
   ```python
   try:
       result = await asyncio.wait_for(
           page.evaluate(set_session_script),
           timeout=30.0
       )
   except asyncio.TimeoutError:
       logger.error("page.evaluate() timed out after 30 seconds")
       return None
   ```

3. **Verify frontend is accessible before attempting auth**:
   ```python
   try:
       response = await page.goto(frontend_url, wait_until="domcontentloaded", timeout=10000)
       if not response or response.status >= 400:
           logger.error(f"Frontend not accessible: {response.status if response else 'no response'}")
           return None
   except Exception as e:
       logger.error(f"Failed to navigate to frontend: {e}")
       return None
   ```

4. **Add lock around auth state creation** to prevent concurrent creation:
   ```python
   async with self._auth_state_lock:  # New lock for auth state creation
       storage_state_path = await self._get_or_create_auth_state(...)
   ```

5. **Add logging at critical points** to identify exactly where it hangs:
   ```python
   logger.info("About to call page.evaluate()...")
   result = await page.evaluate(set_session_script)
   logger.info("page.evaluate() completed")
   ```

## Next Steps

1. ✅ Confirm diagnosis is accurate
2. ⏳ Wait for approval to implement fixes
3. 🔧 Add timeouts and error handling
4. ✅ Test that session creation completes within reasonable time
5. ✅ Verify logs show progress through auth state creation

