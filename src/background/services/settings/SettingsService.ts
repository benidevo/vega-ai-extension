import { UserSettings, DEFAULT_SETTINGS } from '../../../types/settings';
import { Logger } from '@/utils/logger';

const logger = new Logger('SettingsService');

// The hosted service was retired. Profiles that still point at it are reset.
const RETIRED_HOST = 'vega.benidevo.com';
const AUTH_STORAGE_KEYS = ['authToken', 'authTokenData', 'authProvider'];

type StoredSettings = Partial<UserSettings> & { backendMode?: string };

export class SettingsService {
  private static readonly STORAGE_KEY = 'userSettings';

  static async getSettings(): Promise<UserSettings> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const stored = result[this.STORAGE_KEY] as StoredSettings | undefined;

      if (!stored) {
        return { ...DEFAULT_SETTINGS };
      }

      if (stored.backendMode === 'cloud' || stored.apiHost === RETIRED_HOST) {
        // Drop the old hosted login so it is never sent to another server.
        await chrome.storage.local.remove(AUTH_STORAGE_KEYS);
        await this.saveSettings({ ...DEFAULT_SETTINGS });
        return { ...DEFAULT_SETTINGS };
      }

      // A leftover backendMode field is ignored here and dropped on the next save.
      return {
        apiHost: stored.apiHost ?? DEFAULT_SETTINGS.apiHost,
        apiProtocol: stored.apiProtocol ?? DEFAULT_SETTINGS.apiProtocol,
      };
    } catch (error) {
      logger.error('Error loading settings', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  static async saveSettings(settings: UserSettings): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEY]: settings,
    });
  }

  static isConfigured(settings: UserSettings): boolean {
    return settings.apiHost !== '';
  }

  // Returns an empty string until a server is configured.
  static async getApiBaseUrl(): Promise<string> {
    const settings = await this.getSettings();
    if (!this.isConfigured(settings)) {
      return '';
    }
    return `${settings.apiProtocol}://${settings.apiHost}`;
  }

  static async testConnection(
    host: string,
    protocol: 'http' | 'https'
  ): Promise<boolean> {
    try {
      const url = `${protocol}://${host}/health`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      logger.error('Connection test failed', error);
      return false;
    }
  }
}
