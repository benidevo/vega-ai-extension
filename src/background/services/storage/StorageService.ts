import { IStorageService, StorageArea } from './IStorageService';

export class StorageService implements IStorageService {
  private area: chrome.storage.StorageArea;
  private isInitialized = false;

  constructor(area: StorageArea = 'local') {
    this.area = chrome.storage[area];
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    this.isInitialized = false;
  }

  async get<T>(key: string): Promise<T | null> {
    return new Promise(resolve => {
      this.area.get(key, result => {
        if (chrome.runtime.lastError) {
          console.error('Storage get error:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(result[key] || null);
        }
      });
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      this.area.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async remove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.area.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.area.clear(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async getMultiple<T extends Record<string, unknown>>(
    keys: string[]
  ): Promise<Partial<T>> {
    return new Promise(resolve => {
      this.area.get(keys, result => {
        if (chrome.runtime.lastError) {
          console.error('Storage getMultiple error:', chrome.runtime.lastError);
          resolve({} as Partial<T>);
        } else {
          resolve(result as Partial<T>);
        }
      });
    });
  }

  async setMultiple(items: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.area.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
}
