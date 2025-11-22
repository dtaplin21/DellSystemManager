# Multi-Agent Browser Tools Implementation for Unified AI Panel Workspace

## Current State

**Single Agent Approach** (Current):
- `handle_chat_message()` creates one agent with all browser tools
- Agent tries to do everything: navigate, screenshot, extract, analyze
- Process: Sequential (single agent)
- Issue: One agent handling all responsibilities

**Chat Interface**:
- `PanelAIChat` component calls `/api/ai/chat`
- Backend routes to `handle_chat_message()`
- Returns single agent response

## Proposed Multi-Agent Architecture

### Agent Roles & Responsibilities

**Agent 1: Navigation Specialist**
- **Role**: Browser Navigation Coordinator
- **Goal**: Navigate to target pages, verify page loads, handle redirects
- **Tools**: `browser_navigate`, `browser_screenshot` (for verification)
- **Responsibility**: Get to the right page, ensure it's loaded

**Agent 2: Visual Analyst**
- **Role**: Visual Layout Analyst
- **Goal**: Capture and analyze visual state of the panel layout
- **Tools**: `browser_screenshot`, `browser_vision_analyze`, `browser_extract`
- **Responsibility**: Understand what's visually displayed, extract panel data

**Agent 3: Interaction Executor**
- **Role**: UI Interaction Specialist
- **Goal**: Execute user-requested actions (move panels, click buttons, fill forms)
- **Tools**: `browser_interact`, `browser_extract`, `browser_screenshot` (before/after)
- **Responsibility**: Perform actions, verify results

**Agent 4: Validation Coordinator**
- **Role**: Quality Assurance Validator
- **Goal**: Verify actions completed correctly, validate data integrity
- **Tools**: `browser_extract`, `browser_screenshot`, `browser_performance`
- **Responsibility**: Confirm success, catch errors, validate results

### Workflow Process: Sequential with Collaboration

```
User Message → Coordinator Agent
    ↓
Agent 1: Navigation Specialist
    ├─ Navigate to panel layout page
    ├─ Verify page loaded
    └─ Pass: URL, session_id, page_state
    ↓
Agent 2: Visual Analyst
    ├─ Capture screenshot
    ├─ Analyze visual layout
    ├─ Extract panel data
    └─ Pass: Screenshot, panel_data, visual_analysis
    ↓
Agent 3: Interaction Executor (if actions needed)
    ├─ Execute requested actions
    ├─ Capture before/after screenshots
    └─ Pass: Action_results, updated_state
    ↓
Agent 4: Validation Coordinator
    ├─ Verify actions succeeded
    ├─ Validate data integrity
    ├─ Check for errors
    └─ Generate final report
    ↓
Response to User
```

## Implementation Details

### 1. New Workflow Blueprint

**File**: `ai_service/hybrid_ai_architecture.py`
**Location**: Add to `_ensure_base_blueprints()` method

