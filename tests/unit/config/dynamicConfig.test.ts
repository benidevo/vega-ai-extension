import { DynamicConfig } from '@/config/dynamicConfig';
import { SettingsService } from '@/background/services/settings/SettingsService';
import { config as staticConfig } from '@/config/index';
import { UserSettings } from '@/types/settings';

jest.mock('@/background/services/settings/SettingsService');
jest.mock('@/config/index', () => ({
  config: {
    auth: {
      providers: {
        google: {
          clientId: 'test-client-id',
          scopes: ['openid', 'email'],
          apiEndpoint: '/api/auth/google',
        },
        password: {
          apiBaseUrl: 'http://localhost:8765',
        },
      },
      defaultProvider: 'password',
    },
    api: {
      baseUrl: 'http://localhost:8765',
      authEndpoint: '/api/auth',
      timeout: 30000,
      retryAttempts: 3,
    },
    extension: {
      name: 'Vega AI Job Capture',
      version: '1.0.0',
      environment: 'production',
      deploymentMode: 'opensource',
      debug: false,
    },
    features: {
      enableAnalytics: true,
      enableErrorReporting: true,
      maxJobsPerSession: 100,
      enableGoogleAuth: true,
      enableDynamicHost: true,
    },
  },
}));

describe('DynamicConfig', () => {
  const mockGetSettings = SettingsService.getSettings as jest.MockedFunction<
    typeof SettingsService.getSettings
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    DynamicConfig.clearCache();
  });

  describe('getConfig', () => {
    it('should merge user settings with static config', async () => {
      const userSettings: UserSettings = {
        apiHost: 'custom.host.com',
        apiProtocol: 'https',
        backendMode: 'cloud',
      };

      mockGetSettings.mockResolvedValue(userSettings);

      const config = await DynamicConfig.getConfig();

      expect(config.api.baseUrl).toBe('https://custom.host.com');
      expect(config.auth.providers.password.apiBaseUrl).toBe(
        'https://custom.host.com'
      );
      expect(config.extension).toEqual(staticConfig.extension);
      expect(config.features).toEqual(staticConfig.features);
    });

    it('should cache the configuration', async () => {
      const userSettings: UserSettings = {
        apiHost: 'cached.host.com',
        apiProtocol: 'https',
        backendMode: 'local',
      };

      mockGetSettings.mockResolvedValue(userSettings);

      const config1 = await DynamicConfig.getConfig();
      const config2 = await DynamicConfig.getConfig();

      expect(config1).toBe(config2);
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    it('should handle http protocol', async () => {
      const userSettings: UserSettings = {
        apiHost: 'localhost:3000',
        apiProtocol: 'http',
        backendMode: 'local',
      };

      mockGetSettings.mockResolvedValue(userSettings);

      const config = await DynamicConfig.getConfig();

      expect(config.api.baseUrl).toBe('http://localhost:3000');
      expect(config.auth.providers.password.apiBaseUrl).toBe(
        'http://localhost:3000'
      );
    });
  });

  describe('clearCache', () => {
    it('should clear cached configuration', async () => {
      const userSettings1: UserSettings = {
        apiHost: 'first.host.com',
        apiProtocol: 'https',
        backendMode: 'cloud',
      };

      const userSettings2: UserSettings = {
        apiHost: 'second.host.com',
        apiProtocol: 'https',
        backendMode: 'cloud',
      };

      mockGetSettings
        .mockResolvedValueOnce(userSettings1)
        .mockResolvedValueOnce(userSettings2);

      const config1 = await DynamicConfig.getConfig();
      expect(config1.api.baseUrl).toBe('https://first.host.com');

      DynamicConfig.clearCache();

      const config2 = await DynamicConfig.getConfig();
      expect(config2.api.baseUrl).toBe('https://second.host.com');
      expect(mockGetSettings).toHaveBeenCalledTimes(2);
    });
  });
});
