import { config as staticConfig, AppConfig } from './index';
import { SettingsService } from '../background/services/settings/SettingsService';

/**
 * Dynamic configuration that merges static config with user settings
 */
export class DynamicConfig {
  private static cachedConfig: AppConfig | null = null;

  static async getConfig(): Promise<AppConfig> {
    const userSettings = await SettingsService.getSettings();
    const apiBaseUrl = `${userSettings.apiProtocol}://${userSettings.apiHost}`;

    // Merge with static config
    const dynamicConfig: AppConfig = {
      ...staticConfig,
      auth: {
        ...staticConfig.auth,
        providers: {
          ...staticConfig.auth.providers,
          password: {
            apiBaseUrl: apiBaseUrl,
          },
        },
      },
      api: {
        ...staticConfig.api,
        baseUrl: apiBaseUrl,
      },
    };

    this.cachedConfig = dynamicConfig;
    return dynamicConfig;
  }

  static clearCache(): void {
    this.cachedConfig = null;
  }
}
