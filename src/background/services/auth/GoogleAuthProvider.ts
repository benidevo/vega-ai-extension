import { IAuthProvider, AuthCredentials } from './IAuthProvider';
import { AuthToken } from '@/types';
import { authLogger } from '../../../utils/logger';

/**
 * Google OAuth authentication provider
 * Wraps Chrome's identity API for OAuth flow
 */
export class GoogleAuthProvider implements IAuthProvider {
  readonly type = 'google' as const;

  private clientId: string;
  private scopes: string[];
  private apiEndpoint: string;

  constructor(clientId: string, scopes: string[], apiEndpoint: string) {
    this.clientId = clientId;
    this.scopes = scopes;
    this.apiEndpoint = apiEndpoint;
  }

  async authenticate(
    _credentials?: AuthCredentials['google']
  ): Promise<AuthToken> {
    authLogger.info('Starting Google OAuth flow');

    try {
      const redirectUri = chrome.identity.getRedirectURL();
      const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');

      authUrl.searchParams.set('client_id', this.clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', this.scopes.join(' '));

      // Clear any cached auth sessions to prevent the double-click issue
      await new Promise<void>(resolve => {
        chrome.identity.clearAllCachedAuthTokens(() => {
          resolve();
        });
      });

      const authCode = await new Promise<string>((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          { url: authUrl.toString(), interactive: true },
          responseUrl => {
            if (chrome.runtime.lastError || !responseUrl) {
              const errorMessage =
                chrome.runtime.lastError?.message || 'OAuth flow failed';

              // Check if user cancelled the flow
              if (
                errorMessage.includes('canceled') ||
                errorMessage.includes('closed')
              ) {
                reject(new Error('Sign-in was cancelled. Please try again.'));
              } else {
                reject(new Error(errorMessage));
              }
              return;
            }

            try {
              const url = new URL(responseUrl);
              const params = new URLSearchParams(url.search);
              const code = params.get('code');

              if (!code) {
                throw new Error('No authorization code received');
              }

              resolve(code);
            } catch (error) {
              reject(error);
            }
          }
        );
      });

      // Exchange auth code for tokens
      authLogger.info('Exchanging auth code for tokens', {
        endpoint: this.apiEndpoint,
        redirectUri: redirectUri,
      });

      let response;
      try {
        response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: authCode,
            redirect_uri: redirectUri,
          }),
        });
      } catch (fetchError) {
        authLogger.error('Failed to connect to backend', fetchError, {
          endpoint: this.apiEndpoint,
        });
        throw new Error(
          `Unable to connect to authentication server at ${this.apiEndpoint}. Please check your backend configuration and ensure the server is running.`
        );
      }

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => response.statusText);
        authLogger.error('Token exchange failed', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          endpoint: this.apiEndpoint,
        });
        throw new Error(
          `Token exchange failed (${response.status}): ${errorText || response.statusText}`
        );
      }

      const data = await response.json();

      if (!data.token || !data.refresh_token) {
        throw new Error('Invalid response from authentication server');
      }

      // Calculate expiration time
      const expiresIn = data.expires_in || 3600;
      const expiresAt = Date.now() + expiresIn * 1000;

      const tokens: AuthToken = {
        access_token: data.token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
      };

      authLogger.info('Google OAuth authentication successful');

      return tokens;
    } catch (error) {
      authLogger.error('Google OAuth authentication failed', error);
      throw error;
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthToken> {
    authLogger.info('Refreshing Google OAuth tokens');

    try {
      let response;
      try {
        response = await fetch(`${this.apiEndpoint}/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refresh_token: refreshToken,
          }),
        });
      } catch (fetchError) {
        authLogger.error(
          'Failed to connect to backend for token refresh',
          fetchError,
          {
            endpoint: `${this.apiEndpoint}/refresh`,
          }
        );
        throw new Error(
          `Unable to connect to authentication server at ${this.apiEndpoint}. Please check your backend configuration.`
        );
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Refresh token expired');
        }
        const errorText = await response
          .text()
          .catch(() => response.statusText);
        throw new Error(
          `Token refresh failed (${response.status}): ${errorText || response.statusText}`
        );
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error('Invalid response from authentication server');
      }

      const expiresIn = data.expires_in || 3600;
      const expiresAt = Date.now() + expiresIn * 1000;

      const tokens: AuthToken = {
        access_token: data.token,
        refresh_token: refreshToken, // Keep existing refresh token
        expires_at: expiresAt,
      };

      authLogger.info('Google OAuth tokens refreshed successfully');
      return tokens;
    } catch (error) {
      authLogger.error('Failed to refresh Google OAuth tokens', error);
      throw error;
    }
  }

  async validateAuth(token: string): Promise<boolean> {
    return !!token;
  }
}
