# Static IP Setup Guide

## Current Network Configuration

- **Current IP**: `192.168.22.170`
- **Subnet Mask**: `255.255.252.0` (CIDR: /22)
- **Router IP**: See command output below
- **Network Range**: `192.168.20.0` - `192.168.23.255`
- **Mac MAC Address**: `36:83:68:bc:70:24` (for router reservation)

## Setting Static IP on macOS

### Method 1: System Settings (Recommended)

1. **Open System Settings**
   - Click Apple menu → System Settings
   - Or press `⌘,` (Command + Comma)

2. **Navigate to Network**
   - Click "Network" in the sidebar
   - Select "Wi-Fi" (or your active connection)

3. **Open Network Details**
   - Click "Details..." button next to your network name

4. **Configure TCP/IP**
   - Click "TCP/IP" tab
   - Change "Configure IPv4" dropdown from "Using DHCP" to "Manually"

5. **Enter Static IP Settings**
   - **IPv4 Address**: `192.168.22.170`
   - **Subnet Mask**: `255.255.252.0`
   - **Router**: `[Your Router IP]` (see command output)
   - **DNS Servers**: 
     - `8.8.8.8` (Google DNS)
     - `8.8.4.4` (Google DNS backup)
     - Or use your router's DNS: `[Router IP]`

6. **Apply Changes**
   - Click "OK" to save
   - Click "Apply" in the main Network window
   - You may need to reconnect to Wi-Fi

### Method 2: Command Line (Advanced)

```bash
# Get current network interface name
networksetup -listallhardwareports | grep -A 1 "Wi-Fi"

# Set static IP (replace en0 with your interface name)
sudo networksetup -setmanual "Wi-Fi" 192.168.22.170 255.255.252.0 [Router IP]

# Set DNS servers
sudo networksetup -setdnsservers "Wi-Fi" 8.8.8.8 8.8.4.4

# Verify settings
networksetup -getinfo "Wi-Fi"
```

## Verify Static IP

After setting the static IP, verify it's working:

```bash
# Check current IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Test connectivity
ping -c 3 8.8.8.8

# Test router connectivity
ping -c 3 [Router IP]
```

## Important Notes

1. **IP Conflict Prevention**: Make sure `192.168.22.170` is not assigned to another device by your router's DHCP
2. **Router Configuration**: You may want to exclude this IP from DHCP pool in router settings
3. **Backup**: Note your current DHCP settings before changing, in case you need to revert
4. **Network Changes**: If you change networks (different Wi-Fi), you'll need to reconfigure

## Troubleshooting

### Can't Connect After Setting Static IP

1. **Check Router IP**: Make sure router IP is correct
2. **Check Subnet**: Verify subnet mask matches your network
3. **Check DNS**: Try using router IP as DNS server
4. **Revert to DHCP**: If issues persist, switch back to DHCP temporarily

### IP Conflict Detected

- Another device may be using `192.168.22.170`
- Change to a different IP in the same subnet (e.g., `192.168.22.171`)
- Update `QC APP/QC-APP-Info.plist` with new IP

## Router IP Reservation (RECOMMENDED - Easier Method)

Instead of setting static IP on Mac, reserve the IP in your router. This is easier and avoids conflicts!

**Your Mac's MAC Address**: `36:83:68:bc:70:24`

### Steps:

1. **Find Your Router IP**
   - Open System Settings → Network → Wi-Fi → Details → TCP/IP
   - Look for "Router" IP address (usually `192.168.20.1` or `192.168.22.1`)
   - Or try accessing: `http://192.168.20.1` or `http://192.168.22.1` in a browser

2. **Log Into Router Admin Panel**
   - Open browser and go to router IP (from step 1)
   - Enter admin username/password (check router label or default: admin/admin)

3. **Find DHCP Reservations**
   - Look for: "DHCP Reservations", "Static IP Assignment", "Address Reservation", or "IP Reservation"
   - Common locations: Advanced → DHCP Settings, or Network → DHCP

4. **Add Reservation**
   - Click "Add" or "New Reservation"
   - Enter:
     - **MAC Address**: `36:83:68:bc:70:24`
     - **IP Address**: `192.168.22.170`
     - **Hostname**: `MacBook-Air` (optional, for reference)
   - Save/Apply changes

5. **Restart Network Connection**
   - On your Mac: System Settings → Network → Wi-Fi → Turn off and on
   - Or disconnect and reconnect to Wi-Fi
   - Your Mac should now get `192.168.22.170` automatically

6. **Verify**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Should show `192.168.22.170`

**Benefits of this method:**
- ✅ Mac stays on DHCP (easier to manage)
- ✅ No manual IP configuration needed
- ✅ Avoids IP conflicts
- ✅ Works even if you change networks temporarily
- ✅ Router manages the reservation automatically

This method is recommended over setting static IP on the Mac!

