# GitHub Secrets Setup Guide

This guide explains how to configure GitHub Actions secrets for CI/CD workflows.

## Required Secrets

### 1. Test Credentials

These are required for E2E tests to authenticate:

#### `TEST_USER_EMAIL`
- **Description**: Email address for the test user account
- **Example**: `playwright-e2e-1767906508@example.com`
- **Required**: Yes (for E2E tests)
- **Where to get**: Create a test user in your Supabase project

#### `TEST_USER_PASSWORD`
- **Description**: Password for the test user account
- **Example**: `user123`
- **Required**: Yes (for E2E tests)
- **Where to get**: Set when creating the test user

### 2. Test Configuration (Optional)

#### `PLAYWRIGHT_TEST_BASE_URL`
- **Description**: Base URL for Playwright tests
- **Default**: `https://dellsystemmanager.vercel.app`
- **Required**: No (has default)
- **When to override**: If testing against staging or local environment

#### `RUN_LIVE_AI_TESTS`
- **Description**: Enable live AI service tests (makes real API calls)
- **Default**: `false`
- **Required**: No
- **Values**: `true` or `false`
- **Note**: Set to `true` only if you want to run expensive AI tests in CI

### 3. Service URLs (Optional)

#### `BACKEND_URL`
- **Description**: Backend service URL for keep-alive pings
- **Default**: `https://geosyntec-backend-ugea.onrender.com`
- **Required**: No (has default)
- **Used by**: Keep-alive workflow

#### `AI_SERVICE_URL`
- **Description**: AI service URL for keep-alive pings
- **Default**: `https://geosyntec-backend.onrender.com`
- **Required**: No (has default)
- **Used by**: Keep-alive workflow

## How to Set Secrets

### Method 1: GitHub Web Interface (Recommended)

1. **Navigate to Repository Settings**:
   - Go to: `https://github.com/dtaplin21/DellSystemManager`
   - Click **Settings** tab
   - Click **Secrets and variables** → **Actions**

2. **Add New Secret**:
   - Click **New repository secret**
   - Enter the **Name** (e.g., `TEST_USER_EMAIL`)
   - Enter the **Secret** value
   - Click **Add secret**

3. **Repeat for Each Secret**:
   - Add all required secrets listed above

### Method 2: GitHub CLI

```bash
# Install GitHub CLI if not installed
brew install gh  # macOS
# or download from https://cli.github.com

# Authenticate
gh auth login

# Set secrets
gh secret set TEST_USER_EMAIL --body "playwright-e2e-1767906508@example.com"
gh secret set TEST_USER_PASSWORD --body "user123"
gh secret set RUN_LIVE_AI_TESTS --body "false"
```

## Verifying Secrets

### Check if Secrets are Set

1. Go to: `https://github.com/dtaplin21/DellSystemManager/settings/secrets/actions`
2. You should see all configured secrets listed (values are hidden)

### Test Secrets in Workflow

Create a test workflow or check existing workflow runs:

1. Go to: `https://github.com/dtaplin21/DellSystemManager/actions`
2. Click on a workflow run
3. Check if tests run successfully (they'll fail if secrets are missing)

## Security Best Practices

1. **Never commit secrets to repository**:
   - ✅ Use GitHub Secrets
   - ❌ Don't hardcode in workflow files
   - ❌ Don't commit `.env` files with secrets

2. **Use different test accounts**:
   - Create dedicated test users
   - Don't use production accounts
   - Use strong passwords even for test accounts

3. **Rotate secrets regularly**:
   - Update test user passwords periodically
   - Rotate API keys if compromised

4. **Limit secret access**:
   - Only add secrets that are needed
   - Remove unused secrets
   - Use environment-specific secrets when possible

## Troubleshooting

### Tests Fail with "Authentication Error"

**Problem**: `TEST_USER_EMAIL` or `TEST_USER_PASSWORD` not set or incorrect

**Solution**:
1. Verify secrets are set in GitHub
2. Check test user exists in Supabase
3. Verify credentials are correct

### Tests Fail with "Connection Error"

**Problem**: `PLAYWRIGHT_TEST_BASE_URL` pointing to wrong URL

**Solution**:
1. Check the URL is accessible
2. Verify the URL matches your deployment
3. Update secret if needed

### Keep-Alive Pings Fail

**Problem**: `BACKEND_URL` or `AI_SERVICE_URL` incorrect

**Solution**:
1. Verify service URLs are correct
2. Check services are running
3. Update secrets if URLs changed

## Quick Setup Checklist

- [ ] Create test user in Supabase
- [ ] Set `TEST_USER_EMAIL` secret
- [ ] Set `TEST_USER_PASSWORD` secret
- [ ] (Optional) Set `PLAYWRIGHT_TEST_BASE_URL` if using custom URL
- [ ] (Optional) Set `RUN_LIVE_AI_TESTS` to `true` if needed
- [ ] Verify secrets are set correctly
- [ ] Test workflow runs successfully

## Example: Complete Setup

```bash
# 1. Create test user in Supabase dashboard
# Email: playwright-e2e-test@example.com
# Password: TestPassword123!

# 2. Set secrets via GitHub CLI
gh secret set TEST_USER_EMAIL --body "playwright-e2e-test@example.com"
gh secret set TEST_USER_PASSWORD --body "TestPassword123!"

# 3. (Optional) Set custom test URL
gh secret set PLAYWRIGHT_TEST_BASE_URL --body "https://staging.dellsystemmanager.vercel.app"

# 4. Verify secrets
gh secret list
```

## Need Help?

- Check workflow logs: `https://github.com/dtaplin21/DellSystemManager/actions`
- Review test documentation: `tests/README.md`
- Check Playwright config: `playwright.config.ts`

