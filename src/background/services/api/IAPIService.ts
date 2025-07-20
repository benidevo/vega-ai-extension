import { IService } from '../IService';
import { JobListing, ActivePreferencesResponse } from '@/types';

/**
 * API service interface for backend communication
 */
export interface IAPIService extends IService {
  /**
   * Save a job listing to the backend
   */
  saveJob(job: JobListing): Promise<SaveJobResponse>;

  /**
   * Set authentication token for API requests
   */
  setAuthToken(token: string | null): void;

  /**
   * Get active job search preferences
   */
  getActivePreferences(): Promise<ActivePreferencesResponse | null>;

  /**
   * Record search results for a preference
   */
  recordSearchResults(preferenceId: string, jobsFound: number): Promise<void>;
}

/**
 * API response interfaces
 */
export interface SaveJobResponse {
  id: string;
  job: JobListing;
  createdAt: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * API configuration
 */
export interface APIConfig {
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
}
