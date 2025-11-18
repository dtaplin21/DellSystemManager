# Database Connection Fix - Automatic Port Fallback

## Problem
The Supabase connection was failing because port **6543** (connection pooler) was blocked or unreachable. All connection attempts were timing out.

## Solution
Implemented **automatic port fallback** with three connection modes:

### 1. **Auto Mode** (Default)
- Automatically tests both ports (6543 and 5432) on first connection attempt
- Uses whichever port is accessible
- Falls back to port 5432 (direct connection) if pooler port fails
- No configuration needed - works out of the box

### 2. **Direct Mode** (`SUPABASE_CONNECTION_MODE=direct`)
- Forces use of port 5432 (direct connection)
- Bypasses connection pooler
- Use when pooler port is blocked

### 3. **Pooler Mode** (`SUPABASE_CONNECTION_MODE=pooler`)
- Forces use of port 6543 (connection pooler)
- Use when you know pooler is accessible

## How It Works

1. **On Startup:**
   - Validates connection string format
   - Checks `SUPABASE_CONNECTION_MODE` environment variable
   - Initializes pool with appropriate port (or auto-detects)

2. **On First Query (Auto Mode):**
   - Tests current port (6543 if in connection string)
   - If it fails, tests alternative port (5432)
   - Caches the working port for future queries
   - Logs which port is being used

3. **On Subsequent Queries:**
   - Uses the optimized connection string
   - Creates temporary pools with optimized port if needed
   - Falls back to original pool if optimized connection fails

## Configuration

### Environment Variable
```bash
# Auto mode (default) - tests both ports automatically
SUPABASE_CONNECTION_MODE=auto

# Direct connection only (port 5432)
SUPABASE_CONNECTION_MODE=direct

# Pooler connection only (port 6543)
SUPABASE_CONNECTION_MODE=pooler
```

### No Configuration Needed
If you don't set `SUPABASE_CONNECTION_MODE`, it defaults to `auto` mode and will automatically find the working port.

## Logging

The system logs connection decisions:
- `Supabase connection mode` - Shows which mode is active
- `Auto mode: optimizing connection port...` - When testing ports
- `✅ Connection optimized` - When port optimization succeeds
- `PostgreSQL connection pool initialized` - Final connection configuration

## Testing

Run the diagnostic script to test both ports:
```bash
cd backend
node scripts/diagnose-db-connection.js
```

## Benefits

1. **Automatic** - No manual configuration needed
2. **Resilient** - Automatically finds working port
3. **Fast** - Tests ports quickly (3 second timeout per test)
4. **Non-breaking** - Works with existing connection strings
5. **Flexible** - Can override with environment variable

## Technical Details

- Port testing uses 3-second timeout per port
- Connection optimization happens on first query attempt
- Optimized connection string is cached for performance
- Temporary pools are created only when needed
- Original pool is preserved as fallback

## Troubleshooting

If connections still fail:
1. Check logs for which port is being used
2. Try setting `SUPABASE_CONNECTION_MODE=direct` explicitly
3. Verify `DATABASE_URL` is correct
4. Run diagnostic script to see detailed port tests
5. Check firewall/network settings

