# Desktop App Setup Instructions

## Quick Start

### 1. Install Dependencies

```bash
cd desktop
npm install
```

### 2. Install Frontend Dependencies (if not already done)

```bash
cd ../frontend
npm install
```

### 3. Development Mode

Start the desktop app in development mode:

```bash
cd desktop
npm run dev
```

This will:
- Start Next.js dev server (frontend) on http://localhost:3000
- Launch Electron app
- Enable hot reload for both frontend and Electron

## Building for Production

### Windows Build

```bash
cd desktop
npm run build:win
```

This creates a Windows installer (.exe) in `build/windows/`

### Development Build (without installer)

```bash
cd desktop
npm run build
```

## Project Structure

```
desktop/
├── electron/              # Electron main process
│   ├── main.js           # Main entry point
│   ├── preload.js        # Secure IPC bridge
│   ├── updater.js        # Auto-update
│   └── windows/          # Window management
├── src/                   # React application
│   ├── renderer/          # React components
│   │   ├── components/
│   │   │   ├── construction/  # Construction features
│   │   │   ├── desktop/       # Desktop UI
│   │   │   └── cad/           # CAD integration
│   │   └── layouts/           # Desktop layouts
│   └── shared/            # Shared utilities
│       └── electron/      # Electron IPC
└── resources/             # App resources
    ├── icons/             # App icons
    └── installer/         # Installer configs
```

## Features Implemented

✅ **Electron Setup**
- Main process configuration
- Window management
- IPC communication
- Auto-update support

✅ **Desktop Integration**
- Windows file associations
- System tray
- Native menus
- Multi-window support

✅ **Desktop UI Components**
- Desktop layout
- Toolbar
- Menu bar integration

✅ **Construction Components** (Placeholders)
- Job site manager
- Crew manager
- Equipment tracker
- Material inventory

✅ **CAD Components** (Placeholders)
- CAD importer
- CAD overlay
- CAD exporter

## Next Steps

1. **Integrate with Existing Frontend**
   - Connect desktop app to existing Next.js frontend
   - Adapt existing components for desktop

2. **Implement Construction Features**
   - Build job site management
   - Implement crew tracking
   - Add equipment management
   - Create material inventory

3. **CAD Integration**
   - Research CAD libraries (DWG TrueView SDK, etc.)
   - Implement CAD file import
   - Build overlay functionality
   - Create export functionality

4. **Offline Support**
   - Set up local SQLite database
   - Implement offline queue
   - Add background sync

5. **Testing**
   - Test on Windows 10/11
   - Test on Dell desktops/laptops
   - Performance optimization

## Troubleshooting

### App won't start
- Ensure Node.js 18+ is installed
- Check that frontend dependencies are installed
- Verify port 3000 is available

### Build fails
- Ensure all dependencies are installed
- Check Windows build tools are installed
- Verify icon files exist

### IPC not working
- Check `preload.js` is properly configured
- Verify `contextIsolation` is enabled
- Check IPC handlers in `main.js`

## Development Tips

- Use `Ctrl+Shift+I` to open DevTools in Electron
- Hot reload works for both React and Electron
- Check console for IPC errors
- Use Electron's built-in debugging tools

