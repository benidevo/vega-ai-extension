import { detectJobSite, extractJobData } from './extractors';
import { AscentioOverlay } from './overlay';

// Initialize overlay
let overlay: AscentioOverlay | null = null;

// Initialize the content script
async function initialize(): Promise<void> {
  // Detect if this is a job site we support
  const site = detectJobSite(window.location.href);

  if (site) {
    console.log('Ascentio: Detected job site:', site);

    // Create overlay if it doesn't exist
    if (!overlay) {
      overlay = new AscentioOverlay();
    }

    // Try to extract job data
    const jobData = extractJobData(site, document);

    if (jobData) {
      console.log('Ascentio: Extracted job data:', jobData);

      // Store job data
      chrome.storage.local.set({ currentJob: jobData });

      // Update badge to indicate job is ready
      chrome.action.setBadgeText({ text: '1' });
      chrome.action.setBadgeBackgroundColor({ color: '#0D9488' }); // Use primary color

      // Notify background script
      chrome.runtime.sendMessage({
        type: 'JOB_EXTRACTED',
        payload: jobData
      });
    }
  } else {
    // Remove overlay if we're not on a job page
    if (overlay) {
      overlay.destroy();
      overlay = null;
    }
  }
}

// Listen for page changes (SPA navigation)
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