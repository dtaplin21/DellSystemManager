#!/bin/bash

# DellSystemManager MCP Setup Script
# This script sets up MCP for both internal team and external customers

echo "🚀 Setting up DellSystemManager MCP Server..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the backend/mcp directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing MCP dependencies..."
npm install

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p ../../logs

# Test the server
echo "🧪 Testing MCP server..."
node test-mcp.js
if [ $? -eq 0 ]; then
    echo "✅ MCP server test passed"
else
    echo "❌ MCP server test failed"
    exit 1
fi

# Create Claude Desktop config
echo "🔧 Creating Claude Desktop configuration..."

# Detect OS and set config path
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
    CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CLAUDE_CONFIG_DIR="$HOME/.config/claude"
    CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    CLAUDE_CONFIG_DIR="$APPDATA/Claude"
    CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
else
    echo "❌ Unsupported operating system: $OSTYPE"
    exit 1
fi

# Create Claude config directory if it doesn't exist
mkdir -p "$CLAUDE_CONFIG_DIR"

# Copy the config file
cp claude-desktop-config.json "$CONFIG_FILE"
echo "✅ Claude Desktop config created at: $CONFIG_FILE"

echo ""
echo "🎉 MCP Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Restart Claude Desktop"
echo "2. Look for the 🔌 icon in Claude Desktop"
echo "3. Test with: 'Show me all projects in DellSystemManager'"
echo ""
echo "Available tools:"
echo "• get_projects - List all projects"
echo "• get_project_panels - Get panels for a project"
echo "• get_asbuilt_records - Get as-built records"
echo "• search_records - Search records by text"
echo "• generate_report - Generate project reports"
echo "• query_database - Execute SQL queries (internal only)"
echo "• import_asbuilt_excel - Import Excel files (internal only)"
echo ""
echo "To test the server manually:"
echo "  cd /Users/dtaplin21/DellSystemManager/backend/mcp"
echo "  node server.js"
echo ""
echo "To view logs:"
echo "  tail -f ../../logs/mcp-combined.log"
