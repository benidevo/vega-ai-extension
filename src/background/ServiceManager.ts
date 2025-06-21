import {
  IAuthService,
  IAPIService,
  IMessageService,
  IStorageService,
  IBadgeService,
  GoogleAuthService,
  APIService,
  MessageService,
  StorageService,
  BadgeService,
  MessageType,
} from './services';
import { googleConfig, apiConfig } from '@/config';
import { JobListing } from '@/types';

/**
 * Service Manager to coordinate all background services
 */
export class ServiceManager {
  private authService: IAuthService;
  private apiService: IAPIService;
  private messageService: IMessageService;
  private storageService: IStorageService;
  private badgeService: IBadgeService;
  private isInitialized = false;

  constructor() {
    this.storageService = new StorageService('local');

    this.authService = new GoogleAuthService(
      {
        clientId: googleConfig.clientId,
        scopes: googleConfig.scopes,
        apiEndpoint: `${apiConfig.baseUrl}${apiConfig.authEndpoint}`,
      },
      this.storageService
    );

    this.apiService = new APIService(
      {
        baseUrl: apiConfig.baseUrl,
        timeout: apiConfig.timeout,
        retryAttempts: apiConfig.retryAttempts,
      },
      this.authService
    );

    this.messageService = new MessageService();
    this.badgeService = new BadgeService();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.storageService.initialize();
    await this.authService.initialize();
    await this.apiService.initialize();
    await this.messageService.initialize();
    await this.badgeService.initialize();

    this.setupAuthHandlers();
    this.setupMessageHandlers();

    this.authService.onAuthStateChange(async isAuthenticated => {
      if (isAuthenticated) {
        const token = await this.authService.getAuthToken();
        this.apiService.setAuthToken(token);
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

  async destroy(): Promise<void> {
    await this.badgeService.destroy();
    await this.messageService.destroy();
    await this.apiService.destroy();
    await this.authService.destroy();
    await this.storageService.destroy();

    this.isInitialized = false;
  }

  private setupAuthHandlers(): void {
    this.messageService.on(
      MessageType.LOGIN,
      (message, sender, sendResponse) => {
        this.authService
          .login()
          .then(() => {
            sendResponse({ success: true });
          })
          .catch(error => {
            console.error('Login error:', error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : 'Login failed',
            });
          });
        return true;
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
            console.error('Logout error:', error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : 'Logout failed',
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
      this.badgeService.showSuccess().catch(console.error);
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
            console.error('Save job error:', error);
            await this.badgeService.showError();
            // Handle API errors with custom messages
            const errorMessage =
              error.code === 'AUTH_EXPIRED'
                ? error.message
                : error.code === 'AUTH_REFRESH_FAILED'
                  ? error.message
                  : error.message || 'Save failed';
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
}
