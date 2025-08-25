import { IService } from '../IService';
import { AuthToken } from '@/types';

export interface IAuthService extends IService {
  login(username?: string, password?: string): Promise<void>;

  logout(): Promise<void>;

  getAuthToken(): Promise<string | null>;

  getAuthTokenData(): Promise<AuthToken | null>;

  refreshAuthToken(): Promise<void>;

  isAuthenticated(): Promise<boolean>;

  onAuthStateChange(callback: (isAuthenticated: boolean) => void): void;
}
