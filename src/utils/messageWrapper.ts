import { Logger } from './logger';
import { errorService } from '@/background/services/error';

const logger = new Logger('MessageWrapper');

/**
 * Wraps chrome.runtime.sendMessage with error handling and retry logic
 */
export async function sendMessage<T = unknown>(
  message: { type: string; [key: string]: unknown },
  options?: { retries?: number; delay?: number }
): Promise<T> {
  const { retries = 3, delay = 1000 } = options || {};

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        throw new Error('Extension context invalidated');
      }

      const response = await chrome.runtime.sendMessage(message);
      return response;
    } catch (error) {
      const isLastAttempt = attempt === retries;

      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('extension context invalidated')) {
          logger.error('Extension context invalidated', error);

          if (isLastAttempt) {
            throw new Error(
              'Extension was updated or reloaded. Please refresh the page.'
            );
          }
        }

        // Connection errors that might be recoverable
        if (
          errorMessage.includes('could not establish connection') ||
          errorMessage.includes('receiving end does not exist')
        ) {
          logger.warn(`Connection error on attempt ${attempt}`, { message });

          if (!isLastAttempt) {
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
            continue;
          }
        }
      }

      if (isLastAttempt) {
        errorService.handleError(error, {
          action: 'send_message',
          message,
          attempts: retries,
        });
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  // This should never be reached due to the throw in the last attempt
  throw new Error('Failed to send message after all retries');
}

/**
 * Safely checks if we can communicate with the service worker
 */
export async function isServiceWorkerAlive(): Promise<boolean> {
  try {
    const response = await sendMessage<{ success: boolean }>(
      {
        type: 'PING',
      },
      { retries: 1 }
    );
    return response?.success === true;
  } catch {
    return false;
  }
}