```python
"multi_agent_browser_automation": WorkflowBlueprint(
    id="multi_agent_browser_automation",
    name="Multi-Agent Browser Automation",
    description="Collaborative browser automation with specialized agents for navigation, analysis, execution, and validation",
    process=Process.sequential,  # Sequential because agents depend on each other
    agents={
        "navigator": AgentProfile(
            name="Navigation Specialist",
            role="Browser Navigation Coordinator",
            goal="Navigate to target pages, verify page loads, handle redirects and authentication",
            backstory="Expert browser navigator with deep understanding of web routing, authentication flows, and page load verification. Specializes in getting to the right page reliably.",
            complexity=TaskComplexity.MODERATE,
            tools=[
                "browser_navigate",
                "browser_screenshot",  # For verification
            ],
        ),
        "visual_analyst": AgentProfile(
            name="Visual Layout Analyst",
            role="Visual Layout Specialist",
            goal="Capture and analyze visual state of panel layouts, extract panel data sorted by visual position",
            backstory="Visual analysis expert trained to understand spatial layouts, panel arrangements, and UI state. Specializes in extracting meaningful data from visual representations.",
            complexity=TaskComplexity.COMPLEX,
            tools=[
                "browser_screenshot",
                "browser_vision_analyze",
                "browser_extract",
            ],
        ),
        "interaction_executor": AgentProfile(
            name="Interaction Specialist",
            role="UI Interaction Executor",
            goal="Execute user-requested actions on the panel layout (move panels, click buttons, fill forms, update positions)",
            backstory="UI automation specialist with expertise in precise element interaction, drag-and-drop operations, and form manipulation. Ensures actions are executed accurately.",
            complexity=TaskComplexity.COMPLEX,
            tools=[
                "browser_interact",
                "browser_extract",
                "browser_screenshot",  # Before/after verification
            ],
        ),
        "validator": AgentProfile(
            name="Validation Coordinator",
            role="Quality Assurance Validator",
            goal="Verify actions completed correctly, validate data integrity, catch errors, and generate validation reports",
            backstory="QA specialist focused on validation and error detection. Reviews agent outputs, verifies data consistency, and ensures all actions completed successfully.",
            complexity=TaskComplexity.MODERATE,
            tools=[
                "browser_extract",
                "browser_screenshot",
                "browser_performance",
                "browser_realtime",  # For error detection
            ],
        ),
    },
    tasks=[
        WorkflowTaskTemplate(
            id="navigate-to-panel-layout",
            description="Navigate to the panel layout page specified in the context. Verify the page loaded successfully, handle any authentication redirects, and confirm the canvas element is present.",
            agent="navigator",
            expected_output="Navigation confirmation with page URL, load status, and canvas element verification",
            context_keys=["payload", "panel_layout_url"],
        ),
        WorkflowTaskTemplate(
            id="analyze-visual-layout",
            description="Capture a screenshot of the current panel layout, analyze the visual arrangement using vision analysis, and extract panel data sorted by visual position (Y coordinate, then X coordinate).",
            agent="visual_analyst",
            expected_output="Screenshot reference, visual analysis results, and extracted panel data with visual positioning",
            context_keys=["payload", "history"],
        ),
        WorkflowTaskTemplate(
            id="execute-user-actions",
            description="Execute any user-requested actions on the panel layout (if actions are specified). This includes moving panels, clicking buttons, filling forms, or updating panel positions. Capture before/after screenshots to verify changes.",
            agent="interaction_executor",
            expected_output="List of actions performed, before/after screenshots, and updated panel state",
            context_keys=["payload", "history", "user_message"],
        ),
        WorkflowTaskTemplate(
            id="validate-results",
            description="Verify all actions completed successfully, validate the extracted panel data for consistency, check for any errors in the browser console or network requests, and generate a comprehensive validation report.",
            agent="validator",
            expected_output="Validation report with success status, data integrity checks, error detection, and final panel state",
            context_keys=["payload", "history"],
        ),
    ],
),
```

### 2. Update handle_chat_message() to Use Multi-Agent Workflow

**File**: `ai_service/hybrid_ai_architecture.py`
**Location**: `handle_chat_message()` method, around line 725-813

**Current Flow**:
```python
# Current: Single agent
agent = self._create_agent_for_task(optimal_model, complexity, requires_browser_tools)
response = await agent.execute(enhanced_query, enhanced_context)
```

**New Flow**:
```python
# New: Multi-agent workflow for browser tools
if requires_browser_tools:
    logger.info(f"[handle_chat_message] Routing to multi-agent browser automation workflow")
    
    orchestrator = self.get_orchestrator(user_id, user_tier)
    
    # Build workflow payload
    workflow_payload = {
        "panel_layout_url": panel_layout_url,
        "frontend_url": frontend_url,
        "user_id": user_id,
        "session_id": session_id,
        "user_message": message,
        "user_context": enhanced_context,
        "preflight_automation": {
            "success": preflight_success,
            "details": automation_details
        },
        "requested_actions": self._extract_requested_actions(message),  # Parse user intent
    }
    
    try:
        # Execute multi-agent workflow
        workflow_result = await orchestrator.execute_workflow(
            "multi_agent_browser_automation",
            payload=workflow_payload,
            metadata={
                "trigger": "chat",
                "source": "unified_ai_panel_workspace",
                "user_id": user_id,
                "user_tier": user_tier,
                "project_id": context.get("projectId"),
            }
        )
        
        # Extract response from workflow
        response = workflow_result.get("output", "")
        if not response:
            # Fallback: Combine agent outputs
            response = self._combine_agent_outputs(workflow_result)
        
        return {
            "reply": response,
            "response": response,
            "success": True,
            "timestamp": time.time(),
            "user_id": user_id,
            "model_used": optimal_model,
            "workflow_used": "multi_agent_browser_automation",
            "agents_used": ["navigator", "visual_analyst", "interaction_executor", "validator"],
            "browser_tools_required": True,
            "workflow_details": workflow_result.get("details", {}),
        }
    except Exception as workflow_error:
        logger.error(f"[handle_chat_message] Multi-agent workflow failed: {workflow_error}")
        # Fallback to single agent
        logger.warning(f"[handle_chat_message] Falling back to single agent")
        agent = self._create_agent_for_task(optimal_model, complexity, requires_browser_tools)
        response = await agent.execute(enhanced_query, enhanced_context)
        # ... continue with existing single-agent logic
else:
    # Non-browser tasks: use single agent
    agent = self._create_agent_for_task(optimal_model, complexity, requires_browser_tools)
    response = await agent.execute(enhanced_query, enhanced_context)
    # ... continue with existing logic
```

