# GeoSynth QC Pro - Desktop Application

Windows desktop application for construction companies, optimized for QC Managers working on geosynthetic material projects.

## Technology Stack

- **Electron**: Desktop app framework
- **Next.js/React**: Frontend (reused from web app)
- **TypeScript**: Type safety
- **Node.js**: Backend integration

## Project Structure

```
desktop/
├── electron/              # Electron main process
│   ├── main.js           # Main entry point
│   ├── preload.js        # Secure IPC bridge
│   ├── updater.js        # Auto-update functionality
│   └── windows/          # Window management
├── src/                   # React application
│   ├── main/             # Desktop entry point
│   ├── renderer/          # React components
│   │   ├── components/
│   │   │   ├── construction/  # Construction-specific
│   │   │   ├── desktop/        # Desktop-specific UI
│   │   │   └── cad/            # CAD integration
│   │   └── layouts/            # Desktop layouts
│   └── shared/            # Shared utilities
│       └── electron/      # Electron IPC utilities
├── resources/             # App resources
│   ├── icons/            # App icons
│   └── installer/        # Installer configs
└── build/                 # Build outputs
```

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Windows 10/11 (for Windows builds)
- macOS (for macOS builds, optional)

### Setup

1. Install dependencies:
```bash
cd desktop
npm install
```

2. Install frontend dependencies (if not already done):
```bash
cd ../frontend
npm install
```

3. Start development:
```bash
cd desktop
npm run dev
```

This will:
- Start Next.js dev server (frontend)
- Launch Electron app
- Enable hot reload

### Building

#### Development Build
```bash
npm run build
```

#### Windows Installer
```bash
npm run build:win
```

This creates a Windows installer (.exe) in `build/windows/`

#### macOS Build
```bash
npm run build:mac
```

## Features

### Desktop-Specific Features
- ✅ Windows file associations
- ✅ System tray integration
- ✅ Native Windows notifications
- ✅ Multi-window support
- ✅ Desktop menu bar
- ✅ Keyboard shortcuts
- ✅ Auto-update functionality

### Construction Company Features
- 🚧 Job site management
- 🚧 Crew management
- 🚧 Equipment tracking
- 🚧 Material inventory
- 🚧 CAD integration (AutoCAD/DWG)
- 🚧 Offline support
- 🚧 Construction-specific reporting

## Configuration

### Environment Variables

Create `.env` file in `desktop/` directory:

```env
NODE_ENV=development
API_BASE_URL=http://localhost:8003
AI_SERVICE_URL=http://localhost:5001
```

### Build Configuration

Edit `package.json` `build` section to customize:
- App ID
- Product name
- Icons
- Installer settings

## Windows Installer

The Windows installer is configured in `package.json`:
- **Target**: NSIS installer (.exe)
- **Architecture**: x64 and ia32
- **Features**:
  - Custom installation directory
  - Desktop shortcut
  - Start menu shortcut
  - Auto-update support

## Auto-Update

Auto-update is configured using `electron-updater`:
- Checks for updates on app startup
- Downloads updates in background
- Prompts user to restart when ready

## Troubleshooting

### App won't start
- Check Node.js version (18+)
- Ensure frontend is built: `cd ../frontend && npm run build`
- Check console for errors

### Build fails
- Ensure all dependencies are installed
- Check Windows build tools are installed
- Verify icon files exist in `resources/icons/`

### IPC not working
- Ensure `preload.js` is properly configured
- Check `contextIsolation` is enabled
- Verify IPC handlers in `main.js`

## Next Steps

1. ✅ Desktop app structure created
2. 🚧 Integrate with existing frontend
3. 🚧 Add construction-specific features
4. 🚧 Implement CAD integration
5. 🚧 Add offline support
6. 🚧 Create Windows installer
7. 🚧 Test on Windows machines

## License

MIT

