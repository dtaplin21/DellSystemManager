# Firewall Configuration Guide for Supabase PostgreSQL

## Quick Start

Your router firewall is blocking PostgreSQL ports (6543, 5432). Follow these steps to allow database connections.

---

## Step 1: Access Router Admin Panel

1. **Open browser** and navigate to:
   - `http://setup.ui.com` 
   - OR `http://10.10.0.1`

2. **Login** with router admin credentials
   - If you don't know credentials, check router label or contact network admin

---

## Step 2: Navigate to Firewall Settings

Common locations (varies by router brand):
- **Advanced** → **Firewall**
- **Security** → **Firewall Rules**
- **Network** → **Firewall**
- **Settings** → **Security** → **Firewall**
- **Firewall** → **Rules**

Look for sections like:
- "Outbound Rules"
- "Egress Rules"
- "Firewall Rules"
- "Access Control"

---

## Step 3: Add Firewall Rule

### Option A: Single Rule for Both Ports (Recommended)

**Rule Configuration:**
- **Rule Name**: `Supabase PostgreSQL`
- **Action**: `ALLOW` or `PERMIT`
- **Direction**: `OUTBOUND` or `EGRESS`
- **Protocol**: `TCP`
- **Destination Port**: `6543, 5432` (or separate rules for each)
- **Destination**: `aws-0-us-east-2.pooler.supabase.com`
  - OR use IP addresses: `13.59.95.192`, `3.13.175.194`, `3.139.14.59`
- **Source**: `Any` or `10.10.0.0/24` (your local network)
- **Status**: `Enabled`

### Option B: Separate Rules for Each Port

**Rule 1: Supabase Pooler Port**
- **Rule Name**: `Supabase Pooler (6543)`
- **Action**: `ALLOW`
- **Direction**: `OUTBOUND`
- **Protocol**: `TCP`
- **Destination Port**: `6543`
- **Destination**: `aws-0-us-east-2.pooler.supabase.com`
- **Status**: `Enabled`

**Rule 2: Supabase Direct Port**
- **Rule Name**: `Supabase Direct (5432)`
- **Action**: `ALLOW`
- **Direction**: `OUTBOUND`
- **Protocol**: `TCP`
- **Destination Port**: `5432`
- **Destination**: `aws-0-us-east-2.pooler.supabase.com`
- **Status**: `Enabled`

---

## Step 4: Save and Apply Rules

1. Click **"Save"** or **"Apply"**
2. Wait for router to apply changes (may take 30-60 seconds)
3. Router may restart - wait for it to come back online

---

## Step 5: Verify Configuration

### Test 1: Command Line Test
```bash
# Test pooler port (6543)
nc -zv aws-0-us-east-2.pooler.supabase.com 6543

# Test direct port (5432)
nc -zv aws-0-us-east-2.pooler.supabase.com 5432
```

**Expected Output (Success):**
```
Connection to aws-0-us-east-2.pooler.supabase.com port 6543 [tcp/*] succeeded!
```

**If Still Failing:**
- Wait 1-2 minutes for router to apply rules
- Check router logs for rule application
- Verify rule is enabled/active
- Try restarting router

### Test 2: Backend Connection Test
```bash
# Run comprehensive diagnosis
node backend/scripts/comprehensive-db-diagnosis.js

# Should show:
# ✅ TCP Port 6543: PASS
# ✅ TCP Port 5432: PASS
```

### Test 3: Backend Server Test
```bash
# Restart backend server
cd backend && npm run dev

# Check logs for:
# ✅ Successfully connected to PostgreSQL database
```

---

## Router-Specific Instructions

### For Ubiquiti/UniFi Routers
1. Go to **Settings** → **Firewall & Security** → **Firewall Rules**
2. Click **"Create New Rule"**
3. Set:
   - **Name**: `Supabase PostgreSQL`
   - **Action**: `Accept`
   - **Direction**: `Outbound`
   - **Protocol**: `TCP`
   - **Destination Port**: `6543, 5432`
   - **Destination**: `aws-0-us-east-2.pooler.supabase.com`
4. **Save** and **Apply**

### For TP-Link Routers
1. Go to **Advanced** → **Firewall** → **Access Control**
2. Click **"Add"**
3. Set:
   - **Rule Name**: `Supabase PostgreSQL`
   - **Action**: `Allow`
   - **Direction**: `Outbound`
   - **Protocol**: `TCP`
   - **Destination Port**: `6543, 5432`
   - **Destination IP**: `13.59.95.192`
4. **Save**

