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
  MessageType
} from './services';

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
        clientId: 'placeholder-client-id.apps.googleusercontent.com',
        scopes: ['email', 'profile'],
        apiEndpoint: 'https://localhost:8000/api/auth'
      },
      this.storageService
    );

    this.apiService = new APIService({
      baseUrl: 'https://localhost:8000/api',
      timeout: 30000,
      retryAttempts: 3
    });

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

    this.authService.onAuthStateChange(async (user) => {
      if (user) {
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
    this.messageService.on(MessageType.LOGIN, (message, sender, sendResponse) => {
      this.authService.login()
        .then(async () => {
          const user = await this.authService.getCurrentUser();
          sendResponse({ success: true, user });
        })
        .catch((error) => {
          console.error('Login error:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Login failed' });
        });
      return true;
    });

    this.messageService.on(MessageType.LOGOUT, (message, sender, sendResponse) => {
      this.authService.logout()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Logout error:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Logout failed' });
        });
      return true;
    });
  }

  private setupMessageHandlers(): void {
    this.messageService.on(MessageType.JOB_EXTRACTED, () => {
      this.badgeService.showSuccess().catch(console.error);
      return false;
    });

    this.messageService.on(MessageType.SAVE_JOB, (message, sender, sendResponse) => {
      const job = message.payload;
      this.apiService.saveJob(job)
        .then(async (response) => {
          await this.badgeService.showSuccess();
          sendResponse({ success: true, data: response });
        })
        .catch(async (error) => {
          console.error('Save job error:', error);
          await this.badgeService.showError();
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Save failed' });
        });
      return true;
    });
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
