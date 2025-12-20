# Troubleshooting iPhone Connection to Backend

## Current Error
- **Error Code**: -1001 (Request Timeout)
- **Trying to connect to**: `http://192.168.22.170:8003/api/auth/user`
- **Issue**: Connection times out before reaching the server

## Diagnosis Steps

### 1. Verify Backend is Running

Check if the backend server is running on port 8003:

```bash
# Check if port 8003 is listening
lsof -i :8003

# Or check process
ps aux | grep "node.*server.js"
```

**Expected**: Should show Node.js process listening on port 8003

**If not running**: Start the backend:
```bash
cd /Users/dtaplin21/DellSystemManager
npm run dev:backend
```

---

### 2. Check macOS Firewall

The macOS Firewall might be blocking incoming connections on port 8003.

**Check Firewall Status**:
1. System Settings → Network → Firewall
2. Check if Firewall is ON

**If Firewall is ON**:
- Option A: Add Node.js to allowed apps
  - Click "Options" → "Add" → Select Node.js
  - Or allow incoming connections for Node.js

- Option B: Temporarily disable firewall for testing
  ```bash
  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
  ```
  **Remember to re-enable after testing!**

- Option C: Allow port 8003 specifically
  ```bash
  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node
  ```

---

### 3. Verify Mac's Current IP Address

The Mac's IP might have changed. Check current IP:

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**If IP changed**: Update `QC APP/QC-APP-Info.plist` with new IP

---

### 4. Test Network Connectivity

**From Mac, test if iPhone can reach Mac**:
```bash
# Ping iPhone from Mac (if you know iPhone's IP)
ping -c 3 [iPhone IP]

# Or test if Mac is reachable on port 8003
curl http://192.168.22.170:8003/api/health
```

**From iPhone**:
- Make sure iPhone and Mac are on the same Wi-Fi network
- Check iPhone's Wi-Fi settings → IP Address (should be in same subnet: 192.168.22.x)

---

### 5. Test Backend Locally First

Verify backend works locally:

```bash
# From Mac terminal
curl http://localhost:8003/api/health
curl http://192.168.22.170:8003/api/health
```

**Expected**: Should return `{"status":"ok"}` or similar

**If localhost works but IP doesn't**: Firewall or network issue

---

### 6. Check Backend Server Logs

Look at backend terminal output for:
- Connection attempts from iPhone
- Error messages
- Authentication failures

**Expected**: Should see connection attempts when iPhone tries to connect

**If no connection attempts**: Network/firewall blocking

---

## Quick Fixes

### Fix 1: Disable Firewall Temporarily (Testing Only)

```bash
# Disable
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off

# Test iPhone connection

# Re-enable (IMPORTANT!)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
```

### Fix 2: Allow Node.js Through Firewall

1. System Settings → Network → Firewall → Options
2. Find Node.js in the list
3. Set to "Allow incoming connections"
4. If not listed, click "+" and add Node.js manually

### Fix 3: Verify Same Network

- **Mac**: System Settings → Network → Wi-Fi → Check network name
- **iPhone**: Settings → Wi-Fi → Check network name
- **Must match!**

### Fix 4: Restart Backend Server

```bash
# Stop backend (Ctrl+C in terminal)
# Then restart
cd /Users/dtaplin21/DellSystemManager
npm run dev:backend
```

---

## Common Issues

### Issue: "Connection Refused" (Different from timeout)
- **Cause**: Backend not running or wrong port
- **Fix**: Start backend server

### Issue: "Request Timeout" (Current error)
- **Cause**: Firewall blocking or network issue
- **Fix**: Check firewall settings, verify same network

### Issue: "Could not connect to server"
- **Cause**: Wrong IP address or Mac not reachable
- **Fix**: Verify Mac's IP, update Info.plist

---

## Verification Checklist

- [ ] Backend server is running (`lsof -i :8003` shows process)
- [ ] Backend responds to `curl http://localhost:8003/api/health`
- [ ] Backend responds to `curl http://192.168.22.170:8003/api/health`
- [ ] macOS Firewall allows Node.js or is disabled
- [ ] Mac and iPhone are on same Wi-Fi network
- [ ] Mac's IP is still `192.168.22.170` (check with `ifconfig`)
- [ ] `QC APP/QC-APP-Info.plist` has correct IP address
- [ ] Backend logs show connection attempts from iPhone

---

## Next Steps

1. **First**: Verify backend is running and accessible locally
2. **Second**: Check firewall settings
3. **Third**: Verify network connectivity
4. **Fourth**: Test from iPhone again

If all checks pass but still timing out, try:
- Restarting Wi-Fi on both devices
- Restarting backend server
- Using a different port (if 8003 is blocked by ISP/router)

