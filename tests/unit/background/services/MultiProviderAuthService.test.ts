import { MultiProviderAuthService } from '../../../../src/background/services/auth/MultiProviderAuthService';
import { IStorageService } from '../../../../src/background/services/storage/IStorageService';

// Mock config
jest.mock('../../../../src/config', () => ({
  config: {
    features: {
      enableGoogleAuth: false,
    },
  },
}));

// Mock logger
jest.mock('../../../../src/utils/logger', () => ({
  authLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('MultiProviderAuthService', () => {
  let authService: MultiProviderAuthService;
  let mockStorageService: jest.Mocked<IStorageService>;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  const mockConfig = {
    google: {
      clientId: 'test-client-id',
      scopes: ['openid'],
      apiEndpoint: 'http://localhost:8765/api/auth/google',
    },
    password: {
      apiBaseUrl: 'http://localhost:8765',
    },
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
    authService = new MultiProviderAuthService(mockConfig, mockStorageService);
  });

  describe('loginWithPassword', () => {
    it('should authenticate with username and password', async () => {
      const mockTokenResponse = {
        token: 'test-access-token',
        refresh_token: 'test-refresh-token',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
        statusText: 'OK',
      } as Response);

      await authService.loginWithPassword('testuser', 'testpass');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8765/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testuser', password: 'testpass' }),
        })
      );

      expect(mockStorageService.set).toHaveBeenCalledWith(
        'authTokenData',
        expect.objectContaining({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_at: expect.any(Number),
        })
      );
      expect(mockStorageService.set).toHaveBeenCalledWith(
        'authProvider',
        'password'
      );
      expect(mockStorageService.set).toHaveBeenCalledWith(
        'authToken',
        'test-access-token'
      );
    });

    it('should handle authentication errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
        statusText: 'Unauthorized',
      } as Response);

      await expect(
        authService.loginWithPassword('testuser', 'wrongpass')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('loginWithProvider - Google disabled', () => {
    it('should reject Google auth when disabled', async () => {
      await expect(authService.loginWithProvider('google')).rejects.toThrow(
        'Google authentication is disabled'
      );
    });

    it('should allow password auth when Google is disabled', async () => {
      const mockResponse = {
        token: 'token',
        refresh_token: 'refresh',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(
        authService.loginWithProvider('password', {
          username: 'user',
          password: 'pass',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('getAvailableProviders', () => {
    it('should only return password provider when Google is disabled', () => {
      const providers = authService.getAvailableProviders();
      expect(providers).toEqual(['password']);
      expect(providers).not.toContain('google');
    });
  });

  describe('logout', () => {
    it('should clear all auth data from storage', async () => {
      await authService.logout();

      expect(mockStorageService.remove).toHaveBeenCalledWith('authToken');
      expect(mockStorageService.remove).toHaveBeenCalledWith('authTokenData');
      expect(mockStorageService.remove).toHaveBeenCalledWith('authProvider');
    });
  });
});
