import { IService } from '../IService';

/**
 * Authentication service interface
 */
export interface IAuthService extends IService {
  /**
   * Initiate Google OAuth flow
   */
  login(): Promise<void>;

  /**
   * Logout the current user
   */
  logout(): Promise<void>;

  /**
   * Get current authentication token
   */
  getAuthToken(): Promise<string | null>;

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Set authentication change listener
   */
  onAuthStateChange(callback: (isAuthenticated: boolean) => void): void;
}

/**
 * Google OAuth configuration
 */
export interface GoogleAuthConfig {
  clientId: string;
  scopes: string[];
  apiEndpoint: string;
}
