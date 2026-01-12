# Test Suites Skip Status

## ✅ All Test Suites Updated

All test suites have been reviewed and updated to remove hardcoded skips. Tests will now run when `RUN_LIVE_AI_TESTS=true` is set.

## Test Suite Status

### ✅ AI Test Suites (Conditional Skip Based on `RUN_LIVE_AI_TESTS`)

1. **`ai-chat.spec.ts`**
   - ✅ Individual tests use conditional skip: `test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', ...)`
   - Status: Ready to run when `RUN_LIVE_AI_TESTS=true`

2. **`ai-defect-detection.spec.ts`**
   - ✅ Individual tests use conditional skip: `test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', ...)`
   - Status: Ready to run when `RUN_LIVE_AI_TESTS=true`

3. **`ai-document-analysis.spec.ts`**
   - ✅ Describe-level conditional skip: `test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', ...)`
   - ✅ Runtime skips for missing projects/files (acceptable)
   - Status: Ready to run when `RUN_LIVE_AI_TESTS=true`

4. **`ai-form-extraction.spec.ts`**
   - ✅ Describe-level conditional skip: `test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', ...)`
   - ✅ Uses real project IDs from `beforeEach`
   - ✅ Runtime skips for missing projects (acceptable)
   - Status: Ready to run when `RUN_LIVE_AI_TESTS=true`

5. **`ai-panel-optimization.spec.ts`**
   - ✅ Individual tests use conditional skip: `test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', ...)`
   - Status: Ready to run when `RUN_LIVE_AI_TESTS=true`

6. **`ai-plan-geometry.spec.ts`**
   - ✅ Individual tests use conditional skip: `test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', ...)`
   - Status: Ready to run when `RUN_LIVE_AI_TESTS=true`

7. **`ai-health.spec.ts`**
   - ✅ No skips - always runs
   - Status: Always enabled

8. **`ai-panel-automation.spec.ts`**
   - ✅ **FIXED**: Changed from hardcoded skip to conditional skip
   - ✅ Describe-level conditional skip: `test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', ...)`
   - Status: Ready to run when `RUN_LIVE_AI_TESTS=true`

9. **`ai-workflow-orchestration.spec.ts`**
   - ✅ **FIXED**: Changed from hardcoded skip to conditional skip
   - ✅ Describe-level conditional skip: `test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', ...)`
   - ✅ Uses `BACKEND_BASE_URL` for API calls
   - Status: Ready to run when `RUN_LIVE_AI_TESTS=true`

10. **`ai-qc-extraction.spec.ts`**
    - ✅ **FIXED**: Changed from hardcoded skip to conditional skip
    - ✅ Describe-level conditional skip: `test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', ...)`
    - ✅ Uses `BACKEND_BASE_URL` for API calls
    - Status: Ready to run when `RUN_LIVE_AI_TESTS=true`

### ✅ Non-AI Test Suites (Always Enabled)

11. **`asbuilt.spec.ts`**
    - ✅ No hardcoded skips
    - Status: Always enabled

12. **`panel-layout.spec.ts`**
    - ✅ No hardcoded skips
    - Status: Always enabled

13. **`documents.spec.ts`**
    - ✅ No hardcoded skips
    - Status: Always enabled

14. **`projects.spec.ts`**
    - ✅ No hardcoded skips
    - Status: Always enabled

15. **`auth.spec.ts`**
    - ✅ No hardcoded skips
    - Status: Always enabled

## Changes Made

### Files Updated

1. **`tests/e2e/ai-panel-automation.spec.ts`**
   - Changed: `test.skip(true, 'Automation job endpoints...')`
   - To: `test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', 'Live AI tests are disabled...')`

2. **`tests/e2e/ai-workflow-orchestration.spec.ts`**
   - Changed: `test.skip(true, 'Workflow orchestration endpoints...')`
   - To: `test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', 'Live AI tests are disabled...')`
   - Added: `BACKEND_BASE_URL` import and usage

3. **`tests/e2e/ai-qc-extraction.spec.ts`**
   - Changed: `test.skip(true, 'QC extraction API endpoint...')`
   - To: `test.skip(process.env.RUN_LIVE_AI_TESTS !== 'true', 'Live AI tests are disabled...')`
   - Added: `BACKEND_BASE_URL` import and usage
   - Updated: API endpoints to use `BACKEND_BASE_URL`

## How to Run Tests

### Run All Tests (Non-AI)
```bash
npm run test:e2e
```

### Run All Tests Including Live AI Tests
```bash
RUN_LIVE_AI_TESTS=true npm run test:e2e
# or
npm run test:e2e:live
```

### Run Specific Test Suite
```bash
RUN_LIVE_AI_TESTS=true npm run test:e2e ai-chat
RUN_LIVE_AI_TESTS=true npm run test:e2e ai-form-extraction
```

## Runtime Skips (Acceptable)

The following runtime skips are acceptable and will only skip when conditions are not met:

- **"No projects available"** - Skips when no projects exist in the test account
- **"Test document file not found"** - Skips when test fixtures are missing
- **"No project selected"** - Skips when project selection fails

These are not hardcoded skips and will run when conditions are met.

## Summary

✅ **All hardcoded skips removed**
✅ **All test suites use conditional skips based on `RUN_LIVE_AI_TESTS`**
✅ **All tests will run when `RUN_LIVE_AI_TESTS=true` is set**
✅ **Runtime skips remain for valid conditions (missing projects/files)**

