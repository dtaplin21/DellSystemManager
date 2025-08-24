# Database Management Scripts

These scripts replace the problematic inline Node.js commands with clean, readable, and maintainable database operations.

## 🚀 Quick Start

All scripts are located in the `backend/scripts/` directory and can be run from the backend folder:

```bash
cd backend
node scripts/[script-name].js
```

## 📋 Available Scripts

### 1. `check-panels.js` - Check Panel Count
**Usage:** `node scripts/check-panels.js [projectId]`

**What it does:**
- Shows total panel count across all projects
- Displays panel count per project
- Shows data types and sample data
- If no projectId provided, shows all projects

**Examples:**
```bash
# Check all projects
node scripts/check-panels.js

# Check specific project
node scripts/check-panels.js 69fc302b-166d-4543-9990-89c4b1e0ed59
```

### 2. `clear-panels.js` - Clear Panels
**Usage:** `node scripts/clear-panels.js [projectId]`

**What it does:**
- Clears all panels from panel_layouts table
- Sets panels to empty array `[]`
- If no projectId provided, clears ALL projects
- Shows rows affected

**Examples:**
```bash
# Clear all projects
node scripts/clear-panels.js

# Clear specific project
node scripts/clear-panels.js 69fc302b-166d-4543-9990-89c4b1e0ed59
```

### 3. `check-table-structure.js` - Check Database Schema
**Usage:** `node scripts/check-table-structure.js [tableName]`

**What it does:**
- Shows all tables in the database
- Displays column information for specific tables
- Shows data types, nullability, and defaults
- If no tableName provided, shows all tables

**Examples:**
```bash
# Check all tables
node scripts/check-table-structure.js

# Check specific table
node scripts/check-table-structure.js panel_layouts
```

### 4. `db-manager.js` - Interactive Database Manager
**Usage:** `node scripts/db-manager.js`

**What it does:**
- Interactive menu for common operations
- Combines all functionality in one tool
- User-friendly interface
- Safe database operations

**Features:**
- Check panel count
- Clear all panels
- Clear specific project panels
- Check table structure
- Graceful exit

## 🔧 Requirements

- Node.js installed
- PostgreSQL database running
- Environment variables set (DATABASE_URL)
- Dependencies installed (`npm install`)

## 🚨 Safety Features

All scripts include:
- **Connection pooling** for efficient database access
- **Proper error handling** with detailed error messages
- **Connection cleanup** to prevent resource leaks
- **Transaction safety** for destructive operations
- **Input validation** for user-provided data

## 📊 Output Examples

### Check Panels Output:
```
🎯 Target: Check panels for ALL projects
🔌 Connecting to database...
✅ Database connected successfully
🔍 Checking panels for ALL projects...
📊 Total panel_layouts records: 5
📊 Total panels across all projects: 0
📊 Projects with panels:
   65e1c6fb-de0a-4c72-9adc-2ddea27092d0: 0 panels (string)
   ed416666-685d-4393-b945-9f4ee6e86209: 0 panels (string)
🔌 Database connection released
🏁 Script completed
```

### Clear Panels Output:
```
🎯 Target: Clear panels for ALL projects
🔌 Connecting to database...
✅ Database connected successfully
🗑️  Clearing panels for ALL projects...
✅ Panels cleared for all projects
📊 Rows affected: 5
🔌 Database connection released
🏁 Script completed
```

## 🎯 When to Use Each Script

- **`check-panels.js`** - Before and after operations to verify changes
- **`clear-panels.js`** - When you need to reset panel data
- **`check-table-structure.js`** - When debugging schema issues
- **`db-manager.js`** - For interactive database management

## 🔍 Troubleshooting

### Common Issues:

1. **Connection Failed**
   - Check DATABASE_URL environment variable
   - Verify PostgreSQL is running
   - Check firewall/network settings

2. **Permission Denied**
   - Verify database user permissions
   - Check table access rights

3. **Script Not Found**
   - Ensure you're in the `backend` directory
   - Check file permissions (`chmod +x scripts/*.js`)

### Debug Mode:
All scripts include comprehensive logging. Check the console output for detailed error information.

## 🚀 Next Steps

These scripts provide a solid foundation for database management. Consider:

1. **Adding more operations** (backup, restore, migrate)
2. **Creating scheduled tasks** for maintenance
3. **Adding data validation** for complex operations
4. **Integrating with CI/CD** for automated testing

## 📝 Notes

- Scripts are designed to be **safe and idempotent**
- All destructive operations show clear warnings
- Scripts handle errors gracefully and provide helpful feedback
- Database connections are properly managed and cleaned up
