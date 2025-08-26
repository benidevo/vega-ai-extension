import {
  IAuthService,
  IAPIService,
  IMessageService,
  IStorageService,
  IBadgeService,
  APIService,
  MessageService,
  StorageService,
  BadgeService,
  MessageType,
} from './services';
import { MultiProviderAuthService } from './services/auth/MultiProviderAuthService';
import { DynamicConfig } from '@/config/dynamicConfig';
import { JobListing, AuthProviderType } from '@/types';
import { AuthCredentials } from './services/auth/IAuthProvider';
import { errorService } from './services/error';
import { Logger } from '@/utils/logger';
import { keepAliveService } from './services/KeepAliveService';
import { connectionManager } from './services/ConnectionManager';

export class ServiceManager {
  private authService: IAuthService;
  private apiService: IAPIService;
  private messageService: IMessageService;
  private storageService: IStorageService;
  private badgeService: IBadgeService;
  private isInitialized = false;
  private processedLoginRequests = new Set<string>();
  private loginRequestCleanupTimers = new Map<string, NodeJS.Timeout>();
  private logger = new Logger('ServiceManager');
  private readonly MAX_LOGIN_REQUESTS = 100;

  constructor() {
    this.storageService = new StorageService('local');
    this.authService = null!; // Will be initialized with dynamic config
    this.apiService = null!; // Will be initialized with dynamic config
    this.messageService = new MessageService();
    this.badgeService = new BadgeService();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const dynamicConfig = await DynamicConfig.getConfig();

    this.authService = new MultiProviderAuthService(
      {
        password: {
          apiBaseUrl: dynamicConfig.auth.providers.password.apiBaseUrl,
        },
      },
      this.storageService
    );

    this.apiService = new APIService(
      {
        baseUrl: dynamicConfig.api.baseUrl,
        timeout: dynamicConfig.api.timeout,
        retryAttempts: dynamicConfig.api.retryAttempts,
      },
      this.authService
    );

    await this.storageService.initialize();
    await this.authService.initialize();
    await this.apiService.initialize();
    await this.messageService.initialize();
    await this.badgeService.initialize();

    connectionManager.initialize();
    await keepAliveService.initialize();

    this.setupAuthHandlers();
    this.setupMessageHandlers();

    this.authService.onAuthStateChange(async isAuthenticated => {
      if (isAuthenticated) {
        const token = await this.authService.getAuthToken();
        if (token) {
          this.apiService.setAuthToken(token);
        } else {
          this.logger.warn(
            'Authentication state is true but no token available'
          );
        }
      } else {
        this.apiService.setAuthToken(null);
      }
    });

    const token = await this.authService.getAuthToken();
    if (token) {
      this.apiService.setAuthToken(token);
    }

    this.isInitialized = true;
  }

  private setupAuthHandlers(): void {
    this.messageService.on(
      'LOGIN_WITH_PROVIDER',
      (message, sender, sendResponse) => {
        const { provider, credentials } = message.payload as {
          provider: AuthProviderType;
          credentials?: AuthCredentials[AuthProviderType];
        };

        const authService = this.authService as MultiProviderAuthService;
        authService
          .loginWithProvider(provider, credentials)
          .then(() => {
            sendResponse({ success: true });
          })
          .catch(error => {
            const errorDetails = errorService.handleError(error, {
              action: 'provider_login',
              provider,
            });
            sendResponse({
              success: false,
              error: errorDetails.userMessage,
            });
          });
        return true;
      }
    );

    this.messageService.on(
      'LOGIN_WITH_PASSWORD',
      (message, sender, sendResponse) => {
        const { username, password } = message.payload as {
          username: string;
          password: string;
        };
        const requestId = message.requestId as string | undefined;

        if (requestId) {
          if (this.processedLoginRequests.has(requestId)) {
            console.log(
              '[ServiceManager] Duplicate login request detected, ignoring:',
              requestId
            );
            sendResponse({ success: false, error: 'Duplicate request' });
            return true;
          }

          if (this.processedLoginRequests.size >= this.MAX_LOGIN_REQUESTS) {
            const firstKey = this.processedLoginRequests.values().next().value;
            if (firstKey) {
              this.processedLoginRequests.delete(firstKey);
              const timer = this.loginRequestCleanupTimers.get(firstKey);
              if (timer) {
                clearTimeout(timer);
                this.loginRequestCleanupTimers.delete(firstKey);
              }
            }
          }

          this.processedLoginRequests.add(requestId);

          const cleanupTimer = setTimeout(() => {
            this.processedLoginRequests.delete(requestId);
            this.loginRequestCleanupTimers.delete(requestId);
          }, 2000);
          this.loginRequestCleanupTimers.set(requestId, cleanupTimer);
        }

        const authService = this.authService as MultiProviderAuthService;

        (async () => {
          try {
            console.log(
              '[ServiceManager] Login attempt, requestId:',
              requestId
            );
            await authService.loginWithPassword(username, password);
            console.log('[ServiceManager] Login successful');
            sendResponse({ success: true });
          } catch (error) {
            console.error('[ServiceManager] Login failed:', error);
            const errorDetails = errorService.handleError(error, {
              action: 'password_login',
            });
            console.log(
              '[ServiceManager] Sending error response:',
              errorDetails.userMessage
            );
            sendResponse({
              success: false,
              error: errorDetails.userMessage,
            });

            if (requestId) {
              this.processedLoginRequests.delete(requestId);
              const timer = this.loginRequestCleanupTimers.get(requestId);
              if (timer) {
                clearTimeout(timer);
                this.loginRequestCleanupTimers.delete(requestId);
              }
            }
          }
        })();

        return true;
      }
    );

    this.messageService.on(
      'GET_AUTH_PROVIDERS',
      (message, sender, sendResponse) => {
        const authService = this.authService as MultiProviderAuthService;
        const providers = authService.getAvailableProviders();
        sendResponse({ success: true, providers });
        return false;
      }
    );

    this.messageService.on(
      MessageType.LOGOUT,
      (message, sender, sendResponse) => {
        this.authService
          .logout()
          .then(() => {
            sendResponse({ success: true });
          })
          .catch(error => {
            const errorDetails = errorService.handleError(error, {
              action: 'logout',
            });
            sendResponse({
              success: false,
              error: errorDetails.userMessage,
            });
          });
        return true;
      }
    );
  }

