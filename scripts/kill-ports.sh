#!/bin/bash

# Kill processes on ports 3000, 6379, and 8003
# Run this script before starting dev:all

echo "🔍 Finding processes on ports 3000, 6379, and 8003..."

# Port 3000 (Frontend)
PIDS_3000=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$PIDS_3000" ]; then
  echo "Killing processes on port 3000: $PIDS_3000"
  kill -9 $PIDS_3000 2>/dev/null
fi

# Port 6379 (Redis)
PIDS_6379=$(lsof -ti:6379 2>/dev/null)
if [ ! -z "$PIDS_6379" ]; then
  echo "Killing processes on port 6379: $PIDS_6379"
  kill -9 $PIDS_6379 2>/dev/null
fi

# Port 8003 (Backend)
PIDS_8003=$(lsof -ti:8003 2>/dev/null)
if [ ! -z "$PIDS_8003" ]; then
  echo "Killing processes on port 8003: $PIDS_8003"
  kill -9 $PIDS_8003 2>/dev/null
fi

# Also kill by process name (more aggressive)
pkill -f "redis-server" 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
pkill -f "next dev" 2>/dev/null

sleep 1

# Verify ports are clear
echo ""
echo "✅ Checking if ports are clear..."
if lsof -i:3000 -i:6379 -i:8003 2>/dev/null | grep -q LISTEN; then
  echo "⚠️  Some ports are still in use:"
  lsof -i:3000 -i:6379 -i:8003 2>/dev/null | grep LISTEN
  echo ""
  echo "You may need to manually kill these processes or restart your terminal."
else
  echo "✅ All ports are clear! You can now run 'npm run dev:all'"
fi

