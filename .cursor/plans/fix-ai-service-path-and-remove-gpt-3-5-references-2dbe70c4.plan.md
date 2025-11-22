<!-- 2dbe70c4-a812-498f-bf70-64f73ad1a1a5 ec05a677-958d-4601-883c-1e020afc7707 -->
# Agent Utilization Plan: Mapping WorkflowOrchestrator Agents to Use Cases

## Agent Inventory

### Workflow 1: new_project_setup (Hierarchical Process)

- **config** (Configuration Lead): Project Configuration Specialist
- **qa** (Quality Analyst): Quality and Compliance Analyst  
- **reporter** (Communication Specialist): Executive Report Author

### Workflow 2: panel_optimization (Parallel Process)

- **optimizer** (Layout Optimizer): Panel Layout Optimizer
- **compliance** (Compliance Partner): Specification Compliance Officer

### Workflow 3: web_automation (Sequential Process)

- **web_automation** (Web Automation Specialist): Headless Browser Operator

## Agent Utilization Table

| Agent | Role | Primary Use Case | Integration Point | Current Status | Priority |
|-------|------|------------------|-------------------|----------------|----------|
| **config** | Project Configuration Specialist | New project creation and setup | `POST /api/projects` | Not used | High |
| **qa** | Quality and Compliance Analyst | Project validation and compliance checks | `POST /api/projects`, `PATCH /api/projects/:id` | Not used | High |
| **reporter** | Executive Report Author | Generate project summaries and reports | `GET /api/projects/:id`, Dashboard views | Not used | Medium |
| **optimizer** | Panel Layout Optimizer | Panel layout optimization and generation | `POST /api/ai/automate-layout`, `POST /api/ai/execute-ai-layout` | Not used | High |
| **compliance** | Specification Compliance Officer | Validate panel layouts against specs | `POST /api/panels/populate-from-analysis/:projectId` | Not used | High |
| **web_automation** | Headless Browser Operator | Visual analysis, panel extraction, UI automation | `POST /api/ai/chat` (browser tool tasks) | Partially used (single agent) | High |

## Implementation Plan

### Phase 0: Fix Browser Tools Process Type Issue (CRITICAL - DO FIRST)

**Problem**: Hierarchical process being used with single agent, causing browser tools to fail.

**Root Cause**:
- Browser tools force `TaskComplexity.COMPLEX` (line 311-312)
- COMPLEX sets `process=Process.hierarchical` (line 528)
- But Crew only has ONE agent: `agents=[self.agent]` (line 227)
- Hierarchical processes REQUIRE multiple agents or manager LLM

**File: `ai_service/hybrid_ai_architecture.py`** (MODIFY)

**Line 528**: Fix process type selection
- Current: `process = Process.hierarchical if complexity in (TaskComplexity.COMPLEX, TaskComplexity.EXPERT) else Process.sequential`
- Problem: Browser tools get COMPLEX → hierarchical → fails with single agent
- Fix: Always use `Process.sequential` for single-agent crews
- Change to: `process = Process.sequential  # Always sequential for single agent`

**File: `ai_service/hybrid_ai_architecture.py`** (MODIFY)

**Line 560-870**: Route browser tools to `web_automation` workflow
- Current: Always creates single agent for browser tools
- Fix: Route browser tool tasks to `WorkflowOrchestrator.execute_workflow("web_automation", ...)`
- This uses proper sequential process with browser automation agent
- Fallback to single agent if workflow fails

**Success Criteria**:
- Browser tools execute properly (no hierarchical process error)
- Single agent tasks use sequential process
- Browser tool tasks use web_automation workflow (sequential)
- No more "Attribute manager_llm or manager_agent is required" errors

### Phase 1: Project Setup Workflow Integration

**File: `backend/routes/projects.js`**

- Modify `POST /api/projects` to call `WorkflowOrchestrator.execute_new_project_workflow()`
- Integration point: After project data validation, before database save
- Agents used: config → qa → reporter (hierarchical)

**File: `ai_service/integration_layer.py`**

- Implement `handle_new_project()` method in `DellSystemAIService`
- Method should call `get_orchestrator().execute_new_project_workflow()`

**File: `ai_service/hybrid_ai_architecture.py`**

- Add `handle_new_project()` method to `DellSystemAIService` class
- Method signature: `async def handle_new_project(self, user_id: str, user_tier: str, project_data: Dict) -> Dict`

### Phase 2: Panel Optimization Workflow Integration

**File: `backend/routes/ai.js`**

- Modify `POST /api/ai/automate-layout` to use `panel_optimization` workflow
- Modify `POST /api/ai/execute-ai-layout` to use `panel_optimization` workflow
- Agents used: optimizer + compliance (parallel execution)

**File: `backend/routes/panels.js`**

- Modify `POST /api/panels/populate-from-analysis/:projectId` to include compliance check
- Integration point: After AI analysis, before panel creation

**File: `ai_service/integration_layer.py`**

- Implement `handle_layout_optimization()` method
- Method should call `get_orchestrator().execute_panel_optimization_workflow()`

**File: `ai_service/hybrid_ai_architecture.py`**

