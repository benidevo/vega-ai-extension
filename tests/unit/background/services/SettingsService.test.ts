import { SettingsService } from '@/background/services/settings/SettingsService';
import { DEFAULT_SETTINGS, UserSettings } from '@/types/settings';
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
    mockChrome.storage.local.set.mockResolvedValue(undefined);
    mockChrome.storage.local.remove.mockResolvedValue(undefined);
  });

  describe('getSettings', () => {
    it('should return unconfigured defaults on first use', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});

      const settings = await SettingsService.getSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(SettingsService.isConfigured(settings)).toBe(false);
    });

    it('should return stored settings', async () => {
      const storedSettings: UserSettings = {
        apiHost: 'custom.host.com',
        apiProtocol: 'https',
      };

      mockChrome.storage.local.get.mockResolvedValue({
        userSettings: storedSettings,
      });

      const settings = await SettingsService.getSettings();

      expect(settings).toEqual(storedSettings);
      expect(mockChrome.storage.local.set).not.toHaveBeenCalled();
      expect(mockChrome.storage.local.remove).not.toHaveBeenCalled();
    });

    it('should keep a self-hosted server and ignore the legacy backendMode', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        userSettings: {
          apiHost: 'localhost:8765',
          apiProtocol: 'http',
          backendMode: 'local',
        },
      });

      const settings = await SettingsService.getSettings();

      expect(settings).toEqual({
        apiHost: 'localhost:8765',
        apiProtocol: 'http',
      });
      expect(mockChrome.storage.local.set).not.toHaveBeenCalled();
      expect(mockChrome.storage.local.remove).not.toHaveBeenCalled();
    });

    it.each(['vega.benidevo.com:443', 'Vega.Benidevo.com'])(
      'should reset a retired host stored as %p',
      async apiHost => {
        mockChrome.storage.local.get.mockResolvedValue({
          userSettings: { apiHost, apiProtocol: 'https' },
        });

        const settings = await SettingsService.getSettings();

        expect(settings).toEqual(DEFAULT_SETTINGS);
        expect(mockChrome.storage.local.remove).toHaveBeenCalled();
      }
    );

    it('should keep a self-hosted host that only contains the retired name', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        userSettings: {
          apiHost: 'vega.benidevo.com.example.org',
          apiProtocol: 'https',
        },
      });

      const settings = await SettingsService.getSettings();

      expect(settings.apiHost).toBe('vega.benidevo.com.example.org');
      expect(mockChrome.storage.local.remove).not.toHaveBeenCalled();
    });

    it('should reset a stored cloud profile and clear its login', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        userSettings: {
          apiHost: 'vega.benidevo.com',
          apiProtocol: 'https',
          backendMode: 'cloud',
        },
      });

      const settings = await SettingsService.getSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(mockChrome.storage.local.remove).toHaveBeenCalledWith([
        'authToken',
        'authTokenData',
        'authProvider',
      ]);
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        userSettings: DEFAULT_SETTINGS,
      });
    });

    it('should reset a profile without backendMode that points at the retired host', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        userSettings: {
          apiHost: 'vega.benidevo.com',
          apiProtocol: 'https',
        },
      });

      const settings = await SettingsService.getSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(mockChrome.storage.local.remove).toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      mockChrome.storage.local.get.mockRejectedValue(
        new Error('Storage error')
      );

      const settings = await SettingsService.getSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('saveSettings', () => {
    const authKeys = ['authToken', 'authTokenData', 'authProvider'];

    it('should save settings to storage', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});
      const settings: UserSettings = {
        apiHost: 'test.com',
        apiProtocol: 'https',
      };

      await SettingsService.saveSettings(settings);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        userSettings: settings,
      });
    });

    it.each([
      ['host', { apiHost: 'b.example.com', apiProtocol: 'https' }],
      ['protocol', { apiHost: 'a.example.com', apiProtocol: 'http' }],
    ] as const)(
      'should clear the login before saving a different %s',
      async (_, next) => {
        mockChrome.storage.local.get.mockResolvedValue({
          userSettings: { apiHost: 'a.example.com', apiProtocol: 'https' },
        });

        await SettingsService.saveSettings(next);

        expect(mockChrome.storage.local.remove).toHaveBeenCalledWith(authKeys);
        expect(
          mockChrome.storage.local.remove.mock.invocationCallOrder[0]
        ).toBeLessThan(
          mockChrome.storage.local.set.mock.invocationCallOrder[0]
        );
      }
    );

    it('should keep the login when host and protocol are unchanged', async () => {
      const same = { apiHost: 'a.example.com', apiProtocol: 'https' } as const;
      mockChrome.storage.local.get.mockResolvedValue({ userSettings: same });

      await SettingsService.saveSettings(same);

      expect(mockChrome.storage.local.remove).not.toHaveBeenCalled();
    });
  });

  describe('getApiBaseUrl', () => {
    it('should return an empty string when no server is configured', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});

      expect(await SettingsService.getApiBaseUrl()).toBe('');
    });

    it('should return the configured server URL', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        userSettings: { apiHost: 'custom.local:3000', apiProtocol: 'http' },
      });

      expect(await SettingsService.getApiBaseUrl()).toBe(
        'http://custom.local:3000'
      );
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
