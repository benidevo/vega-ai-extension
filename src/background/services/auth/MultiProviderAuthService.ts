import { IAuthService } from './IAuthService';
import { IStorageService } from '../storage/IStorageService';
import { AuthToken, AuthProviderType } from '@/types';
import { AuthCredentials } from './IAuthProvider';
import { AuthProviderFactory, AuthProviderConfig } from './AuthProviderFactory';
import { authLogger } from '../../../utils/logger';
import { MessageType } from '../message/IMessageService';

export class MultiProviderAuthService implements IAuthService {
  private factory: AuthProviderFactory;
  private storageService: IStorageService;
  private authStateListeners: Array<(isAuthenticated: boolean) => void> = [];
  private isInitialized = false;
  private isLoginInProgress = false;

  constructor(config: AuthProviderConfig, storageService: IStorageService) {
    this.factory = new AuthProviderFactory(config);
    this.storageService = storageService;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const authToken = await this.getAuthToken();
    await this.storageService.get<AuthProviderType>('authProvider');

    if (authToken) {
      this.notifyAuthStateChange(true);
    }

    this.isInitialized = true;
    authLogger.info('MultiProviderAuthService initialized');
  }

  async destroy(): Promise<void> {
    this.authStateListeners = [];
    this.isInitialized = false;
    authLogger.info('MultiProviderAuthService destroyed');
  }

  async login(username?: string, password?: string): Promise<void> {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }
    return this.loginWithProvider('password', { username, password });
  }

  async loginWithProvider(
    providerType: AuthProviderType,
    credentials?: AuthCredentials[AuthProviderType]
  ): Promise<void> {
    if (this.isLoginInProgress) {
      authLogger.warn('Login already in progress, ignoring duplicate request');
      return;
    }

    if (providerType !== 'password') {
      throw new Error(
        `Authentication provider ${providerType} is not supported`
      );
    }

    this.isLoginInProgress = true;

    const loginTimeout = setTimeout(() => {
      if (this.isLoginInProgress) {
        authLogger.warn('Login timeout - resetting login flag');
        this.isLoginInProgress = false;
      }
    }, 30000);

    try {
      authLogger.info('Starting login process', { provider: providerType });

      const provider = this.factory.getProvider(providerType);
      const tokens = await provider.authenticate(credentials);

      await this.storeAuthTokens(tokens, providerType);

      clearTimeout(loginTimeout);
      this.isLoginInProgress = false;
      this.notifyAuthStateChange(true);

      authLogger.info('Login successful', { provider: providerType });
    } catch (error) {
      clearTimeout(loginTimeout);
      this.isLoginInProgress = false;
      authLogger.error('Login failed', error, { provider: providerType });
      throw error;
    }
  }

  async loginWithPassword(username: string, password: string): Promise<void> {
    return this.loginWithProvider('password', { username, password });
  }

  async logout(): Promise<void> {
    try {
      await this.storageService.remove('authToken');
      await this.storageService.remove('authTokenData');
      await this.storageService.remove('authProvider');

      this.notifyAuthStateChange(false);
      authLogger.info('Logout completed');
    } catch (error) {
      authLogger.error('Logout failed', error);
      throw error;
    }
  }

  async getAuthToken(): Promise<string | null> {
    const tokenData = await this.getAuthTokenData();
    if (!tokenData) return null;

    const isExpired = Date.now() >= tokenData.expires_at - 5 * 60 * 1000;
    if (isExpired) {
      try {
        await this.refreshAuthToken();
        const refreshedTokenData = await this.getAuthTokenData();
        return refreshedTokenData?.access_token || null;
      } catch (error) {
        authLogger.error('Failed to refresh token', error);
        return null;
      }
    }

    return tokenData.access_token;
  }

  async getAuthTokenData(): Promise<AuthToken | null> {
    return await this.storageService.get<AuthToken>('authTokenData');
  }

  async refreshAuthToken(): Promise<void> {
    const tokenData = await this.getAuthTokenData();
    const providerType =
      await this.storageService.get<AuthProviderType>('authProvider');

    if (!tokenData || !tokenData.refresh_token || !providerType) {
      throw new Error('No refresh token available');
    }

    try {
      const provider = this.factory.getProvider(providerType);
      const newTokens = await provider.refreshTokens(tokenData.refresh_token);

      await this.storeAuthTokens(newTokens, providerType);
      authLogger.info('Token refresh successful', { provider: providerType });
    } catch (error) {
      authLogger.error('Token refresh failed', error, {
        provider: providerType,
      });

      if (error instanceof Error && error.message === 'Refresh token expired') {
        await this.logout();
      }

      throw error;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAuthToken();
    return !!token;
  }

  onAuthStateChange(callback: (isAuthenticated: boolean) => void): void {
    this.authStateListeners.push(callback);
  }

  getAvailableProviders(): AuthProviderType[] {
    return ['password'];
  }

  async getCurrentProvider(): Promise<AuthProviderType | null> {
    return await this.storageService.get<AuthProviderType>('authProvider');
  }

  private async storeAuthTokens(
    tokens: AuthToken,
    provider: AuthProviderType
  ): Promise<void> {
    await Promise.all([
      this.storageService.set('authTokenData', tokens),
      this.storageService.set('authProvider', provider),
      this.storageService.set('authToken', tokens.access_token),
    ]);

    await chrome.storage.local.get(['authToken']);
  }

  private notifyAuthStateChange(isAuthenticated: boolean): void {
    this.authStateListeners.forEach(listener => {
      try {
        listener(isAuthenticated);
      } catch (error) {
        authLogger.error('Error in auth state listener', error);
      }
    });

    chrome.tabs.query({ url: ['*://*.linkedin.com/*'] }, tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs
            .sendMessage(tab.id, {
              type: MessageType.AUTH_STATE_CHANGED,
              payload: { isAuthenticated },
            })
            .catch(error => {
              if (
                !error.message?.includes('Could not establish connection') &&
                !error.message?.includes('Receiving end does not exist')
              ) {
                authLogger.warn('Failed to broadcast auth state to tab', {
                  tabId: tab.id,
                  error: error.message,
                });
              }
            });
        }
      });
    });

    chrome.runtime
      .sendMessage({
        type: MessageType.AUTH_STATE_CHANGED,
        payload: { isAuthenticated },
      })
      .catch(error => {
        if (
          !error.message?.includes('Could not establish connection') &&
          !error.message?.includes('Receiving end does not exist')
        ) {
          authLogger.warn('Failed to broadcast auth state to runtime', {
            error: error.message,
          });
        }
      });
  }
}
