import { Logger } from '../../../utils/logger';

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  STORAGE = 'STORAGE',
  PERMISSION = 'PERMISSION',
  VALIDATION = 'VALIDATION',
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

    // Network errors
    if (
      error.name === 'NetworkError' ||
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('connection')
    ) {
      return {
        category: ErrorCategory.NETWORK,
        message: error.message,
        userMessage:
          'Network connection error. Please check your internet connection and try again.',
        originalError: error,
        context,
        retryable: true,
      };
    }

    // Authentication errors
    if (
      message.includes('auth') ||
      message.includes('unauthorized') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('forbidden') ||
      message.includes('token')
    ) {
      return {
        category: ErrorCategory.AUTH,
        message: error.message,
        userMessage: 'Authentication failed. Please sign in again.',
        originalError: error,
        context,
        retryable: false,
      };
    }

    // Storage errors
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

    // Permission errors
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

    // Validation errors
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

    // Default to unknown
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
      // Send notification to the extension popup or content script
      await chrome.runtime.sendMessage({
        type: 'ERROR_NOTIFICATION',
        payload: {
          message: errorDetails.userMessage,
          category: errorDetails.category,
          retryable: errorDetails.retryable,
        },
      });
    } catch (notificationError) {
      // If we can't send the message, at least log it
      this.logger.error('Failed to send error notification', notificationError);
    }
  }

  async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    context?: Record<string, unknown>
  ): Promise<T> {
    let lastError: ErrorDetails | null = null;

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

        this.logger.info(
          `Retrying operation (attempt ${attempt}/${maxRetries})`,
          {
            delay,
            category: lastError.category,
          }
        );

        await new Promise(resolve => setTimeout(resolve, delay * attempt));
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
