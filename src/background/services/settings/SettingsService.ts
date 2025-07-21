import {
  UserSettings,
  DEFAULT_SETTINGS,
  BACKEND_CONFIGS,
  BackendMode,
} from '../../../types/settings';
import { Logger } from '@/utils/logger';

const logger = new Logger('SettingsService');

export class SettingsService {
  private static readonly STORAGE_KEY = 'userSettings';

  static async getSettings(): Promise<UserSettings> {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      const settings = result[this.STORAGE_KEY] || DEFAULT_SETTINGS;

      // Ensure backendMode exists for migration
      if (!settings.backendMode) {
        settings.backendMode = 'cloud';
      }

      return settings;
    } catch (error) {
      logger.error('Error loading settings', error);
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

    // For local mode, use the custom host/protocol if set
    if (settings.backendMode === 'local') {
      return `${settings.apiProtocol}://${settings.apiHost}`;
    }

    // For cloud mode, always use the predefined config
    const config = BACKEND_CONFIGS[settings.backendMode];
    return `${config.apiProtocol}://${config.apiHost}`;
  }

  static async setBackendMode(
    mode: BackendMode,
    customHost?: string,
    customProtocol?: 'http' | 'https'
  ): Promise<void> {
    const settings = await this.getSettings();
    const config = BACKEND_CONFIGS[mode];

    settings.backendMode = mode;

    if (mode === 'local' && customHost && customProtocol) {
      // For local mode with custom settings
      settings.apiHost = customHost;
      settings.apiProtocol = customProtocol;
    } else {
      // Use default config for the mode
      settings.apiHost = config.apiHost;
      settings.apiProtocol = config.apiProtocol;
    }

    await this.saveSettings(settings);
  }

  static async getBackendMode(): Promise<BackendMode> {
    const settings = await this.getSettings();
    return settings.backendMode;
  }

  static async isOAuthEnabled(): Promise<boolean> {
    const mode = await this.getBackendMode();
    return BACKEND_CONFIGS[mode].enableOAuth;
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
