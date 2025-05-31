import { IAuthService, GoogleAuthConfig } from './IAuthService';
import { IStorageService } from '../storage/IStorageService';
import { AuthToken } from '@/types';

export class GoogleAuthService implements IAuthService {
  private config: GoogleAuthConfig;
  private storageService: IStorageService;
  private authStateListeners: Array<(isAuthenticated: boolean) => void> = [];
  private isInitialized = false;
  private isLoginInProgress = false;

  constructor(config: GoogleAuthConfig, storageService: IStorageService) {
    this.config = config;
    this.storageService = storageService;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const authToken = await this.getAuthToken();
    if (authToken) {
      this.notifyAuthStateChange(true);
    }

    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    this.authStateListeners = [];
    this.isInitialized = false;
  }

  async login(): Promise<void> {
    if (this.isLoginInProgress) {
      console.warn('Login already in progress, ignoring duplicate request');
      return;
    }

    this.isLoginInProgress = true;

    try {
      const redirectUri = chrome.identity.getRedirectURL();
      console.log('Extension redirect URI:', redirectUri);
      console.log('Client ID being used:', this.config.clientId);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');

    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', this.config.scopes.join(' '));

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.toString(), interactive: true },
        async (responseUrl) => {
          if (chrome.runtime.lastError || !responseUrl) {
            this.isLoginInProgress = false;
            reject(new Error(chrome.runtime.lastError?.message || 'Authentication failed'));
            return;
          }

          try {
            const url = new URL(responseUrl);
            const params = new URLSearchParams(url.search);
            const authCode = params.get('code');

            if (!authCode) {
              throw new Error('No authorization code received');
            }

            await this.exchangeTokenForJWT(authCode);
            this.isLoginInProgress = false;
            resolve();
          } catch (error) {
            this.isLoginInProgress = false;
            reject(error);
          }
        }
      );
    });
    } catch (error) {
      this.isLoginInProgress = false;
      throw error;
    }
  }

  async logout(): Promise<void> {
    await this.storageService.remove('authToken');
    await this.storageService.remove('authTokenData');

    this.notifyAuthStateChange(false);
  }

  async getAuthToken(): Promise<string | null> {
    const tokenData = await this.getAuthTokenData();
    if (!tokenData) return null;

    // Check if token is expired (with 5 minute buffer)
    const isExpired = Date.now() >= (tokenData.expires_at - 5 * 60 * 1000);
    if (isExpired) {
      try {
        await this.refreshAuthToken();
        const refreshedTokenData = await this.getAuthTokenData();
        return refreshedTokenData?.access_token || null;
      } catch (error) {
        console.error('Failed to refresh token:', error);
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
    if (!tokenData || !tokenData.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.config.apiEndpoint}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: tokenData.refresh_token
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Refresh token is invalid, user needs to login again
        await this.logout();
        throw new Error('Refresh token expired');
      }
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('Invalid response from authentication server');
    }

    const expiresIn = data.expires_in || 3600;
    const expiresAt = Date.now() + (expiresIn * 1000);

    const newTokenData: AuthToken = {
      access_token: data.token,
      refresh_token: tokenData.refresh_token, // Keep the existing refresh token
      expires_at: expiresAt
    };

    await this.storageService.set('authTokenData', newTokenData);
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAuthToken();
    return !!token;
  }

  onAuthStateChange(callback: (isAuthenticated: boolean) => void): void {
    this.authStateListeners.push(callback);
  }

  private async exchangeTokenForJWT(authCode: string): Promise<void> {
    const redirectUri = chrome.identity.getRedirectURL();
    const response = await fetch(`${this.config.apiEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: authCode,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.token || !data.refresh_token) {
      throw new Error('Invalid response from authentication server');
    }

    // Calculate expiration time (assume 1 hour if not provided)
    const expiresIn = data.expires_in || 3600;
    const expiresAt = Date.now() + (expiresIn * 1000);

    const tokenData: AuthToken = {
      access_token: data.token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt
    };

    await this.storageService.set('authTokenData', tokenData);
    // Keep backward compatibility
    await this.storageService.set('authToken', data.token);

    this.notifyAuthStateChange(true);
  }

  private notifyAuthStateChange(isAuthenticated: boolean): void {
    this.authStateListeners.forEach(listener => {
      try {
        listener(isAuthenticated);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }
}
