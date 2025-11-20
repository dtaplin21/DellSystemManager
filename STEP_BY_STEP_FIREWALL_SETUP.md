# Step-by-Step Firewall Configuration Guide

## What I Can Do vs. What You Need to Do

### ✅ I Can Do (Automated):
- **Step 3**: Test connection after you configure firewall
- **Step 4**: Restart backend server (if needed)

### ❌ I Cannot Do (Requires Manual Access):
- **Step 1**: Access router admin panel (requires browser + login)
- **Step 2**: Add firewall rules (requires router web interface)

---

## Step 1: Access Router Admin Panel

### What You Need to Do:

1. **Open your web browser** (Chrome, Safari, Firefox, etc.)

2. **Navigate to router admin panel**:
   ```
   http://10.10.0.1
   ```
   OR
   ```
   http://setup.ui.com
   ```

3. **Login with router credentials**:
   - **Default credentials** are often on a sticker on the router
   - Common defaults:
     - Username: `admin` / Password: `admin`
     - Username: `admin` / Password: `password`
     - Username: `admin` / Password: (blank)
   - If you changed them, use your custom credentials
   - If you don't remember, you may need to reset router

4. **If login page doesn't appear**:
   - Try `https://10.10.0.1` (with https)
   - Check router label for default IP address
   - Try `http://192.168.1.1` (common alternative)
   - Check router documentation

### Visual Guide:
```
Browser → Address Bar → Type: http://10.10.0.1 → Press Enter
→ Login Page Appears → Enter Username/Password → Click Login
```

### Troubleshooting:
- **"Page not found"**: Router might use different IP, check router label
- **"Connection refused"**: Router might be down, check power/network
- **"Login failed"**: Check credentials or reset router

---

## Step 2: Add Firewall Rules

### What You Need to Do:

#### A. Navigate to Firewall Settings

Once logged into router admin panel, find firewall settings:

**Common Locations** (try these in order):
1. **Advanced** → **Firewall**
2. **Security** → **Firewall Rules**
3. **Network** → **Firewall**
4. **Settings** → **Security** → **Firewall**
5. **Firewall** → **Rules**
6. **Access Control** → **Firewall**

**Look for tabs/sections like:**
- "Outbound Rules"
- "Egress Rules"
- "Firewall Rules"
- "Access Control"
- "Port Forwarding" (different, but may have firewall settings)

#### B. Add New Firewall Rule

Click **"Add Rule"**, **"Create Rule"**, **"New Rule"**, or similar button.

#### C. Configure Rule Settings

Fill in these fields:

**Required Fields:**
- **Rule Name**: `Supabase PostgreSQL` (or any name you prefer)
- **Action**: `ALLOW` or `PERMIT` (NOT "Deny" or "Block")
- **Direction**: `OUTBOUND` or `EGRESS` (NOT "Inbound")
- **Protocol**: `TCP` (select from dropdown)
- **Destination Port**: `6543` (or `6543, 5432` if router supports multiple ports)
- **Destination**: `aws-0-us-east-2.pooler.supabase.com`
  - OR use IP address: `13.59.95.192`
- **Status**: `Enabled` or `Active` (check the checkbox)

**Optional Fields** (if available):
- **Source**: Leave as `Any` or `10.10.0.0/24`
- **Description**: "Allow Supabase database connections"

#### D. Save the Rule

1. Click **"Save"**, **"Apply"**, or **"OK"** button
2. Wait for router to process (may take 30-60 seconds)
3. Router may show "Applying changes..." message
4. Some routers require you to click "Apply" again on main firewall page

#### E. Add Second Rule (if router doesn't support multiple ports)

If you can only add one port per rule, create a second rule:

**Rule 2:**
- **Rule Name**: `Supabase Direct Port`
- **Action**: `ALLOW`
- **Direction**: `OUTBOUND`
- **Protocol**: `TCP`
- **Destination Port**: `5432`
- **Destination**: `aws-0-us-east-2.pooler.supabase.com` or `13.59.95.192`
- **Status**: `Enabled`

### Visual Guide:
```
Router Admin → Firewall → Add Rule → Fill Fields → Save → Apply
```

### Router-Specific Instructions:

