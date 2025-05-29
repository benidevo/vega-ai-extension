import { IService } from '../IService';

/**
 * Storage service interface for Chrome extension storage
 */
export interface IStorageService extends IService {
  /**
   * Get value from storage
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set value in storage
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Remove value from storage
   */
  remove(key: string): Promise<void>;

  /**
   * Clear all storage
   */
  clear(): Promise<void>;

  /**
   * Get multiple values from storage
   */
  getMultiple<T extends Record<string, any>>(keys: string[]): Promise<Partial<T>>;

  /**
   * Set multiple values in storage
   */
  setMultiple(items: Record<string, any>): Promise<void>;
}

/**
 * Storage areas available in Chrome extensions
 */
export type StorageArea = 'local' | 'sync' | 'session';