- Add `handle_layout_optimization()` method to `DellSystemAIService` class
- Method signature: `async def handle_layout_optimization(self, user_id: str, user_tier: str, layout_data: Dict) -> Dict`

### Phase 3: Browser Automation Workflow Integration

**File: `backend/routes/ai.js`**

- Modify `POST /api/ai/chat` to detect complex browser automation tasks
- Route complex tasks to `web_automation` workflow instead of single agent
- Simple chat messages continue using single agent

**File: `ai_service/hybrid_ai_architecture.py`**

- Update `handle_chat_message()` to detect workflow-worthy browser tasks
- Criteria: Multiple browser operations, complex interactions, or multi-step automation
- Route to `WorkflowOrchestrator.execute_workflow("web_automation", ...)` for complex cases

### Phase 4: Document Analysis Integration

**File: `backend/routes/ai.js`**

- Modify `POST /api/ai/analyze-documents` to use appropriate workflow
- Create new workflow or extend existing workflows for document analysis
- Consider using `config` agent for document-based project setup

**File: `ai_service/integration_layer.py`**

- Implement `handle_document_analysis()` method
- Method should route to appropriate workflow based on analysis type

**File: `ai_service/hybrid_ai_architecture.py`**

- Add `handle_document_analysis()` method to `DellSystemAIService` class
- Method signature: `async def handle_document_analysis(self, user_id: str, user_tier: str, document_path: str, analysis_type: str) -> Dict`

## Detailed Integration Points

### 1. Project Creation (`POST /api/projects`)

**Current**: Direct database insert
**New**:

1. Validate project data
2. Call `ai_integration.setup_new_project_hybrid(project_data, user_id, user_tier)`
3. Workflow executes: config → qa → reporter
4. Save project with workflow results
5. Return project + executive summary

### 2. Panel Layout Optimization (`POST /api/ai/automate-layout`)

**Current**: Single AI call
**New**:

1. Extract panel data and constraints
2. Call `ai_integration.optimize_panels_hybrid(panels, strategy, site_config, user_id, user_tier)`
3. Workflow executes: optimizer + compliance (parallel)
4. Return optimized layout + compliance report

### 3. Chat with Browser Tools (`POST /api/ai/chat`)

**Current**: Single agent execution
**New**:

1. Detect task complexity (simple vs complex browser automation)
2. Simple tasks: Continue using single agent (`CrewAgentExecutor`)
3. Complex tasks: Route to `web_automation` workflow
4. Workflow executes: navigate → interact → collect (sequential)

### 4. Panel Population from Analysis (`POST /api/panels/populate-from-analysis/:projectId`)

**Current**: Direct panel creation
**New**:

1. Receive AI analysis results
2. Call `panel_optimization` workflow with compliance check
3. Workflow executes: optimizer + compliance (parallel)
4. Create panels with compliance validation

## Workflow Routing Logic

### Simple vs Complex Task Detection

**Simple Tasks** (use single agent):

- Single browser operation (navigate, screenshot, extract)
- Simple questions that don't require multi-step automation
- Direct queries about existing data

**Complex Tasks** (use workflows):

- Multi-step browser automation (navigate + interact + collect)
- Project setup requiring configuration + validation + reporting
- Panel optimization requiring layout + compliance review
- Document analysis requiring multiple agent perspectives

## Files to Modify

1. `ai_service/hybrid_ai_architecture.py`

- Add `handle_new_project()` method
- Add `handle_layout_optimization()` method
- Add `handle_document_analysis()` method
- Update `handle_chat_message()` with workflow routing logic

2. `ai_service/integration_layer.py`

- Fix `setup_new_project_hybrid()` to call correct method
- Fix `optimize_panels_hybrid()` to call correct method
- Fix `analyze_documents_hybrid()` to call correct method

3. `backend/routes/projects.js`

- Integrate `new_project_setup` workflow in `POST /api/projects`

4. `backend/routes/ai.js`

- Integrate `panel_optimization` workflow in layout endpoints
- Integrate `web_automation` workflow for complex chat tasks
- Integrate workflows in document analysis endpoints

5. `backend/routes/panels.js`

- Add compliance check in panel population endpoint

## Success Criteria

- All 6 agents are actively used in appropriate workflows
- Project creation uses 3-agent hierarchical workflow
- Panel optimization uses 2-agent parallel workflow
- Complex browser automation uses sequential workflow
- Simple chat continues using single agent (no regression)
- All integration layer methods properly route to workflows

### To-dos

- [ ] **CRITICAL**: Fix process type in `_create_agent_for_task()` - always use sequential for single agent (Line 528)
- [ ] **CRITICAL**: Route browser tool tasks to `web_automation` workflow in `handle_chat_message()` (Line 725-813)
- [ ] Implement handle_new_project(), handle_layout_optimization(), and handle_document_analysis() methods in DellSystemAIService
- [ ] Fix integration_layer.py methods to call correct DellSystemAIService methods
- [ ] Integrate new_project_setup workflow into POST /api/projects endpoint
- [ ] Integrate panel_optimization workflow into panel layout endpoints
- [ ] Add workflow routing logic to handle_chat_message() for complex browser automation
- [ ] Add compliance validation to panel population endpoint