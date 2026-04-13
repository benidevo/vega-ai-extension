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
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      let settings = result[this.STORAGE_KEY] as UserSettings | undefined;

      if (!settings) {
        settings = { ...DEFAULT_SETTINGS };
        await this.saveSettings(settings);
      } else {
        let needsSave = false;

        // Ensure backendMode exists for migration
        if (!settings.backendMode) {
          settings.backendMode = 'cloud';
          needsSave = true;
        }

        // Ensure cloud mode uses correct settings
        if (settings.backendMode === 'cloud') {
          const cloudConfig = BACKEND_CONFIGS.cloud;
          if (
            settings.apiHost !== cloudConfig.apiHost ||
            settings.apiProtocol !== cloudConfig.apiProtocol
          ) {
            settings.apiHost = cloudConfig.apiHost;
            settings.apiProtocol = cloudConfig.apiProtocol;
            needsSave = true;
          }
        }

        if (needsSave) {
          await this.saveSettings(settings);
        }
      }

      return settings;
    } catch (error) {
      logger.error('Error loading settings', error);
      return DEFAULT_SETTINGS;
    }
  }

  static async saveSettings(settings: UserSettings): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEY]: settings,
    });
  }

  static async getApiBaseUrl(): Promise<string> {
    const settings = await this.getSettings();

    if (settings.backendMode === 'local') {
      return `${settings.apiProtocol}://${settings.apiHost}`;
    }

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
      settings.apiHost = customHost;
      settings.apiProtocol = customProtocol;
    } else {
      settings.apiHost = config.apiHost;
      settings.apiProtocol = config.apiProtocol;
    }

    await this.saveSettings(settings);
  }

  static async getBackendMode(): Promise<BackendMode> {
    const settings = await this.getSettings();
    return settings.backendMode;
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
