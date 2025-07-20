import { extractJobData, isSupportedJobPage } from './extractors';
import { VegaAIOverlay } from './overlay';
import { contentLogger } from '../utils/logger';
import { contentConnection } from './connection';

let overlay: VegaAIOverlay | null = null;
let isInitializing = false;

// Establish persistent connection to service worker
contentConnection.connect();

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
  } else if (message.type === 'EXTRACT_SEARCH_RESULTS') {
    handleSearchExtraction(message.payload)
      .then(result => sendResponse(result))
      .catch(error => {
        contentLogger.error('Search extraction failed', error);
        sendResponse({ jobsFound: 0, error: error.message });
      });
    return true; // Keep channel open for async response
  }
  return true; // Keep the message channel open for async response
});

window.addEventListener('unload', () => {
  if (overlay) {
    overlay.destroy();
    overlay = null;
  }
  mutationObserver.disconnect();
  contentConnection.disconnect();
});

/**
 * Handle search result extraction for automated searches
 */
async function handleSearchExtraction(params: {
  preferenceId: string;
  maxAge: number;
  jobTitle: string;
  location: string;
}): Promise<{ jobsFound: number }> {
  contentLogger.info('Starting search extraction', params);

  try {
    // Wait for search results to load
    await waitForSearchResults();

    // Count job cards that match criteria
    const jobCards = document.querySelectorAll(
      '[data-job-id], .job-card-container, .jobs-search-results__list-item'
    );
    let validJobs = 0;

    for (const card of jobCards) {
      if (isJobWithinAge(card as HTMLElement, params.maxAge)) {
        validJobs++;
      }
    }

    contentLogger.info(`Found ${validJobs} jobs within age limit`, {
      maxAge: params.maxAge,
      totalCards: jobCards.length,
    });

    return { jobsFound: validJobs };
  } catch (error) {
    contentLogger.error('Search extraction error', error);
    return { jobsFound: 0 };
  }
}

/**
 * Wait for search results to load on the page
 */
async function waitForSearchResults(timeout = 10000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const jobCards = document.querySelectorAll(
      '[data-job-id], .job-card-container, .jobs-search-results__list-item'
    );

    if (jobCards.length > 0) {
      // Wait a bit more for all results to render
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }

    // Check for "no results" message
    const noResults = document.querySelector('.jobs-search-no-results');
    if (noResults) {
      contentLogger.info('No search results found');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error('Search results did not load in time');
}

/**
 * Check if a job card is within the specified age limit
 */
function isJobWithinAge(card: HTMLElement, maxAgeSeconds: number): boolean {
  // Extract posting time
  const timeElement = card.querySelector('time');
  const timeText =
    timeElement?.getAttribute('datetime') ||
    timeElement?.textContent ||
    card.querySelector('.job-card-list__listed-time')?.textContent ||
    '';

  if (!timeText) {
    contentLogger.debug('No time found for job card', {
      cardHTML: card.outerHTML.substring(0, 200),
    });
    return true; // Include if we can't determine age
  }

  const jobAgeSeconds = parseJobAge(timeText);
  return jobAgeSeconds <= maxAgeSeconds;
}

/**
 * Parse job age from various time formats
 */
function parseJobAge(timeText: string): number {
  const now = Date.now();

  // Handle "X hours/days/weeks ago" format
  const matches = timeText.match(/(\d+)\s*(hour|day|week|month)/i);
  if (matches) {
    const [, amount, unit] = matches;
    const value = parseInt(amount);

    switch (unit.toLowerCase()) {
      case 'hour':
        return value * 3600;
      case 'day':
        return value * 86400;
      case 'week':
        return value * 604800;
      case 'month':
        return value * 2592000;
    }
  }

  // Handle "Just now" or "Recently posted"
  if (timeText.match(/just now|recently/i)) {
    return 0;
  }

  // Try to parse ISO date
  try {
    const postedDate = new Date(timeText);
    if (!isNaN(postedDate.getTime())) {
      return Math.floor((now - postedDate.getTime()) / 1000);
    }
  } catch {
    // Ignore parse errors
  }

  // Default to 0 (assume recent)
  return 0;
}
