const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

class AppUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.setupAutoUpdater();
  }

  setupAutoUpdater() {
    // Configure auto-updater
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    // Check for updates on startup (only in production)
    if (process.env.NODE_ENV !== 'development') {
      autoUpdater.checkForUpdatesAndNotify();
    }

    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      this.sendStatusToWindow('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      this.sendStatusToWindow('Update available.');
      if (this.mainWindow) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: 'Update Available',
          message: 'A new version is available. It will be downloaded in the background.',
          buttons: ['OK']
        });
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      this.sendStatusToWindow('Update not available.');
    });

    autoUpdater.on('error', (err) => {
      this.sendStatusToWindow('Error in auto-updater. ' + err);
      console.error('Auto-updater error:', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let logMessage = 'Download speed: ' + progressObj.bytesPerSecond;
      logMessage = logMessage + ' - Downloaded ' + progressObj.percent + '%';
      logMessage = logMessage + ' (' + progressObj.transferred + '/' + progressObj.total + ')';
      this.sendStatusToWindow(logMessage);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.sendStatusToWindow('Update downloaded.');
      if (this.mainWindow) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: 'Update Ready',
          message: 'Update downloaded. The application will restart to apply the update.',
          buttons: ['Restart Now', 'Later']
        }).then((result) => {
          if (result.response === 0) {
            autoUpdater.quitAndInstall(false, true);
          }
        });
      }
    });
  }

  sendStatusToWindow(text) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('update-status', text);
    }
  }

  checkForUpdates() {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

module.exports = AppUpdater;