### For Netgear Routers
1. Go to **Advanced** → **Firewall Rules**
2. Click **"Add Outbound Service"**
3. Set:
   - **Service Name**: `Supabase PostgreSQL`
   - **Action**: `ALLOW always`
   - **Protocol**: `TCP`
   - **Destination Port**: `6543, 5432`
   - **Destination IP**: `aws-0-us-east-2.pooler.supabase.com`
4. **Apply**

### For ASUS Routers
1. Go to **Firewall** → **General** → **Firewall Rules**
2. Click **"Add"**
3. Set:
   - **Rule Name**: `Supabase PostgreSQL`
   - **Action**: `Accept`
   - **Direction**: `Outbound`
   - **Protocol**: `TCP`
   - **Destination Port**: `6543, 5432`
   - **Destination**: `aws-0-us-east-2.pooler.supabase.com`
4. **Apply**

### For Generic Routers
Look for:
- **Firewall** → **Outbound Rules**
- **Security** → **Firewall** → **Egress Rules**
- **Advanced** → **Firewall** → **Rules**

---

## Troubleshooting

### Issue: Can't Access Router Admin Panel
**Solutions:**
- Try `http://10.10.0.1` instead of `setup.ui.com`
- Check router label for default IP/credentials
- Reset router to factory defaults (last resort)

### Issue: No Firewall Settings Visible
**Solutions:**
- Check if you're logged in as admin (not guest)
- Look for "Advanced" or "Expert" mode
- Some routers hide firewall settings - check documentation

### Issue: Rule Added But Still Blocked
**Solutions:**
1. **Verify rule is enabled**: Check rule status is "Active" or "Enabled"
2. **Check rule order**: Some routers apply rules in order - ensure ALLOW rule comes before DENY rules
3. **Wait for propagation**: Router may take 1-2 minutes to apply rules
4. **Restart router**: Power cycle router to ensure rules are applied
5. **Check for conflicting rules**: Look for DENY rules that might override ALLOW rule

### Issue: Router Doesn't Support Hostname Rules
**Solutions:**
- Use IP addresses instead: `13.59.95.192`, `3.13.175.194`, `3.139.14.59`
- Create separate rules for each IP if needed
- Some routers require IP ranges - use CIDR notation if supported

### Issue: Still Blocked After Configuration
**Solutions:**
1. **Test from different network** (mobile hotspot) to confirm it's router-specific
2. **Check ISP firewall**: Some ISPs block database ports - contact ISP
3. **Check VPN**: If using VPN, configure VPN firewall rules
4. **Check macOS firewall**: Verify macOS firewall isn't blocking (unlikely for outbound)

---

## Verification Checklist

After configuration, verify:

- [ ] Router firewall rule is **enabled/active**
- [ ] Rule allows **OUTBOUND** connections
- [ ] Rule allows **TCP** protocol
- [ ] Rule allows ports **6543** and **5432**
- [ ] Rule destination is **Supabase hostname or IPs**
- [ ] `nc -zv` test **succeeds**
- [ ] Backend diagnosis script **shows PASS**
- [ ] Backend server **connects successfully**

---

## Configuration File

A configuration file has been created: `firewall-rules.txt`

This file contains:
- Firewall rule specifications
- Testing commands
- IP addresses and ports

Use this as reference when configuring router.

---

## Quick Reference

**Supabase Connection Details:**
- **Hostname**: `aws-0-us-east-2.pooler.supabase.com`
- **IP Addresses**: `13.59.95.192`, `3.13.175.194`, `3.139.14.59`
- **Pooler Port**: `6543`
- **Direct Port**: `5432`
- **Protocol**: `TCP`
- **Direction**: `OUTBOUND`

**Router Details:**
- **Router IP**: `10.10.0.1`
- **Router Hostname**: `setup.ui.com`
- **Admin URL**: `http://10.10.0.1` or `http://setup.ui.com`

**Testing Commands:**
```bash
# Test connectivity
nc -zv aws-0-us-east-2.pooler.supabase.com 6543
nc -zv aws-0-us-east-2.pooler.supabase.com 5432

# Run comprehensive test
node backend/scripts/comprehensive-db-diagnosis.js

# Check IP ban status
node backend/scripts/check-ip-ban.js
```

---

## Need Help?

If you're still having issues:

1. **Check router documentation** for firewall configuration
2. **Contact network administrator** if router is managed
3. **Test from mobile hotspot** to confirm router is the issue
4. **Check router logs** for firewall rule application

---

## Next Steps After Configuration

1. ✅ Verify firewall rules are active
2. ✅ Test connectivity with `nc -zv`
3. ✅ Run comprehensive diagnosis script
4. ✅ Restart backend server
5. ✅ Monitor backend logs for successful connections
6. ✅ Test frontend to ensure projects load

---

**Last Updated**: 2025-11-20  
**Router**: setup.ui.com (10.10.0.1)