#### If Router Uses IP Addresses Instead of Hostnames:
- Use: `13.59.95.192` (primary Supabase IP)
- Or create rules for all three IPs:
  - `13.59.95.192`
  - `3.13.175.194`
  - `3.139.14.59`

#### If Router Requires Port Range:
- Use: `6543-6543` and `5432-5432`
- Or: `5432-6543` (if router allows range)

#### If Router Has Rule Priority/Order:
- Ensure ALLOW rule comes **before** any DENY rules
- Move rule to top of list if possible

### Troubleshooting:

**"Rule already exists"**:
- Check if rule is already there but disabled
- Enable existing rule instead of creating new one

**"Invalid destination"**:
- Try using IP address instead of hostname
- Check if router requires specific format

**"Cannot save rule"**:
- Check if you have admin privileges
- Try logging out and back in
- Check router documentation

**"Rule saved but not working"**:
- Verify rule is **enabled/active**
- Check rule order (ALLOW before DENY)
- Wait 1-2 minutes for router to apply
- Restart router if needed

---

## Step 3: Test Connection ✅ (I Can Do This)

After you configure the firewall, I can test the connection for you.

**Command I'll run:**
```bash
nc -zv aws-0-us-east-2.pooler.supabase.com 6543
```

**What Success Looks Like:**
```
Connection to aws-0-us-east-2.pooler.supabase.com port 6543 [tcp/*] succeeded!
```

**What Failure Looks Like:**
```
nc: connectx to aws-0-us-east-2.pooler.supabase.com port 6543 (tcp) failed: Operation timed out
```

**If Still Failing:**
- Wait 1-2 more minutes (router may need time to apply)
- Verify rule is enabled in router admin
- Check router logs for errors
- Try restarting router

---

## Step 4: Restart Backend Server ✅ (I Can Do This)

After firewall is configured and connection test passes, I can restart the backend server.

**What I'll do:**
1. Check if backend is running
2. Stop backend server (if running)
3. Start backend server
4. Monitor logs for successful database connection

**What Success Looks Like:**
```
✅ Successfully connected to PostgreSQL database
✅ Database connection pool initialized
```

**What Failure Looks Like:**
```
❌ Connection terminated due to connection timeout
```

---

## Complete Workflow

### Your Part (Manual):
1. ✅ Open browser → `http://10.10.0.1`
2. ✅ Login to router
3. ✅ Navigate to Firewall settings
4. ✅ Add firewall rule (ports 6543, 5432)
5. ✅ Save and apply rule
6. ✅ Wait 1-2 minutes

### My Part (Automated):
7. ✅ Test connection: `nc -zv aws-0-us-east-2.pooler.supabase.com 6543`
8. ✅ Run full diagnosis: `node backend/scripts/comprehensive-db-diagnosis.js`
9. ✅ Restart backend server (if needed)
10. ✅ Verify database connection in logs

---

## Quick Checklist

Before you start:
- [ ] Browser is open
- [ ] You know router login credentials
- [ ] Router is powered on and connected

During configuration:
- [ ] Accessed router admin panel (`http://10.10.0.1`)
- [ ] Logged in successfully
- [ ] Found Firewall settings
- [ ] Created OUTBOUND rule
- [ ] Set ports: 6543, 5432
- [ ] Set destination: Supabase hostname or IP
- [ ] Rule is ENABLED/ACTIVE
- [ ] Saved and applied rule

After configuration:
- [ ] Wait 1-2 minutes for router to apply
- [ ] Tell me to test connection
- [ ] I'll verify and restart backend

---

## Need Help?

If you get stuck on any step:

1. **Can't access router**: Check router label for IP/credentials
2. **Can't find firewall settings**: Check router documentation or try "Advanced" menu
3. **Rule not working**: Verify rule is enabled, check rule order, wait longer
4. **Still blocked**: Test from mobile hotspot to confirm it's router-specific

---

## After You Complete Steps 1-2

Once you've added the firewall rule and saved it, **let me know** and I'll:
1. Test the connection
2. Run full diagnosis
3. Restart backend server
4. Verify everything is working

Just say: **"Firewall configured, please test"** or similar, and I'll handle the rest!

