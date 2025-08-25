import { IAuthProvider } from './IAuthProvider';
import { AuthProviderType } from '@/types';
import { PasswordAuthService } from './PasswordAuthService';

export interface AuthProviderConfig {
  password: {
    apiBaseUrl: string;
  };
}

export class AuthProviderFactory {
  private config: AuthProviderConfig;
  private providers: Map<AuthProviderType, IAuthProvider> = new Map();

  constructor(config: AuthProviderConfig) {
    this.config = config;
  }

  getProvider(type: AuthProviderType): IAuthProvider {
    if (this.providers.has(type)) {
      return this.providers.get(type)!;
    }

    let provider: IAuthProvider;

    switch (type) {
      case 'password':
        provider = new PasswordAuthService(this.config.password.apiBaseUrl);
        break;

      default:
        throw new Error(`Unsupported auth provider type: ${type}`);
    }

    this.providers.set(type, provider);
    return provider;
  }

  getAvailableProviders(): AuthProviderType[] {
    return ['password'];
  }

  isProviderSupported(type: string): type is AuthProviderType {
    return type === 'password';
  }

  clearCache(): void {
    this.providers.clear();
  }
}
