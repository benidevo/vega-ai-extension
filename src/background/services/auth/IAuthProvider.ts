import { AuthToken, AuthProviderType } from '@/types';

/**
 * Authentication credentials for different providers
 */
export interface AuthCredentials {
  google?: {
    // Google OAuth uses Chrome identity API - no credentials needed
  };
  password?: {
    username: string;
    password: string;
  };
}

/**
 * Authentication provider interface
 * Each auth method (Google OAuth, username/password) must implement this
 */
export interface IAuthProvider {
  /**
   * Provider type identifier
   */
  readonly type: AuthProviderType;

  /**
   * Authenticate user with provider-specific credentials
   */
  authenticate(
    credentials?: AuthCredentials[AuthProviderType]
  ): Promise<AuthToken>;

  /**
   * Refresh authentication tokens
   */
  refreshTokens(refreshToken: string): Promise<AuthToken>;

  /**
   * Validate current authentication state
   */
  validateAuth(token: string): Promise<boolean>;
}
