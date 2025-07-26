import {
  ErrorService,
  ErrorCategory,
  ErrorDetails,
} from '@/background/services/error/ErrorService';
import { mockChrome, resetChromeMocks } from '../../../mocks/chrome';

jest.mock('@/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('ErrorService', () => {
  let errorService: ErrorService;

  beforeEach(() => {
    jest.clearAllMocks();
    resetChromeMocks();
    (ErrorService as any).instance = undefined;
    errorService = ErrorService.getInstance();
  });

  describe('handleError', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error message');
      const context = { operation: 'test' };

      const result = errorService.handleError(error, context);

      expect(result).toMatchObject({
        message: 'Test error message',
        originalError: error,
        context,
      });
    });

    it('should handle string errors', () => {
      const error = 'String error message';
      const context = { operation: 'test' };

      const result = errorService.handleError(error, context);

      expect(result).toMatchObject({
        message: 'String error message',
        userMessage: expect.any(String),
        context,
      });
    });

    it('should handle unknown error types', () => {
      const error = { customError: true };
      const context = { operation: 'test' };

      const result = errorService.handleError(error, context);

      expect(result).toMatchObject({
        category: ErrorCategory.UNKNOWN,
        message: '[object Object]',
        userMessage: 'An unexpected error occurred. Please try again.',
        context,
      });
    });
  });

  describe('categorizeError', () => {
    it('should categorize errors correctly', () => {
      const testCases = [
        { error: new Error('Network error'), category: ErrorCategory.NETWORK },
        { error: new Error('fetch failed'), category: ErrorCategory.NETWORK },
        { error: new Error('401 Unauthorized'), category: ErrorCategory.AUTH },
        { error: new Error('Token expired'), category: ErrorCategory.AUTH },
        { error: new Error('Storage error'), category: ErrorCategory.STORAGE },
        {
          error: new Error('Permission denied'),
          category: ErrorCategory.PERMISSION,
        },
        {
          error: new Error('Invalid input'),
          category: ErrorCategory.VALIDATION,
        },
      ];

      testCases.forEach(({ error, category }) => {
        const result = (errorService as any).categorizeError(error);
        expect(result.category).toBe(category);
      });

      const quotaError = new Error('Quota exceeded');
      quotaError.name = 'QuotaExceededError';
      const quotaResult = (errorService as any).categorizeError(quotaError);
      expect(quotaResult.category).toBe(ErrorCategory.STORAGE);
    });

    it('should determine retryability', () => {
      const retryableError = new Error('Network error');
      const nonRetryableError = new Error('Invalid input');

      const result1 = (errorService as any).categorizeError(retryableError);
      const result2 = (errorService as any).categorizeError(nonRetryableError);

      expect(result1.retryable).toBe(true);
      expect(result2.retryable).toBe(false);
    });
  });

  describe('notifyUser', () => {
    it('should send error notification via runtime message', async () => {
      const errorDetails: ErrorDetails = {
        category: ErrorCategory.AUTH,
        message: 'Auth error',
        userMessage: 'Please sign in',
      };

      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      await errorService.notifyUser(errorDetails);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'ERROR_NOTIFICATION',
        payload: {
          message: 'Please sign in',
          category: ErrorCategory.AUTH,
          retryable: undefined,
        },
      });
    });

    it('should handle notification errors gracefully', async () => {
      const errorDetails: ErrorDetails = {
        category: ErrorCategory.NETWORK,
        message: 'Network error',
        userMessage: 'Connection failed',
        retryable: true,
      };

      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('Chrome API error')
      );

      await expect(
        errorService.notifyUser(errorDetails)
      ).resolves.not.toThrow();
    });
  });

  describe('handleAndLogError', () => {
    it('should log error and return details', () => {
      const error = new Error('Test error');
      const context = { operation: 'test' };

      const logger = (errorService as any).logger;
      const result = errorService.handleAndLogError(error, context);

      expect(logger.error).toHaveBeenCalledWith(
        'Test error',
        error,
        expect.objectContaining({
          category: expect.any(String),
          context,
        })
      );
      expect(result).toMatchObject({
        message: 'Test error',
        originalError: error,
        context,
      });
    });
  });

  describe('retryOperation', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await errorService.retryOperation(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error')) // Make it retryable
        .mockResolvedValueOnce('success');

      const result = await errorService.retryOperation(operation, 3, 10);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Network error')); // Retryable error

      await expect(
        errorService.retryOperation(operation, 3, 10)
      ).rejects.toThrow('Network error');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const validationError = new Error('Validation failed');
      const operation = jest.fn().mockRejectedValue(validationError);

      await expect(
        errorService.retryOperation(operation, 3, 10)
      ).rejects.toThrow('Validation failed');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('createErrorBoundary', () => {
    it('should handle errors and notify user', async () => {
      const notifyUserSpy = jest
        .spyOn(errorService, 'notifyUser')
        .mockResolvedValue(undefined);
      const boundary = errorService.createErrorBoundary('TestComponent');

      const error = new Error('Component error');
      const result = boundary.handleError(error);

      expect(result).toMatchObject({
        message: 'Component error',
        context: { component: 'TestComponent' },
      });

      expect(notifyUserSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Component error',
        })
      );
    });
  });
});
