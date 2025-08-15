import { readJobDetails, isSupportedJobPage } from './extractors';
import { VegaAIOverlay } from './overlay';
import { contentLogger } from '../utils/logger';
import { contentConnection } from './connection';

let overlay: VegaAIOverlay | null = null;
let isInitializing = false;

contentConnection.connect();

function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

async function initialize(): Promise<void> {
  if (!isContextValid()) {
    contentLogger.warn('Extension context is invalid, skipping initialization');
    cleanup();
    return;
  }

  if (isInitializing) {
    contentLogger.debug('Initialization already in progress, skipping');
    return;
  }

  try {
    isInitializing = true;
    contentLogger.debug('Starting content script initialization', {
      url: window.location.href,
    });

    if (isSupportedJobPage()) {
      contentLogger.info('Job page detected, initializing overlay');

      if (!overlay) {
        overlay = await contentLogger.time('overlay_creation', () =>
          VegaAIOverlay.create()
        );
        contentLogger.info('Overlay created successfully');
      }

      try {
        const jobData = await contentLogger.time('job_reading', () =>
          readJobDetails()
        );

        if (jobData) {
          contentLogger.info('Job data read', {
            title: jobData.title,
            company: jobData.company,
          });

          try {
            await chrome.runtime.sendMessage({
              type: 'JOB_READ',
              payload: jobData,
            });
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.includes('Extension context invalidated')
            ) {
              contentLogger.warn(
                'Extension context invalidated while sending message'
              );
              cleanup();
              return;
            }
            contentLogger.error('Failed to send message to background', error);
          }
        } else {
          contentLogger.warn('No job data read from current page');
        }
      } catch (readError) {
        contentLogger.error('Failed to read job data', readError);
      }
    } else {
      if (overlay) {
        contentLogger.info('Not a job page, cleaning up overlay');
        overlay.destroy();
        overlay = null;
      }
    }
  } finally {
    isInitializing = false;
    contentLogger.debug('Initialization completed');
  }
}

const debouncedInitialize = debounce(initialize, 500);

function isContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function cleanup(): void {
  if (overlay) {
    overlay.destroy();
    overlay = null;
  }
  mutationObserver.disconnect();
  contentConnection.disconnect();
  contentLogger.info('Cleaned up due to invalid extension context');
}

let hasInitialized = false;
const initializeWhenVisible = () => {
  if (!isContextValid()) {
    contentLogger.warn('Extension context is invalid');
    cleanup();
    return;
  }

  if (!hasInitialized && isSupportedJobPage()) {
    const contentSelectors = [
      '.jobs-unified-top-card',
      '.job-details-jobs-unified-top-card',
      '[data-job-id]',
      'main',
      '#main',
    ];

    let targetElement: Element | null = null;
    for (const selector of contentSelectors) {
      targetElement = document.querySelector(selector);
      if (targetElement) break;
    }

    if (targetElement) {
      const observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting && !hasInitialized) {
              hasInitialized = true;
              debouncedInitialize();
              observer.disconnect();
            }
          });
        },
        {
          threshold: 0.1,
        }
      );

      observer.observe(targetElement);
    } else {
      debouncedInitialize();
    }
  }
};

let lastUrl = location.href;

const checkForUrlChange = () => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    hasInitialized = false;

    if (!isSupportedJobPage() && overlay) {
      overlay.destroy();
      overlay = null;
      chrome.action.setBadgeText({ text: '' });
    } else if (isSupportedJobPage()) {
      setTimeout(initializeWhenVisible, 300);
    }
  }
};

const mutationObserver = new MutationObserver(() => checkForUrlChange());
mutationObserver.observe(document, { subtree: true, childList: true });

if (location.hostname.includes('linkedin.com')) {
  setInterval(checkForUrlChange, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeWhenVisible, 100);
  });
} else {
  setTimeout(initializeWhenVisible, 100);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isContextValid()) {
    contentLogger.warn('Extension context is invalid, ignoring message');
    sendResponse({ success: false, error: 'Extension context invalidated' });
    cleanup();
    return false;
  }

  if (message.type === 'REINITIALIZE') {
    debouncedInitialize();
    sendResponse({ success: true });
  }
  return true;
});

window.addEventListener('unload', () => {
  if (overlay) {
    overlay.destroy();
    overlay = null;
  }
  mutationObserver.disconnect();
  contentConnection.disconnect();
});
