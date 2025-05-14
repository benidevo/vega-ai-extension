# ProspecTor Browser Extension: TDD (Vanilla Implementation)

## Tech Stack

- **Framework:** None (vanilla browser extension)
- **Language:** TypeScript
- **UI:** Vanilla HTML + HTMX
- **Styling:** Tailwind CSS
- **HTTP:** Native Fetch API
- **Authentication:** Google OAuth 2.0
- **Building/Bundling:** Simple npm script for now (focusing on Chrome/Edge browsers)

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Content Script │────▶│  Service Worker │────▶│  ProspecTor API │
│                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│  Browser Storage│◀───▶│   Popup UI      │
│                 │     │                 │
└─────────────────┘     └─────────────────┘
```

## Components

### 1. Content Scripts

Purpose: Extract job data from web pages.

```typescript
// content/index.ts
import { detectJobSite, extractJobData } from './extractors';

// Run on page load
window.addEventListener('load', async () => {
  const site = detectJobSite(window.location.href);
  if (site) {
    const jobData = await extractJobData(site, document);
    if (jobData) {
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
```

### 2. Service Worker (Background)

Purpose: Handle background tasks, authentication, and API communication.

```typescript
// background.ts
// Handle job extracted messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JOB_EXTRACTED') {
    // Set badge notification
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  }
  return true;
});

// Handle auth flow
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOGIN') {
    initiateGoogleAuth();
  }
  return true;
});
```

### 3. Popup UI

Purpose: Display, edit, and upload job data.

```html
<!-- popup/index.html -->
<div class="w-80 p-4 bg-gray-50">
  <h1 class="text-xl font-bold mb-4">ProspecTor</h1>

  <!-- Job data form -->
  <form hx-post="https://api.prospector.example/jobs"
        hx-trigger="submit"
        hx-indicator="#loading">
    <!-- Form fields -->
    <div class="mb-3">
      <label class="block text-sm font-medium text-gray-700">Job Title</label>
      <input type="text" name="title" id="title" class="w-full p-2 border rounded">
    </div>

    <!-- Other fields -->

    <button type="submit" class="w-full py-2 px-4 bg-blue-600 text-white rounded-lg">
      Upload Job
    </button>
  </form>
</div>
```

```typescript
// popup/index.ts
import '../styles/main.css';
import 'htmx.org';

// Load current job data
document.addEventListener('DOMContentLoaded', async () => {
  const { currentJob, authToken } = await chrome.storage.local.get(['currentJob', 'authToken']);

  // Check authentication
  if (!authToken) {
    document.body.innerHTML = `
      <div class="flex flex-col items-center p-4">
        <p class="mb-4">Please sign in to use ProspecTor</p>
        <button id="login" class="px-4 py-2 bg-blue-600 text-white rounded">
          Sign in with Google
        </button>
      </div>
    `;
    document.getElementById('login').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'LOGIN' });
    });
    return;
  }

  // Populate form with job data
  if (currentJob) {
    document.getElementById('title').value = currentJob.title || '';
    // Populate other fields
  }

  // Add authorization header to all HTMX requests
  document.body.setAttribute('hx-headers', JSON.stringify({
    'Authorization': `Bearer ${authToken}`
  }));
});
```

### 4. Extractors

Purpose: Site-specific job data extraction logic.

```typescript
// content/extractors/linkedin.ts
export function extractLinkedInJob(document: Document): JobListing {
  // Try structured data first
  const structuredData = extractStructuredData(document);
  if (structuredData) return structuredData;

  // Fall back to DOM parsing
  return {
    title: getText(document, '.job-title'),
    company: getText(document, '.company-name'),
    location: getText(document, '.job-location'),
    description: getText(document, '.description__text'),
    url: window.location.href,
    source: 'LinkedIn',
    postedAt: new Date().toISOString()
  };
}

function extractStructuredData(document: Document): JobListing | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      if (data['@type'] === 'JobPosting') {
        return {
          title: data.title,
          company: data.hiringOrganization?.name,
          location: data.jobLocation?.address?.addressLocality,
          description: data.description,
          url: window.location.href,
          source: 'LinkedIn',
          postedAt: new Date().toISOString()
        };
      }
    } catch (e) {
      console.error('Error parsing structured data:', e);
    }
  }
  return null;
}
```

## Authentication Flow

1. User clicks "Sign in with Google" button in popup
2. Extension calls chrome.identity.launchWebAuthFlow()
3. User completes Google authentication
4. Extension receives OAuth token
5. Extension exchanges token with ProspecTor backend for JWT
6. JWT stored securely in chrome.storage.local
7. JWT used for all subsequent API calls

## API Endpoints

### Authentication

- `POST /api/auth/google` - Exchange Google token for ProspecTor JWT
  - Request: `{ token: string }`
  - Response: `{ token: string, user: UserProfile }`

### Job Management

- `POST /api/jobs` - Upload job listing
  - Headers: `Authorization: Bearer {jwt}`
  - Body: `JobListing` object
  - Response: `{ id: string, status: string }`

## Local Storage Schema

```typescript
interface StorageSchema {
  authToken: string;            // JWT from backend
  user: UserProfile;            // User information
  currentJob: JobListing | null; // Currently captured job
  pendingUploads: JobListing[]; // Jobs waiting to be uploaded
}
```

## Implementation Plan

### Phase 1: Setup (1-2 days)

- Set up vanilla extension project structure
- Configure TypeScript, Tailwind CSS, HTMX
- Create manifest.json and base files
- Implement storage utilities

### Phase 2: Authentication (1-2 days)

- Implement Google OAuth flow
- Create token exchange with backend
- Build authentication UI

### Phase 3: Job Extraction (3-4 days)

- Implement content scripts for LinkedIn
- Add support for Indeed
- Build generic extraction fallbacks

### Phase 4: UI & Upload (2-3 days)

- Create popup UI with HTMX
- Build form for job data editing with Tailwind
- Implement job upload functionality
- Add offline support for pending uploads

### Phase 5: Testing & Refinement (2-3 days)

- Test on different job sites
- Fix extraction bugs
- Optimize performance
- Cross-browser testing
