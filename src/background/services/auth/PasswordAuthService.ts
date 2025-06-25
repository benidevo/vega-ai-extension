import { IAuthProvider, AuthCredentials } from './IAuthProvider';
import { AuthToken } from '@/types';
import { authLogger } from '../../../utils/logger';

/**
 * Username/Password authentication provider
 * Handles traditional username/password authentication via backend API
 */
export class PasswordAuthService implements IAuthProvider {
  readonly type = 'password' as const;

  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async authenticate(
    credentials?: AuthCredentials['password']
  ): Promise<AuthToken> {
    if (!credentials) {
      throw new Error(
        'Username and password are required for password authentication'
      );
    }

    const { username, password } = credentials;

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    authLogger.info('Attempting password authentication', { username });

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Authentication failed' }));
        throw new Error(
          errorData.error || errorData.message || 'Authentication failed'
        );
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error('Invalid authentication response');
      }

      if (!data.refresh_token) {
        throw new Error('Invalid authentication response');
      }

      const tokens: AuthToken = {
        access_token: data.token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + 3600 * 1000, // Default to 1 hour since backend doesn't return expires_at
      };

      authLogger.info('Password authentication successful', { username });

      return tokens;
    } catch (error) {
      authLogger.error('Password authentication failed', error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Authentication failed');
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
          throw new Error('Refresh token expired');
        }
        throw new Error('Failed to refresh tokens');
      }

      const data = await response.json();

      const tokens: AuthToken = {
        access_token: data.token,
        refresh_token: refreshToken, // Keep the existing refresh token since backend doesn't return a new one
        expires_at: Date.now() + 3600 * 1000, // Default to 1 hour since backend doesn't return expires_at
      };

      authLogger.info('Password auth tokens refreshed successfully');
      return tokens;
    } catch (error) {
      authLogger.error('Failed to refresh password auth tokens', error);
      throw error;
    }
  }

  async validateAuth(token: string): Promise<boolean> {
    return !!token;
  }
}
