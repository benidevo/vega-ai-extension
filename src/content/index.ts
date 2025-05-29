import { extractJobData, isSupportedJobPage } from './extractors';
import { AscentioOverlay } from './overlay';

let overlay: AscentioOverlay | null = null;
let isInitializing = false;

// Delay for reinitialization when URL changes
const REINITIALIZATION_DELAY_MS = 100;

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
    return;
  }

  try {
    isInitializing = true;

    if (isSupportedJobPage()) {
      console.log('Ascentio: Detected supported job page');

      if (!overlay) {
        overlay = new AscentioOverlay();
      }

      try {
        const jobData = extractJobData();

        if (jobData) {
          console.log('Ascentio: Extracted job data:', jobData);

          await chrome.storage.local.set({ currentJob: jobData });

          chrome.action.setBadgeText({ text: '1' });
          chrome.action.setBadgeBackgroundColor({ color: '#0D9488' });

          chrome.runtime.sendMessage({
            type: 'JOB_EXTRACTED',
            payload: jobData
          }).catch(err => {
            console.error('Ascentio: Failed to send message:', err);
          });
        }
      } catch (extractionError) {
        console.error('Ascentio: Failed to extract job data:', extractionError);
      }
    } else {
      if (overlay) {
        overlay.destroy();
        overlay = null;
      }
    }
  } finally {
    isInitializing = false;
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
      '#main'
    ];

    let targetElement: Element | null = null;
    for (const selector of contentSelectors) {
      targetElement = document.querySelector(selector);
      if (targetElement) break;
    }

    if (targetElement) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !hasInitialized) {
            hasInitialized = true;
            debouncedInitialize();
            observer.disconnect();
          }
        });
      }, {
        threshold: 0.1 // Trigger when 10% of the element is visible
      });

      observer.observe(targetElement);
    } else {
      // Fallback if we can't find a suitable element
      debouncedInitialize();
    }
  }
};

let lastUrl = location.href;
const mutationObserver = new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    hasInitialized = false;

    if (!isSupportedJobPage() && overlay) {
      overlay.destroy();
      overlay = null;
      // Clear the badge
      chrome.action.setBadgeText({ text: '' });
    }

    setTimeout(initializeWhenVisible, REINITIALIZATION_DELAY_MS);
  }
});

mutationObserver.observe(document, { subtree: true, childList: true });

window.addEventListener('load', () => {
  initializeWhenVisible();
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initializeWhenVisible();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REINITIALIZE' || message.type === 'JOB_SAVED') {
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
