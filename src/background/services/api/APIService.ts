import {
  IAPIService,
  SaveJobResponse,
  APIConfig,
  APIError,
} from './IAPIService';
import { JobListing } from '@/types';
import { IAuthService } from '../auth/IAuthService';
import { apiLogger } from '../../../utils/logger';

export class APIService implements IAPIService {
  private config: APIConfig;
  private authToken: string | null = null;
  private authService: IAuthService | null = null;
  private isInitialized = false;
  private refreshingToken = false;
  private pendingRequests: Array<() => void> = [];

  // Circuit breaker properties
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  constructor(config: APIConfig, authService?: IAuthService) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      ...config,
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
    apiLogger.info('Saving job', { title: job.title, company: job.company });

    const response = await apiLogger.time('save_job_request', () =>
      this.request<SaveJobResponse>('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(job),
      })
    );

    apiLogger.info('Job saved successfully', {
      jobId: response.id || 'unknown',
    });
    return response;
  }

  private async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    // Check circuit breaker
    if (this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.CIRCUIT_BREAKER_TIMEOUT) {
        const error = new Error(
          'Service temporarily unavailable. Please try again later.'
        );
        (error as Error & { code: string }).code = 'CIRCUIT_BREAKER_OPEN';
        throw error;
      }
      // Reset circuit breaker
      this.failureCount = 0;
    }

    const { method = 'GET', body, params, attemptNumber = 1 } = options;

    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    apiLogger.debug('Making API request', {
      url: url.toString(),
      method,
      attemptNumber,
      hasAuthToken: !!this.authToken,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle 401 Unauthorized
        if (
          response.status === 401 &&
          this.authService &&
          attemptNumber === 1
        ) {
          // Wait if already refreshing
          if (this.refreshingToken) {
            await new Promise<void>(resolve => {
              this.pendingRequests.push(resolve);
            });
            // Retry the request after token refresh
            return this.request<T>(endpoint, {
              ...options,
              attemptNumber: attemptNumber + 1,
            });
          }

          this.refreshingToken = true;
          try {
            await this.authService.refreshAuthToken();
            const newToken = await this.authService.getAuthToken();
            this.setAuthToken(newToken);

            this.pendingRequests.forEach(resolve => resolve());
            this.pendingRequests = [];

            return this.request<T>(endpoint, {
              ...options,
              attemptNumber: attemptNumber + 1,
            });
          } catch (refreshError: unknown) {
            // Token refresh failed, resolve any pending requests so they don't hang
            this.pendingRequests.forEach(resolve => resolve());
            this.pendingRequests = [];

            if (
              refreshError instanceof Error &&
              refreshError.message === 'Refresh token expired'
            ) {
              const error = new Error(
                'Your session has expired. Please sign in again.'
              );
              (error as Error & { code: string }).code = 'AUTH_EXPIRED';
              throw error;
            }

            const error = new Error(
              'Failed to refresh authentication. Please try signing in again.'
            );
            (error as Error & { code: string }).code = 'AUTH_REFRESH_FAILED';
            throw error;
          } finally {
            this.refreshingToken = false;
          }
        }

        const error = await this.parseError(response);
        throw error;
      }

      const data = await response.json();
      // Reset failure count on success
      this.failureCount = 0;
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      const normalizedError = this.normalizeError(error);

      // Update circuit breaker on failure (but not on auth errors)
      if (
        normalizedError.code !== 'AUTH_EXPIRED' &&
        normalizedError.code !== 'AUTH_REFRESH_FAILED'
      ) {
        this.failureCount++;
        this.lastFailureTime = Date.now();
      }

      if (this.shouldRetry(normalizedError, attemptNumber)) {
        await this.delay(this.getRetryDelay(attemptNumber));
        return this.request<T>(endpoint, {
          ...options,
          attemptNumber: attemptNumber + 1,
        });
      }

      throw normalizedError;
    }
  }

  private async parseError(response: Response): Promise<APIError> {
    try {
      const errorData = await response.json();
      return {
        code: errorData.code || 'API_ERROR',
        message: errorData.message || response.statusText,
        details: errorData.details,
      };
    } catch {
      return {
        code: 'API_ERROR',
        message: response.statusText || 'Request failed',
      };
    }
  }

  private shouldRetry(error: APIError, attemptNumber: number): boolean {
    if (attemptNumber >= this.config.retryAttempts!) {
      return false;
    }

    // Retry on network errors or 5xx server errors
    if (error.code === 'TIMEOUT_ERROR' || error.code === 'NETWORK_ERROR') {
      return true;
    }

    if (
      error.code === 'API_ERROR' &&
      error.details &&
      typeof error.details === 'object' &&
      'status' in error.details &&
      typeof error.details.status === 'number' &&
      error.details.status >= 500
    ) {
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

  private normalizeError(error: unknown): APIError {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error
    ) {
      return error as APIError;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        code: 'TIMEOUT_ERROR',
        message: 'Request timed out',
      };
    }

    if (error instanceof Error) {
      apiLogger.error('API request failed', error, {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      });

      if (error.message.includes('fetch')) {
        return {
          code: 'NETWORK_ERROR',
          message: `Cannot connect to backend (${this.config.baseUrl}). Is it running?`,
        };
      }
    }

    return {
      code: 'NETWORK_ERROR',
      message:
        error instanceof Error ? error.message : 'Network request failed',
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
