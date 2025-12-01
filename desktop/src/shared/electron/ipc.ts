/**
 * IPC utilities for Electron communication
 */

export interface ElectronAPI {
  getVersion: () => Promise<string>;
  openProjectWindow: (projectId: string) => Promise<void>;
  closeProjectWindow: (projectId: string) => Promise<void>;
  showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>;
  showOpenDialog: (options: OpenDialogOptions) => Promise<OpenDialogResult>;
  showMessageBox: (options: MessageBoxOptions) => Promise<MessageBoxResult>;
  onMenuAction: (callback: (action: string, ...args: any[]) => void) => void;
  platform: string;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
  removeAllListeners: (channel: string) => void;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
}

export interface SaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
}

export interface OpenDialogResult {
  canceled: boolean;
  filePaths?: string[];
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  title?: string;
  message: string;
  detail?: string;
  buttons?: string[];
  defaultId?: number;
  cancelId?: number;
}

export interface MessageBoxResult {
  response: number;
  checkboxChecked?: boolean;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

/**
 * Check if running in Electron
 */
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
};

/**
 * Get Electron API
 */
export const getElectronAPI = (): ElectronAPI | null => {
  if (isElectron()) {
    return window.electronAPI;
  }
  return null;
};

/**
 * Open a project in a new window
 */
export const openProjectWindow = async (projectId: string): Promise<void> => {
  const api = getElectronAPI();
  if (api) {
    await api.openProjectWindow(projectId);
  }
};

/**
 * Show save dialog
 */
export const showSaveDialog = async (
  options: SaveDialogOptions
): Promise<SaveDialogResult> => {
  const api = getElectronAPI();
  if (api) {
    return await api.showSaveDialog(options);
  }
  return { canceled: true };
};

/**
 * Show open dialog
 */
export const showOpenDialog = async (
  options: OpenDialogOptions
): Promise<OpenDialogResult> => {
  const api = getElectronAPI();
  if (api) {
    return await api.showOpenDialog(options);
  }
  return { canceled: true };
};

/**
 * Show message box
 */
export const showMessageBox = async (
  options: MessageBoxOptions
): Promise<MessageBoxResult> => {
  const api = getElectronAPI();
  if (api) {
    return await api.showMessageBox(options);
  }
  return { response: 0 };
};

/**
 * Listen for menu actions
 */
export const onMenuAction = (
  callback: (action: string, ...args: any[]) => void
): void => {
  const api = getElectronAPI();
  if (api) {
    api.onMenuAction(callback);
  }
};

