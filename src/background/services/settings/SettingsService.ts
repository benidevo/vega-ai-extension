import { UserSettings, DEFAULT_SETTINGS } from '../../../types/settings';

export class SettingsService {
  private static readonly STORAGE_KEY = 'userSettings';

  static async getSettings(): Promise<UserSettings> {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error loading settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  static async saveSettings(settings: UserSettings): Promise<void> {
    await chrome.storage.sync.set({
      [this.STORAGE_KEY]: settings,
    });
  }

  static async getApiBaseUrl(): Promise<string> {
    const settings = await this.getSettings();
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
      console.error('Connection test failed:', error);
      return false;
    }
  }
}
