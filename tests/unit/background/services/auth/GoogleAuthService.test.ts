import { GoogleAuthService } from '../../../../../src/background/services/auth/GoogleAuthService';
import { StorageService } from '../../../../../src/background/services/storage/StorageService';
import { chrome } from '../../../../mocks/chrome';
import { Logger } from '../../../../../src/utils/logger';

jest.mock('../../../../../src/utils/logger');
jest.mock('../../../../../src/background/services/storage/StorageService');

global.fetch = jest.fn();

describe('GoogleAuthService', () => {
  let authService: GoogleAuthService;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    global.chrome = chrome;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockStorageService = {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      getMultiple: jest.fn(),
      setMultiple: jest.fn(),
      initialize: jest.fn(),
    } as any;

    (Logger as unknown as jest.Mock).mockImplementation(() => mockLogger);
    (StorageService as jest.Mock).mockImplementation(() => mockStorageService);

    const config = {
      clientId: 'test-client-id',
      scopes: ['openid', 'email', 'profile'],
      apiEndpoint: 'http://localhost:8765',
    };

    authService = new GoogleAuthService(config, mockStorageService);
  });

  describe('login', () => {
    it('should authenticate successfully', async () => {
      const mockAuthCode = 'test-auth-code';
      const mockTokenResponse = {
        token: 'jwt-token',
        refresh_token: 'refresh-token',
      };

      // Mock chrome.identity.launchWebAuthFlow
      chrome.identity.launchWebAuthFlow = jest.fn((_details, callback) => {
        callback(`https://redirect.url?code=${mockAuthCode}`);
      });

      chrome.identity.getRedirectURL.mockReturnValue('https://redirect.url/');

      // Mock successful token exchange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse),
      });

      await authService.login();

      expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8765/api/auth/google',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: mockAuthCode,
            redirect_uri: 'https://redirect.url/',
          }),
        })
      );

      expect(mockStorageService.set).toHaveBeenCalledWith(
        'authTokenData',
        expect.objectContaining({
          access_token: 'jwt-token',
          refresh_token: 'refresh-token',
        })
      );
    });

    it('should handle authentication cancellation', async () => {
      chrome.runtime.lastError = { message: 'User cancelled' };
      chrome.identity.launchWebAuthFlow = jest.fn((_details, callback) => {
        callback(undefined);
      });

      await expect(authService.login()).rejects.toThrow('User cancelled');

      chrome.runtime.lastError = null;
    });

    it('should handle token exchange errors', async () => {
      const mockAuthCode = 'test-auth-code';

      chrome.identity.launchWebAuthFlow = jest.fn((_details, callback) => {
        callback(`https://redirect.url?code=${mockAuthCode}`);
      });

      chrome.identity.getRedirectURL.mockReturnValue('https://redirect.url/');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
      });

      await expect(authService.login()).rejects.toThrow('Authentication failed: Unauthorized');
    });
  });

  describe('logout', () => {
    it('should clear auth tokens on logout', async () => {
      await authService.logout();

      expect(mockStorageService.remove).toHaveBeenCalledWith('authToken');
      expect(mockStorageService.remove).toHaveBeenCalledWith('authTokenData');
    });
  });

  describe('getAuthToken', () => {
    it('should return valid token', async () => {
      const mockTokenData = {
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: Date.now() + 3600000, // 1 hour from now
      };

      mockStorageService.get.mockResolvedValue(mockTokenData);

      const token = await authService.getAuthToken();

      expect(token).toBe('valid-token');
    });

    it('should refresh expired token', async () => {
      const expiredTokenData = {
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        expires_at: Date.now() - 1000, // Expired
      };

      const newTokenData = {
        token: 'new-token',
        expires_at: Date.now() + 3600000,
      };

      mockStorageService.get.mockResolvedValue(expiredTokenData);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(newTokenData),
      });

      await authService.getAuthToken();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8765/api/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: 'refresh-token' }),
        })
      );

      expect(mockStorageService.set).toHaveBeenCalledWith(
        'authTokenData',
        expect.objectContaining({
          access_token: 'new-token',
        })
      );
    });

    it('should return null when no token exists', async () => {
      mockStorageService.get.mockResolvedValue(null);

      const token = await authService.getAuthToken();

      expect(token).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token exists', async () => {
      mockStorageService.get.mockResolvedValue({
        access_token: 'valid-token',
        expires_at: Date.now() + 3600000,
      });

      const result = await authService.isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false when no token exists', async () => {
      mockStorageService.get.mockResolvedValue(null);

      const result = await authService.isAuthenticated();

      expect(result).toBe(false);
    });
  });
});
