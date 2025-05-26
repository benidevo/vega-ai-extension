import { extractJobData, isSupportedJobPage } from './extractors';
import { AscentioOverlay } from './overlay';

let overlay: AscentioOverlay | null = null;


/**
 * Initializes the content script by detecting supported job pages, extracting job data,
 * updating the extension badge, and managing the overlay UI.
 */
async function initialize(): Promise<void> {
  if (isSupportedJobPage()) {
    console.log('Ascentio: Detected supported job page');

    if (!overlay) {
      overlay = new AscentioOverlay();
    }

    const jobData = extractJobData();

    if (jobData) {
      console.log('Ascentio: Extracted job data:', jobData);

      chrome.storage.local.set({ currentJob: jobData });

      chrome.action.setBadgeText({ text: '1' });
      chrome.action.setBadgeBackgroundColor({ color: '#0D9488' });

      chrome.runtime.sendMessage({
        type: 'JOB_EXTRACTED',
        payload: jobData
      });
    }
  } else {
    if (overlay) {
      overlay.destroy();
      overlay = null;
    }
  }
}

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // Small delay to let page load
    setTimeout(initialize, 1000);
  }
}).observe(document, { subtree: true, childList: true });

// Run on initial page load
window.addEventListener('load', () => {
  setTimeout(initialize, 1000);
});

// Also run immediately in case the page is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(initialize, 1000);
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REINITIALIZE' || message.type === 'JOB_SAVED') {
    // Re-run initialization to check for new job data
    setTimeout(initialize, 500);
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});