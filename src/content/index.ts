import { detectJobSite, extractJobData } from './extractors';

// Run on page load
window.addEventListener('load', async () => {
  // Detect if this is a job site we support
  const site = detectJobSite(window.location.href);

  if (site) {
    console.log('Ascentio: Detected job site:', site);

    // Try to extract job data
    const jobData = extractJobData(site, document);

    if (jobData) {
      console.log('Ascentio: Extracted job data:', jobData);

      // Store job data
      chrome.storage.local.set({ currentJob: jobData });

      // Notify background script
      chrome.runtime.sendMessage({
        type: 'JOB_EXTRACTED',
        payload: jobData
      });
    }
  }
});