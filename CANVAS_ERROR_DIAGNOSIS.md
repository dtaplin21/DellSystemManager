# Canvas Error Diagnosis - 5 Possible Failure Modes

## Overview

This document diagnoses 5 possible canvas-related errors that could prevent browser automation from finding the canvas element on the panel layout page.

---

## Error 1: Canvas Doesn't Exist on the Page

### Symptoms
- Navigation succeeds but canvas selector times out
- Logs show: `"Optional selector 'canvas' timeout after 5000ms"`
- Page loads successfully but no canvas element found

### Root Causes

#### 1.1 Conditional Rendering (Fullscreen Mode)
**Location**: `frontend/src/components/panels/PanelLayout.tsx:1690`

```tsx
{/* Normal Canvas - Only shown when NOT in fullscreen */}
{!isFullscreen && (
  <canvas
    ref={canvasRef}
    data-testid="canvas-main"
    ...
  />
)}
```

**Issue**: Canvas is conditionally rendered based on `isFullscreen` state. If the page loads in fullscreen mode, the canvas won't exist.

**Detection**:
- Check logs for: `"Canvas not found - may be conditionally rendered (fullscreen mode)"`
- Navigation tool checks for canvas elements: `navigation_tool.py:297-307`
- If `len(canvas_elements) == 0`, canvas doesn't exist

**Fix**:
- Wait for fullscreen state to stabilize
- Use alternative selector: `[data-testid="canvas-main"]` when not in fullscreen
- Check for fullscreen canvas element if fullscreen mode is active

#### 1.2 No Panels = No Canvas
**Location**: Canvas may not render if there are no panels

**Detection**:
- Check panel count: `externalPanels?.length || 0`
- Navigation tool logs: `"Total elements on page: {count}"`
- If no panels exist, canvas might not render

**Fix**:
- Verify panel data exists before waiting for canvas
- Use fallback: Extract panel data from API/React state instead of canvas

---

## Error 2: Canvas Has a Different Selector

### Current Selector Used
**Location**: `ai-service/hybrid_ai_architecture.py:1866`

```python
wait_for="canvas",  # Primary selector - navigation will continue even if not found
```

### Actual Canvas Selectors in Frontend

#### 2.1 Main Canvas Selector
**Location**: `frontend/src/components/panels/PanelLayout.tsx:1691`

```tsx
<canvas
  ref={canvasRef}
  data-testid="canvas-main"  // ← Better selector!
  className="absolute inset-0 bg-white"
  ...
/>
```

**Issue**: Using generic `"canvas"` selector may match wrong canvas or multiple canvases.

**Better Selectors**:
1. `[data-testid="canvas-main"]` - Most specific
2. `canvas[data-testid="canvas-main"]` - Type + attribute
3. `.canvas-container canvas` - Container-based
4. `canvas.bg-white` - Class-based (if unique)

#### 2.2 Alternative Canvas Components
**Location**: Multiple canvas implementations exist:

- `PanelCanvas.tsx` - Uses `<canvas>` without data-testid
- `PanelCanvasV3.tsx` - Uses `<canvas>` without data-testid
- `FullscreenLayout.tsx` - May have separate canvas

**Detection**:
- Navigation tool logs all canvas elements: `navigation_tool.py:297-307`
- Check visibility and bounds for each canvas found
- Log: `"Found {count} canvas elements on page"`

**Fix**:
- Use `[data-testid="canvas-main"]` instead of `"canvas"`
- Or use `canvas.bg-white` if that class is unique
- Check multiple selectors in order of preference

---

## Error 3: Canvas Renders Conditionally (Only if Panel Data Exists)

### Conditional Rendering Logic
**Location**: `frontend/src/components/panels/PanelLayout.tsx:133-657`

**Key Dependencies**:
1. `externalPanels` prop must be provided
2. Panels must pass validation (`isValidPanel`)
3. Canvas renders inside conditional container

**Detection**:
- Check logs for panel count: `"External Panels: {count}"`
- Check for validation errors: `"Skipping invalid external panel"`
- Navigation tool checks: `"Total elements on page: {count}"`

**Timeline**:
1. Page loads → React initializes
2. `useEffect` processes `externalPanels` → Validates panels
3. If panels valid → Canvas renders
4. If no panels/invalid → Canvas may not render

**Fix**:
- Wait for panel data to load before checking canvas
- Use longer timeout if panels are loading asynchronously
- Check for loading states: `loading`, `isLoading`, `panels.length === 0`

