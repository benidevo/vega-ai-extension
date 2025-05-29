import { IAuthService, GoogleAuthConfig } from './IAuthService';
import { IStorageService } from '../storage/IStorageService';

export class GoogleAuthService implements IAuthService {
  private config: GoogleAuthConfig;
  private storageService: IStorageService;
  private authStateListeners: Array<(isAuthenticated: boolean) => void> = [];
  private isInitialized = false;

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
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  async logout(): Promise<void> {
    await this.storageService.remove('authToken');

    this.notifyAuthStateChange(false);
  }

  async getAuthToken(): Promise<string | null> {
    return await this.storageService.get<string>('authToken');
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

    if (!data.token) {
      throw new Error('Invalid response from authentication server');
    }

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
