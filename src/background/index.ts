import { ServiceManager } from './ServiceManager';
import { errorService } from './services/error';
import { Logger } from '@/utils/logger';

const logger = new Logger('Background');
const serviceManager = new ServiceManager();

async function initializeWithRetry(retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await serviceManager.initialize();
      logger.info('Service manager initialized successfully');
      return;
    } catch (error) {
      errorService.handleError(error, {
        action: 'initialize_background_services',
        attempt,
        maxRetries: retries,
      });

      if (attempt === retries) {
        logger.error('Failed to initialize after all retries', error);
        throw error;
      }

      logger.warn(`Initialization attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Self-healing: Re-initialize on activation
chrome.runtime.onStartup.addListener(async () => {
  logger.info('Extension startup detected');
  await initializeWithRetry();
});

// Initialize on first load
initializeWithRetry().catch(error => {
  logger.error('Fatal: Could not initialize extension', error);
});

chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason === 'install') {
    await serviceManager.badge.showSuccess();
  }
});

chrome.runtime.onSuspend.addListener(async () => {
  logger.info('Extension suspending, cleaning up...');
  await serviceManager.destroy();
});

// Global error handlers to prevent service worker crashes
self.addEventListener('error', event => {
  const error = event.error || new Error(event.message);
  errorService.handleError(error, {
    action: 'global_error_handler',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
  event.preventDefault();
});

self.addEventListener('unhandledrejection', event => {
  errorService.handleError(event.reason, {
    action: 'unhandled_promise_rejection',
    promise: event.promise,
  });
  event.preventDefault();
});

export { serviceManager };