### 3. Helper Method: Extract Requested Actions

**File**: `ai_service/hybrid_ai_architecture.py`
**Location**: Add new method to `DellSystemAIService` class

```python
def _extract_requested_actions(self, message: str) -> List[Dict[str, Any]]:
    """Extract user-requested actions from message"""
    message_lower = message.lower()
    actions = []
    
    # Detect move/rearrange requests
    if any(word in message_lower for word in ["move", "rearrange", "reorder", "position"]):
        actions.append({
            "type": "rearrange_panels",
            "description": "User wants to move or rearrange panels"
        })
    
    # Detect click/interaction requests
    if any(word in message_lower for word in ["click", "select", "choose", "press"]):
        actions.append({
            "type": "interact",
            "description": "User wants to click or interact with UI elements"
        })
    
    # Detect form fill requests
    if any(word in message_lower for word in ["fill", "enter", "update", "change"]):
        actions.append({
            "type": "form_fill",
            "description": "User wants to fill or update form fields"
        })
    
    return actions
```

### 4. Helper Method: Combine Agent Outputs

**File**: `ai_service/hybrid_ai_architecture.py`
**Location**: Add new method to `DellSystemAIService` class

```python
def _combine_agent_outputs(self, workflow_result: Dict) -> str:
    """Combine outputs from multiple agents into coherent response"""
    if not isinstance(workflow_result, dict):
        return str(workflow_result)
    
    # Extract outputs from each agent task
    outputs = []
    
    # Navigator output
    if "navigate-to-panel-layout" in workflow_result:
        nav_output = workflow_result["navigate-to-panel-layout"]
        outputs.append(f"✅ Navigation: {nav_output}")
    
    # Visual analyst output
    if "analyze-visual-layout" in workflow_result:
        visual_output = workflow_result["analyze-visual-layout"]
        outputs.append(f"📊 Visual Analysis: {visual_output}")
    
    # Interaction executor output
    if "execute-user-actions" in workflow_result:
        action_output = workflow_result["execute-user-actions"]
        outputs.append(f"⚙️ Actions Executed: {action_output}")
    
    # Validator output
    if "validate-results" in workflow_result:
        validation_output = workflow_result["validate-results"]
        outputs.append(f"✓ Validation: {validation_output}")
    
    # Combine with workflow summary
    if "output" in workflow_result:
        return workflow_result["output"]
    
    return "\n\n".join(outputs) if outputs else "Workflow completed successfully."
```

## Agent Collaboration Flow

### Example: "Show me the current panel layout"

```
User: "Show me the current panel layout"
    ↓
Coordinator detects browser tools needed
    ↓
Workflow: multi_agent_browser_automation
    ↓
Agent 1 (Navigator):
    - Navigates to /dashboard/projects/{id}/panel-layout
    - Verifies page loaded
    - Confirms canvas element present
    - Output: "Navigation successful. Page loaded at {url}. Canvas element found."
    ↓
Agent 2 (Visual Analyst):
    - Takes screenshot
    - Analyzes visual layout using vision
    - Extracts panel data (sorted by Y, then X)
    - Output: "Screenshot captured. Found {N} panels. Visual analysis complete. Panel data extracted."
    ↓
Agent 3 (Interaction Executor):
    - No actions needed (user just wants to see layout)
    - Skips execution
    - Output: "No actions required."
    ↓
Agent 4 (Validator):
    - Verifies navigation succeeded
    - Validates panel data integrity
    - Checks for errors
    - Output: "Validation complete. All checks passed. Panel data is consistent."
    ↓
Final Response:
    "I've analyzed the current panel layout. Here's what I found:
    
    ✅ Navigation: Successfully navigated to panel layout page
    📊 Visual Analysis: Found 12 panels arranged in the layout
    ✓ Validation: All data checks passed
    
    [Panel details and visual arrangement description]"
```

