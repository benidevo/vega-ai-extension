import '@/styles/main.css';
import { JobListing } from '@/types';

// Get reference to the DOM elements
const authContentElement = document.getElementById('auth-content');
const jobDataElement = document.getElementById('job-data');
const pageStatusElement = document.getElementById('page-status');

// Initialize the popup
async function initPopup(): Promise<void> {
  // Check if we're on a supported job page
  checkPageStatus();
  
  // BYPASS AUTH: Skip login check and always assume user is logged in
  // Get current job data directly
  const { currentJob } = await chrome.storage.local.get('currentJob');
  
  if (currentJob) {
    renderJobData(currentJob);
  } else {
    renderEmptyState();
  }
}

async function checkPageStatus(): Promise<void> {
  if (!pageStatusElement) return;
  
  // Query the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url || '';
  
  // Check if we're on a supported job site
  const isJobPage = 
    url.includes('linkedin.com/jobs') ||
    url.includes('indeed.com/viewjob') ||
    url.includes('indeed.com/job');
  
  if (isJobPage) {
    pageStatusElement.innerHTML = `
      <div class="p-3 bg-primary bg-opacity-10 border border-primary border-opacity-30 rounded-md">
        <p class="text-sm text-primary flex items-center">
          <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Job listing detected on this page
        </p>
      </div>
    `;
  } else {
    pageStatusElement.innerHTML = '';
  }
}

function renderLoginForm(): void {
  if (!authContentElement) return;
  
  authContentElement.innerHTML = `
    <div class="text-center py-8">
      <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <h2 class="text-lg font-medium mb-2">Sign in to Ascentio</h2>
      <p class="text-sm text-gray-400 mb-4">Connect your account to start capturing jobs</p>
      <button class="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm rounded-md transition-colors">
        Sign In
      </button>
    </div>
  `;
}

function renderJobData(job: JobListing): void {
  if (!jobDataElement || !authContentElement) return;
  
  // Display the current job data
  jobDataElement.innerHTML = `
    <div class="mb-3 p-3 bg-slate-800 bg-opacity-50 rounded-md border border-slate-700">
      <h3 class="font-medium text-sm text-white mb-1">${job.title}</h3>
      <p class="text-xs text-gray-400 mb-2">${job.company} • ${job.location}</p>
      <div class="flex items-center justify-between">
        <span class="text-xs text-primary">Ready to save</span>
      </div>
    </div>
  `;
  
  // Add the save form
  authContentElement.innerHTML = `
    <div>
      <form id="jobForm">
        <div class="mb-3">
          <label class="block text-xs font-medium text-gray-300 mb-1">Interest Level</label>
          <select 
            id="interestLevel" 
            name="interestLevel"
            class="w-full px-3 py-2 text-sm rounded-md bg-slate-800 bg-opacity-50 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="high">High - Very Interested</option>
            <option value="medium" selected>Medium - Somewhat Interested</option>
            <option value="low">Low - Slightly Interested</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="block text-xs font-medium text-gray-300 mb-1">Notes</label>
          <textarea 
            id="notes"
            name="notes" 
            class="w-full px-3 py-2 text-sm rounded-md bg-slate-800 bg-opacity-50 border border-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary" 
            rows="3" 
            placeholder="Add any notes about this job..."
          ></textarea>
        </div>
        <button 
          id="saveBtn"
          type="button"
          class="w-full px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm rounded-md transition-colors duration-200"
        >
          Save to Ascentio
        </button>
      </form>
    </div>
  `;
  
  // Add event listener to save button
  document.getElementById('saveBtn')?.addEventListener('click', saveJob);
}

function renderEmptyState(): void {
  if (!authContentElement) return;
  
  authContentElement.innerHTML = `
    <div class="text-center py-8">
      <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <p class="text-sm text-gray-400 mb-2">No job detected on this page</p>
      <p class="text-xs text-gray-500">Navigate to a job listing to capture it</p>
    </div>
  `;
}

async function saveJob(): Promise<void> {
  const interestLevel = document.getElementById('interestLevel') as HTMLSelectElement;
  const notes = document.getElementById('notes') as HTMLTextAreaElement;
  
  // Get the current job data only, bypass auth token
  const { currentJob } = await chrome.storage.local.get(['currentJob']);
  
  if (!currentJob) return;
  
  // Prepare the job data with user input
  const jobToSave: JobListing = {
    ...currentJob,
    interestLevel: interestLevel?.value as 'high' | 'medium' | 'low',
    notes: notes?.value || '',
    savedAt: new Date().toISOString()
  };
  
  try {
    // BYPASS API: Instead of sending to API, just log and store locally
    console.log('Job saved:', jobToSave);
    
    // Store in local storage for demo
    await chrome.storage.local.set({ savedJobs: [jobToSave] });
    
    // Simulate successful response
    const response = { ok: true };
    
    if (response.ok) {
      // Clear the current job
      chrome.storage.local.remove('currentJob');
      // Reset the badge
      chrome.action.setBadgeText({ text: '' });
      
      // Send message to content script to reinitialize
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'JOB_SAVED' });
      }
      
      // Show success message
      if (authContentElement) {
        authContentElement.innerHTML = `
          <div class="p-3 bg-green-900 bg-opacity-50 border border-green-700 rounded-md text-center"
               _="on load wait 3s then remove me">
            <p class="text-sm text-green-300 font-medium mb-1">Job Saved Successfully!</p>
            <p class="text-xs text-green-300">The job has been added to your dashboard</p>
          </div>
        `;
        
        // Reset to empty state after success
        setTimeout(async () => {
          // Re-initialize to check for new job data
          await initPopup();
        }, 3000);
      }
    }
  } catch (error) {
    console.error('Error saving job', error);
    
    // Show error message
    if (authContentElement) {
      authContentElement.innerHTML = `
        <div class="p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded-md text-center">
          <p class="text-sm text-red-300 font-medium mb-1">Error Saving Job</p>
          <p class="text-xs text-red-300 mb-3">Please try again</p>
          <button 
            id="retryBtn" 
            class="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      `;
      
      document.getElementById('retryBtn')?.addEventListener('click', () => {
        // Re-initialize the popup to try again
        initPopup();
      });
    }
  }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initPopup);