import { GoogleAuthProvider } from '@/background/services/auth/GoogleAuthProvider';
import { mockChrome, resetChromeMocks } from '../../../../mocks/chrome';

jest.mock('@/utils/logger', () => ({
  authLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

global.fetch = jest.fn();

describe('GoogleAuthProvider', () => {
  let authProvider: GoogleAuthProvider;
  const clientId = 'test-client-id';
  const scopes = ['scope1', 'scope2'];
  const apiEndpoint = 'https://api.example.com/auth';

  beforeEach(() => {
    jest.clearAllMocks();
    resetChromeMocks();
    (global.fetch as jest.Mock).mockReset();
    authProvider = new GoogleAuthProvider(clientId, scopes, apiEndpoint);

    mockChrome.identity.getRedirectURL = jest
      .fn()
      .mockReturnValue('https://extension-id.chromiumapp.org/');
    mockChrome.identity.clearAllCachedAuthTokens = jest.fn(callback =>
      callback()
    );
    mockChrome.identity.launchWebAuthFlow = jest.fn();
  });

  describe('type', () => {
    it('should have google type', () => {
      expect(authProvider.type).toBe('google');
    });
  });

  describe('authenticate', () => {
    it('should perform successful OAuth flow', async () => {
      const authCode = 'test-auth-code';
      const mockTokens = {
        token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
      };

      mockChrome.identity.launchWebAuthFlow = jest.fn((options, callback) => {
        expect(options.interactive).toBe(true);
        expect(options.url).toContain(clientId);
        expect(options.url).toContain('scope1+scope2');
        callback('https://extension-id.chromiumapp.org/?code=' + authCode);
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      const result = await authProvider.authenticate();

      expect(mockChrome.identity.clearAllCachedAuthTokens).toHaveBeenCalled();
      expect(mockChrome.identity.launchWebAuthFlow).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: authCode,
          redirect_uri: 'https://extension-id.chromiumapp.org/',
        }),
      });

      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: expect.any(Number),
      });
    });

    it('should handle user cancellation', async () => {
      mockChrome.runtime.lastError = { message: 'User canceled the operation' };
      mockChrome.identity.launchWebAuthFlow = jest.fn((options, callback) => {
        callback(null);
      });

      await expect(authProvider.authenticate()).rejects.toThrow(
        'Sign-in was cancelled. Please try again.'
      );

      mockChrome.runtime.lastError = null;
    });

    it('should handle OAuth flow errors', async () => {
      mockChrome.runtime.lastError = { message: 'OAuth flow failed' };
      mockChrome.identity.launchWebAuthFlow = jest.fn((options, callback) => {
        callback(null);
      });

      await expect(authProvider.authenticate()).rejects.toThrow(
        'OAuth flow failed'
      );

      mockChrome.runtime.lastError = null;
    });

    it('should handle missing authorization code', async () => {
      mockChrome.identity.launchWebAuthFlow = jest.fn((options, callback) => {
        callback('https://extension-id.chromiumapp.org/?error=access_denied');
      });

      await expect(authProvider.authenticate()).rejects.toThrow(
        'No authorization code received'
      );
    });

    it('should handle token exchange network errors', async () => {
      mockChrome.identity.launchWebAuthFlow = jest.fn((options, callback) => {
        callback('https://extension-id.chromiumapp.org/?code=test-code');
      });

      (global.fetch as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Network error');
      });

      await expect(authProvider.authenticate()).rejects.toThrow(
        `Unable to connect to authentication server at ${apiEndpoint}. Please check your backend configuration and ensure the server is running.`
      );
    });

    it('should handle token exchange HTTP errors', async () => {
      mockChrome.identity.launchWebAuthFlow = jest.fn((options, callback) => {
        callback('https://extension-id.chromiumapp.org/?code=test-code');
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid authorization code',
      });

      await expect(authProvider.authenticate()).rejects.toThrow(
        'Token exchange failed (400): Invalid authorization code'
      );
    });

    it('should handle token exchange error response without text', async () => {
      mockChrome.identity.launchWebAuthFlow = jest.fn((options, callback) => {
        callback('https://extension-id.chromiumapp.org/?code=test-code');
      });

      (global.fetch as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Network error');
      });

      await expect(authProvider.authenticate()).rejects.toThrow(
        `Unable to connect to authentication server at ${apiEndpoint}. Please check your backend configuration and ensure the server is running.`
      );

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => {
          throw new Error('Failed to read response');
        },
      });

      mockChrome.identity.launchWebAuthFlow = jest.fn((options, callback) => {
        callback('https://extension-id.chromiumapp.org/?code=test-code');
      });

      await expect(authProvider.authenticate()).rejects.toThrow(
        'Token exchange failed (500): Internal Server Error'
      );
    });

    it('should handle invalid token response', async () => {
      (global.fetch as jest.Mock).mockReset();

      mockChrome.identity.launchWebAuthFlow = jest.fn((options, callback) => {
        callback('https://extension-id.chromiumapp.org/?code=test-code');
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      });

      await expect(authProvider.authenticate()).rejects.toThrow(
        'Invalid response from authentication server'
      );
    });

    it('should use default expiration time if not provided', async () => {
      (global.fetch as jest.Mock).mockReset();

      mockChrome.identity.launchWebAuthFlow = jest.fn((options, callback) => {
        callback('https://extension-id.chromiumapp.org/?code=test-code');
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'access-token',
          refresh_token: 'refresh-token',
        }),
      });

      const result = await authProvider.authenticate();

      expect(result.expires_at).toBeGreaterThan(Date.now());
      expect(result.expires_at).toBeLessThanOrEqual(Date.now() + 3600 * 1000);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const refreshToken = 'test-refresh-token';
      const mockResponse = {
        token: 'new-access-token',
        expires_in: 7200,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authProvider.refreshTokens(refreshToken);

      expect(global.fetch).toHaveBeenCalledWith(`${apiEndpoint}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: refreshToken,
        expires_at: expect.any(Number),
      });
    });

    it('should handle refresh network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(authProvider.refreshTokens('refresh-token')).rejects.toThrow(
        `Unable to connect to authentication server at ${apiEndpoint}. Please check your backend configuration.`
      );
    });

    it('should handle expired refresh token', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Refresh token expired',
      });

      await expect(authProvider.refreshTokens('refresh-token')).rejects.toThrow(
        'Refresh token expired'
      );
    });

    it('should handle refresh HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      await expect(authProvider.refreshTokens('refresh-token')).rejects.toThrow(
        'Token refresh failed (500): Server error'
      );
    });

    it('should handle refresh error without text', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => {
          throw new Error('Failed to read');
        },
      });

      await expect(authProvider.refreshTokens('refresh-token')).rejects.toThrow(
        'Token refresh failed (503): Service Unavailable'
      );
    });

    it('should handle invalid refresh response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      });

      await expect(authProvider.refreshTokens('refresh-token')).rejects.toThrow(
        'Invalid response from authentication server'
      );
    });

    it('should use default expiration time for refresh', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'new-access-token',
        }),
      });

      const result = await authProvider.refreshTokens('refresh-token');

      expect(result.expires_at).toBeGreaterThan(Date.now());
      expect(result.expires_at).toBeLessThanOrEqual(Date.now() + 3600 * 1000);
    });
  });

  describe('validateAuth', () => {
    it('should return true for valid token', async () => {
      const result = await authProvider.validateAuth('valid-token');
      expect(result).toBe(true);
    });

    it('should return false for empty token', async () => {
      const result = await authProvider.validateAuth('');
      expect(result).toBe(false);
    });

    it('should return false for null token', async () => {
      const result = await authProvider.validateAuth(null as any);
      expect(result).toBe(false);
    });

    it('should return false for undefined token', async () => {
      const result = await authProvider.validateAuth(undefined as any);
      expect(result).toBe(false);
    });
  });
});
