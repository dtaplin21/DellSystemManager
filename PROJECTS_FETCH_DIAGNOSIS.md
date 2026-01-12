# Projects Fetch 401 Error Diagnosis

## Problem
Frontend is getting `401 Unauthorized` when fetching projects, even though:
- Session exists: `hasSession: true`
- Access token is present: `accessToken: Present`
- Request is sent with `Authorization: Bearer <token>`

## Root Cause Analysis

### Backend Authentication Flow
1. Frontend sends: `Authorization: Bearer <supabase_access_token>`
2. Backend middleware (`backend/middlewares/auth.js`) extracts token
3. Backend calls: `supabase.auth.getUser(token)` to verify token
4. Backend returns 401 if verification fails

### Possible Issues

#### Issue 1: Backend Supabase Client Configuration
**Location**: `backend/db/index.js` line 518
```javascript
const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey;
```

**Problem**: If `SUPABASE_SERVICE_ROLE_KEY` is not set, backend falls back to anon key. The anon key may not have permission to verify user tokens.

**Solution**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Render backend environment variables.

#### Issue 2: Token Expiration
**Problem**: Supabase access tokens expire after 1 hour. If the token is expired, `getUser()` will fail.

**Solution**: Frontend should refresh tokens automatically, but there may be a race condition.

#### Issue 3: Backend URL Mismatch
**Problem**: Frontend might be calling wrong backend URL.

**Check**: Verify `NEXT_PUBLIC_BACKEND_URL` in Vercel matches `geosyntec-backend-ugea.onrender.com`

#### Issue 4: CORS Issues
**Problem**: Authorization header might be blocked by CORS.

**Check**: Verify backend CORS configuration allows the frontend origin.

## Diagnostic Steps

### Step 1: Check Backend Environment Variables (Render)
Go to Render Dashboard → Backend Service → Environment Variables

**Required Variables:**
- ✅ `SUPABASE_URL` - Should be set
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - **CRITICAL** - Must be set (not anon key)
- ✅ `SUPABASE_ANON_KEY` - Optional fallback

**Action**: If `SUPABASE_SERVICE_ROLE_KEY` is missing, add it from Supabase Dashboard → Settings → API → Service Role Key

### Step 2: Check Frontend Environment Variables (Vercel)
Go to Vercel Dashboard → Project → Settings → Environment Variables

**Required Variables:**
- ✅ `NEXT_PUBLIC_BACKEND_URL` - Should be `https://geosyntec-backend-ugea.onrender.com`
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Should match backend SUPABASE_URL
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Should be set

### Step 3: Check Backend Logs
Go to Render Dashboard → Backend Service → Logs

**Look for:**
- `[AUTH] Token verification returned no user` - Token invalid/expired
- `[AUTH] Supabase connection timeout` - Supabase unreachable
- `[AUTH] Missing Authorization header` - Token not sent
- `[AUTH] Invalid token` - Token format wrong

### Step 4: Test Token Manually
```bash
# Get token from browser console (localStorage)
# Then test with curl:
curl -H "Authorization: Bearer <YOUR_TOKEN>" \
     https://geosyntec-backend-ugea.onrender.com/api/projects
```

## Most Likely Fix

### Fix 1: Add SUPABASE_SERVICE_ROLE_KEY to Render Backend

1. Go to Supabase Dashboard → Settings → API
2. Copy the **Service Role Key** (not the anon key)
3. Go to Render Dashboard → Backend Service → Environment Variables
4. Add: `SUPABASE_SERVICE_ROLE_KEY` = `<service_role_key>`
5. Restart the backend service

### Fix 2: Verify Token Refresh

The frontend should automatically refresh expired tokens. Check if `ProjectsProvider` waits for token refresh before fetching.

**File**: `frontend/src/contexts/ProjectsProvider.tsx`
- Already has session readiness check (lines 115-148)
- May need to wait longer for token refresh

### Fix 3: Add Better Error Logging

Add more detailed logging in backend auth middleware to see exact Supabase error:

```javascript
// In backend/middlewares/auth.js line 91-93
const result = await supabase.auth.getUser(token);
if (result.error) {
  logger.error('[AUTH] Supabase getUser error', {
    message: result.error.message,
    status: result.error.status,
    code: result.error.code
  });
}
```

## Quick Test

Test if backend can verify tokens:

```bash
# In Render backend shell or locally:
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);
supabase.auth.getUser('YOUR_TOKEN_HERE').then(r => console.log(r));
"
```

## Expected Behavior After Fix

1. Frontend sends request with `Authorization: Bearer <token>`
2. Backend extracts token
3. Backend calls `supabase.auth.getUser(token)` with SERVICE_ROLE_KEY
4. Supabase verifies token and returns user
5. Backend queries database for user profile
6. Backend returns projects for that user

## Related Files

- `backend/middlewares/auth.js` - Authentication middleware
- `backend/db/index.js` - Supabase client initialization
- `frontend/src/lib/api.ts` - Frontend API client
- `frontend/src/contexts/ProjectsProvider.tsx` - Projects fetching logic

