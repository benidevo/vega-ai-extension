import { MultiProviderAuthService } from '../../../../src/background/services/auth/MultiProviderAuthService';
import { IStorageService } from '../../../../src/background/services/storage/IStorageService';

jest.mock('../../../../src/config', () => ({
  config: {
    features: {
      enableGoogleAuth: false,
    },
  },
}));

jest.mock('../../../../src/utils/logger', () => ({
  authLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../../src/background/services/auth/AuthProviderFactory');
const mockPasswordProvider = {
  authenticate: jest.fn(),
  refreshTokens: jest.fn(),
  validateAuth: jest.fn(),
  type: 'password' as const,
};

const mockGoogleProvider = {
  authenticate: jest.fn(),
  refreshTokens: jest.fn(),
  validateAuth: jest.fn(),
  type: 'google' as const,
};

const mockFactoryInstance = {
  getProvider: jest.fn(type => {
    switch (type) {
      case 'password':
        return mockPasswordProvider;
      case 'google':
        return mockGoogleProvider;
      default:
        return null;
    }
  }),
  getAvailableProviders: jest.fn(() => ['password']),
};

const mockChrome = {
  storage: {
    local: {
      get: jest.fn().mockImplementation((keys, callback) => {
        if (callback) {
          callback({});
        }
        return Promise.resolve({});
      }),
    },
  },
  tabs: {
    query: jest.fn().mockImplementation((query, callback) => {
      if (callback) {
        callback([]);
      }
    }),
    sendMessage: jest.fn().mockImplementation(() => Promise.resolve()),
  },
  runtime: {
    sendMessage: jest.fn().mockImplementation(() => Promise.resolve()),
  },
};

(global as any).chrome = mockChrome;
global.fetch = jest.fn();

describe('MultiProviderAuthService', () => {
  let authService: MultiProviderAuthService;
  let mockStorageService: jest.Mocked<IStorageService>;

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

    mockPasswordProvider.authenticate.mockReset();
    mockPasswordProvider.refreshTokens.mockReset();
    mockPasswordProvider.validateAuth.mockReset();
    mockGoogleProvider.authenticate.mockReset();
    mockGoogleProvider.refreshTokens.mockReset();
    mockGoogleProvider.validateAuth.mockReset();

    mockFactoryInstance.getProvider.mockClear();
    mockFactoryInstance.getProvider.mockImplementation(type => {
      switch (type) {
        case 'password':
          return mockPasswordProvider;
        case 'google':
          return mockGoogleProvider;
        default:
          return null;
      }
    });

    mockStorageService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      getMultiple: jest.fn().mockResolvedValue({}),
      setMultiple: jest.fn().mockResolvedValue(undefined),
    };

    const {
      AuthProviderFactory,
    } = require('../../../../src/background/services/auth/AuthProviderFactory');
    AuthProviderFactory.mockClear();
    AuthProviderFactory.mockImplementation(() => mockFactoryInstance);

    mockChrome.storage.local.get.mockClear();
    mockChrome.tabs.query.mockClear();
    mockChrome.tabs.sendMessage.mockClear();
    mockChrome.runtime.sendMessage.mockClear();

    authService = new MultiProviderAuthService(mockConfig, mockStorageService);
  });

  describe('loginWithPassword', () => {
    it('should authenticate with username and password', async () => {
      mockPasswordProvider.authenticate.mockResolvedValue({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: Date.now() + 3600000,
      });

      await authService.loginWithPassword('testuser', 'testpass');

      expect(mockPasswordProvider.authenticate).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'testpass',
      });

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
      mockPasswordProvider.authenticate.mockRejectedValue(
        new Error('Invalid credentials')
      );

      await expect(
        authService.loginWithPassword('testuser', 'wrongpass')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('loginWithProvider - Password only', () => {
    it('should allow password auth', async () => {
      mockPasswordProvider.authenticate.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000,
      });

      await expect(
        authService.loginWithProvider('password', {
          username: 'user',
          password: 'pass',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('getAvailableProviders', () => {
    it('should only return password provider', () => {
      const providers = authService.getAvailableProviders();
      expect(providers).toEqual(['password']);
    });
  });

  describe('logout', () => {
    it('should clear all auth data from storage', async () => {
      await authService.logout();

      expect(mockStorageService.remove).toHaveBeenCalledWith('authToken');
      expect(mockStorageService.remove).toHaveBeenCalledWith('authTokenData');
      expect(mockStorageService.remove).toHaveBeenCalledWith('authProvider');
    });

    it('should handle logout errors', async () => {
      mockStorageService.remove.mockRejectedValueOnce(
        new Error('Storage error')
      );

      await expect(authService.logout()).rejects.toThrow('Storage error');
    });
  });

  describe('initialize', () => {
    it('should initialize and notify auth state if token exists', async () => {
      mockStorageService.get.mockImplementation(key => {
        if (key === 'authTokenData') {
          return Promise.resolve({
            access_token: 'token',
            refresh_token: 'refresh',
            expires_at: Date.now() + 3600000,
          });
        }
        return Promise.resolve(null);
      });

      const authStateCallback = jest.fn();
      authService.onAuthStateChange(authStateCallback);

      await authService.initialize();

      expect(authStateCallback).toHaveBeenCalledWith(true);
    });
  });

  describe('getAuthToken', () => {
    it('should return token if not expired', async () => {
      mockStorageService.get.mockResolvedValue({
        access_token: 'valid-token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000,
      });

      const token = await authService.getAuthToken();

      expect(token).toBe('valid-token');
    });

    it('should refresh token if expired', async () => {
      const newTokenData = {
        access_token: 'new-token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000,
      };

      mockPasswordProvider.refreshTokens.mockResolvedValue(newTokenData);

      let tokenStored = false;
      mockStorageService.get.mockImplementation(key => {
        if (key === 'authTokenData') {
          if (tokenStored) {
            return Promise.resolve(newTokenData);
          }
          return Promise.resolve({
            access_token: 'old-token',
            refresh_token: 'refresh',
            expires_at: Date.now() - 1000, // Expired
          });
        }
        if (key === 'authProvider') {
          return Promise.resolve('password');
        }
        return Promise.resolve(null);
      });

      mockStorageService.set.mockImplementation(key => {
        if (key === 'authTokenData') {
          tokenStored = true;
        }
        return Promise.resolve();
      });

      const token = await authService.getAuthToken();

      expect(mockPasswordProvider.refreshTokens).toHaveBeenCalledWith(
        'refresh'
      );
      expect(token).toBe('new-token');
    });

    it('should return null if refresh fails', async () => {
      const {
        AuthProviderFactory,
      } = require('../../../../src/background/services/auth/AuthProviderFactory');
      const mockProvider = {
        refreshTokens: jest.fn().mockRejectedValue(new Error('Refresh failed')),
      };

      const mockFactory = {
        getProvider: jest.fn().mockReturnValue(mockProvider),
        getAvailableProviders: jest.fn().mockReturnValue(['password']),
      };
      AuthProviderFactory.mockReturnValue(mockFactory);

      mockStorageService.get.mockImplementation(key => {
        if (key === 'authTokenData') {
          return Promise.resolve({
            access_token: 'old-token',
            refresh_token: 'refresh',
            expires_at: Date.now() - 1000, // Expired
          });
        }
        if (key === 'authProvider') {
          return Promise.resolve('password');
        }
        return Promise.resolve(null);
      });

      const token = await authService.getAuthToken();

      expect(token).toBeNull();
    });

    it('should return null if no token data', async () => {
      mockStorageService.get.mockResolvedValue(null);

      const token = await authService.getAuthToken();

      expect(token).toBeNull();
    });
  });

  describe('refreshAuthToken', () => {
    it('should throw if no refresh token available', async () => {
      mockStorageService.get.mockResolvedValue(null);

      await expect(authService.refreshAuthToken()).rejects.toThrow(
        'No refresh token available'
      );
    });

    it('should throw if no provider type stored', async () => {
      mockStorageService.get.mockImplementation(key => {
        if (key === 'authTokenData') {
          return Promise.resolve({
            access_token: 'token',
            refresh_token: 'refresh',
            expires_at: Date.now(),
          });
        }
        return Promise.resolve(null);
      });

      await expect(authService.refreshAuthToken()).rejects.toThrow(
        'No refresh token available'
      );
    });

    it('should logout if refresh token expired', async () => {
      mockPasswordProvider.refreshTokens.mockRejectedValue(
        new Error('Refresh token expired')
      );

      mockStorageService.get.mockImplementation(key => {
        if (key === 'authTokenData') {
          return Promise.resolve({
            access_token: 'token',
            refresh_token: 'refresh',
            expires_at: Date.now(),
          });
        }
        if (key === 'authProvider') {
          return Promise.resolve('password');
        }
        return Promise.resolve(null);
      });

      await expect(authService.refreshAuthToken()).rejects.toThrow(
        'Refresh token expired'
      );

      expect(mockStorageService.remove).toHaveBeenCalledWith('authToken');
    });
  });

  describe('isAuthenticated', () => {
    it('should return true if valid token exists', async () => {
      mockStorageService.get.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000,
      });

      const result = await authService.isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false if no token exists', async () => {
      mockStorageService.get.mockResolvedValue(null);

      const result = await authService.isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('getCurrentProvider', () => {
    it('should return current provider type', async () => {
      mockStorageService.get.mockResolvedValue('password');

      const provider = await authService.getCurrentProvider();

      expect(provider).toBe('password');
      expect(mockStorageService.get).toHaveBeenCalledWith('authProvider');
    });
  });

  describe('login with provider', () => {
    it('should prevent duplicate login attempts', async () => {
      mockPasswordProvider.authenticate.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  access_token: 'token',
                  refresh_token: 'refresh',
                  expires_at: Date.now() + 3600000,
                }),
              100
            )
          )
      );

      const login1 = authService.loginWithProvider('password', {
        username: 'user',
        password: 'pass',
      });
      const login2 = authService.loginWithProvider('password', {
        username: 'user',
        password: 'pass',
      });

      await Promise.all([login1, login2]);

      expect(mockPasswordProvider.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should handle login timeout', async () => {
      jest.useFakeTimers();

      mockPasswordProvider.authenticate.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      authService.loginWithProvider('password', {
        username: 'user',
        password: 'pass',
      });

      jest.advanceTimersByTime(30001);

      mockPasswordProvider.authenticate.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000,
      });

      await authService.loginWithProvider('password', {
        username: 'user',
        password: 'pass',
      });

      expect(mockPasswordProvider.authenticate).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  describe('login (default method)', () => {
    it('should require username and password', async () => {
      await expect(authService.login()).rejects.toThrow(
        'Username and password are required'
      );
    });

    it('should use password provider when credentials provided', async () => {
      mockPasswordProvider.authenticate.mockResolvedValue({
        access_token: 'test-token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000,
      });

      await authService.login('user', 'pass');

      expect(mockPasswordProvider.authenticate).toHaveBeenCalledWith({
        username: 'user',
        password: 'pass',
      });
    });
  });

  describe('notifyAuthStateChange', () => {
    beforeEach(() => {
      mockChrome.tabs.query.mockReset();
      mockChrome.tabs.sendMessage.mockReset();
      mockChrome.runtime.sendMessage.mockReset();
    });

    it('should notify all listeners and broadcast to tabs', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      authService.onAuthStateChange(listener1);
      authService.onAuthStateChange(listener2);

      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([
          { id: 1, url: 'https://linkedin.com/jobs' },
          { id: 2, url: 'https://linkedin.com/feed' },
        ]);
      });
      mockChrome.tabs.sendMessage.mockResolvedValue(undefined);
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      await authService.logout();

      expect(listener1).toHaveBeenCalledWith(false);
      expect(listener2).toHaveBeenCalledWith(false);
      expect(mockChrome.tabs.query).toHaveBeenCalledWith(
        { url: ['*://*.linkedin.com/*'] },
        expect.any(Function)
      );
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });

    it('should ignore connection errors when broadcasting', async () => {
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }]);
      });
      mockChrome.tabs.sendMessage.mockRejectedValue(
        new Error('Could not establish connection')
      );
      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('Receiving end does not exist')
      );

      await authService.logout();

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });

    it('should log other broadcast errors', async () => {
      const { authLogger } = require('../../../../src/utils/logger');
      authLogger.warn.mockClear();

      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }]);
      });
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Other error'));
      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('Different error')
      );

      await authService.logout();

      expect(authLogger.warn).toHaveBeenCalledWith(
        'Failed to broadcast auth state to tab',
        expect.any(Object)
      );
      expect(authLogger.warn).toHaveBeenCalledWith(
        'Failed to broadcast auth state to runtime',
        expect.any(Object)
      );
    });
  });

  describe('getAvailableProviders', () => {
    it('should only return password provider', () => {
      const authService2 = new MultiProviderAuthService(
        mockConfig,
        mockStorageService
      );
      const providers = authService2.getAvailableProviders();

      expect(providers).toEqual(['password']);
    });
  });

  describe('storeAuthTokens', () => {
    it('should call chrome.storage.local.get after storing', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ authToken: 'token' });

      mockPasswordProvider.authenticate.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000,
      });

      await authService.loginWithProvider('password', {
        username: 'user',
        password: 'pass',
      });

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith(['authToken']);
    });
  });
});
