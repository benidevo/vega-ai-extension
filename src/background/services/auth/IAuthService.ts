import { IService } from '../IService';
import { UserProfile } from '@/types';

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
   * Get current user profile
   */
  getCurrentUser(): Promise<UserProfile | null>;

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Set authentication change listener
   */
  onAuthStateChange(callback: (user: UserProfile | null) => void): void;
}

/**
 * Google OAuth configuration
 */
export interface GoogleAuthConfig {
  clientId: string;
  scopes: string[];
  apiEndpoint: string;
}