**Code Reference**:
```tsx
// PanelLayout.tsx:657
useEffect(() => {
  if (!externalPanels || externalPanels.length === 0) {
    // Panels cleared - canvas may not render
    dispatch({ type: 'RESET_PANELS' })
  }
}, [externalPanels])
```

---

## Error 4: Canvas Renders Slowly (Takes >5 Seconds)

### Current Timeout Configuration
**Location**: `ai_service/browser_tools/browser_config.py:23`

```python
optional_selector_timeout_ms: int = 5000  # 5 seconds for optional selectors like canvas
```

**Location**: `ai_service/browser_tools/navigation_tool.py:151`

```python
if wait_for == "canvas":
    timeout = getattr(session.security, 'optional_selector_timeout_ms', 5000)  # 5 seconds
```

### Why Canvas Might Render Slowly

#### 4.1 React Rendering Pipeline
1. **Page Load** (~1-2s): HTML loads, React hydrates
2. **Data Fetching** (~1-3s): `externalPanels` prop received
3. **Panel Validation** (~0.5-1s): `usePanelValidation` validates panels
4. **Canvas Initialization** (~0.5-2s): `useCanvasRenderer` initializes
5. **First Render** (~0.5-1s): Canvas element appears in DOM

**Total**: 3.5-9 seconds possible

#### 4.2 Heavy Computation
**Location**: `frontend/src/hooks/use-canvas-renderer.ts`

- Canvas rendering involves coordinate transformations
- Panel position calculations
- Grid rendering
- Performance optimizations

**Detection**:
- Navigation tool logs timing: `"Selector wait duration: {time}s"`
- Check for: `"Timeout waiting for selector 'canvas'"`
- Page loads but canvas appears after timeout

**Fix**:
- Increase timeout for canvas: `optional_selector_timeout_ms: 10000` (10 seconds)
- Wait for React to finish rendering: Check for `[data-testid="canvas-main"]` with longer timeout
- Use `state="visible"` instead of `state="attached"` to ensure canvas is rendered

**Code Reference**:
```python
# navigation_tool.py:255
await page.wait_for_selector(wait_for, timeout=timeout, state="attached")
# Should be:
await page.wait_for_selector(wait_for, timeout=timeout, state="visible")
```

---

## Error 5: Page Shows Error State (No Canvas in Error UI)

### Error States in Frontend

#### 5.1 Loading State
**Location**: `frontend/src/app/dashboard/projects/[id]/panel-layout/loading.tsx`

```tsx
<Suspense fallback={<Loading />}>
  <PanelLayoutRefactored />
</Suspense>
```

**Issue**: While loading, canvas doesn't exist.

#### 5.2 Error Boundary
**Location**: `frontend/src/app/dashboard/projects/[id]/panel-layout/error.tsx`

**Issue**: If error occurs, canvas won't render.

#### 5.3 Panel Validation Errors
**Location**: `frontend/src/components/panels/PanelLayout.tsx:537`

```tsx
const errors = getPanelValidationErrors(panel);
console.warn('Skipping invalid external panel:', { panel, errors });
```

**Issue**: If all panels are invalid, canvas may not render.

#### 5.4 API Errors
**Location**: Panel data fetching may fail

**Issue**: If API fails, `externalPanels` is empty/null, canvas doesn't render.

### Detection Methods

#### 5.1 Check Page Title
**Location**: `navigation_tool.py:189, 277`

```python
page_title = await page.title()
logger.info("Page title: %s", page_title)
```

**Error Indicators**:
- Title contains "Error"
- Title contains "404"
- Title contains "Not Found"

#### 5.2 Check Console Errors
**Location**: `navigation_tool.py:193-201`

```python
console_messages = list(session.console_messages)
errors = [msg for msg in console_messages if msg.get("type") == "error"]
if errors:
    logger.warning("Found %d console errors on page:", len(errors))
```

**Error Indicators**:
- JavaScript errors in console
- React errors
- API errors

#### 5.3 Check URL
**Location**: `navigation_tool.py:206-221`

```python
current_url = page.url
if current_url != "about:blank" and url in current_url:
    # Page loaded successfully
else:
    # Page may not have loaded
```

**Error Indicators**:
- URL contains `/error`
- URL is `about:blank` (navigation failed)
- URL doesn't match expected panel layout URL

#### 5.4 Check DOM for Error Elements
**Location**: `navigation_tool.py:290-309`

```python
# Check if selector exists in DOM at all
all_elements = await page.query_selector_all("*")
# Look for error indicators
error_selectors = [
    "[data-error]",
    ".error",
    "[role='alert']",
    "h1:has-text('Error')",
    "h1:has-text('404')"
]
```

### Fix Strategies

