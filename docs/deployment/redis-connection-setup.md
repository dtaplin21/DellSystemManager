# Redis Connection Setup Guide

## Overview

Your Redis service (`geosyntec-redis`) is available and running. To connect your worker service to Redis, you need to set the `REDIS_URL` environment variable.

## Step-by-Step Instructions

### 1. Get Your Internal Redis URL

From your Redis dashboard:
- **Internal Redis URL**: `redis://red-d5e4rg7pm1nc73cefnl0:6379`
- **Region**: Oregon
- **Status**: ✓ Available

**Important**: Use the **Internal** URL (not External) for services in the same region. This is more secure and faster.

### 2. Add REDIS_URL to Worker Service

1. Go to your Render Dashboard
2. Navigate to your **Worker Service** (likely named `geosyntec-worker` or similar)
3. Click on **Environment** in the left sidebar
4. Click **Add Environment Variable**
5. Set:
   - **Key**: `REDIS_URL`
   - **Value**: `redis://red-d5e4rg7pm1nc73cefnl0:6379`
6. Click **Save Changes**

### 3. Verify Both Services Are in Same Region

**Critical**: Both services must be in the same region for internal networking to work.

- **Redis**: Oregon ✓
- **Worker**: Should also be Oregon

To check/change worker region:
1. Go to Worker Service → Settings
2. Verify **Region** is set to **Oregon**
3. If different, you may need to recreate the service in Oregon (or use External URL, but Internal is preferred)

### 4. Restart Worker Service

After adding the environment variable:
1. Go to Worker Service → **Manual Deploy**
2. Click **Deploy latest commit** (or trigger a new deployment)
3. Monitor the logs to verify connection

### 5. Verify Connection

Check worker logs for:
- ✅ `[JobQueue] Redis connected`
- ✅ `[JobQueue] Redis ready`
- ✅ `[JobQueue] Redis connection verified with PING`
- ✅ `[Worker] Automation worker started and ready to process jobs`

If you see errors:
- ❌ `ECONNREFUSED` → Check region match and URL format
- ❌ `Connection timeout` → Check network/firewall settings
- ❌ `Authentication failed` → Check if Redis requires password (Free tier usually doesn't)

## Best Practices

### ✅ DO:
- Use **Internal Redis URL** for services in the same region
- Keep all services in the **same region** (Oregon)
- Use environment variables (not hardcoded URLs)
- Monitor logs after deployment

### ❌ DON'T:
- Use External URL if services are in the same region (slower, less secure)
- Mix regions (Oregon + other regions won't work with internal URLs)
- Hardcode Redis URLs in code
- Use Redis password if not required (Free tier doesn't need it)

## Troubleshooting

### Issue: Still Getting ECONNREFUSED

**Check 1**: Verify environment variable is set
- Go to Worker Service → Environment
- Confirm `REDIS_URL` exists and value matches exactly

**Check 2**: Verify region match
- Redis: Oregon
- Worker: Oregon (must match)

**Check 3**: Verify service names
- Redis service ID: `red-d5e4rg7pm1nc73cefnl0`
- URL format: `redis://red-d5e4rg7pm1nc73cefnl0:6379`

**Check 4**: Check Redis status
- Go to Redis dashboard → Verify status is "Available"
- Check Redis logs for any errors

### Issue: Connection Timeout

- Wait a few minutes after adding environment variable
- Restart the worker service
- Check if Redis service is running (should show "Available")

### Issue: Worker Still Crashing

The worker has been updated to exit gracefully if Redis isn't available. If it's still crashing:
1. Check worker logs for the specific error
2. Verify the environment variable was saved correctly
3. Ensure you've deployed the latest code with the graceful exit fix

## Additional Services That May Need Redis

If you have other services that use Redis:

### Backend API Service
- Add `REDIS_URL` environment variable (same value)
- Used for: Job queue initialization (optional, fails gracefully)

### AI Service
- Uses individual config: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- Or can use `REDIS_URL` if code supports it
- Used for: CrewAI/LiteLLM caching (optional)

## Security Notes

- **Internal URLs** are only accessible within Render's private network
- **External URLs** require authentication and are accessible from the internet
- For production, prefer Internal URLs when possible
- Free tier Redis has no persistence (acceptable for job queues since jobs are also stored in PostgreSQL)

## Next Steps After Connection

Once Redis is connected:
1. ✅ Worker will start successfully
2. ✅ Background automation jobs will be queued
3. ✅ Jobs will be processed by the worker
4. ✅ You can monitor job status via API endpoints

## Verification Checklist

- [ ] `REDIS_URL` environment variable added to worker service
- [ ] Value matches internal Redis URL exactly
- [ ] Both services are in Oregon region
- [ ] Worker service restarted after adding variable
- [ ] Worker logs show "Redis connected"
- [ ] Worker logs show "Automation worker started"
- [ ] No more `ECONNREFUSED` errors

