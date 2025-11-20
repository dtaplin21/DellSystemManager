# Router Admin Panel Not Accessible - Solutions

## Problem
Router at `10.10.0.1` (`setup.ui.com`) doesn't have accessible web admin interface.

## Router Type Analysis
Based on hostname `setup.ui.com`, this is likely a **Ubiquiti/UniFi router**, which:
- ✅ Are reachable (ping works)
- ❌ Don't have web admin on router itself
- ✅ Are managed via UniFi Controller software/app

---

## Solution 1: Use UniFi Controller (If UniFi Router)

### Option A: UniFi Controller Software
1. **Download UniFi Controller**:
   - Mac: https://www.ui.com/download/unifi/
   - Or use UniFi Cloud Portal: https://unifi.ui.com

2. **Access Controller**:
   - If controller is running locally: `https://localhost:8443`
   - If cloud-managed: Login at https://unifi.ui.com
   - If controller on network: Find controller IP/URL

3. **Configure Firewall**:
   - Navigate to: **Settings** → **Firewall & Security** → **Firewall Rules**
   - Add outbound rule for ports 6543, 5432

### Option B: UniFi Mobile App
1. **Install UniFi app** (iOS/Android)
2. **Login** to UniFi account
3. **Select network** → **Firewall Rules**
4. **Add outbound rule**

---

## Solution 2: Contact Network Administrator

Since router admin isn't accessible, router may be:
- Managed by ISP
- Managed by company IT
- Managed by property manager
- Cloud-managed by someone else

**What to Request:**
```
Please add firewall rule to allow outbound connections:

Rule Name: Supabase PostgreSQL
Action: ALLOW
Direction: OUTBOUND
Protocol: TCP
Destination Ports: 6543, 5432
Destination: aws-0-us-east-2.pooler.supabase.com
OR IPs: 13.59.95.192, 3.13.175.194, 3.139.14.59
```

---

## Solution 3: Use Mobile Hotspot (Temporary)

**Immediate workaround** while investigating router access:

1. **Enable mobile hotspot** on phone
2. **Connect Mac to hotspot**
3. **Test connection**:
   ```bash
   nc -zv aws-0-us-east-2.pooler.supabase.com 6543
   ```
4. **If works**: Confirms router firewall is blocking
5. **Run backend on hotspot** to continue development

**To use hotspot:**
```bash
# Connect to hotspot via WiFi settings
# Then test:
nc -zv aws-0-us-east-2.pooler.supabase.com 6543

# If successful, restart backend:
cd backend && npm run dev
```

---

## Solution 4: Check for SSH Access

Some routers allow SSH configuration:

```bash
# Try SSH to router
ssh admin@10.10.0.1

# If SSH works, you may be able to configure firewall via CLI
# (Requires router-specific commands)
```

**Note**: Most home routers don't allow SSH, but enterprise routers might.

---

## Solution 5: Check Router Brand/Model

**To identify router:**
1. **Check router physically** - look for brand/model label
2. **Check network settings** - may show router info
3. **Check `setup.ui.com`** - may redirect to management portal

**Common router types:**
- **Ubiquiti/UniFi**: Managed via UniFi Controller
- **Enterprise routers**: May require management software
- **ISP routers**: May have admin disabled, require ISP access
- **Cloud-managed**: May require cloud portal login

---

## Solution 6: Try Alternative Admin Ports

Some routers use non-standard ports:

Try these URLs:
- `http://10.10.0.1:8080`
- `http://10.10.0.1:8443`
- `http://10.10.0.1:8888`
- `https://10.10.0.1:8443`
- `http://setup.ui.com:8080`

---

## Immediate Action Plan

### Step 1: Try UniFi Controller
1. Check if UniFi Controller is installed
2. Try accessing: `https://localhost:8443`
3. Or login to: https://unifi.ui.com

### Step 2: Use Mobile Hotspot (Temporary)
1. Enable hotspot on phone
2. Connect Mac to hotspot
3. Test database connection
4. If works, continue development on hotspot

### Step 3: Contact Network Admin
1. Identify who manages router
2. Request firewall rule addition
3. Provide rule details (see above)

---

## Testing After Configuration

Once firewall is configured (via any method):

```bash
# Test connection
nc -zv aws-0-us-east-2.pooler.supabase.com 6543

# Run full diagnosis
node backend/scripts/comprehensive-db-diagnosis.js

# Restart backend
cd backend && npm run dev
```

---

## What We Know

✅ Router IP: `10.10.0.1`  
✅ Router hostname: `setup.ui.com`  
✅ Router is reachable (ping works)  
❌ Web admin not accessible (ports 80/443 refused)  
⚠️ Likely UniFi/Ubiquiti router (requires Controller software)

---

## Next Steps

1. **Check for UniFi Controller** - Try `https://localhost:8443` or https://unifi.ui.com
2. **Use mobile hotspot** - Temporary workaround to continue development
3. **Contact network admin** - Request firewall rule if router is managed
4. **Check router label** - Identify brand/model for specific instructions

