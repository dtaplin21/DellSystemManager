# Playwright Test Commands

## Quick Reference

### Standard Tests (Skip Live AI Tests)
These commands run all tests except those that require live AI service calls:

```bash
npm run test:e2e              # Run all tests (skips live AI tests)
npm run test:e2e:ui           # Run with UI mode
npm run test:e2e:debug        # Run in debug mode
npm run test:e2e:headed       # Run with visible browser
npm run test:e2e:chromium     # Run only Chromium tests
```

### Live AI Tests (Include All Tests)
These commands enable live AI service tests that make real API calls:

```bash
npm run test:e2e:live              # Run all tests including live AI tests
npm run test:e2e:ui:live           # Run with UI mode (includes live AI tests)
npm run test:e2e:debug:live         # Run in debug mode (includes live AI tests)
npm run test:e2e:headed:live       # Run with visible browser (includes live AI tests)
npm run test:e2e:chromium:live    # Run only Chromium tests (includes live AI tests)
```

## Environment Variables

### `.env.playwright` File
Create or update `.env.playwright` in the root directory to set test configuration:

```env
# Required for deployed Playwright runs
TEST_USER_EMAIL=playwright-e2e-1767906508@example.com
TEST_USER_PASSWORD=user123

# Set to 'true' to enable live AI service tests (makes real API calls)
RUN_LIVE_AI_TESTS=true

# Optional: Override default base URLs if needed
# PLAYWRIGHT_TEST_BASE_URL=https://your-frontend.vercel.app
# PLAYWRIGHT_BACKEND_URL=https://your-backend.onrender.com
# PLAYWRIGHT_AI_SERVICE_URL=https://your-ai-service.onrender.com
```

### Command Line Override
You can also set environment variables directly in the command:

```bash
RUN_LIVE_AI_TESTS=true npm run test:e2e
```

## Test Categories

### Skipped by Default (Require `RUN_LIVE_AI_TESTS=true`)
- **AI Chat Tests** (`ai-chat.spec.ts`)
  - `should handle chat API endpoint`
  - `should maintain conversation context`
  
- **AI Defect Detection** (`ai-defect-detection.spec.ts`)
  - `should detect defects in uploaded image`
  - `should return empty defects array for clean image`

- **AI Panel Optimization** (`ai-panel-optimization.spec.ts`)
  - `should optimize panels with strategy`
  - `should handle optimization errors gracefully`

- **AI Plan Geometry** (`ai-plan-geometry.spec.ts`)
  - `should extract plan geometry from uploaded plan document`
  - `should validate plan geometry model structure`

### Always Skipped (Not Yet Deployed)
- `ai-form-extraction.spec.ts` - Mobile extract-form-data endpoint not available
- `ai-panel-automation.spec.ts` - Automation job endpoints not available
- `ai-workflow-orchestration.spec.ts` - Workflow orchestration endpoints not available
- `ai-qc-extraction.spec.ts` - QC extraction API endpoint not deployed

### Conditional Skips
Some tests skip automatically if:
- Required fixture files are missing
- Test data doesn't exist (e.g., no projects, no documents)
- UI elements aren't found

## Tips

1. **Use `test:e2e:ui:live`** for interactive debugging of live AI tests
2. **Use `test:e2e:headed:live`** to watch the browser during live AI tests
3. **Check `.env.playwright`** is set correctly before running live tests
4. **Live AI tests are slower** - they make real API calls and may take several minutes
5. **Cost consideration** - Live AI tests use real OpenAI API credits

## Troubleshooting

### Tests Still Skipped?
- Check that `RUN_LIVE_AI_TESTS=true` is set in `.env.playwright` or command line
- Verify the variable name is exactly `RUN_LIVE_AI_TESTS` (case-sensitive)
- Try running with explicit env var: `RUN_LIVE_AI_TESTS=true npm run test:e2e`

### Authentication Errors?
- Ensure `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` are set in `.env.playwright`
- Verify the test user exists in your Supabase project

### AI Service Errors?
- Check that your AI service is deployed and accessible
- Verify `PLAYWRIGHT_AI_SERVICE_URL` or `NEXT_PUBLIC_AI_SERVICE_URL` is correct
- Check AI service logs for errors


