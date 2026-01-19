# How to Run Debug Test Against Production

## Quick Start

The debug test is configured to run against **PRODUCTION** by default.

### Option 1: Using Environment Variables (Recommended)

```bash
TEST_USER_EMAIL=your-email@example.com \
TEST_USER_PASSWORD=your-password \
npx playwright test tests/e2e/ai-document-analysis-debug.spec.ts
```

### Option 2: Using .env.playwright File

1. Create `.env.playwright` in the project root (this file is gitignored):
```bash
TEST_USER_EMAIL=your-email@example.com
TEST_USER_PASSWORD=your-password
```

2. Run the test:
```bash
npx playwright test tests/e2e/ai-document-analysis-debug.spec.ts
```

### Option 3: With UI (Visual Debugging)

```bash
TEST_USER_EMAIL=your-email@example.com \
TEST_USER_PASSWORD=your-password \
npx playwright test tests/e2e/ai-document-analysis-debug.spec.ts --ui
```

### Option 4: With Headed Browser (Watch It Run)

```bash
TEST_USER_EMAIL=your-email@example.com \
TEST_USER_PASSWORD=your-password \
npx playwright test tests/e2e/ai-document-analysis-debug.spec.ts --headed
```

## What URLs Are Used

The test will automatically use:
- **Frontend**: `https://dellsystemmanager.vercel.app` (production)
- **Backend**: `https://geosyntec-backend-ugea.onrender.com` (production)
- **AI Service**: `https://geosyntec-backend.onrender.com` (production)

## Override URLs (If Needed)

To override and use different URLs:

```bash
PLAYWRIGHT_TEST_BASE_URL=https://your-frontend.com \
PLAYWRIGHT_BACKEND_URL=https://your-backend.com \
TEST_USER_EMAIL=your-email@example.com \
TEST_USER_PASSWORD=your-password \
npx playwright test tests/e2e/ai-document-analysis-debug.spec.ts
```

## What the Debug Test Will Show

The test provides detailed logging for:

1. ✅ **Environment Confirmation** - Shows which URLs are being used
2. ✅ **Login Process** - Step-by-step login with URL verification
3. ✅ **API Calls** - Direct API testing with full response details
4. ✅ **Cookies** - All cookies, especially auth-related ones
5. ✅ **LocalStorage** - Session data stored in browser
6. ✅ **ProjectHelpers** - Tests the helper function with logging
7. ✅ **Page Analysis** - Checks what's actually rendered on the page
8. ✅ **Final Summary** - Complete diagnostic summary

## Expected Output

You'll see output like:

```
🔍 ========================================
🔍 DEBUG TEST - PRODUCTION ENVIRONMENT
🔍 ========================================
🔍 [DEBUG] Frontend URL: https://dellsystemmanager.vercel.app
🔍 [DEBUG] Backend URL: https://geosyntec-backend-ugea.onrender.com
🔍 [DEBUG] Test user: your-email@example.com
✅ [DEBUG] Confirmed: Targeting PRODUCTION

🔍 [DEBUG] Step 1: Attempting login...
✅ [DEBUG] Login completed
🔍 [DEBUG] Current URL after login: https://dellsystemmanager.vercel.app/dashboard

🔍 [DEBUG] Step 2: Testing API call directly...
🔍 [DEBUG] API Endpoint: https://geosyntec-backend-ugea.onrender.com/api/projects
🔍 [DEBUG] API Response Status: 200
✅ [DEBUG] API call successful
✅ [DEBUG] Found project ID via API: abc-123-def-456

... (more detailed logs)

📊 ========================================
📊 [DEBUG] FINAL SUMMARY
📊 ========================================
  - Frontend URL: https://dellsystemmanager.vercel.app
  - Backend URL: https://geosyntec-backend-ugea.onrender.com
  - Login: ✅ Success
  - Project ID found: abc-123-def-456
  - Total cookies: 5
  - Auth cookies: 2
  - localStorage auth keys: 1
📊 ========================================
```

## Troubleshooting

### If Test Fails with "Credentials Not Set"

Make sure you've set `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`:

```bash
# Check if they're set
echo $TEST_USER_EMAIL
echo $TEST_USER_PASSWORD

# If not, set them:
export TEST_USER_EMAIL=your-email@example.com
export TEST_USER_PASSWORD=your-password
```

### If Test Shows "Not Targeting Production"

The test will warn you if it's not using production URLs. Check:
- `PLAYWRIGHT_TEST_BASE_URL` environment variable
- Default in `tests/helpers/service-urls.ts`

### If API Returns 401

This means authentication failed. Check:
- Test user credentials are correct
- User exists in Supabase
- Cookies are being sent with API requests

### If API Returns Empty Array

This means:
- User has no projects in database
- OR authentication token not being sent properly
- OR backend query issue

The debug test will help identify which one.