1. **Wait for Error State to Clear**:
   ```python
   # Wait for loading to complete
   await page.wait_for_selector(".loading", state="hidden", timeout=5000)
   # Then check for errors
   error_element = await page.query_selector("[data-error]")
   if error_element:
       return "Error: Page shows error state"
   ```

2. **Check for Success Indicators**:
   ```python
   # Wait for panel layout container
   await page.wait_for_selector(".panel-layout-container", timeout=10000)
   # Then check for canvas
   canvas = await page.query_selector("[data-testid='canvas-main']")
   ```

3. **Fallback to API Data Extraction**:
   ```python
   # If canvas not found, extract from React state
   panel_data = await page.evaluate("""
     window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.get(1)?.findFiberByHostInstance(document.querySelector('[data-testid="canvas-main"]'))
   """)
   ```

---

## Recommended Fixes

### Fix 1: Use Better Selector
**Change**: `ai-service/hybrid_ai_architecture.py:1866`

```python
# Before:
wait_for="canvas",

# After:
wait_for="[data-testid='canvas-main']",  # More specific selector
```

### Fix 2: Increase Timeout for Canvas
**Change**: `ai_service/browser_tools/browser_config.py:23`

```python
# Before:
optional_selector_timeout_ms: int = 5000  # 5 seconds

# After:
optional_selector_timeout_ms: int = 10000  # 10 seconds for slow-rendering canvas
```

### Fix 3: Wait for Visibility Instead of Attachment
**Change**: `ai_service/browser_tools/navigation_tool.py:255`

```python
# Before:
await page.wait_for_selector(wait_for, timeout=timeout, state="attached")

# After:
await page.wait_for_selector(wait_for, timeout=timeout, state="visible")  # Ensure rendered
```

### Fix 4: Check for Error States Before Waiting
**Change**: `ai_service/browser_tools/navigation_tool.py:234` (add before selector wait)

```python
# Check for error states
error_selectors = ["[data-error]", ".error", "[role='alert']"]
for error_selector in error_selectors:
    error_element = await page.query_selector(error_selector)
    if error_element:
        error_text = await error_element.inner_text()
        return f"Error: Page shows error state: {error_text}"

# Check for loading state
loading_element = await page.query_selector(".loading, [data-loading]")
if loading_element:
    # Wait for loading to complete
    await page.wait_for_selector(".loading, [data-loading]", state="hidden", timeout=5000)
```

### Fix 5: Add Multiple Selector Fallbacks
**Change**: `ai-service/hybrid_ai_architecture.py:1866`

```python
# Try multiple selectors in order
selectors_to_try = [
    "[data-testid='canvas-main']",  # Most specific
    "canvas.bg-white",  # Class-based
    "canvas",  # Fallback
]

for selector in selectors_to_try:
    try:
        navigation_result = await self.navigate_panel_layout(
            session_id=session_id,
            user_id=user_id,
            url=panel_layout_url,
            wait_for=selector,
        )
        if "found" in str(navigation_result.get("status", "")).lower():
            break  # Success, stop trying
    except Exception as e:
        continue  # Try next selector
```

---

## Diagnostic Checklist

When canvas is not found, check:

- [ ] **Page loaded successfully?** (Check URL, title, console errors)
- [ ] **Canvas exists in DOM?** (Check `query_selector_all("canvas")` count)
- [ ] **Canvas is visible?** (Check `is_visible()` and `bounding_box()`)
- [ ] **Fullscreen mode active?** (Canvas hidden when `isFullscreen === true`)
- [ ] **Panels exist?** (Check `externalPanels.length > 0`)
- [ ] **Panels valid?** (Check validation errors in logs)
- [ ] **Loading state cleared?** (Check for `.loading` element)
- [ ] **Error state present?** (Check for `[data-error]`, `.error`)
- [ ] **Timeout sufficient?** (5s may be too short for slow renders)
- [ ] **Selector correct?** (`"canvas"` vs `"[data-testid='canvas-main']"`)

---

## Summary

| Error | Root Cause | Detection | Fix Priority |
|-------|------------|-----------|--------------|
| **1. Canvas doesn't exist** | Conditional rendering (fullscreen) | Check canvas count = 0 | High |
| **2. Different selector** | Generic `"canvas"` selector | Check for `data-testid` | High |
| **3. Conditional on panels** | No panels = no canvas | Check panel count | Medium |
| **4. Slow rendering** | 5s timeout too short | Check wait duration | Medium |
| **5. Error state** | Page shows error UI | Check console errors, URL | High |

**Recommended Action**: Implement all 5 fixes, starting with Fix 1 (better selector) and Fix 4 (error state checking).

