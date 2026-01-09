# Timeout & Retry Implementation Summary

## Changes Made

### 1. Increased Timeout Values

**Files Modified:**
- `frontend/src/lib/config.ts`
- `frontend/src/lib/apiClient.ts`

**Changes:**
- Backend timeout increased from **10 seconds** to **60 seconds**
- This accounts for Render cold starts which can take 30-60 seconds

**Rationale:**
Render free tier services spin down after ~15 minutes of inactivity. When they wake up (cold start), they can take 30-60 seconds to become responsive. The previous 10-second timeout was too short.

---

### 2. Added Retry Logic with Exponential Backoff

**File Modified:**
- `frontend/src/lib/api.ts` - `makeAuthenticatedRequest()` function

**Implementation:**
- **Max Retries**: 3 attempts
- **Exponential Backoff**: 1s, 2s, 4s delays between retries
- **Progressive Timeout**: Timeout increases with each retry attempt (60s, 120s, 180s)

**Retry Conditions:**
- Timeout errors (`AbortError`, `TimeoutError`)
- Network errors (`Failed to fetch`)
- Transient server errors (502, 503)

**Non-Retryable Errors:**
- Authentication errors (401, 403)
- Client errors (400, 404)
- Rate limit errors (429) - handled separately

**Example Flow:**
```
Attempt 1: Timeout after 60s → Wait 1s → Retry
Attempt 2: Timeout after 120s → Wait 2s → Retry  
Attempt 3: Timeout after 180s → Fail with error
```

---

### 3. Keep-Alive Ping System

**Files Created:**
- `scripts/keep-alive-ping.js` - Node.js script to ping services
- `.github/workflows/keep-alive.yml` - GitHub Actions workflow

**Purpose:**
Prevents Render services from spinning down by pinging them every 10 minutes.

**Usage Options:**

**Option A: GitHub Actions (Recommended)**
- Automatically runs every 10 minutes via cron
- No additional infrastructure needed
- Free for public repositories

**Option B: Local Cron Job**
```bash
# Add to crontab (crontab -e)
*/10 * * * * cd /path/to/project && node scripts/keep-alive-ping.js
```

**Option C: Manual Execution**
```bash
node scripts/keep-alive-ping.js
```

**Option D: External Service**
- Use services like UptimeRobot, Pingdom, or cron-job.org
- Set to ping every 5-10 minutes:
  - `https://geosyntec-backend-ugea.onrender.com/health`
  - `https://quality-control-quality-assurance.onrender.com/health`

---

### 4. Updated Playwright Test Timeouts

**File Modified:**
- `tests/e2e/ai-chat.spec.ts`

**Changes:**
- Test timeout increased from 180s to **300s** (5 minutes)
- API request timeout increased from 120s to **180s** (3 minutes)

**Rationale:**
AI service responses can be slow, especially during cold starts or when processing complex requests.

---

## Configuration

### Environment Variables

The keep-alive script uses these environment variables (optional):
- `BACKEND_URL` - Defaults to `https://geosyntec-backend-ugea.onrender.com`
- `AI_SERVICE_URL` - Defaults to `https://quality-control-quality-assurance.onrender.com`

### GitHub Actions Secrets (Optional)

If you want to override URLs in GitHub Actions:
- `BACKEND_URL` - Backend service URL
- `AI_SERVICE_URL` - AI service URL

---

## Testing

### Test the Changes Locally

1. **Test Retry Logic:**
   ```bash
   # Temporarily set a short timeout to trigger retries
   # Edit frontend/src/lib/config.ts: timeout: 5000
   # Then make a request - you should see retry logs
   ```

2. **Test Keep-Alive Script:**
   ```bash
   node scripts/keep-alive-ping.js
   ```

3. **Test Playwright Tests:**
   ```bash
   RUN_LIVE_AI_TESTS=true npm run test:e2e
   ```

---

## Monitoring

### Check if Services Stay Warm

1. **Render Dashboard:**
   - Go to Render Dashboard
   - Check service logs
   - Look for frequent health check requests

2. **GitHub Actions:**
   - Go to Actions tab
   - Check "Keep-Alive Ping" workflow
   - Should run every 10 minutes

3. **Service Response Times:**
   - First request after idle: 30-60s (cold start)
   - Subsequent requests: <1s (warm)

---

## Troubleshooting

### Issue: Services Still Timing Out

**Possible Causes:**
1. Keep-alive not running frequently enough
2. Services taking longer than 60s to cold start
3. Network issues

**Solutions:**
1. Increase ping frequency (every 5 minutes instead of 10)
2. Increase timeout further (to 90s or 120s)
3. Check Render service status/logs

### Issue: Too Many Retries Causing Slow UI

**Possible Causes:**
1. Services consistently slow
2. Network issues

**Solutions:**
1. Upgrade Render plan (services stay warm)
2. Check network connectivity
3. Reduce max retries (from 3 to 2)

### Issue: GitHub Actions Not Running

**Possible Causes:**
1. Workflow file not committed
2. Cron syntax incorrect
3. Repository not public (free tier limitation)

**Solutions:**
1. Ensure `.github/workflows/keep-alive.yml` is committed
2. Check GitHub Actions tab for errors
3. Consider using external cron service instead

---

## Performance Impact

### Positive Impacts:
- ✅ Reduced timeout errors
- ✅ Better user experience (automatic retries)
- ✅ Services stay warm (faster responses)

### Potential Concerns:
- ⚠️ Longer wait times on first request (up to 60s)
- ⚠️ More retry attempts = more server load
- ⚠️ Keep-alive pings = minimal server load

---

## Next Steps

1. **Enable GitHub Actions:**
   - Commit `.github/workflows/keep-alive.yml`
   - Push to repository
   - Verify workflow runs in Actions tab

2. **Monitor for 24-48 Hours:**
   - Check if services stay warm
   - Monitor timeout error rates
   - Adjust ping frequency if needed

3. **Consider Upgrading:**
   - If cold starts are still problematic, consider upgrading Render plan
   - Paid plans keep services warm automatically

---

## Files Changed

### Modified:
- `frontend/src/lib/config.ts` - Increased timeout to 60s
- `frontend/src/lib/apiClient.ts` - Increased timeout to 60s, max retries to 3
- `frontend/src/lib/api.ts` - Added retry logic with exponential backoff
- `tests/e2e/ai-chat.spec.ts` - Increased test timeouts

### Created:
- `scripts/keep-alive-ping.js` - Keep-alive ping script
- `.github/workflows/keep-alive.yml` - GitHub Actions workflow
- `TIMEOUT_RETRY_IMPLEMENTATION.md` - This documentation

---

## Summary

✅ **Timeouts**: Increased from 10s to 60s  
✅ **Retry Logic**: 3 attempts with exponential backoff  
✅ **Keep-Alive**: GitHub Actions pings every 10 minutes  
✅ **Test Timeouts**: Increased for AI tests  

These changes should significantly reduce timeout errors and improve reliability when dealing with Render cold starts.

