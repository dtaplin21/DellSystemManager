const { BrowserWindow } = require('electron');
const path = require('path');

class MainWindow {
  constructor() {
    this.window = null;
  }

  create() {
    if (this.window) {
      this.window.focus();
      return;
    }

    const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged;

    this.window = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 800,
      show: false,
      icon: path.join(__dirname, '..', '..', 'resources', 'icons', 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: true
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
    });

    // Load the app
    if (isDev) {
      this.window.loadURL('http://localhost:3000');
      this.window.webContents.openDevTools();
    } else {
      this.window.loadFile(
        path.join(__dirname, '..', '..', '..', 'frontend', '.next', 'server', 'pages', 'index.html')
      );
    }

    this.window.once('ready-to-show', () => {
      this.window.show();
      if (process.platform === 'win32') {
        this.window.focus();
      }
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    return this.window;
  }

  getWindow() {
    return this.window;
  }

  isOpen() {
    return this.window !== null && !this.window.isDestroyed();
  }

  focus() {
    if (this.window) {
      this.window.focus();
    }
  }

  minimize() {
    if (this.window) {
      this.window.minimize();
    }
  }

  maximize() {
    if (this.window) {
      this.window.maximize();
    }
  }

  close() {
    if (this.window) {
      this.window.close();
    }
  }
}

module.exports = MainWindow;

