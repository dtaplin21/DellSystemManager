# DellSystemManager MCP Server

Model Context Protocol (MCP) server for DellSystemManager, providing AI tools for both internal team and external customers.

## 🚀 Quick Start

### 1. Setup (One-time)
```bash
cd backend/mcp
./setup-mcp.sh
```

### 2. Use with Claude Desktop
1. Restart Claude Desktop
2. Look for the 🔌 icon in Claude Desktop
3. Test with: "Show me all projects in DellSystemManager"

## 🛠️ Available Tools

### Internal Tools (Team Only)
- `get_projects` - List all projects
- `get_project_panels` - Get panels for a project
- `get_asbuilt_records` - Get as-built records
- `search_records` - Search records by text
- `generate_report` - Generate project reports
- `query_database` - Execute SQL queries (admin only)
- `import_asbuilt_excel` - Import Excel files (admin only)

### External Tools (Customer-facing)
- `get_my_projects` - Get user's projects
- `get_project_panels` - Get panels for a project
- `get_asbuilt_records` - Get as-built records
- `search_records` - Search records by text
- `generate_report` - Generate project reports

## 🔧 Configuration

### Environment Variables
```bash
# MCP Mode
MCP_MODE=internal  # or 'external'

# Internal Auth
MCP_ALLOWED_EMAILS=dtaplin21+new@gmail.com,admin@company.com
MCP_INTERNAL_AUTH=false

# Logging
MCP_LOG_LEVEL=info
MCP_CONSOLE_LOG=true

# Rate Limiting
MCP_RATE_LIMIT=true
MCP_RATE_MAX=100
MCP_RATE_WINDOW_MS=900000  # 15 minutes

# Security
MCP_MAX_QUERY_LENGTH=1000
MCP_MAX_FILE_SIZE=10485760  # 10MB
```

### Claude Desktop Config
The setup script automatically creates the config at:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

## 🧪 Testing

### Manual Test
```bash
cd backend/mcp
node server.js
```

### Automated Test
```bash
cd backend/mcp
node test-mcp.js
```

### Test with Claude Desktop
1. Open Claude Desktop
2. Ask: "What tools do you have access to?"
3. Try: "Show me all projects in DellSystemManager"
4. Try: "Get panels for project [project-id]"

## 📊 Monitoring

### Logs
- **Error logs**: `logs/mcp-error.log`
- **Combined logs**: `logs/mcp-combined.log`
- **Audit logs**: `logs/mcp-audit.log`

### View Logs
```bash
# Real-time logs
tail -f logs/mcp-combined.log

# Error logs only
tail -f logs/mcp-error.log

# Search logs
grep "ERROR" logs/mcp-combined.log
```

## 🔒 Security

### Internal Mode
- Simple email whitelist authentication
- Full database access
- No rate limiting (for team use)

### External Mode
- Full Supabase authentication
- Row-level security
- Rate limiting per user
- Audit logging

## 🚀 Deployment

### Development
```bash
cd backend/mcp
npm run dev  # Uses nodemon
```

### Production
```bash
cd backend/mcp
npm start
```

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### Server won't start
1. Check database connection: `echo $DATABASE_URL`
2. Check logs: `tail -f logs/mcp-error.log`
3. Test config: `node -e "console.log(require('./config-wrapper.cjs'))"`

### Claude Desktop not connecting
1. Check config file exists and is valid JSON
2. Restart Claude Desktop
3. Check server is running: `ps aux | grep server.js`

### Permission denied
1. Check file permissions: `chmod +x setup-mcp.sh`
2. Check database permissions
3. Check log directory permissions

## 📈 Performance

### Rate Limits
- **Internal**: No limits
- **External**: 100 requests per 15 minutes per user
- **Tool-specific**: Varies by tool complexity

### Database Connections
- **Max connections**: 5 (configurable)
- **Connection pooling**: Enabled
- **Read-only mode**: For external users

## 🔄 Updates

### Update MCP Server
```bash
cd backend/mcp
git pull
npm install
./setup-mcp.sh
```

### Update Claude Desktop Config
The setup script will update the config automatically, or manually copy:
```bash
cp claude-desktop-config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

## 📞 Support

For issues or questions:
1. Check the logs first
2. Test with the automated test script
3. Verify configuration
4. Check database connectivity

## 🎯 Next Steps

1. **Phase 1**: Internal MCP (✅ Complete)
2. **Phase 2**: External AI features in web app
3. **Phase 3**: Advanced AI workflows
4. **Phase 4**: Multi-tenant MCP
