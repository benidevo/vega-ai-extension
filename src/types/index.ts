/**
 * Job listing data interface
 */
export interface JobListing {
  title: string;
  company: string;
  location: string;
  description: string;
  jobType?:
    | 'full_time'
    | 'part_time'
    | 'contract'
    | 'intern'
    | 'remote'
    | 'freelance';
  applicationUrl?: string;
  sourceUrl: string;
  notes?: string;
}

/**
 * Authentication token structure
 */
export interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in milliseconds
}

/**
 * Authentication provider types
 */
export type AuthProviderType = 'google' | 'password';

/**
 * Job search preference
 */
export interface JobSearchPreference {
  id: string;
  user_id: number;
  job_title: string;
  location: string;
  skills?: string[];
  max_age: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Quota status for job searches
 */
export interface QuotaStatus {
  search_runs: {
    used: number;
    limit: number;
    remaining: number;
  };
  job_count: {
    used: number;
    limit: number;
    remaining: number;
  };
  reset_at: string;
}

/**
 * Active preferences API response
 */
export interface ActivePreferencesResponse {
  preferences: JobSearchPreference[];
  quota_status: QuotaStatus;
}

/**
 * Record search results response
 */
export interface RecordSearchResultsResponse {
  success: boolean;
  message: string;
  updated_quota: QuotaStatus;
}
