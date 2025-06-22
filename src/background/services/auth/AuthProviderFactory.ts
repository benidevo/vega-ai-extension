import { IAuthProvider } from './IAuthProvider';
import { AuthProviderType } from '@/types';
import { GoogleAuthProvider } from './GoogleAuthProvider';
import { PasswordAuthService } from './PasswordAuthService';

/**
 * Configuration for auth providers
 */
export interface AuthProviderConfig {
  google: {
    clientId: string;
    scopes: string[];
    apiEndpoint: string;
  };
  password: {
    apiBaseUrl: string;
  };
}

/**
 * Factory for creating authentication providers
 * Manages different auth methods (Google OAuth, username/password, etc.)
 */
export class AuthProviderFactory {
  private config: AuthProviderConfig;
  private providers: Map<AuthProviderType, IAuthProvider> = new Map();

  constructor(config: AuthProviderConfig) {
    this.config = config;
  }

  /**
   * Get auth provider by type
   */
  getProvider(type: AuthProviderType): IAuthProvider {
    // Return cached provider if it exists
    if (this.providers.has(type)) {
      return this.providers.get(type)!;
    }

    let provider: IAuthProvider;

    switch (type) {
      case 'google':
        provider = new GoogleAuthProvider(
          this.config.google.clientId,
          this.config.google.scopes,
          this.config.google.apiEndpoint
        );
        break;

      case 'password':
        provider = new PasswordAuthService(this.config.password.apiBaseUrl);
        break;

      default:
        throw new Error(`Unsupported auth provider type: ${type}`);
    }

    this.providers.set(type, provider);
    return provider;
  }

  /**
   * Get all available provider types
   */
  getAvailableProviders(): AuthProviderType[] {
    return ['google', 'password'];
  }

  /**
   * Check if a provider type is supported
   */
  isProviderSupported(type: string): type is AuthProviderType {
    return ['google', 'password'].includes(type as AuthProviderType);
  }

  /**
   * Clear cached providers (useful for testing or config changes)
   */
  clearCache(): void {
    this.providers.clear();
  }
}
