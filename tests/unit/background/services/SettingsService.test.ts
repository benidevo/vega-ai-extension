import { SettingsService } from '@/background/services/settings/SettingsService';
import {
  DEFAULT_SETTINGS,
  BACKEND_CONFIGS,
  UserSettings,
} from '@/types/settings';
import { mockChrome, resetChromeMocks } from '../../../mocks/chrome';

jest.mock('@/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

global.fetch = jest.fn();

describe('SettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetChromeMocks();
  });

  describe('getSettings', () => {
    it('should return default settings on first use', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({});
      mockChrome.storage.sync.set.mockResolvedValue(undefined);

      const settings = await SettingsService.getSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        userSettings: DEFAULT_SETTINGS,
      });
    });

    it('should return stored settings', async () => {
      const storedSettings: UserSettings = {
        apiHost: 'custom.host.com',
        apiProtocol: 'https',
        backendMode: 'local',
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        userSettings: storedSettings,
      });

      const settings = await SettingsService.getSettings();

      expect(settings).toEqual(storedSettings);
    });

    it('should migrate settings without backendMode', async () => {
      const oldSettings = {
        apiHost: 'localhost:8765',
        apiProtocol: 'http',
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        userSettings: oldSettings,
      });
      mockChrome.storage.sync.set.mockResolvedValue(undefined);

      const settings = await SettingsService.getSettings();

      expect(settings.backendMode).toBe('cloud');
      expect(mockChrome.storage.sync.set).toHaveBeenCalled();
    });

    it('should fix cloud mode settings if incorrect', async () => {
      const incorrectCloudSettings: UserSettings = {
        apiHost: 'localhost:8765',
        apiProtocol: 'http',
        backendMode: 'cloud',
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        userSettings: incorrectCloudSettings,
      });
      mockChrome.storage.sync.set.mockResolvedValue(undefined);

      const settings = await SettingsService.getSettings();

      expect(settings.apiHost).toBe(BACKEND_CONFIGS.cloud.apiHost);
      expect(settings.apiProtocol).toBe(BACKEND_CONFIGS.cloud.apiProtocol);
      expect(mockChrome.storage.sync.set).toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      mockChrome.storage.sync.get.mockRejectedValue(new Error('Storage error'));

      const settings = await SettingsService.getSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('saveSettings', () => {
    it('should save settings to storage', async () => {
      const settings: UserSettings = {
        apiHost: 'test.com',
        apiProtocol: 'https',
        backendMode: 'local',
      };

      mockChrome.storage.sync.set.mockResolvedValue(undefined);

      await SettingsService.saveSettings(settings);

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        userSettings: settings,
      });
    });
  });

  describe('getApiBaseUrl', () => {
    it('should return cloud URL for cloud mode', async () => {
      const cloudSettings: UserSettings = {
        ...DEFAULT_SETTINGS,
        backendMode: 'cloud',
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        userSettings: cloudSettings,
      });

      const url = await SettingsService.getApiBaseUrl();

      expect(url).toBe(
        `${BACKEND_CONFIGS.cloud.apiProtocol}://${BACKEND_CONFIGS.cloud.apiHost}`
      );
    });

    it('should return custom URL for local mode', async () => {
      const localSettings: UserSettings = {
        apiHost: 'custom.local:3000',
        apiProtocol: 'http',
        backendMode: 'local',
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        userSettings: localSettings,
      });

      const url = await SettingsService.getApiBaseUrl();

      expect(url).toBe('http://custom.local:3000');
    });
  });

  describe('setBackendMode', () => {
    beforeEach(() => {
      mockChrome.storage.sync.get.mockResolvedValue({
        userSettings: DEFAULT_SETTINGS,
      });
      mockChrome.storage.sync.set.mockResolvedValue(undefined);
    });

    it('should set cloud mode with default config', async () => {
      await SettingsService.setBackendMode('cloud');

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        userSettings: {
          apiHost: BACKEND_CONFIGS.cloud.apiHost,
          apiProtocol: BACKEND_CONFIGS.cloud.apiProtocol,
          backendMode: 'cloud',
        },
      });
    });

    it('should set local mode with custom settings', async () => {
      await SettingsService.setBackendMode(
        'local',
        'custom.local:4000',
        'http'
      );

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        userSettings: {
          apiHost: 'custom.local:4000',
          apiProtocol: 'http',
          backendMode: 'local',
        },
      });
    });

    it('should set local mode with default config when no custom settings', async () => {
      await SettingsService.setBackendMode('local');

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        userSettings: {
          apiHost: BACKEND_CONFIGS.local.apiHost,
          apiProtocol: BACKEND_CONFIGS.local.apiProtocol,
          backendMode: 'local',
        },
      });
    });
  });

  describe('getBackendMode', () => {
    it('should return the current backend mode', async () => {
      const settings: UserSettings = {
        ...DEFAULT_SETTINGS,
        backendMode: 'local',
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        userSettings: settings,
      });

      const mode = await SettingsService.getBackendMode();

      expect(mode).toBe('local');
    });
  });

  describe('isOAuthEnabled', () => {
    it('should return true for cloud mode', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        userSettings: { ...DEFAULT_SETTINGS, backendMode: 'cloud' },
      });

      const enabled = await SettingsService.isOAuthEnabled();

      expect(enabled).toBe(true);
    });

    it('should return false for local mode', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        userSettings: { ...DEFAULT_SETTINGS, backendMode: 'local' },
      });

      const enabled = await SettingsService.isOAuthEnabled();

      expect(enabled).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      const result = await SettingsService.testConnection('test.com', 'https');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('https://test.com/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: expect.any(AbortSignal),
      });
    });

    it('should return false for failed connection', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      const result = await SettingsService.testConnection('test.com', 'https');

      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await SettingsService.testConnection('test.com', 'https');

      expect(result).toBe(false);
    });
  });
});
