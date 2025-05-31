import { IAPIService, SaveJobResponse, APIConfig, APIError } from './IAPIService';
import { JobListing } from '@/types';
import { IAuthService } from '../auth/IAuthService';

export class APIService implements IAPIService {
  private config: APIConfig;
  private authToken: string | null = null;
  private authService: IAuthService | null = null;
  private isInitialized = false;
  private refreshingToken = false;
  private pendingRequests: Array<() => void> = [];

  constructor(config: APIConfig, authService?: IAuthService) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      ...config
    };
    this.authService = authService || null;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    this.authToken = null;
    this.isInitialized = false;
  }

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  async saveJob(job: JobListing): Promise<SaveJobResponse> {
    const response = await this.request<SaveJobResponse>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(job)
    });

    return response;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { method = 'GET', body, params, attemptNumber = 1 } = options;

    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle 401 Unauthorized
        if (response.status === 401 && this.authService && attemptNumber === 1) {
          // Wait if already refreshing
          if (this.refreshingToken) {
            await new Promise<void>(resolve => {
              this.pendingRequests.push(resolve);
            });
            // Retry the request after token refresh
            return this.request<T>(endpoint, { ...options, attemptNumber: attemptNumber + 1 });
          }

          this.refreshingToken = true;
          try {
            await this.authService.refreshAuthToken();
            const newToken = await this.authService.getAuthToken();
            this.setAuthToken(newToken);

            this.pendingRequests.forEach(resolve => resolve());
            this.pendingRequests = [];

            return this.request<T>(endpoint, { ...options, attemptNumber: attemptNumber + 1 });
          } catch (refreshError: any) {
            // Token refresh failed, reject all pending requests
            this.pendingRequests = [];

            if (refreshError.message === 'Refresh token expired') {
              throw {
                code: 'AUTH_EXPIRED',
                message: 'Your session has expired. Please sign in again.'
              };
            }

            throw {
              code: 'AUTH_REFRESH_FAILED',
              message: 'Failed to refresh authentication. Please try signing in again.'
            };
          } finally {
            this.refreshingToken = false;
          }
        }

        const error = await this.parseError(response);
        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (this.shouldRetry(error, attemptNumber)) {
        await this.delay(this.getRetryDelay(attemptNumber));
        return this.request<T>(endpoint, { ...options, attemptNumber: attemptNumber + 1 });
      }

      throw this.normalizeError(error);
    }
  }

  private async parseError(response: Response): Promise<APIError> {
    try {
      const errorData = await response.json();
      return {
        code: errorData.code || 'API_ERROR',
        message: errorData.message || response.statusText,
        details: errorData.details
      };
    } catch {
      return {
        code: 'API_ERROR',
        message: response.statusText || 'Request failed'
      };
    }
  }

  private shouldRetry(error: any, attemptNumber: number): boolean {
    if (attemptNumber >= this.config.retryAttempts!) {
      return false;
    }

    // Retry on network errors or 5xx server errors
    if (error.name === 'AbortError' || error.code === 'NETWORK_ERROR') {
      return true;
    }

    if (error.code === 'API_ERROR' && error.details?.status >= 500) {
      return true;
    }

    return false;
  }

  private getRetryDelay(attemptNumber: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return Math.pow(2, attemptNumber - 1) * 1000;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private normalizeError(error: any): APIError {
    if (error.code && error.message) {
      return error;
    }

    if (error.name === 'AbortError') {
      return {
        code: 'TIMEOUT_ERROR',
        message: 'Request timed out'
      };
    }

    return {
      code: 'NETWORK_ERROR',
      message: error.message || 'Network request failed'
    };
  }

  setAuthService(authService: IAuthService): void {
    this.authService = authService;
  }
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  params?: Record<string, string | number>;
  attemptNumber?: number;
}
