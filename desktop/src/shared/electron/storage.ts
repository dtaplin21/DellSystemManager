/**
 * Local storage utilities for Electron desktop app
 * Uses SQLite for offline data storage
 */

import { isElectron } from './ipc';

export interface StorageOptions {
  useLocalStorage?: boolean; // Fallback to localStorage in web
  useIndexedDB?: boolean; // Use IndexedDB for larger data
}

/**
 * Store data locally (offline support)
 */
export const storeLocal = async (
  key: string,
  value: any,
  options: StorageOptions = {}
): Promise<void> => {
  if (isElectron()) {
    // In Electron, we'll use a local SQLite database
    // For now, fallback to localStorage
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to store locally:', error);
      throw error;
    }
  } else {
    // Web fallback
    if (options.useLocalStorage) {
      localStorage.setItem(key, JSON.stringify(value));
    } else if (options.useIndexedDB) {
      // Use IndexedDB for larger data
      await storeInIndexedDB(key, value);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
};

/**
 * Retrieve data from local storage
 */
export const getLocal = async <T>(
  key: string,
  defaultValue?: T,
  options: StorageOptions = {}
): Promise<T | null> => {
  if (isElectron()) {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
      }
      return defaultValue || null;
    } catch (error) {
      console.error('Failed to retrieve from local storage:', error);
      return defaultValue || null;
    }
  } else {
    // Web fallback
    if (options.useLocalStorage) {
      const item = localStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
      }
      return defaultValue || null;
    } else if (options.useIndexedDB) {
      return await getFromIndexedDB<T>(key, defaultValue);
    } else {
      const item = localStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
      }
      return defaultValue || null;
    }
  }
};

/**
 * Remove data from local storage
 */
export const removeLocal = async (key: string): Promise<void> => {
  if (isElectron()) {
    localStorage.removeItem(key);
  } else {
    localStorage.removeItem(key);
  }
};

/**
 * Clear all local storage
 */
export const clearLocal = async (): Promise<void> => {
  if (isElectron()) {
    localStorage.clear();
  } else {
    localStorage.clear();
  }
};

/**
 * Store in IndexedDB (for larger data)
 */
const storeInIndexedDB = async (key: string, value: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GeoSynthQC', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['storage'], 'readwrite');
      const store = transaction.objectStore('storage');
      const putRequest = store.put({ key, value, timestamp: Date.now() });
      
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('storage')) {
        db.createObjectStore('storage', { keyPath: 'key' });
      }
    };
  });
};

/**
 * Get from IndexedDB
 */
const getFromIndexedDB = async <T>(
  key: string,
  defaultValue?: T
): Promise<T | null> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GeoSynthQC', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['storage'], 'readonly');
      const store = transaction.objectStore('storage');
      const getRequest = store.get(key);
      
      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const result = getRequest.result;
        resolve(result ? (result.value as T) : (defaultValue || null));
      };
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('storage')) {
        db.createObjectStore('storage', { keyPath: 'key' });
      }
    };
  });
};

