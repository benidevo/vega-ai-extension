import { IAuthProvider, AuthCredentials } from './IAuthProvider';
import { AuthToken } from '@/types';
import { authLogger } from '../../../utils/logger';

export class PasswordAuthService implements IAuthProvider {
  readonly type = 'password' as const;

  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async authenticate(
    credentials?: AuthCredentials['password']
  ): Promise<AuthToken> {
    try {
      if (!credentials) {
        throw new Error(
          'Username and password are required for password authentication'
        );
      }

      const { username, password } = credentials;

      if (!username || !password) {
        throw new Error('Username and password are required');
      }

      authLogger.info('Attempting password authentication');
      let response: Response;

      try {
        response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
        });
      } catch (networkError) {
        authLogger.error('Network error during authentication', networkError);

        if (
          this.apiBaseUrl.includes('localhost') ||
          this.apiBaseUrl.includes('127.0.0.1')
        ) {
          throw new Error(
            'Cannot connect to local backend. Please ensure your local Vega server is running.'
          );
        }

        throw new Error(
          'Network error. Please check your connection and try again.'
        );
      }

      if (!response.ok) {
        let errorData: { error?: string; message?: string } = {
          error: 'Authentication failed',
        };

        try {
          errorData = await response.json();
        } catch {
          authLogger.warn('Failed to parse error response', {
            status: response.status,
          });
        }

        authLogger.info('Authentication error details', {
          status: response.status,
          error: errorData.error || errorData.message,
        });

        if (response.status === 401) {
          const backendMessage = errorData.error || errorData.message;

          if (backendMessage && backendMessage.toLowerCase().includes('user')) {
            throw new Error(backendMessage);
          } else {
            throw new Error(
              'Invalid username or password. Please check your credentials.'
            );
          }
        } else if (response.status === 404) {
          throw new Error(
            'Authentication service not found. Please check your backend configuration.'
          );
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }

        throw new Error(
          errorData.error ||
            errorData.message ||
            'Unable to sign in. Please try again.'
        );
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error('Incomplete response from server. Please try again.');
      }

      if (!data.refresh_token) {
        throw new Error('Incomplete response from server. Please try again.');
      }

      const tokens: AuthToken = {
        access_token: data.token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + 3600 * 1000,
      };

      authLogger.info('Password authentication successful');

      return tokens;
    } catch (error) {
      authLogger.error('Authentication failed', error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Authentication failed: Unknown error');
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthToken> {
    authLogger.info('Refreshing password auth tokens');

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Your session has expired. Please sign in again.');
        }
        throw new Error(
          'Unable to refresh your session. Please sign in again.'
        );
      }

      const data = await response.json();

      const tokens: AuthToken = {
        access_token: data.token,
        refresh_token: refreshToken,
        expires_at: Date.now() + 3600 * 1000,
      };

      authLogger.info('Password auth tokens refreshed successfully');
      return tokens;
    } catch (error) {
      authLogger.error('Failed to refresh password auth tokens', error);
      throw error;
    }
  }

  async validateAuth(token: string): Promise<boolean> {
    return !!token && token.trim() !== '';
  }
}
