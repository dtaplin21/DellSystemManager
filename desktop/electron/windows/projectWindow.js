const { BrowserWindow } = require('electron');
const path = require('path');

class ProjectWindow {
  constructor(projectId, parentWindow) {
    this.projectId = projectId;
    this.window = null;
    this.parentWindow = parentWindow;
  }

  create() {
    if (this.window) {
      this.window.focus();
      return this.window;
    }

    const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged;

    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 700,
      show: false,
      parent: this.parentWindow,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: true
      }
    });

    // Load project view
    if (isDev) {
      this.window.loadURL(`http://localhost:3000/dashboard/projects/${this.projectId}`);
    } else {
      this.window.loadFile(
        path.join(
          __dirname,
          '..',
          '..',
          '..',
          'frontend',
          '.next',
          'server',
          'pages',
          'dashboard',
          'projects',
          '[id]',
          'index.html'
        )
      );
    }

    this.window.once('ready-to-show', () => {
      this.window.show();
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

  close() {
    if (this.window) {
      this.window.close();
    }
  }
}

module.exports = ProjectWindow;

