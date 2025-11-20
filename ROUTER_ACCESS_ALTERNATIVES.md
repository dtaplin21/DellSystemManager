# Router Admin Panel Not Accessible - Alternative Solutions

## Problem
Router admin panel at `http://10.10.0.1` returns `ERR_CONNECTION_REFUSED`.

## Possible Reasons
1. Router doesn't have web admin interface
2. Router admin is disabled
3. Router uses different IP address
4. Router requires different protocol (HTTPS)
5. Router is managed by ISP/network admin
6. Router uses different port for admin

---

## Solution 1: Find Correct Router IP Address

### Method A: Check Network Settings
```bash
# Check default gateway (this is usually router IP)
netstat -rn | grep default

# Check ARP table for router MAC
arp -a | grep "10.10.0"

# Check network info
networksetup -getinfo "Wi-Fi"
```

### Method B: Check Router Label
- Look for sticker on router
- Check for "Admin URL" or "Management IP"
- Common IPs: `192.168.1.1`, `192.168.0.1`, `10.0.0.1`

### Method C: Try Common Router IPs
Try these in browser:
- `http://192.168.1.1`
- `http://192.168.0.1`
- `http://10.0.0.1`
- `http://172.16.0.1`
- `https://10.10.0.1` (with HTTPS)

---

## Solution 2: Router May Not Have Web Interface

Some routers (especially ISP-provided or enterprise routers) don't have web admin panels.

### Alternative: Contact Network Administrator
If router is managed by:
- **ISP**: Contact ISP support to configure firewall
- **Company IT**: Contact IT department
- **Landlord/Property Manager**: Request firewall configuration

**What to Request:**
- Allow outbound TCP connections to:
  - Host: `aws-0-us-east-2.pooler.supabase.com`
  - Ports: `6543`, `5432`
  - IPs: `13.59.95.192`, `3.13.175.194`, `3.139.14.59`

---

## Solution 3: Use Mobile Hotspot (Temporary Workaround)

If you can't configure router firewall, use mobile hotspot:

1. **Enable mobile hotspot** on your phone
2. **Connect Mac to hotspot**
3. **Test connection**:
   ```bash
   nc -zv aws-0-us-east-2.pooler.supabase.com 6543
   ```
4. **If works**: Router firewall is definitely the issue
5. **Run backend** on hotspot connection

**Limitation**: Not permanent solution, but confirms diagnosis

---

## Solution 4: Check Router Brand/Model

Different router brands use different admin interfaces:

### Ubiquiti/UniFi
- Usually managed via UniFi Controller software
- May not have web interface on router itself
- Requires UniFi Controller app/software

### Enterprise Routers
- May require SSH access
- May require management software
- May be cloud-managed

### ISP Routers
- May have admin disabled
- May require ISP access
- May use custom management portal

---

## Solution 5: Check if Router Uses Different Port

Some routers use non-standard ports for admin:

Try these URLs:
- `http://10.10.0.1:8080`
- `http://10.10.0.1:8443`
- `http://10.10.0.1:8888`
- `https://10.10.0.1:8443`

---

## Solution 6: Check Router Documentation

1. **Find router brand/model**:
   - Check router label
   - Check network settings for router info
   - Check `setup.ui.com` - may be router hostname

2. **Search online**:
   - "[Router Brand] [Model] admin panel access"
   - "[Router Brand] default IP address"
   - "[Router Brand] firewall configuration"

---

## Solution 7: Use Router Mobile App

Many modern routers have mobile apps:
- Check App Store/Play Store for router brand
- Look for "[Brand] Router" or "[Brand] Network" app
- May allow firewall configuration via app

---

## Solution 8: Check if Router is Cloud-Managed

Some routers are managed via cloud:
- Check router documentation for cloud portal
- May need to create account on manufacturer website
- Firewall rules configured via cloud dashboard

---

## Immediate Workaround: Use Mobile Hotspot

While investigating router access, you can:

1. **Connect to mobile hotspot**
2. **Test database connection**:
   ```bash
   nc -zv aws-0-us-east-2.pooler.supabase.com 6543
   ```
3. **If connection works**: Confirms router firewall is blocking
4. **Run backend on hotspot** to continue development

---

## Next Steps

1. **Try alternative IPs** (see Solution 1)
2. **Check router label** for admin URL/IP
3. **Contact network admin** if router is managed
4. **Use mobile hotspot** as temporary workaround
5. **Check router brand** and search for admin access method

---

## What Information Do We Need?

To help further, please provide:
- Router brand/model (check label)
- Who manages the router (you, ISP, company IT)
- Can you see router physically? (to check label)
- Is this home network or corporate network?