### Example: "Move panel P001 to position (100, 200)"

```
User: "Move panel P001 to position (100, 200)"
    ↓
Coordinator detects browser tools + actions needed
    ↓
Workflow: multi_agent_browser_automation
    ↓
Agent 1 (Navigator):
    - Navigates to panel layout
    - Verifies page loaded
    ↓
Agent 2 (Visual Analyst):
    - Captures current state screenshot
    - Extracts current panel positions
    - Identifies panel P001 current position
    ↓
Agent 3 (Interaction Executor):
    - Executes drag-and-drop: P001 → (100, 200)
    - Captures after screenshot
    - Verifies panel moved
    - Output: "Panel P001 moved from (50, 75) to (100, 200)"
    ↓
Agent 4 (Validator):
    - Verifies panel is at correct position
    - Validates no errors occurred
    - Confirms layout integrity
    - Output: "Validation: Panel successfully moved. Position confirmed."
    ↓
Final Response:
    "✅ Panel P001 has been moved to position (100, 200).
    
    Before: Position (50, 75)
    After: Position (100, 200)
    
    ✓ Validation: Move completed successfully. No errors detected."
```

## Integration with Existing Chat Interface

**No Frontend Changes Required**:
- `PanelAIChat` component continues to call `/api/ai/chat`
- Backend routes to `handle_chat_message()`
- `handle_chat_message()` routes to multi-agent workflow
- Response format remains the same
- User sees same chat interface, but with better results

**Enhanced Response Format** (Optional):
```typescript
interface MultiAgentChatResponse {
  success: boolean
  reply: string
  response: string
  workflow_used: "multi_agent_browser_automation"
  agents_used: string[]  // ["navigator", "visual_analyst", "interaction_executor", "validator"]
  workflow_details?: {
    navigator?: { output: string, status: string }
    visual_analyst?: { output: string, panels_found: number }
    interaction_executor?: { output: string, actions_performed: number }
    validator?: { output: string, validation_status: string }
  }
}
```

## Benefits of Multi-Agent Approach

1. **Specialization**: Each agent focuses on one responsibility
2. **Reliability**: Navigator ensures page loads before analysis
3. **Quality**: Validator catches errors before responding
4. **Collaboration**: Agents build on each other's work
5. **Debugging**: Easier to identify which agent failed
6. **Scalability**: Can add more specialized agents later

## Comparison: Single vs Multi-Agent

| Aspect | Single Agent | Multi-Agent |
|--------|--------------|-------------|
| Navigation | ✅ Can navigate | ✅ Specialized navigator |
| Visual Analysis | ✅ Can analyze | ✅ Dedicated visual analyst |
| Actions | ✅ Can execute | ✅ Specialized executor |
| Validation | ⚠️ Self-validates | ✅ Dedicated validator |
| Error Detection | ⚠️ May miss errors | ✅ Validator catches errors |
| Reliability | ⚠️ Single point of failure | ✅ Multiple checks |
| Debugging | ❌ Hard to debug | ✅ Clear agent boundaries |

## Files to Modify

1. **`ai_service/hybrid_ai_architecture.py`**:
   - Add `multi_agent_browser_automation` workflow to `_ensure_base_blueprints()`
   - Update `handle_chat_message()` to route browser tools to workflow
   - Add `_extract_requested_actions()` helper method
   - Add `_combine_agent_outputs()` helper method

2. **No Frontend Changes Required**:
   - `PanelAIChat` component works as-is
   - Same API endpoint (`/api/ai/chat`)
   - Same response format (enhanced with optional workflow details)

## Success Criteria

- ✅ Multi-agent workflow executes for browser tool tasks
- ✅ Four specialized agents collaborate sequentially
- ✅ Each agent completes its task before next agent starts
- ✅ Validator catches errors and validates results
- ✅ Response combines all agent outputs coherently
- ✅ Chat interface receives enhanced multi-agent responses
- ✅ Fallback to single agent if workflow fails

