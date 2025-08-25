import { AuthToken, AuthProviderType } from '@/types';

export interface AuthCredentials {
  password?: {
    username: string;
    password: string;
  };
}
export interface IAuthProvider {
  readonly type: AuthProviderType;

  authenticate(
    credentials?: AuthCredentials[AuthProviderType]
  ): Promise<AuthToken>;

  refreshTokens(refreshToken: string): Promise<AuthToken>;

  validateAuth(token: string): Promise<boolean>;
}
