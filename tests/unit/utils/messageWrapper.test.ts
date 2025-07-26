import { sendMessage, isServiceWorkerAlive } from '@/utils/messageWrapper';
import { errorService } from '@/background/services/error';
import { mockChrome, resetChromeMocks } from '../../mocks/chrome';

jest.mock('@/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@/background/services/error', () => ({
  errorService: {
    handleError: jest.fn(),
  },
}));

describe('messageWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetChromeMocks();
    jest.useFakeTimers();
    mockChrome.runtime.id = 'test-extension-id';
    mockChrome.runtime.sendMessage = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const message = { type: 'TEST_MESSAGE', data: 'test' };
      const response = { success: true, result: 'test result' };

      mockChrome.runtime.sendMessage.mockResolvedValue(response);

      const result = await sendMessage(message);

      expect(result).toEqual(response);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(message);
    });

    it('should retry on connection errors', async () => {
      const message = { type: 'TEST_MESSAGE' };
      const response = { success: true };

      mockChrome.runtime.sendMessage
        .mockRejectedValueOnce(
          new Error(
            'Could not establish connection. Receiving end does not exist.'
          )
        )
        .mockResolvedValueOnce(response);

      const promise = sendMessage(message, { retries: 3, delay: 100 });

      await jest.advanceTimersByTimeAsync(100);

      const result = await promise;

      expect(result).toEqual(response);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should throw error when extension context is invalidated', async () => {
      const message = { type: 'TEST_MESSAGE' };

      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('Extension context invalidated')
      );

      await expect(
        sendMessage(message, { retries: 1, delay: 10 })
      ).rejects.toThrow(
        'Extension was updated or reloaded. Please refresh the page.'
      );

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should throw error when runtime id is missing', async () => {
      mockChrome.runtime.id = undefined;
      const message = { type: 'TEST_MESSAGE' };

      await expect(
        sendMessage(message, { retries: 1, delay: 10 })
      ).rejects.toThrow(
        'Extension was updated or reloaded. Please refresh the page.'
      );

      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('should use exponential backoff for retries', async () => {
      const message = { type: 'TEST_MESSAGE' };

      mockChrome.runtime.sendMessage
        .mockRejectedValueOnce(new Error('Could not establish connection'))
        .mockRejectedValueOnce(new Error('Could not establish connection'))
        .mockResolvedValueOnce({ success: true });

      const promise = sendMessage(message, { retries: 3, delay: 100 });

      await jest.advanceTimersByTimeAsync(100);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(200);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toEqual({ success: true });
    });

    it('should handle non-Error objects', async () => {
      const message = { type: 'TEST_MESSAGE' };

      mockChrome.runtime.sendMessage
        .mockRejectedValueOnce('String error')
        .mockResolvedValueOnce({ success: true });

      const promise = sendMessage(message, { retries: 2, delay: 100 });

      await jest.advanceTimersByTimeAsync(100);

      const result = await promise;
      expect(result).toEqual({ success: true });
    });

    it('should call errorService.handleError on final failure', async () => {
      const message = { type: 'TEST_MESSAGE' };
      const error = new Error('Network error');

      mockChrome.runtime.sendMessage.mockRejectedValue(error);

      try {
        await sendMessage(message, { retries: 1, delay: 10 });
      } catch {
        // Expected
      }

      expect(errorService.handleError).toHaveBeenCalledWith(error, {
        action: 'send_message',
        message,
        attempts: 1,
      });
    });

    it('should use default options when not provided', async () => {
      const message = { type: 'TEST_MESSAGE' };

      mockChrome.runtime.sendMessage
        .mockRejectedValueOnce(new Error('Could not establish connection'))
        .mockResolvedValueOnce({ success: true });

      const promise = sendMessage(message);

      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toEqual({ success: true });
    });
  });

  describe('isServiceWorkerAlive', () => {
    it('should return true when service worker responds', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

      const result = await isServiceWorkerAlive();

      expect(result).toBe(true);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'PING',
      });
    });

    it('should return false when service worker does not respond with success', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: false });

      const result = await isServiceWorkerAlive();

      expect(result).toBe(false);
    });

    it('should return false when sendMessage throws error', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('Connection failed')
      );

      const result = await isServiceWorkerAlive();

      expect(result).toBe(false);
    });

    it('should return false when response is null', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue(null);

      const result = await isServiceWorkerAlive();

      expect(result).toBe(false);
    });
  });
});
