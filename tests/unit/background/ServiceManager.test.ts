import { ServiceManager } from '@/background/ServiceManager';
import { MessageType } from '@/background/services/message/IMessageService';
import { AuthCredentials } from '@/background/services/auth/IAuthProvider';

jest.mock('@/background/services', () => ({
  APIService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    setAuthToken: jest.fn(),
    saveJob: jest.fn(),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
  MessageService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
    sendToTab: jest.fn(),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
  StorageService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
  BadgeService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    updateCount: jest.fn().mockResolvedValue(undefined),
    showSuccess: jest.fn().mockResolvedValue(undefined),
    showError: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
  MessageType: {
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    SAVE_JOB: 'SAVE_JOB',
    AUTH_STATE_CHANGED: 'AUTH_STATE_CHANGED',
    JOB_EXTRACTED: 'JOB_EXTRACTED',
    OPEN_POPUP: 'OPEN_POPUP',
  },
}));

jest.mock('@/background/services/auth/MultiProviderAuthService', () => ({
  MultiProviderAuthService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    login: jest.fn(),
    logout: jest.fn(),
    loginWithProvider: jest.fn(),
    loginWithPassword: jest.fn(),
    getAvailableProviders: jest.fn(),
    refreshToken: jest.fn(),
    getAuthToken: jest.fn(),
    getRefreshToken: jest.fn(),
    isAuthenticated: jest.fn(),
    onAuthStateChange: jest.fn(),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('@/config/dynamicConfig', () => ({
  DynamicConfig: {
    getConfig: jest.fn().mockResolvedValue({
      api: {
        baseUrl: 'http://localhost:8765',
        authEndpoint: '/api/auth',
        timeout: 30000,
        retryAttempts: 3,
      },
      auth: {
        providers: {
          google: {
            clientId: 'test-client-id',
            redirectUri: 'test-redirect-uri',
            scopes: ['profile', 'email'],
            apiEndpoint: '/auth/google',
          },
          password: {
            enabled: true,
            apiBaseUrl: 'http://localhost:8765',
          },
        },
      },
      storage: {
        syncInterval: 5,
      },
    }),
    clearCache: jest.fn(),
  },
}));

jest.mock('@/background/services/error', () => ({
  errorService: {
    handleError: jest.fn().mockReturnValue({
      category: 'UNKNOWN',
      message: 'Test error',
      userMessage: 'An error occurred',
    }),
    handleAndLogError: jest.fn().mockReturnValue({
      category: 'UNKNOWN',
      message: 'Test error',
      userMessage: 'An error occurred',
    }),
  },
}));

jest.mock('@/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@/background/services/KeepAliveService', () => ({
  keepAliveService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    start: jest.fn(),
  },
}));

jest.mock('@/background/services/ConnectionManager', () => ({
  connectionManager: {
    initialize: jest.fn(),
    destroy: jest.fn(),
  },
}));

const mockChrome = {
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
  },
};

(global as any).chrome = mockChrome;

describe('ServiceManager', () => {
  let serviceManager: ServiceManager;
  let mockSendResponse: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    serviceManager = new ServiceManager();
    mockSendResponse = jest.fn();
  });

  describe('initialize', () => {
    it('should initialize all services', async () => {
      await serviceManager.initialize();

      const authService = (serviceManager as any).authService;
      const apiService = (serviceManager as any).apiService;
      const messageService = (serviceManager as any).messageService;
      const storageService = (serviceManager as any).storageService;
      const badgeService = (serviceManager as any).badgeService;

      expect(authService.initialize).toHaveBeenCalled();
      expect(apiService.initialize).toHaveBeenCalled();
      expect(messageService.initialize).toHaveBeenCalled();
      expect(storageService.initialize).toHaveBeenCalled();
      expect(badgeService.initialize).toHaveBeenCalled();
    });

    it('should setup auth handlers', async () => {
      await serviceManager.initialize();

      const messageService = (serviceManager as any).messageService;
      expect(messageService.on).toHaveBeenCalledWith(
        MessageType.LOGIN,
        expect.any(Function)
      );
      expect(messageService.on).toHaveBeenCalledWith(
        MessageType.LOGOUT,
        expect.any(Function)
      );
    });

    it('should setup auth state change callback', async () => {
      await serviceManager.initialize();

      const authService = (serviceManager as any).authService;
      expect(authService.onAuthStateChange).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });

  describe('setupAuthHandlers', () => {
    beforeEach(async () => {
      await serviceManager.initialize();
    });

    describe('LOGIN handler', () => {
      it('should handle successful login', async () => {
        const authService = (serviceManager as any).authService;
        authService.login.mockResolvedValue({
          token: 'test-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 3600,
        });

        const messageService = (serviceManager as any).messageService;
        const loginHandler = messageService.on.mock.calls.find(
          (call: any) => call[0] === MessageType.LOGIN
        )[1];

        const message = {
          type: MessageType.LOGIN,
          payload: {
            provider: 'google' as const,
            credentials: {} as AuthCredentials,
          },
        };

        loginHandler(message, {}, mockSendResponse);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(authService.login).toHaveBeenCalled();
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
        });
      });

      it('should handle login failure', async () => {
        const authService = (serviceManager as any).authService;
        const error = new Error('Login failed');
        authService.login.mockRejectedValue(error);

        const messageService = (serviceManager as any).messageService;
        const loginHandler = messageService.on.mock.calls.find(
          (call: any) => call[0] === MessageType.LOGIN
        )[1];

        const message = {
          type: MessageType.LOGIN,
          payload: {
            provider: 'password' as const,
            credentials: { email: 'test@test.com', password: 'password' },
          },
        };

        loginHandler(message, {}, mockSendResponse);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'An error occurred',
        });
      });
    });

    describe('LOGOUT handler', () => {
      it('should handle successful logout', async () => {
        const authService = (serviceManager as any).authService;
        authService.logout.mockResolvedValue(undefined);

        const messageService = (serviceManager as any).messageService;
        const logoutHandler = messageService.on.mock.calls.find(
          (call: any) => call[0] === MessageType.LOGOUT
        )[1];

        const message = { type: MessageType.LOGOUT };

        logoutHandler(message, {}, mockSendResponse);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(authService.logout).toHaveBeenCalled();
        expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
      });

      it('should handle logout failure', async () => {
        const authService = (serviceManager as any).authService;
        const error = new Error('Logout failed');
        authService.logout.mockRejectedValue(error);

        const messageService = (serviceManager as any).messageService;
        const logoutHandler = messageService.on.mock.calls.find(
          (call: any) => call[0] === MessageType.LOGOUT
        )[1];

        const message = { type: MessageType.LOGOUT };

        logoutHandler(message, {}, mockSendResponse);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'An error occurred',
        });
      });
    });
  });

  describe('auth state change callback', () => {
    it('should update API service token when authenticated', async () => {
      await serviceManager.initialize();

      const authService = (serviceManager as any).authService;
      const apiService = (serviceManager as any).apiService;
      const authStateChangeCallback =
        authService.onAuthStateChange.mock.calls[0][0];

      authService.getAuthToken.mockResolvedValue('new-auth-token');

      await authStateChangeCallback(true);

      expect(apiService.setAuthToken).toHaveBeenCalledWith('new-auth-token');
    });

    it('should clear API service token when not authenticated', async () => {
      await serviceManager.initialize();

      const authService = (serviceManager as any).authService;
      const apiService = (serviceManager as any).apiService;
      const authStateChangeCallback =
        authService.onAuthStateChange.mock.calls[0][0];

      await authStateChangeCallback(false);

      expect(apiService.setAuthToken).toHaveBeenCalledWith(null);
    });

    it('should warn when auth state is true but no token available', async () => {
      await serviceManager.initialize();

      const authService = (serviceManager as any).authService;
      const apiService = (serviceManager as any).apiService;
      const logger = (serviceManager as any).logger;
      const authStateChangeCallback =
        authService.onAuthStateChange.mock.calls[0][0];

      authService.getAuthToken.mockResolvedValue(null);

      await authStateChangeCallback(true);

      expect(logger.warn).toHaveBeenCalledWith(
        'Authentication state is true but no token available'
      );
      expect(apiService.setAuthToken).not.toHaveBeenCalledWith(null);
    });
  });

  describe('additional message handlers', () => {
    beforeEach(async () => {
      await serviceManager.initialize();
    });

    describe('LOGIN_WITH_PROVIDER handler', () => {
      it('should handle successful provider login', async () => {
        const authService = (serviceManager as any).authService;
        authService.loginWithProvider.mockResolvedValue(undefined);

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === 'LOGIN_WITH_PROVIDER'
        )[1];

        const message = {
          type: 'LOGIN_WITH_PROVIDER',
          payload: {
            provider: 'google',
            credentials: { token: 'test-token' },
          },
        };

        handler(message, {}, mockSendResponse);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(authService.loginWithProvider).toHaveBeenCalledWith('google', {
          token: 'test-token',
        });
        expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
      });

      it('should handle provider login failure', async () => {
        const authService = (serviceManager as any).authService;
        authService.loginWithProvider.mockRejectedValue(
          new Error('Provider login failed')
        );

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === 'LOGIN_WITH_PROVIDER'
        )[1];

        const message = {
          type: 'LOGIN_WITH_PROVIDER',
          payload: {
            provider: 'google',
          },
        };

        handler(message, {}, mockSendResponse);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'An error occurred',
        });
      });
    });

    describe('LOGIN_WITH_PASSWORD handler', () => {
      it('should handle successful password login', async () => {
        const authService = (serviceManager as any).authService;
        authService.loginWithPassword.mockResolvedValue(undefined);

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === 'LOGIN_WITH_PASSWORD'
        )[1];

        const message = {
          type: 'LOGIN_WITH_PASSWORD',
          payload: {
            username: 'testuser',
            password: 'testpass',
          },
        };

        const result = handler(message, {}, mockSendResponse);
        expect(result).toBe(true);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(authService.loginWithPassword).toHaveBeenCalledWith(
          'testuser',
          'testpass'
        );
        expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
      });

      it('should handle password login failure', async () => {
        const authService = (serviceManager as any).authService;
        authService.loginWithPassword.mockRejectedValue(
          new Error('Invalid credentials')
        );

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === 'LOGIN_WITH_PASSWORD'
        )[1];

        const message = {
          type: 'LOGIN_WITH_PASSWORD',
          payload: {
            username: 'testuser',
            password: 'wrongpass',
          },
        };

        handler(message, {}, mockSendResponse);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'An error occurred',
        });
      });
    });

    describe('GET_AUTH_PROVIDERS handler', () => {
      it('should return available providers', () => {
        const authService = (serviceManager as any).authService;
        authService.getAvailableProviders.mockReturnValue([
          'google',
          'password',
        ]);

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === 'GET_AUTH_PROVIDERS'
        )[1];

        const message = { type: 'GET_AUTH_PROVIDERS' };
        const result = handler(message, {}, mockSendResponse);

        expect(result).toBe(false);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          providers: ['google', 'password'],
        });
      });
    });

    describe('PING handler', () => {
      it('should respond with timestamp', () => {
        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === 'PING'
        )[1];

        const message = { type: 'PING' };
        const result = handler(message, {}, mockSendResponse);

        expect(result).toBe(false);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          timestamp: expect.any(Number),
        });
      });
    });

    describe('JOB_EXTRACTED handler', () => {
      it('should show success badge', async () => {
        const badgeService = (serviceManager as any).badgeService;
        badgeService.showSuccess.mockResolvedValue(undefined);

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === MessageType.JOB_EXTRACTED
        )[1];

        const message = { type: MessageType.JOB_EXTRACTED };
        const result = handler(message, {}, mockSendResponse);

        expect(result).toBe(false);
        expect(badgeService.showSuccess).toHaveBeenCalled();
      });

      it('should handle badge error', async () => {
        const badgeService = (serviceManager as any).badgeService;
        badgeService.showSuccess.mockRejectedValue(new Error('Badge error'));

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === MessageType.JOB_EXTRACTED
        )[1];

        const message = { type: MessageType.JOB_EXTRACTED };
        handler(message, {}, mockSendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        const { errorService } = require('@/background/services/error');
        expect(errorService.handleError).toHaveBeenCalled();
      });
    });

    describe('SAVE_JOB handler', () => {
      it('should handle successful job save', async () => {
        const apiService = (serviceManager as any).apiService;
        const badgeService = (serviceManager as any).badgeService;
        apiService.saveJob.mockResolvedValue({ id: 'job-123' });

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === MessageType.SAVE_JOB
        )[1];

        const message = {
          type: MessageType.SAVE_JOB,
          payload: {
            title: 'Test Job',
            company: 'Test Corp',
            location: 'Test City',
            description: 'Test description',
            sourceUrl: 'https://test.com',
          },
        };

        handler(message, {}, mockSendResponse);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(apiService.saveJob).toHaveBeenCalledWith(message.payload);
        expect(badgeService.showSuccess).toHaveBeenCalled();
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          data: { id: 'job-123' },
        });
      });

      it('should handle job save failure with AUTH_EXPIRED', async () => {
        const apiService = (serviceManager as any).apiService;
        const badgeService = (serviceManager as any).badgeService;
        const error = new Error('Auth token expired');
        (error as any).code = 'AUTH_EXPIRED';
        apiService.saveJob.mockRejectedValue(error);

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === MessageType.SAVE_JOB
        )[1];

        const message = {
          type: MessageType.SAVE_JOB,
          payload: { title: 'Test Job' },
        };

        handler(message, {}, mockSendResponse);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(badgeService.showError).toHaveBeenCalled();
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'Auth token expired',
        });
      });

      it('should handle job save failure with AUTH_REFRESH_FAILED', async () => {
        const apiService = (serviceManager as any).apiService;
        const badgeService = (serviceManager as any).badgeService;
        const error = new Error('Token refresh failed');
        (error as any).code = 'AUTH_REFRESH_FAILED';
        apiService.saveJob.mockRejectedValue(error);

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === MessageType.SAVE_JOB
        )[1];

        const message = {
          type: MessageType.SAVE_JOB,
          payload: { title: 'Test Job' },
        };

        handler(message, {}, mockSendResponse);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(badgeService.showError).toHaveBeenCalled();
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'Token refresh failed',
        });
      });

      it('should handle generic job save failure', async () => {
        const apiService = (serviceManager as any).apiService;
        const badgeService = (serviceManager as any).badgeService;
        apiService.saveJob.mockRejectedValue(new Error('Network error'));

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === MessageType.SAVE_JOB
        )[1];

        const message = {
          type: MessageType.SAVE_JOB,
          payload: { title: 'Test Job' },
        };

        handler(message, {}, mockSendResponse);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(badgeService.showError).toHaveBeenCalled();
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'An error occurred',
        });
      });
    });

    describe('OPEN_POPUP handler', () => {
      it('should set attention badge', () => {
        jest.useFakeTimers();

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === MessageType.OPEN_POPUP
        )[1];

        const message = { type: MessageType.OPEN_POPUP };
        const result = handler(message, {}, mockSendResponse);

        expect(result).toBe(false);
        expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
          text: '!',
        });
        expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
          color: '#3B82F6',
        });
        expect(mockSendResponse).toHaveBeenCalledWith({ success: true });

        jest.advanceTimersByTime(5000);
        expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
          text: '',
        });

        jest.useRealTimers();
      });
    });

    describe('RELOAD_SETTINGS handler', () => {
      it('should handle successful settings reload', async () => {
        const { DynamicConfig } = require('@/config/dynamicConfig');
        DynamicConfig.clearCache.mockClear();

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === 'RELOAD_SETTINGS'
        )[1];

        const message = { type: 'RELOAD_SETTINGS' };
        const result = handler(message, {}, mockSendResponse);
        expect(result).toBe(true);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(DynamicConfig.clearCache).toHaveBeenCalled();
        expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
      });

      it('should handle settings reload failure', async () => {
        const { DynamicConfig } = require('@/config/dynamicConfig');
        DynamicConfig.getConfig.mockRejectedValueOnce(
          new Error('Config load failed')
        );

        const messageService = (serviceManager as any).messageService;
        const handler = messageService.on.mock.calls.find(
          (call: any) => call[0] === 'RELOAD_SETTINGS'
        )[1];

        const message = { type: 'RELOAD_SETTINGS' };
        handler(message, {}, mockSendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'An error occurred',
        });
      });
    });
  });

  describe('getters', () => {
    beforeEach(async () => {
      await serviceManager.initialize();
    });

    it('should return all services through getters', () => {
      expect(serviceManager.auth).toBe((serviceManager as any).authService);
      expect(serviceManager.api).toBe((serviceManager as any).apiService);
      expect(serviceManager.message).toBe(
        (serviceManager as any).messageService
      );
      expect(serviceManager.storage).toBe(
        (serviceManager as any).storageService
      );
      expect(serviceManager.badge).toBe((serviceManager as any).badgeService);
    });
  });

  describe('destroy', () => {
    it('should destroy all services', async () => {
      await serviceManager.initialize();

      const authService = (serviceManager as any).authService;
      const apiService = (serviceManager as any).apiService;
      const messageService = (serviceManager as any).messageService;
      const badgeService = (serviceManager as any).badgeService;
      const {
        keepAliveService,
      } = require('@/background/services/KeepAliveService');
      const {
        connectionManager,
      } = require('@/background/services/ConnectionManager');

      await serviceManager.destroy();

      expect(keepAliveService.destroy).toHaveBeenCalled();
      expect(connectionManager.destroy).toHaveBeenCalled();
      expect(authService.destroy).toHaveBeenCalled();
      expect(apiService.destroy).toHaveBeenCalled();
      expect(messageService.destroy).toHaveBeenCalled();
      expect(badgeService.destroy).toHaveBeenCalled();
      expect((serviceManager as any).isInitialized).toBe(false);
    });
  });

  describe('initialization edge cases', () => {
    it('should not reinitialize if already initialized', async () => {
      await serviceManager.initialize();

      const authService = (serviceManager as any).authService;
      jest.clearAllMocks();

      await serviceManager.initialize();

      expect(authService.initialize).not.toHaveBeenCalled();
    });
  });
});
