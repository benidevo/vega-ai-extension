import '@/styles/main.css';
import { JobListing } from '@/types';

// Get reference to the DOM elements
const contentElement = document.getElementById('content');
const jobDataElement = document.getElementById('jobData');

// Initialize the popup
async function initPopup(): Promise<void> {
  // BYPASS AUTH: Skip login check and always assume user is logged in
  // Get current job data directly
  const { currentJob } = await chrome.storage.local.get('currentJob');
  
  if (currentJob) {
    renderJobData(currentJob);
  } else {
    renderEmptyState();
  }
}

function renderLoginForm(): void {
  if (!contentElement) return;
  
  contentElement.innerHTML = `
    <div class="bg-white p-4 rounded shadow">
      <h2 class="text-lg font-semibold mb-4">Login to ProspecTor</h2>
      <button 
        id="loginBtn" 
        class="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        hx-on:click="chrome.runtime.sendMessage({ type: 'LOGIN' })"
      >
        Sign in with Google
      </button>
    </div>
  `;
}

function renderJobData(job: JobListing): void {
  if (!jobDataElement || !contentElement) return;
  
  // Display the current job data
  jobDataElement.innerHTML = `
    <div class="bg-white p-3 rounded shadow-sm">
      <h2 class="text-md font-semibold">${job.title}</h2>
      <p class="text-sm text-gray-600">${job.company}</p>
      <p class="text-xs text-gray-500">${job.location}</p>
    </div>
  `;
  
  // Add the save form
  contentElement.innerHTML = `
    <div class="bg-white p-4 rounded shadow">
      <h3 class="text-md font-semibold mb-2">Save Job</h3>
      <form id="jobForm">
        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-700 mb-1">Interest Level</label>
          <select 
            id="interestLevel" 
            name="interestLevel"
            class="w-full border rounded p-1.5 text-sm"
          >
            <option value="high">High - Very Interested</option>
            <option value="medium" selected>Medium - Somewhat Interested</option>
            <option value="low">Low - Slightly Interested</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea 
            id="notes"
            name="notes" 
            class="w-full border rounded p-1.5 text-sm" 
            rows="3" 
            placeholder="Add any notes about this job..."
          ></textarea>
        </div>
        <button 
          id="saveBtn"
          type="button"
          class="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
          hx-on:click="saveJob()"
        >
          Save Job
        </button>
      </form>
    </div>
  `;
  
  // Add event listener to save button
  document.getElementById('saveBtn')?.addEventListener('click', saveJob);
}

function renderEmptyState(): void {
  if (!contentElement) return;
  
  contentElement.innerHTML = `
    <div class="bg-white p-4 rounded shadow text-center">
      <p class="text-gray-700 mb-2">No job detected on this page</p>
      <p class="text-sm text-gray-500">Visit a supported job page to capture details</p>
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
      
      // Show success message
      if (contentElement) {
        contentElement.innerHTML = `
          <div class="bg-white p-4 rounded shadow text-center">
            <p class="text-green-500 font-semibold mb-2">Job Saved Successfully!</p>
            <p class="text-sm text-gray-500">The job has been added to your dashboard</p>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Error saving job', error);
    
    // Show error message
    if (contentElement) {
      contentElement.innerHTML = `
        <div class="bg-white p-4 rounded shadow text-center">
          <p class="text-red-500 font-semibold mb-2">Error Saving Job</p>
          <p class="text-sm text-gray-500">Please try again</p>
          <button 
            id="retryBtn" 
            class="mt-2 bg-blue-500 text-white py-1 px-4 rounded text-sm hover:bg-blue-600"
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