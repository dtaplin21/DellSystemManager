# CI/CD Documentation

This directory contains documentation for GitHub Actions workflows and CI/CD processes.

## Workflows

### E2E Tests (`e2e-tests.yml`)

Runs end-to-end regression tests on pull requests and pushes to `main` or `develop` branches.

**Features:**
- ✅ Runs full regression test suite (`npm run test:regression`)
- ✅ Generates HTML test reports
- ✅ Captures screenshots and videos on failure
- ✅ Posts test results as PR comments
- ✅ Uploads test artifacts

**Triggers:**
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`
- Manual workflow dispatch

**See also:**
- [GitHub Secrets Setup](./github-secrets-setup.md)
- [Test Documentation](../../tests/README.md)

### Keep-Alive Ping (`keep-alive.yml`)

Keeps Render services warm by pinging health endpoints every 10 minutes.

**Features:**
- ✅ Pings backend service
- ✅ Pings AI service
- ✅ Runs keep-alive script

**Triggers:**
- Scheduled (every 10 minutes)
- Manual workflow dispatch

## Setup

### 1. Configure GitHub Secrets

Before workflows can run, you need to set up GitHub secrets:

**Required:**
- `TEST_USER_EMAIL` - Test user email for E2E tests
- `TEST_USER_PASSWORD` - Test user password for E2E tests

**Optional:**
- `PLAYWRIGHT_TEST_BASE_URL` - Override test URL (default: production)
- `RUN_LIVE_AI_TESTS` - Enable AI tests (default: false)
- `BACKEND_URL` - Backend service URL
- `AI_SERVICE_URL` - AI service URL

See [GitHub Secrets Setup Guide](./github-secrets-setup.md) for detailed instructions.

### 2. Verify Workflows

1. Go to: `https://github.com/dtaplin21/DellSystemManager/actions`
2. Check that workflows appear
3. Trigger a test run (create a PR or push to `main`/`develop`)
4. Verify tests run successfully

## Workflow Status

View workflow status badges in the main [README.md](../../README.md).

## Troubleshooting

### Tests Not Running

**Check:**
1. Secrets are configured (see [GitHub Secrets Setup](./github-secrets-setup.md))
2. Workflow files are in `.github/workflows/`
3. Branch names match workflow triggers (`main` or `develop`)

### Tests Failing

**Check:**
1. Test user credentials are correct
2. Test URL is accessible
3. Services are running (if testing against local)
4. Review test logs in GitHub Actions

### PR Comments Not Appearing

**Check:**
1. Workflow has permission to comment on PRs
2. PR is targeting `main` or `develop`
3. Workflow completed successfully

## Adding New Workflows

When adding new workflows:

1. **Create workflow file**: `.github/workflows/[name].yml`
2. **Follow naming conventions**: Use kebab-case
3. **Add documentation**: Update this README
4. **Add status badge**: Update main README.md
5. **Test workflow**: Verify it runs correctly

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Playwright CI/CD Guide](https://playwright.dev/docs/ci)
- [Test Documentation](../../tests/README.md)
- [Defect Tracking](../../docs/qa/defect-tracking.md)

