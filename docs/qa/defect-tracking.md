# Defect Tracking Process

## Overview

This document outlines the defect tracking and reporting process for GeoSynth QC Pro. Defects discovered during testing are tracked and managed through GitHub Issues with structured documentation.

## Defect Reporting Workflow

### 1. Test Execution

Tests are run via:
- **Local development**: `npm run test:e2e` or `npm run test:regression`
- **CI/CD**: Automated runs on pull requests and pushes to main/develop branches
- **Manual testing**: During feature development and QA cycles

### 2. Defect Discovery

When a test fails or a defect is discovered:

1. **Capture Evidence**:
   - Screenshots (automatically captured by Playwright on failure)
   - Videos (automatically captured by Playwright on failure)
   - Console logs and network traces
   - Test execution logs

2. **Document Reproducible Steps**:
   - Test case name and location
   - Preconditions
   - Steps to reproduce
   - Expected behavior
   - Actual behavior

3. **Extract Log Snippets**:
   - Backend logs (structured logging via winston)
   - Frontend console errors
   - API response errors
   - Network request/response details

### 3. Creating a Defect Report

Create a GitHub Issue with the following structure:

#### Issue Title
```
[DEFECT] Brief description of the issue
```

#### Issue Body Template
```markdown
## Test Case
- **Test File**: `tests/e2e/[filename].spec.ts`
- **Test Name**: `[test name]`
- **Test ID**: (if applicable)

## Environment
- **Browser**: Chrome/Firefox/Safari
- **Environment**: Production/Staging/Local
- **Date**: YYYY-MM-DD

## Preconditions
1. User is logged in
2. Project exists
3. (Other relevant preconditions)

## Steps to Reproduce
1. Navigate to `/dashboard/projects`
2. Click "Create Project"
3. Fill in form fields
4. Submit form

## Expected Behavior
- Project should be created successfully
- Success message should appear
- Project should appear in project list

## Actual Behavior
- Error message appears: "Failed to create project"
- Project does not appear in list
- Console shows: `[ERROR] API call failed with 500`

## Evidence
- Screenshot: (attach from test-results/)
- Video: (attach from test-results/)
- Log snippet:
```
[2024-01-15 10:30:45] ERROR [AUTH] Token verification failed
```

## Severity
- [ ] Critical (blocks core functionality)
- [ ] High (major feature broken)
- [ ] Medium (minor feature issue)
- [ ] Low (cosmetic or edge case)

## Priority
- [ ] P0 (fix immediately)
- [ ] P1 (fix in current sprint)
- [ ] P2 (fix in next sprint)
- [ ] P3 (backlog)

## Related
- Related issues: #123
- Related PR: #456
```

### 4. Defect Tracking Labels

Use GitHub labels to categorize defects:

- `bug` - Confirmed defect
- `test-failure` - Test suite failure
- `regression` - Previously working feature broken
- `critical` - Critical severity
- `high-priority` - High priority
- `qa` - QA-related issue
- `e2e-test` - E2E test related
- `frontend` - Frontend issue
- `backend` - Backend issue
- `ai-service` - AI service issue

### 5. Defect Resolution

When a defect is fixed:

1. **Verification**:
   - Re-run the failing test: `npm run test:e2e tests/e2e/[filename].spec.ts`
   - Run full regression suite: `npm run test:regression`
   - Verify fix in the affected environment

2. **Documentation**:
   - Update the GitHub Issue with:
     - Fix description
     - PR number
     - Verification steps
     - Test results

3. **Closure**:
   - Close the issue with a comment linking to the fix PR
   - Add `verified` label if manually verified

## Test Failure Analysis

### Automated Test Failures

When CI tests fail:

1. **Review Test Report**:
   - Check uploaded Playwright HTML report
   - Review screenshots and videos
   - Analyze console logs

2. **Identify Root Cause**:
   - Check backend logs (Render logs)
   - Check frontend console errors
   - Verify API responses
   - Check database state

3. **Create Defect Report**:
   - Follow defect reporting workflow above
   - Include CI run link and artifacts

### Log-Based Troubleshooting

The project uses structured logging for troubleshooting:

- **Backend**: Winston logger with structured JSON logs
- **Frontend**: Console logging with structured format
- **AI Service**: Python logging with structured output

Key log patterns to check:
- `[AUTH]` - Authentication issues
- `[ERROR]` - General errors
- `[API]` - API request/response issues
- `[AI]` - AI service issues

## Regression Testing

### Pre-Release Regression

Before each release:

1. Run full regression suite:
   ```bash
   npm run test:regression
   ```

2. Review test results:
   - Check HTML report
   - Review any failures
   - Verify fixes

3. Document results:
   - Create release notes
   - Document any known issues
   - Update test coverage documentation

### Continuous Regression

- Automated runs on every PR
- Manual runs before merging to main
- Scheduled runs (if configured)

## Best Practices

1. **Always include reproducible steps** - If you can't reproduce it, document why
2. **Attach evidence** - Screenshots, videos, logs are crucial
3. **Link related items** - Link to PRs, issues, commits
4. **Update status** - Keep issues updated as they progress
5. **Verify fixes** - Always verify fixes before closing issues
6. **Document workarounds** - If a workaround exists, document it

## Tools

- **GitHub Issues**: Primary defect tracking system
- **Playwright**: Test execution and evidence capture
- **Winston**: Structured logging for backend
- **Console**: Frontend logging
- **GitHub Actions**: CI/CD test execution

## Metrics

Track the following metrics:

- Defect discovery rate
- Defect resolution time
- Test pass rate
- Regression test coverage
- Critical defect count

