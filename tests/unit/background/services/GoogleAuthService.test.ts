import { GoogleAuthService } from '../../../../src/background/services/auth/GoogleAuthService';
import { IStorageService } from '../../../../src/background/services/storage/IStorageService';
import { AuthToken } from '../../../../src/types';
import { chrome } from '../../../mocks/chrome';

// Mock fetch globally
global.fetch = jest.fn();

describe('GoogleAuthService', () => {
  let authService: GoogleAuthService;
  let mockStorageService: jest.Mocked<IStorageService>;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  const mockConfig = {
    clientId: 'test-client-id',
    scopes: ['openid', 'email', 'profile'],
    apiEndpoint: 'http://localhost:8000/api/auth/google'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService = {
      initialize: jest.fn(),
      destroy: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      getMultiple: jest.fn(),
      setMultiple: jest.fn(),
    };
    authService = new GoogleAuthService(mockConfig, mockStorageService);
  });

  describe('login', () => {
    it('should complete OAuth flow and store tokens', async () => {
      const mockAuthCode = 'test-auth-code';
      const mockTokenResponse = {
        token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600
      };

      // Mock Chrome identity API
      chrome.identity.launchWebAuthFlow.mockImplementation((_options: any, callback: Function) => {
        callback(`https://test-extension-id.chromiumapp.org/?code=${mockAuthCode}`);
      });

      // Mock token exchange API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
        statusText: 'OK'
      } as Response);

      await authService.login();

      // Verify Chrome identity API was called correctly
      expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('https://accounts.google.com/o/oauth2/auth'),
          interactive: true
        }),
        expect.any(Function)
      );

      // Verify token exchange API call
      expect(mockFetch).toHaveBeenCalledWith(mockConfig.apiEndpoint, expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: mockAuthCode,
          redirect_uri: 'https://test-extension-id.chromiumapp.org/'
        })
      }));

      // Verify tokens were stored
      expect(mockStorageService.set).toHaveBeenCalledWith('authTokenData', expect.objectContaining({
        access_token: mockTokenResponse.token,
        refresh_token: mockTokenResponse.refresh_token,
        expires_at: expect.any(Number)
      }));
      expect(mockStorageService.set).toHaveBeenCalledWith('authToken', mockTokenResponse.token);
    });

    it('should handle authentication cancellation', async () => {
      chrome.runtime.lastError = { message: 'User cancelled' };
      chrome.identity.launchWebAuthFlow.mockImplementation((_options: any, callback: Function) => {
        callback(undefined);
      });

      await expect(authService.login()).rejects.toThrow('User cancelled');

      chrome.runtime.lastError = null;
    });

    it('should handle token exchange failure', async () => {
      chrome.identity.launchWebAuthFlow.mockImplementation((_options: any, callback: Function) => {
        callback('https://test-extension-id.chromiumapp.org/?code=test-code');
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      } as Response);

      await expect(authService.login()).rejects.toThrow('Authentication failed: Unauthorized');
    });

    it('should prevent duplicate login attempts', async () => {
      chrome.identity.launchWebAuthFlow.mockImplementation((_options: any, callback: Function) => {
        // Simulate delay
        setTimeout(() => callback('https://test-extension-id.chromiumapp.org/?code=test-code'), 100);
      });

      // Start first login
      const firstLogin = authService.login();

      // Try second login immediately
      const secondLogin = authService.login();

      // Second login should resolve immediately without calling Chrome API again
      await secondLogin;
      expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledTimes(1);

      // Clean up first login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test', refresh_token: 'test', expires_in: 3600 })
      } as Response);
      await firstLogin;
    });
  });

  describe('logout', () => {
    it('should clear stored tokens', async () => {
      await authService.logout();

      expect(mockStorageService.remove).toHaveBeenCalledWith('authToken');
      expect(mockStorageService.remove).toHaveBeenCalledWith('authTokenData');
    });
  });

  describe('getAuthToken', () => {
    it('should return valid token', async () => {
      const mockTokenData: AuthToken = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_at: Date.now() + 3600 * 1000 // 1 hour from now
      };

      mockStorageService.get.mockResolvedValueOnce(mockTokenData);

      const token = await authService.getAuthToken();
      expect(token).toBe('test-token');
    });

    it('should refresh expired token', async () => {
      const expiredTokenData: AuthToken = {
        access_token: 'expired-token',
        refresh_token: 'test-refresh',
        expires_at: Date.now() - 1000 // Expired
      };

      const refreshedTokenResponse = {
        token: 'new-token',
        expires_in: 3600
      };

      mockStorageService.get.mockResolvedValueOnce(expiredTokenData);
      mockStorageService.get.mockResolvedValueOnce(expiredTokenData); // For refresh check

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => refreshedTokenResponse
      } as Response);

      mockStorageService.get.mockResolvedValueOnce({
        access_token: 'new-token',
        refresh_token: 'test-refresh',
        expires_at: Date.now() + 3600 * 1000
      });

      const token = await authService.getAuthToken();
      expect(token).toBe('new-token');

      // Verify refresh endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(`${mockConfig.apiEndpoint}/refresh`, expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refresh_token: 'test-refresh' })
      }));
    });

    it('should handle refresh token failure', async () => {
      const expiredTokenData: AuthToken = {
        access_token: 'expired-token',
        refresh_token: 'test-refresh',
        expires_at: Date.now() - 1000
      };

      mockStorageService.get.mockResolvedValueOnce(expiredTokenData);
      mockStorageService.get.mockResolvedValueOnce(expiredTokenData);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response);

      const token = await authService.getAuthToken();
      expect(token).toBeNull();

      // Verify logout was called on 401
      expect(mockStorageService.remove).toHaveBeenCalledWith('authToken');
      expect(mockStorageService.remove).toHaveBeenCalledWith('authTokenData');
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when valid token exists', async () => {
      mockStorageService.get.mockResolvedValueOnce({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_at: Date.now() + 3600 * 1000
      });

      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    it('should return false when no token exists', async () => {
      mockStorageService.get.mockResolvedValueOnce(null);

      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });

  describe('onAuthStateChange', () => {
    it('should notify listeners on login', async () => {
      const listener = jest.fn();
      authService.onAuthStateChange(listener);

      chrome.identity.launchWebAuthFlow.mockImplementation((_options: any, callback: Function) => {
        callback('https://test-extension-id.chromiumapp.org/?code=test-code');
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test', refresh_token: 'test', expires_in: 3600 })
      } as Response);

      await authService.login();

      expect(listener).toHaveBeenCalledWith(true);
    });

    it('should notify listeners on logout', async () => {
      const listener = jest.fn();
      authService.onAuthStateChange(listener);

      await authService.logout();

      expect(listener).toHaveBeenCalledWith(false);
    });

    it('should handle listener errors gracefully', async () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      authService.onAuthStateChange(errorListener);
      authService.onAuthStateChange(normalListener);

      await authService.logout();

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalledWith(false);
      expect(console.error).toHaveBeenCalledWith('Error in auth state listener:', expect.any(Error));
    });
  });
});
