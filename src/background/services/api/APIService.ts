import {
  IAPIService,
  SaveJobResponse,
  APIConfig,
  APIError,
} from './IAPIService';
import { JobListing } from '@/types';
import { IAuthService } from '../auth/IAuthService';
import { apiLogger } from '../../../utils/logger';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
const DEFAULT_RETRY_MAX_DELAY_MS = 8000;
const DEFAULT_RETRY_JITTER_PERCENT = 25;

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT_MS = 60000;

const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_SERVER_ERROR_MIN = 500;

const EXPONENTIAL_BACKOFF_BASE = 2;
const JITTER_SPREAD_FACTOR = 2;
const JITTER_CENTER_OFFSET = 0.5;

const LOG_STACK_TRACE_LINES = 3;
const SECONDS_PER_MS = 1000;
const DECIMAL_PLACES = 1;

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
  private readonly CIRCUIT_BREAKER_THRESHOLD = CIRCUIT_BREAKER_THRESHOLD;
  private readonly CIRCUIT_BREAKER_TIMEOUT = CIRCUIT_BREAKER_TIMEOUT_MS;

  constructor(config: APIConfig, authService?: IAuthService) {
    this.config = {
      timeout: DEFAULT_TIMEOUT_MS,
      retryAttempts: DEFAULT_RETRY_ATTEMPTS,
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
          'Service is temporarily unavailable due to multiple failed attempts. Please try again in a minute.'
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
          response.status === HTTP_STATUS_UNAUTHORIZED &&
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
      error.details.status >= HTTP_STATUS_SERVER_ERROR_MIN
    ) {
      return true;
    }

    return false;
  }

  private getRetryDelay(attemptNumber: number): number {
    // Get retry configuration with defaults
    const retryConfig = this.config.retryDelays || {
      base: DEFAULT_RETRY_BASE_DELAY_MS,
      max: DEFAULT_RETRY_MAX_DELAY_MS,
      jitterPercent: DEFAULT_RETRY_JITTER_PERCENT,
    };

    // Exponential backoff: base * 2^(attempt-1)
    const exponentialDelay = Math.min(
      retryConfig.base * Math.pow(EXPONENTIAL_BACKOFF_BASE, attemptNumber - 1),
      retryConfig.max
    );

    // Add jitter to prevent thundering herd
    const jitterRange = exponentialDelay * (retryConfig.jitterPercent / 100);
    const jitter =
      exponentialDelay +
      (Math.random() - JITTER_CENTER_OFFSET) *
        JITTER_SPREAD_FACTOR *
        jitterRange;

    const finalDelay = Math.round(Math.max(0, jitter));

    apiLogger.info(`Retry attempt ${attemptNumber} scheduled`, {
      baseDelay: exponentialDelay,
      jitteredDelay: finalDelay,
      delaySeconds: (finalDelay / SECONDS_PER_MS).toFixed(DECIMAL_PLACES),
    });

    return finalDelay;
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
        stack: error.stack
          ?.split('\n')
          .slice(0, LOG_STACK_TRACE_LINES)
          .join('\n'),
      });

      if (error.message.includes('fetch')) {
        return {
          code: 'NETWORK_ERROR',
          message: this.config.baseUrl.includes('localhost')
            ? 'Cannot connect to local backend. Please ensure your local server is running.'
            : 'Cannot connect to server. Please check your internet connection.',
        };
      }
    }

    return {
      code: 'NETWORK_ERROR',
      message:
        error instanceof Error
          ? `Connection error: ${error.message}`
          : 'Unable to complete request. Please check your connection and try again.',
    };
  }
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  params?: Record<string, string | number>;
  attemptNumber?: number;
}