  private setupMessageHandlers(): void {
    console.log('[ServiceManager] Setting up message handlers');
    this.messageService.on('PING', (message, sender, sendResponse) => {
      sendResponse({ success: true, timestamp: Date.now() });
      return false;
    });

    this.messageService.on(MessageType.JOB_READ, () => {
      this.badgeService.showSuccess().catch(error => {
        errorService.handleError(error, { action: 'badge_show_success' });
      });
      return false;
    });

    this.messageService.on(
      MessageType.SAVE_JOB,
      (message, sender, sendResponse) => {
        const job = message.payload as JobListing;
        this.apiService
          .saveJob(job)
          .then(async response => {
            await this.badgeService.showSuccess();
            sendResponse({ success: true, data: response });
          })
          .catch(async error => {
            const errorDetails = errorService.handleError(error, {
              action: 'save_job',
              job,
            });
            await this.badgeService.showError();
            const errorMessage =
              error.code === 'AUTH_EXPIRED'
                ? error.message
                : error.code === 'AUTH_REFRESH_FAILED'
                  ? error.message
                  : errorDetails.userMessage;
            sendResponse({ success: false, error: errorMessage });
          });
        return true;
      }
    );

    this.messageService.on(
      MessageType.OPEN_POPUP,
      (message, sender, sendResponse) => {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });

        setTimeout(() => {
          chrome.action.setBadgeText({ text: '' });
        }, 5000);

        sendResponse({ success: true });
        return false;
      }
    );

    this.messageService.on(
      'RELOAD_SETTINGS',
      (message, sender, sendResponse) => {
        this.handleReloadSettings(sendResponse);
        return true;
      }
    );
  }

  private async handleReloadSettings(
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    try {
      DynamicConfig.clearCache();

      await this.reinitialize();

      sendResponse({ success: true });
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'reload_settings',
      });
      sendResponse({
        success: false,
        error: errorDetails.userMessage,
      });
    }
  }

  private async reinitialize(): Promise<void> {
    console.log('[ServiceManager] Reinitializing services...');

    this.isInitialized = false;

    await new Promise(resolve => setTimeout(resolve, 100));

    this.loginRequestCleanupTimers.forEach(timer => clearTimeout(timer));
    this.loginRequestCleanupTimers.clear();
    this.processedLoginRequests.clear();

    await this.messageService.destroy();
    await this.messageService.initialize();

    if (this.authService) await this.authService.destroy();
    if (this.apiService) await this.apiService.destroy();

    const dynamicConfig = await DynamicConfig.getConfig();

    this.authService = new MultiProviderAuthService(
      {
        password: {
          apiBaseUrl: dynamicConfig.auth.providers.password.apiBaseUrl,
        },
      },
      this.storageService
    );

    this.apiService = new APIService(
      {
        baseUrl: dynamicConfig.api.baseUrl,
        timeout: dynamicConfig.api.timeout,
        retryAttempts: dynamicConfig.api.retryAttempts,
      },
      this.authService
    );

    await this.authService.initialize();
    await this.apiService.initialize();

    this.setupMessageHandlers();
    this.setupAuthHandlers();

    this.authService.onAuthStateChange(async isAuthenticated => {
      if (isAuthenticated) {
        const token = await this.authService.getAuthToken();
        if (token) {
          this.apiService.setAuthToken(token);
        } else {
          this.logger.warn(
            'Authentication state is true but no token available'
          );
        }
      } else {
        this.apiService.setAuthToken(null);
      }
    });

    const token = await this.authService.getAuthToken();
    if (token) {
      this.apiService.setAuthToken(token);
    }

    this.isInitialized = true;
  }

  get auth(): IAuthService {
    return this.authService;
  }

  get api(): IAPIService {
    return this.apiService;
  }

  get message(): IMessageService {
    return this.messageService;
  }

  get storage(): IStorageService {
    return this.storageService;
  }

  get badge(): IBadgeService {
    return this.badgeService;
  }

  async destroy(): Promise<void> {
    this.loginRequestCleanupTimers.forEach(timer => clearTimeout(timer));
    this.loginRequestCleanupTimers.clear();
    this.processedLoginRequests.clear();

    await keepAliveService.destroy();
    connectionManager.destroy();
    await this.authService?.destroy();
    await this.apiService?.destroy();
    await this.messageService?.destroy();
    await this.badgeService?.destroy();
    this.isInitialized = false;
  }
}
