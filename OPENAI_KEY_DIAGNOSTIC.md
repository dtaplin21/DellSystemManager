# OpenAI API Key Diagnostic Guide

## Problem Summary

Your OpenAI API key is failing with these common issues:

1. **Rate Limit Errors (429)** - Most common
2. **Invalid/Expired Key** - Less common
3. **Missing Key in Environment** - Configuration issue
4. **Quota Exceeded** - Billing issue

## Diagnostic Steps

### 1. Check Rate Limits (Most Likely Issue)

**Symptoms:**
```
Rate limit reached for gpt-4o in organization org-XXX on tokens per min (TPM): 
Limit 30000, Used 14576, Requested 15625. Please try again in 402ms.
```

**Solution:**
- **Immediate**: Wait for the rate limit window to reset (usually 1 minute)
- **Short-term**: Implement retry logic with exponential backoff (already partially implemented)
- **Long-term**: 
  - Upgrade OpenAI plan for higher rate limits
  - Implement request queuing/throttling
  - Use multiple API keys with load balancing

**Check Your Current Limits:**
1. Go to: https://platform.openai.com/account/limits
2. Check your **Rate Limits**:
   - **TPM** (Tokens Per Minute): Usually 30,000 for free tier
   - **RPM** (Requests Per Minute): Usually 3,000 for free tier
3. Check your **Usage**:
   - Go to: https://platform.openai.com/usage
   - See if you're hitting limits frequently

### 2. Verify Key is Set in Render

**Backend Service (`geosyntec-backend-ugea`):**
1. Go to Render Dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Verify `OPENAI_API_KEY` is set
5. Check that the value matches your key (should start with `sk-proj-` or `sk-`)

**AI Service (`quality-control-quality-assurance`):**
1. Go to Render Dashboard
2. Select your AI service
3. Go to **Environment** tab
4. Verify `OPENAI_API_KEY` is set
5. Ensure it's the same key as the backend (or a different valid key)

### 3. Test Key Validity

**Option A: Using OpenAI Dashboard**
1. Go to: https://platform.openai.com/api-keys
2. Check if your key is listed and active
3. Check if it has the right permissions

**Option B: Using curl (from your local machine)**
```bash
export OPENAI_API_KEY="your-key-here"
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

Should return a list of models. If you get `401 Unauthorized`, the key is invalid.

**Option C: Check Render Logs**
1. Go to Render Dashboard
2. Select your backend or AI service
3. Go to **Logs** tab
4. Look for errors like:
   - `401 Unauthorized` → Invalid key
   - `429 Rate Limit` → Rate limit exceeded
   - `insufficient_quota` → Billing/quota issue

### 4. Check Billing/Quota

**Symptoms:**
```
Error: You exceeded your current quota, please check your plan and billing details.
```

**Solution:**
1. Go to: https://platform.openai.com/account/billing
2. Check:
   - **Current Usage** - Are you over your limit?
   - **Payment Method** - Is it valid?
   - **Billing History** - Any failed payments?

### 5. Verify Key Format

**Valid Formats:**
- `sk-proj-...` (Project-level key - recommended)
- `sk-...` (Account-level key)

**Invalid Formats:**
- Keys starting with `sk_test_` (test keys don't work in production)
- Keys that are too short (< 40 characters)
- Keys with spaces or newlines

### 6. Check Organization/Project

**Symptoms:**
```
Error: Invalid API key provided
```

**Solution:**
1. Go to: https://platform.openai.com/account/org-settings
2. Verify you're using the correct organization
3. If using project keys, verify the project is active

## Common Fixes

### Fix 1: Add Retry Logic (Already Partially Implemented)

The code already has some retry logic, but we can improve it:

**Backend (`backend/routes/ai.js`):**
- Already handles 429 errors with retry
- Could add exponential backoff for OpenAI-specific errors

**AI Service (`ai_service/openai_service.py`):**
- Needs retry logic for rate limits
- Should catch `RateLimitError` and retry

### Fix 2: Implement Request Throttling

**Option A: Use a Queue System**
- Queue OpenAI requests
- Process them at a rate that stays under limits
- Use Redis/BullMQ for job queuing

**Option B: Add Rate Limiting Middleware**
- Track requests per minute
- Reject requests if approaching limit
- Return 503 with `Retry-After` header

### Fix 3: Upgrade OpenAI Plan

1. Go to: https://platform.openai.com/account/billing/overview
2. Click **Upgrade** or **Manage Plan**
3. Choose a plan with higher rate limits:
   - **Free Tier**: 30,000 TPM, 3,000 RPM
   - **Tier 1**: Higher limits (varies by plan)
   - **Tier 2+**: Even higher limits

### Fix 4: Use Multiple Keys (Load Balancing)

If you have multiple API keys:
1. Create a key rotation system
2. Distribute requests across keys
3. Monitor usage per key
4. Rotate when approaching limits

## Quick Test Script

Create a test script to verify your key:

```bash
# Save this as test-openai-key.sh
#!/bin/bash

KEY="${OPENAI_API_KEY:-$1}"

if [ -z "$KEY" ]; then
  echo "Usage: $0 <OPENAI_API_KEY>"
  exit 1
fi

echo "Testing OpenAI API key..."
echo "Key prefix: ${KEY:0:10}..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  https://api.openai.com/v1/models)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Key is valid!"
  echo "Available models: $(echo "$BODY" | jq -r '.data[].id' | head -5)"
elif [ "$HTTP_CODE" = "401" ]; then
  echo "❌ Key is invalid (401 Unauthorized)"
  echo "Response: $BODY"
elif [ "$HTTP_CODE" = "429" ]; then
  echo "⚠️ Rate limit exceeded (429)"
  echo "Wait a minute and try again"
else
  echo "❌ Unexpected error ($HTTP_CODE)"
  echo "Response: $BODY"
fi
```

Run it:
```bash
chmod +x test-openai-key.sh
./test-openai-key.sh "your-key-here"
```

## Next Steps

1. **Immediate**: Check Render logs for specific error messages
2. **Short-term**: Implement retry logic with exponential backoff
3. **Long-term**: 
   - Upgrade OpenAI plan if hitting limits frequently
   - Implement request queuing/throttling
   - Monitor usage and set up alerts

## Monitoring

Set up alerts for:
- Rate limit errors (429)
- Quota exceeded errors
- Invalid key errors (401)
- High token usage

You can monitor these in:
- Render logs
- OpenAI dashboard (https://platform.openai.com/usage)
- Application logs (if you add logging)

