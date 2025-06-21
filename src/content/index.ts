import { extractJobData, isSupportedJobPage } from './extractors';
import { VegaAIOverlay } from './overlay';
import { contentLogger } from '../utils/logger';

let overlay: VegaAIOverlay | null = null;
let isInitializing = false;

/**
 * Debounce function to prevent multiple rapid calls
 */
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

/**
 * Initializes the content script by detecting supported job pages, extracting job data,
 * updating the extension badge, and managing the overlay UI.
 */
async function initialize(): Promise<void> {
  // Prevent concurrent initializations
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
        const jobData = await contentLogger.time('job_extraction', () =>
          extractJobData()
        );

        if (jobData) {
          await chrome.storage.local.set({ currentJob: jobData });
          contentLogger.info('Job data extracted and cached', {
            title: jobData.title,
            company: jobData.company,
          });

          chrome.action.setBadgeText({ text: '1' });
          chrome.action.setBadgeBackgroundColor({ color: '#0D9488' });

          chrome.runtime
            .sendMessage({
              type: 'JOB_EXTRACTED',
              payload: jobData,
            })
            .catch(err => {
              contentLogger.error('Failed to send message to background', err);
            });
        } else {
          contentLogger.warn('No job data extracted from current page');
        }
      } catch (extractionError) {
        contentLogger.error('Failed to extract job data', extractionError);
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

let hasInitialized = false;
const initializeWhenVisible = () => {
  if (!hasInitialized && isSupportedJobPage()) {
    // Look for main content areas that would contain job information
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
          threshold: 0.1, // Trigger when 10% of the element is visible
        }
      );

      observer.observe(targetElement);
    } else {
      // Fallback if we can't find a suitable element
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

    // Clear overlay immediately if not on job page
    if (!isSupportedJobPage() && overlay) {
      overlay.destroy();
      overlay = null;
      chrome.action.setBadgeText({ text: '' });
    } else if (isSupportedJobPage()) {
      // Reinitialize with a delay for DOM to update
      setTimeout(initializeWhenVisible, 300);
    }
  }
};

// Use both MutationObserver and periodic checks for LinkedIn SPA
const mutationObserver = new MutationObserver(() => checkForUrlChange());
mutationObserver.observe(document, { subtree: true, childList: true });

// Fallback: Check URL every second for LinkedIn to catch SPA navigation
if (location.hostname.includes('linkedin.com')) {
  setInterval(checkForUrlChange, 1000);
}

// Initial check on script load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeWhenVisible, 100);
  });
} else {
  setTimeout(initializeWhenVisible, 100);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REINITIALIZE') {
    debouncedInitialize();
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});

window.addEventListener('unload', () => {
  if (overlay) {
    overlay.destroy();
    overlay = null;
  }
  mutationObserver.disconnect();
});
