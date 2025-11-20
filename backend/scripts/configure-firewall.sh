#!/bin/bash
# Firewall Configuration Script for Supabase PostgreSQL Connections
# This script helps configure firewall rules to allow database connections

set -e

echo "🔧 Firewall Configuration for Supabase PostgreSQL"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_HOST="aws-0-us-east-2.pooler.supabase.com"
SUPABASE_IPS=("13.59.95.192" "3.13.175.194" "3.139.14.59")
POOLER_PORT=6543
DIRECT_PORT=5432
ROUTER_IP="10.10.0.1"
ROUTER_HOST="setup.ui.com"

echo "📋 Configuration Details:"
echo "  Supabase Host: $SUPABASE_HOST"
echo "  Supabase IPs: ${SUPABASE_IPS[*]}"
echo "  Pooler Port: $POOLER_PORT"
echo "  Direct Port: $DIRECT_PORT"
echo "  Router: $ROUTER_HOST ($ROUTER_IP)"
echo ""

# Check macOS Firewall
echo "🔍 Step 1: Checking macOS Firewall..."
MACOS_FIREWALL_STATE=$(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>&1 | grep -i "enabled\|disabled" || echo "unknown")

if [[ "$MACOS_FIREWALL_STATE" == *"enabled"* ]]; then
    echo -e "${YELLOW}⚠️  macOS Firewall is enabled${NC}"
    echo "   Note: macOS firewall typically doesn't block outbound connections"
    echo "   But you may want to check if Node.js is allowed"
    echo ""
    echo "   To check Node.js firewall status:"
    echo "   /usr/libexec/ApplicationFirewall/socketfilterfw --listapps | grep -i node"
    echo ""
else
    echo -e "${GREEN}✅ macOS Firewall is disabled or not blocking outbound${NC}"
fi
echo ""

# Check router accessibility
echo "🔍 Step 2: Checking Router Accessibility..."
if ping -c 1 -W 1 "$ROUTER_IP" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Router is reachable at $ROUTER_IP${NC}"
else
    echo -e "${RED}❌ Router is not reachable at $ROUTER_IP${NC}"
    echo "   Please check your network connection"
    exit 1
fi
echo ""

# Test current connectivity
echo "🔍 Step 3: Testing Current Database Connectivity..."
if nc -zv -G 3 "$SUPABASE_HOST" "$POOLER_PORT" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Port $POOLER_PORT is already accessible!${NC}"
    echo "   Firewall may already be configured correctly"
    exit 0
else
    echo -e "${RED}❌ Port $POOLER_PORT is blocked${NC}"
    echo "   Firewall configuration needed"
fi
echo ""

# Generate firewall rule instructions
echo "📝 Step 4: Firewall Rule Configuration Instructions"
echo "=================================================="
echo ""
echo "You need to configure your router firewall to allow outbound connections."
echo ""
echo "Router Admin Panel:"
echo "  URL: http://$ROUTER_IP"
echo "  OR: http://$ROUTER_HOST"
echo ""
echo "Required Firewall Rules:"
echo "-----------------------"
echo ""
echo "Rule 1: Allow Outbound TCP to Supabase Pooler Port"
echo "  Action: ALLOW"
echo "  Direction: OUTBOUND"
echo "  Protocol: TCP"
echo "  Destination Port: $POOLER_PORT"
echo "  Destination: $SUPABASE_HOST"
echo "  OR Destination IP: ${SUPABASE_IPS[0]}"
echo ""
echo "Rule 2: Allow Outbound TCP to Supabase Direct Port"
echo "  Action: ALLOW"
echo "  Direction: OUTBOUND"
echo "  Protocol: TCP"
echo "  Destination Port: $DIRECT_PORT"
echo "  Destination: $SUPABASE_HOST"
echo "  OR Destination IP: ${SUPABASE_IPS[0]}"
echo ""
echo "Alternative: Single Rule for Both Ports"
echo "  Action: ALLOW"
echo "  Direction: OUTBOUND"
echo "  Protocol: TCP"
echo "  Destination Ports: $POOLER_PORT, $DIRECT_PORT"
echo "  Destination: $SUPABASE_HOST"
echo "  OR Destination IPs: ${SUPABASE_IPS[*]}"
echo ""

# Router-specific instructions
echo "📖 Common Router Configuration Steps:"
echo "-----------------------------------"
echo ""
echo "1. Open router admin panel:"
echo "   Open browser and go to: http://$ROUTER_IP"
echo ""
echo "2. Navigate to Firewall/Security settings"
echo "   Common locations:"
echo "   - Advanced > Firewall"
echo "   - Security > Firewall Rules"
echo "   - Network > Firewall"
echo "   - Settings > Security"
echo ""
echo "3. Add Outbound Rule:"
echo "   - Click 'Add Rule' or 'Create Rule'"
echo "   - Set Action: ALLOW"
echo "   - Set Direction: OUTBOUND (or EGRESS)"
echo "   - Set Protocol: TCP"
echo "   - Set Destination Port: $POOLER_PORT (or both $POOLER_PORT and $DIRECT_PORT)"
echo "   - Set Destination: $SUPABASE_HOST"
echo "   - Save/Apply rule"
echo ""
echo "4. Verify rule is active"
echo ""
echo "5. Test connection:"
echo "   nc -zv $SUPABASE_HOST $POOLER_PORT"
echo ""

# Generate router config file (if supported)
echo "💾 Step 5: Generating Configuration File..."
cat > firewall-rules.txt << EOF
# Supabase PostgreSQL Firewall Rules
# Generated: $(date)

# Rule 1: Supabase Pooler Port (6543)
# Action: ALLOW
# Direction: OUTBOUND
# Protocol: TCP
# Destination Port: 6543
# Destination Host: aws-0-us-east-2.pooler.supabase.com
# Destination IPs: 13.59.95.192, 3.13.175.194, 3.139.14.59

# Rule 2: Supabase Direct Port (5432)
# Action: ALLOW
# Direction: OUTBOUND
# Protocol: TCP
# Destination Port: 5432
# Destination Host: aws-0-us-east-2.pooler.supabase.com
# Destination IPs: 13.59.95.192, 3.13.175.194, 3.139.14.59

# Testing Commands:
# Test pooler port: nc -zv aws-0-us-east-2.pooler.supabase.com 6543
# Test direct port: nc -zv aws-0-us-east-2.pooler.supabase.com 5432
# Test from backend: node backend/scripts/comprehensive-db-diagnosis.js
EOF

echo -e "${GREEN}✅ Configuration file created: firewall-rules.txt${NC}"
echo ""

# Test script
echo "🧪 Step 6: Testing Script Available"
echo "-----------------------------------"
echo "After configuring firewall, run:"
echo "  node backend/scripts/comprehensive-db-diagnosis.js"
echo ""
echo "Or test manually:"
echo "  nc -zv $SUPABASE_HOST $POOLER_PORT"
echo "  nc -zv $SUPABASE_HOST $DIRECT_PORT"
echo ""

echo "✅ Firewall configuration guide complete!"
echo ""
echo "Next Steps:"
echo "1. Access router admin panel: http://$ROUTER_IP"
echo "2. Add firewall rules as described above"
echo "3. Test connection: nc -zv $SUPABASE_HOST $POOLER_PORT"
echo "4. Restart backend server if needed"
echo ""

