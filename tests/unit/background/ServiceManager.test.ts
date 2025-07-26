import { ServiceManager } from '@/background/ServiceManager';
import { MessageType } from '@/background/services/message/IMessageService';
import { AuthCredentials } from '@/background/services/auth/IAuthProvider';

jest.mock('@/background/services', () => ({
  APIService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    setAuthToken: jest.fn(),
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
    isInitialized: jest.fn().mockReturnValue(true),
  })),
  MessageType: {
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    SAVE_JOB: 'SAVE_JOB',
    AUTH_STATE_CHANGED: 'AUTH_STATE_CHANGED',
  },
}));

jest.mock('@/background/services/auth/MultiProviderAuthService', () => ({
  MultiProviderAuthService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    login: jest.fn(),
    logout: jest.fn(),
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
          },
          password: {
            enabled: true,
          },
        },
      },
      storage: {
        syncInterval: 5,
      },
    }),
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
    start: jest.fn(),
  },
}));

jest.mock('@/background/services/ConnectionManager', () => ({
  connectionManager: {
    initialize: jest.fn(),
  },
}));

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
  });
});
