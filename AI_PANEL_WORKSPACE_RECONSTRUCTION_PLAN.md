# AI Panel Workspace Reconstruction Plan

## Overview
Combine the AI Panel Workspace (`PanelAIChat`) and AI Panel Generation (`PanelRequirementsForm`) into a unified component with tabbed interface. The chat interface will allow AI to use browser tools to manipulate the panel layout, while document upload/generation will persist panels to the layout.

## Current State Analysis

### Existing Components

1. **PanelAIChat** (`frontend/src/components/panels/PanelAIChat.tsx`)
   - Location: `/dashboard/panels`
   - Purpose: Chat interface for MCP agents
   - Features: Chat messages, MCP agent coordination, browser tool integration
   - API: `/api/ai/chat` (backend → Python AI service)

2. **PanelRequirementsForm** (`frontend/src/components/panel-layout/PanelRequirementsForm.tsx`)
   - Location: `/dashboard/ai` (Panel Requirements tab)
   - Purpose: Document upload, AI analysis, panel generation
   - Features: Document upload, AI analysis, panel requirements form, layout generation
   - API: `/api/ai/automate-layout`, `/api/panels/image-analysis`, document analysis endpoints

3. **PanelLayoutRefactored** (`frontend/src/app/dashboard/projects/[id]/panel-layout/panel-layout-refactored.tsx`)
   - Location: `/dashboard/projects/[id]/panel-layout`
   - Purpose: Visual panel layout canvas
   - Features: Panel rendering, drag/drop, panel management, sidebar

### Browser Tools Available

1. **Browser Automation Tools** (Python AI Service):
   - `browser_navigate`: Navigate to panel layout page
   - `browser_screenshot`: Capture visual layout
   - `browser_extract`: Extract panel data from page

2. **Panel Manipulation Tool** (`PanelManipulationTool`):
   - `get_panels`: Get panel data from backend
   - `move_panel`: Move panel via API
   - `batch_move`: Batch move operations
   - `reorder_panels_numerically`: Reorder panels

## Reconstruction Plan

### Phase 1: Create Unified Component Structure

#### 1.1 New Component: `UnifiedAIPanelWorkspace`
**Location**: `frontend/src/components/panels/UnifiedAIPanelWorkspace.tsx`

**Structure**:
```typescript
interface UnifiedAIPanelWorkspaceProps {
  projectId: string;
  projectInfo?: {
    projectName?: string;
    location?: string;
    description?: string;
  };
  userId?: string;
  userTier?: string;
}
```

**Tabs**:
- **Tab 1: "Document Analysis & Generation"**
  - Document upload section
  - AI analysis results display
  - Panel requirements form
  - Generate layout button
  - Generated panels persist to layout

- **Tab 2: "AI Chat & Manipulation"**
  - Chat interface (from PanelAIChat)
  - AI can use browser tools to:
    - View current panel layout
    - Manipulate panels via API
    - Take screenshots
    - Extract panel data

**State Management**:
- Shared project context
- Panel layout state (synced with backend)
- Document list state
- Chat history state

