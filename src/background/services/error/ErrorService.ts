import { Logger } from '../../../utils/logger';

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  STORAGE = 'STORAGE',
  PERMISSION = 'PERMISSION',
  VALIDATION = 'VALIDATION',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface ErrorDetails {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  originalError?: Error;
  context?: Record<string, unknown>;
  retryable?: boolean;
}

export class ErrorService {
  private static instance: ErrorService;
  private logger: Logger;

  private constructor() {
    this.logger = new Logger('ErrorService');
  }

  static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }

  handleError(error: unknown, context?: Record<string, unknown>): ErrorDetails {
    const errorDetails = this.categorizeError(error, context);
    return errorDetails;
  }

  handleAndLogError(
    error: unknown,
    context?: Record<string, unknown>
  ): ErrorDetails {
    const errorDetails = this.categorizeError(error, context);
    this.logger.error(errorDetails.message, errorDetails.originalError, {
      category: errorDetails.category,
      context: errorDetails.context,
      retryable: errorDetails.retryable,
    });
    return errorDetails;
  }

  private categorizeError(
    error: unknown,
    context?: Record<string, unknown>
  ): ErrorDetails {
    if (error instanceof Error) {
      return this.categorizeKnownError(error, context);
    }

    return {
      category: ErrorCategory.UNKNOWN,
      message: String(error),
      userMessage: 'An unexpected error occurred. Please try again.',
      context,
      retryable: false,
    };
  }

  private categorizeKnownError(
    error: Error,
    context?: Record<string, unknown>
  ): ErrorDetails {
    const message = error.message.toLowerCase();

    if (
      error.name === 'NetworkError' ||
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('connection')
    ) {
      if (message.includes('local backend') || message.includes('local vega')) {
        return {
          category: ErrorCategory.NETWORK,
          message: error.message,
          userMessage: error.message,
          originalError: error,
          context,
          retryable: false,
        };
      }

      const isRetrying = context?.attemptNumber && context?.maxRetries;
      let userMessage =
        'Network connection error. Please check your internet connection.';

      if (isRetrying) {
        const attempt = context.attemptNumber as number;
        const maxRetries = context.maxRetries as number;
        if (attempt < maxRetries) {
          userMessage = `Network error - retrying (${attempt}/${maxRetries})...`;
        } else {
          userMessage =
            'Network error - please check your connection and try again.';
        }
      }

      return {
        category: ErrorCategory.NETWORK,
        message: error.message,
        userMessage,
        originalError: error,
        context,
        retryable: true,
      };
    }

    if (
      message.includes('auth') ||
      message.includes('unauthorized') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('forbidden') ||
      message.includes('token') ||
      message.includes('invalid username') ||
      message.includes('invalid password')
    ) {
      const userMessage =
        message.includes('password') ||
        message.includes('credentials') ||
        message.includes('invalid username')
          ? error.message
          : 'Authentication failed. Please sign in again.';

      return {
        category: ErrorCategory.AUTH,
        message: error.message,
        userMessage,
        originalError: error,
        context,
        retryable: false,
      };
    }

    if (
      message.includes('storage') ||
      message.includes('quota') ||
      message.includes('disk') ||
      error.name === 'QuotaExceededError'
    ) {
      return {
        category: ErrorCategory.STORAGE,
        message: error.message,
        userMessage: 'Storage error. Please clear some space and try again.',
        originalError: error,
        context,
        retryable: false,
      };
    }

    if (
      message.includes('permission') ||
      message.includes('access denied') ||
      message.includes('not allowed')
    ) {
      return {
        category: ErrorCategory.PERMISSION,
        message: error.message,
        userMessage:
          'Permission denied. Please check your extension permissions.',
        originalError: error,
        context,
        retryable: false,
      };
    }

    if (
      message.includes('invalid') ||
      message.includes('validation') ||
      message.includes('required')
    ) {
      return {
        category: ErrorCategory.VALIDATION,
        message: error.message,
        userMessage: 'Invalid input. Please check your data and try again.',
        originalError: error,
        context,
        retryable: false,
      };
    }

    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('server error') ||
      message.includes('service unavailable')
    ) {
      const isRetrying = context?.attemptNumber && context?.maxRetries;
      let userMessage =
        'Server is temporarily unavailable. Please try again later.';

      if (isRetrying) {
        const attempt = context.attemptNumber as number;
        const maxRetries = context.maxRetries as number;
        userMessage = `Server is busy - attempt ${attempt} of ${maxRetries}`;
      }

      return {
        category: ErrorCategory.SERVER_ERROR,
        message: error.message,
        userMessage,
        originalError: error,
        context,
        retryable: true,
      };
    }

    return {
      category: ErrorCategory.UNKNOWN,
      message: error.message,
      userMessage: 'An unexpected error occurred. Please try again later.',
      originalError: error,
      context,
      retryable: false,
    };
  }

  async notifyUser(errorDetails: ErrorDetails): Promise<void> {
    try {
      if (chrome?.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({
          type: 'ERROR_NOTIFICATION',
          payload: {
            message: errorDetails.userMessage,
            category: errorDetails.category,
            retryable: errorDetails.retryable,
          },
        });
      } else {
        this.logger.warn('Chrome runtime not available for error notification');
      }
    } catch (notificationError) {
      if (
        notificationError instanceof Error &&
        notificationError.message.includes('Extension context invalidated')
      ) {
        this.logger.warn(
          'Extension context invalidated, cannot send notification'
        );
      } else {
        this.logger.error(
          'Failed to send error notification',
          notificationError
        );
      }
    }
  }

  async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    context?: Record<string, unknown>
  ): Promise<T> {
    let lastError: ErrorDetails | null = null;
    const maxDelay = 8000;
    const jitterPercent = 25;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.handleError(error, {
          ...context,
          attempt,
          maxRetries,
        });

        if (!lastError.retryable || attempt === maxRetries) {
          throw error;
        }

        const exponentialDelay = Math.min(
          delay * Math.pow(2, attempt - 1),
          maxDelay
        );

        const jitterRange = exponentialDelay * (jitterPercent / 100);
        const jitteredDelay = Math.round(
          exponentialDelay + (Math.random() - 0.5) * 2 * jitterRange
        );

        this.logger.info(
          `Retrying operation (attempt ${attempt}/${maxRetries})`,
          {
            delayMs: jitteredDelay,
            category: lastError.category,
          }
        );

        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
      }
    }

    throw (
      lastError?.originalError || new Error('Operation failed after retries')
    );
  }

  createErrorBoundary(componentName: string) {
    return {
      handleError: (error: unknown) => {
        const errorDetails = this.handleError(error, {
          component: componentName,
        });
        this.notifyUser(errorDetails);
        return errorDetails;
      },
    };
  }
}

export const errorService = ErrorService.getInstance();
