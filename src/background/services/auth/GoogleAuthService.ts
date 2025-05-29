import { IAuthService, GoogleAuthConfig } from './IAuthService';
import { UserProfile } from '@/types';
import { IStorageService } from '../storage/IStorageService';

export class GoogleAuthService implements IAuthService {
  private config: GoogleAuthConfig;
  private storageService: IStorageService;
  private authStateListeners: Array<(user: UserProfile | null) => void> = [];
  private isInitialized = false;

  constructor(config: GoogleAuthConfig, storageService: IStorageService) {
    this.config = config;
    this.storageService = storageService;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const authToken = await this.getAuthToken();
    if (authToken) {
      const user = await this.getCurrentUser();
      this.notifyAuthStateChange(user);
    }

    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    this.authStateListeners = [];
    this.isInitialized = false;
  }

  async login(): Promise<void> {
    const redirectUri = chrome.identity.getRedirectURL('oauth2');
    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');

    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('response_type', 'token');
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
            const params = new URLSearchParams(url.hash.substring(1));
            const accessToken = params.get('access_token');

            if (!accessToken) {
              throw new Error('No access token received');
            }

            await this.exchangeTokenForJWT(accessToken);
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  async logout(): Promise<void> {
    const authToken = await this.getAuthToken();

    if (authToken) {
      try {
        await fetch(`${this.config.apiEndpoint}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('Error revoking token on server:', error);
      }
    }

    await this.storageService.remove('authToken');
    await this.storageService.remove('user');

    this.notifyAuthStateChange(null);
  }

  async getAuthToken(): Promise<string | null> {
    return await this.storageService.get<string>('authToken');
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    return await this.storageService.get<UserProfile>('user');
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAuthToken();
    return !!token;
  }

  onAuthStateChange(callback: (user: UserProfile | null) => void): void {
    this.authStateListeners.push(callback);
  }

  private async exchangeTokenForJWT(googleToken: string): Promise<void> {
    const response = await fetch(`${this.config.apiEndpoint}/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleToken })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.token || !data.user) {
      throw new Error('Invalid response from authentication server');
    }

    await this.storageService.setMultiple({
      authToken: data.token,
      user: data.user
    });

    this.notifyAuthStateChange(data.user);
  }

  private notifyAuthStateChange(user: UserProfile | null): void {
    this.authStateListeners.forEach(listener => {
      try {
        listener(user);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }
}
