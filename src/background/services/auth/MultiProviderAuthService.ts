import { IAuthService } from './IAuthService';
import { IStorageService } from '../storage/IStorageService';
import { AuthToken, AuthProviderType } from '@/types';
import { AuthCredentials } from './IAuthProvider';
import { AuthProviderFactory, AuthProviderConfig } from './AuthProviderFactory';
import { authLogger } from '../../../utils/logger';
import { config } from '@/config';
import { MessageType } from '../message/IMessageService';

/**
 * Multi-provider authentication service
 * Manages authentication across different providers (Google OAuth, username/password, etc.)
 */
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

  /**
   * Login with Google OAuth (maintains backward compatibility)
   */
  async login(): Promise<void> {
    return this.loginWithProvider('google');
  }

  /**
   * Login with specific provider
   */
  async loginWithProvider(
    providerType: AuthProviderType,
    credentials?: AuthCredentials[AuthProviderType]
  ): Promise<void> {
    if (this.isLoginInProgress) {
      authLogger.warn('Login already in progress, ignoring duplicate request');
      return;
    }

    // Check if Google auth is disabled
    if (providerType === 'google' && !config.features.enableGoogleAuth) {
      throw new Error('Google authentication is disabled');
    }

    this.isLoginInProgress = true;

    // Set a timeout to reset the flag in case something goes wrong
    const loginTimeout = setTimeout(() => {
      if (this.isLoginInProgress) {
        authLogger.warn('Login timeout - resetting login flag');
        this.isLoginInProgress = false;
      }
    }, 30000); // 30 second timeout

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

  /**
   * Login with username/password
   */
  async loginWithPassword(username: string, password: string): Promise<void> {
    return this.loginWithProvider('password', { username, password });
  }

  async logout(): Promise<void> {
    try {
      // Clear all stored auth data
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

    // Check if token is expired (with 5 minute buffer)
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

  /**
   * Get available authentication providers
   */
  getAvailableProviders(): AuthProviderType[] {
    const allProviders = this.factory.getAvailableProviders();
    return allProviders.filter(
      provider =>
        provider === 'password' ||
        (provider === 'google' && config.features.enableGoogleAuth)
    );
  }

  /**
   * Get current provider type
   */
  async getCurrentProvider(): Promise<AuthProviderType | null> {
    return await this.storageService.get<AuthProviderType>('authProvider');
  }

  private async storeAuthTokens(
    tokens: AuthToken,
    provider: AuthProviderType
  ): Promise<void> {
    // Store all auth data in parallel for consistency
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

    // Broadcast auth state change to all tabs and runtime
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs
            .sendMessage(tab.id, {
              type: MessageType.AUTH_STATE_CHANGED,
              payload: { isAuthenticated },
            })
            .catch(() => {
              // Ignore errors for tabs that don't have the content script
            });
        }
      });
    });

    // Also send to any popup or other extension components
    chrome.runtime
      .sendMessage({
        type: MessageType.AUTH_STATE_CHANGED,
        payload: { isAuthenticated },
      })
      .catch(() => {
        // Ignore errors if no listeners
      });
  }
}
