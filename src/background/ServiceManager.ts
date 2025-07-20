import {
  IAuthService,
  IAPIService,
  IMessageService,
  IStorageService,
  IBadgeService,
  IPreferencesService,
  APIService,
  MessageService,
  StorageService,
  BadgeService,
  PreferencesService,
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

/**
 * Service Manager to coordinate all background services
 */
export class ServiceManager {
  private authService: IAuthService;
  private apiService: IAPIService;
  private messageService: IMessageService;
  private storageService: IStorageService;
  private badgeService: IBadgeService;
  private preferencesService: IPreferencesService;
  private isInitialized = false;
  private logger = new Logger('ServiceManager');

  constructor() {
    this.storageService = new StorageService('local');
    this.authService = null!; // Will be initialized with dynamic config
    this.apiService = null!; // Will be initialized with dynamic config
    this.preferencesService = null!; // Will be initialized with dynamic config
    this.messageService = new MessageService();
    this.badgeService = new BadgeService();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const dynamicConfig = await DynamicConfig.getConfig();

    this.authService = new MultiProviderAuthService(
      {
        google: {
          clientId: dynamicConfig.auth.providers.google.clientId,
          scopes: dynamicConfig.auth.providers.google.scopes,
          apiEndpoint: `${dynamicConfig.api.baseUrl}${dynamicConfig.auth.providers.google.apiEndpoint}`,
        },
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

    this.preferencesService = new PreferencesService(this.apiService);

    await this.storageService.initialize();
    await this.authService.initialize();
    await this.apiService.initialize();
    await this.messageService.initialize();
    await this.badgeService.initialize();
    await this.preferencesService.initialize();

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
    // Default login handler (uses Google OAuth)
    this.messageService.on(
      MessageType.LOGIN,
      (message, sender, sendResponse) => {
        this.authService
          .login()
          .then(() => {
            sendResponse({ success: true });
          })
          .catch(error => {
            const errorDetails = errorService.handleError(error, {
              action: 'login',
            });
            sendResponse({
              success: false,
              error: errorDetails.userMessage,
            });
          });
        return true;
      }
    );

    // Handler for provider-specific login
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

    // Password login handler
    this.messageService.on(
      'LOGIN_WITH_PASSWORD',
      (message, sender, sendResponse) => {
        const { username, password } = message.payload as {
          username: string;
          password: string;
        };

        const authService = this.authService as MultiProviderAuthService;

        // Wrap in immediate promise to ensure response is sent
        (async () => {
          try {
            await authService.loginWithPassword(username, password);
            sendResponse({ success: true });
          } catch (error) {
            const errorDetails = errorService.handleError(error, {
              action: 'password_login',
            });
            sendResponse({
              success: false,
              error: errorDetails.userMessage,
            });
          }
        })();

        return true;
      }
    );

    // Get available providers handler
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
    this.messageService.on('PING', (message, sender, sendResponse) => {
      sendResponse({ success: true, timestamp: Date.now() });
      return false;
    });

    this.messageService.on(MessageType.JOB_EXTRACTED, () => {
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
            // Handle API errors with custom messages
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
        // Set badge to draw attention to the extension icon
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });

        setTimeout(() => {
          chrome.action.setBadgeText({ text: '' });
        }, 5000);

        sendResponse({ success: true });
        return false;
      }
    );

    // Handle settings reload
    this.messageService.on(
      'RELOAD_SETTINGS',
      (message, sender, sendResponse) => {
        this.handleReloadSettings(sendResponse);
        return true; // Will respond asynchronously
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
    // Destroy existing services (except storage and message service)
    if (this.authService) await this.authService.destroy();
    if (this.apiService) await this.apiService.destroy();
    if (this.preferencesService) await this.preferencesService.destroy();

    const dynamicConfig = await DynamicConfig.getConfig();

    this.authService = new MultiProviderAuthService(
      {
        google: {
          clientId: dynamicConfig.auth.providers.google.clientId,
          scopes: dynamicConfig.auth.providers.google.scopes,
          apiEndpoint: `${dynamicConfig.api.baseUrl}${dynamicConfig.auth.providers.google.apiEndpoint}`,
        },
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

    this.preferencesService = new PreferencesService(this.apiService);

    await this.authService.initialize();
    await this.apiService.initialize();
    await this.preferencesService.initialize();

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

  get preferences(): IPreferencesService {
    return this.preferencesService;
  }

  async destroy(): Promise<void> {
    await keepAliveService.destroy();
    connectionManager.destroy();
    await this.authService?.destroy();
    await this.apiService?.destroy();
    await this.messageService?.destroy();
    await this.badgeService?.destroy();
    await this.preferencesService?.destroy();
    this.isInitialized = false;
  }
}
