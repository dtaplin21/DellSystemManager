# Database Connection Failure Diagnosis

## Problem
Both ports (6543 and 5432) are failing to connect to Supabase.

## Root Cause Analysis

### Issue 1: Hostname Mismatch (CRITICAL)
**Problem**: When switching from pooler port (6543) to direct port (5432), we're only changing the port but keeping the pooler hostname (`*.pooler.supabase.com`).

**Impact**: Supabase may require different hostnames for pooler vs direct connections:
- Pooler: `aws-0-us-east-2.pooler.supabase.com:6543`
- Direct: `aws-0-us-east-2.supabase.co:5432` (different hostname pattern)

**Current Code Issue**: 
```javascript
// modifyConnectionPort() only changes port, not hostname
function modifyConnectionPort(connString, newPort) {
  const url = new URL(connString);
  url.port = newPort.toString();  // ❌ Only changes port
  return url.toString();
}
```

### Issue 2: IP Address Ban (LIKELY)
**Problem**: Supabase uses Fail2ban which automatically bans IPs after multiple failed connection attempts. Bans last 30 minutes.

**Symptoms**:
- Both ports fail immediately
- Connection timeouts
- "Connection refused" errors

**Detection**: Need to check if IP is banned via Supabase dashboard or CLI.

### Issue 3: Connection String Format
**Problem**: Supabase connection strings have different formats for pooler vs direct:
- Pooler: Uses `*.pooler.supabase.com` hostname
- Direct: May use `*.supabase.co` or same hostname but different connection parameters

### Issue 4: SSL/TLS Requirements
**Problem**: Supabase requires SSL for all connections. Current code sets `rejectUnauthorized: false` which should work, but might need explicit SSL mode in connection string.

## Proposed Fixes

### Fix 1: Hostname Transformation (HIGH PRIORITY)
When switching to direct connection (port 5432), also transform the hostname:
- Remove `.pooler` from hostname
- Change `.com` to `.co` (if applicable)
- Or use a different hostname pattern for direct connections

**Implementation**:
```javascript
function modifyConnectionForDirect(connString) {
  const url = new URL(connString);
  
  // Transform hostname for direct connection
  if (url.hostname.includes('.pooler.supabase.com')) {
    // Remove .pooler and change .com to .co
    url.hostname = url.hostname
      .replace('.pooler.supabase.com', '.supabase.co')
      .replace('.pooler.supabase.co', '.supabase.co');
  }
  
  url.port = '5432';
  return url.toString();
}
```

### Fix 2: IP Ban Detection and Handling (HIGH PRIORITY)
Add detection for IP bans and provide clear error messages:
- Check error messages for ban indicators
- Log clear instructions on how to unban IP
- Add retry logic with exponential backoff

**Implementation**:
```javascript
function isIPBannedError(error) {
  return error.message.includes('banned') ||
         error.message.includes('blocked') ||
         error.code === 'ECONNREFUSED' ||
         (error.message.includes('connection refused') && 
          error.message.includes('supabase'));
}

if (isIPBannedError(error)) {
  logger.error('IP address may be banned by Supabase Fail2ban', {
    instructions: [
      '1. Check Supabase Dashboard → Database Settings → Unban IP',
      '2. Wait 30 minutes for automatic unban',
      '3. Use CLI: supabase network-bans remove --db-unban-ip <ip>'
    ]
  });
}
```

### Fix 3: Connection String Parameter Adjustment
Add required connection parameters for direct connections:
- `sslmode=require` (explicit SSL requirement)
- `connect_timeout=10` (shorter timeout)
- Other Supabase-specific parameters

### Fix 4: Better Error Logging
Enhance error messages to show:
- Which hostname:port combination was tried
- Specific error codes and messages
- Suggestions for resolution

## Testing Strategy

1. **Test Hostname Transformation**:
   - Try direct connection with transformed hostname
   - Compare with original pooler hostname

2. **Check IP Ban Status**:
   - Use Supabase dashboard to check banned IPs
   - Test from different IP if possible

3. **Test Connection String Formats**:
   - Try different hostname patterns
   - Test with explicit SSL parameters

4. **Network Diagnostics**:
   - Test DNS resolution for both hostnames
   - Test TCP connectivity to both ports
   - Check IPv6 compatibility

## Recommended Implementation Order

1. **Fix 2 (IP Ban Detection)** - Most likely cause, quick to implement
2. **Fix 1 (Hostname Transformation)** - Critical for direct connections
3. **Fix 3 (Connection Parameters)** - May resolve SSL issues
4. **Fix 4 (Better Logging)** - Helps with future debugging

## Next Steps

1. Check Supabase dashboard for IP bans
2. Test hostname transformation manually
3. Implement fixes in order of priority
4. Add comprehensive error handling
5. Test with both connection types