#### 1.2 Component Layout
```
┌─────────────────────────────────────────────────────────┐
│  Unified AI Panel Workspace                             │
│  Project: [Project Name]                                │
├─────────────────────────────────────────────────────────┤
│  [Document Analysis] [AI Chat]                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Tab Content Area (changes based on selected tab)       │
│                                                          │
│  Document Analysis Tab:                                 │
│  - Document Upload                                       │
│  - AI Analysis Results                                   │
│  - Panel Requirements Form                               │
│  - Generate Layout Button                                │
│                                                          │
│  AI Chat Tab:                                           │
│  - Chat Messages                                         │
│  - Input Field                                          │
│  - Quick Actions                                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Phase 2: Integrate Panel Generation with Layout Persistence

#### 2.1 Panel Generation Flow
1. User uploads documents in "Document Analysis" tab
2. AI analyzes documents and extracts panel specifications
3. User fills out panel requirements form (or AI auto-fills)
4. User clicks "Generate Layout"
5. **CRITICAL**: Generated panels are saved to backend via `/api/panels/populate-from-analysis/:projectId`
6. Panel layout component (`PanelLayoutRefactored`) automatically refreshes to show new panels
7. Panels persist in database and remain visible

#### 2.2 API Integration Points
- **Document Upload**: `POST /api/documents/upload`
- **AI Analysis**: `POST /api/ai/analyze-documents` or `POST /api/panels/image-analysis/:projectId`
- **Layout Generation**: `POST /api/ai/automate-layout` or `POST /api/panels/populate-from-analysis/:projectId`
- **Panel Persistence**: Panels saved via `/api/panel-layout/update-panel` or batch update

### Phase 3: Enable Browser Tools in Chat Interface

#### 3.1 Chat Context Enhancement
The chat interface needs access to:
- Current panel layout URL: `/dashboard/projects/${projectId}/panel-layout`
- Panel manipulation API endpoints
- Browser session management

#### 3.2 Browser Tool Integration
When user asks AI to manipulate panels:
1. AI uses `browser_navigate` to go to panel layout page
2. AI uses `browser_screenshot` to see current layout
3. AI uses `browser_extract` to get panel data
4. AI uses `PanelManipulationTool` to make changes:
   - `move_panel`: Move individual panels
   - `batch_move`: Move multiple panels
   - `reorder_panels_numerically`: Reorder panels
5. Changes persist to backend
6. Frontend refreshes to show updated layout

#### 3.3 Chat Message Context
Include in chat context payload:
```typescript
{
  projectId: string;
  projectInfo: {...};
  panelLayoutUrl: string; // Full URL to panel layout page
  currentPanels: Panel[]; // Current panel state (optional, can be fetched)
  history: ChatMessage[];
}
```

### Phase 4: State Synchronization

#### 4.1 Real-time Updates
- When panels are generated in "Document Analysis" tab:
  - Update local state
  - Save to backend
  - Trigger refresh in panel layout component (if open)
  - Show success message

- When AI manipulates panels via chat:
  - Changes saved to backend via API
  - Panel layout component auto-refreshes
  - Chat shows confirmation message

#### 4.2 Shared State Hook
Create `useUnifiedPanelWorkspace` hook:
```typescript
interface UnifiedPanelWorkspaceState {
  panels: Panel[];
  documents: Document[];
  chatMessages: ChatMessage[];
  isGenerating: boolean;
  isChatting: boolean;
  refreshPanels: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
}
```

### Phase 5: UI/UX Improvements

#### 5.1 Tab Navigation
- Use Shadcn `Tabs` component
- Visual indicator when panels are being generated/manipulated
- Show panel count badge on tabs

#### 5.2 Visual Feedback
- Loading states during:
  - Document upload
  - AI analysis
  - Panel generation
  - Chat AI responses
  - Panel manipulation

#### 5.3 Success Indicators
- Toast notifications when:
  - Documents uploaded successfully
  - Panels generated successfully
  - AI manipulates panels successfully
- Visual confirmation in panel layout (if visible)

### Phase 6: Route Updates

#### 6.1 New Route Structure
- **Option A**: Replace `/dashboard/panels` with unified workspace
  - Route: `/dashboard/panels` → `UnifiedAIPanelWorkspace`
  - Keep `/dashboard/ai` for backward compatibility (redirects to `/dashboard/panels`)

- **Option B**: New route, keep both
  - Route: `/dashboard/projects/[id]/ai-workspace` → `UnifiedAIPanelWorkspace`
  - Keep `/dashboard/panels` and `/dashboard/ai` as separate pages

**Recommendation**: Option A - Replace `/dashboard/panels` with unified workspace

#### 6.2 Navigation Updates
- Update dashboard navigation to point to unified workspace
- Update project detail page to include link to AI workspace

## Implementation Steps

### Step 1: Create Unified Component Shell
1. Create `UnifiedAIPanelWorkspace.tsx`
2. Set up tab structure (Shadcn Tabs)
3. Add basic layout and styling
4. Integrate project context

### Step 2: Migrate Document Analysis Tab
1. Copy `PanelRequirementsForm` logic into Document Analysis tab
2. Remove document upload from separate page
3. Integrate with unified state management
4. Ensure panel generation persists to backend

### Step 3: Migrate Chat Tab
1. Copy `PanelAIChat` logic into AI Chat tab
2. Enhance context payload with panel layout URL
3. Ensure browser tools can access panel layout page
4. Add panel manipulation capabilities

### Step 4: State Management Integration
1. Create shared state hook
2. Implement panel refresh mechanism
3. Add real-time updates between tabs
4. Sync with backend panel state

### Step 5: Browser Tools Enhancement
1. Verify browser tools can navigate to panel layout
2. Test panel manipulation via API
3. Add error handling for browser tool failures
4. Add visual feedback for AI actions

### Step 6: Testing & Refinement
1. Test document upload → panel generation → persistence
2. Test chat → browser tools → panel manipulation
3. Test state synchronization between tabs
4. Test panel layout refresh after changes
5. Performance testing

## File Changes Required

### New Files
1. `frontend/src/components/panels/UnifiedAIPanelWorkspace.tsx` - Main unified component
2. `frontend/src/hooks/use-unified-panel-workspace.ts` - Shared state hook
3. `frontend/src/app/dashboard/projects/[id]/ai-workspace/page.tsx` - New route page (if Option B)

### Modified Files
1. `frontend/src/app/dashboard/panels/page.tsx` - Replace with unified workspace
2. `frontend/src/app/dashboard/ai/page.tsx` - Update or redirect to unified workspace
3. `frontend/src/components/panels/PanelAIChat.tsx` - Extract chat logic for reuse
4. `frontend/src/components/panel-layout/PanelRequirementsForm.tsx` - Extract form logic for reuse
5. `frontend/src/app/dashboard/layout.tsx` - Update navigation links

### Backend Changes (if needed)
1. Ensure `/api/panels/populate-from-analysis/:projectId` persists panels correctly
2. Ensure `/api/panel-layout/update-panel` supports batch updates
3. Add WebSocket support for real-time panel updates (optional, future enhancement)

## Key Requirements

### Critical Requirements
1. ✅ Panels generated from documents MUST persist to database
2. ✅ Panel layout MUST refresh automatically after generation/manipulation
3. ✅ Chat interface MUST be able to use browser tools to manipulate panels
4. ✅ Both tabs MUST share the same project context
5. ✅ Panel state MUST be synchronized between tabs

### Nice-to-Have Features
1. Real-time panel updates via WebSocket
2. Panel manipulation history/undo
3. Visual diff showing what AI changed
4. Batch operations for multiple panels
5. Export panel layout as image/PDF

## Success Criteria

1. ✅ User can upload documents and generate panels in one tab
2. ✅ Generated panels appear in panel layout and persist
3. ✅ User can chat with AI in another tab
4. ✅ AI can use browser tools to view and manipulate panel layout
5. ✅ Panel changes persist and refresh automatically
6. ✅ No data loss between tab switches
7. ✅ Smooth user experience with clear visual feedback

## Risk Mitigation

### Risk 1: Panel State Desynchronization
**Mitigation**: Use single source of truth (backend), refresh on tab switch

### Risk 2: Browser Tools Fail to Access Panel Layout
**Mitigation**: Add fallback to API-based manipulation, clear error messages

### Risk 3: Performance Issues with Large Panel Counts
**Mitigation**: Implement pagination, virtual scrolling, lazy loading

### Risk 4: Breaking Existing Functionality
**Mitigation**: Keep old routes temporarily, add feature flags, gradual migration

## Timeline Estimate

- **Phase 1**: 2-3 hours (Component structure)
- **Phase 2**: 3-4 hours (Panel generation integration)
- **Phase 3**: 3-4 hours (Browser tools integration)
- **Phase 4**: 2-3 hours (State synchronization)
- **Phase 5**: 2-3 hours (UI/UX improvements)
- **Phase 6**: 1-2 hours (Route updates)

**Total**: ~13-19 hours

## Questions for Approval

1. **Route Structure**: Option A (replace `/dashboard/panels`) or Option B (new route)?
2. **Tab Names**: "Document Analysis" vs "AI Chat" or different names?
3. **Panel Layout Integration**: Should panel layout be embedded in workspace or remain separate page?
4. **Backward Compatibility**: Keep old routes or remove them?
5. **Real-time Updates**: Implement WebSocket now or later?

---

**Status**: ⏳ Awaiting Approval

