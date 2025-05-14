import { JobListing } from '@/types';

// Handle when extension is installed
chrome.runtime.onInstalled.addListener((details) => {
  console.log('ProspecTor extension installed');

  // Add a sample job for testing
  const sampleJob: JobListing = {
    title: "Senior Software Engineer",
    company: "Demo Company Inc.",
    location: "San Francisco, CA (Remote)",
    description: "We're looking for a senior software engineer with experience in JavaScript, React, and Node.js.",
    url: "https://example.com/job/123",
    source: "demo",
    extractedAt: new Date().toISOString()
  };

  // Store the sample job
  chrome.storage.local.set({ currentJob: sampleJob });

  // Show notification badge
  chrome.action.setBadgeText({ text: '1' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JOB_EXTRACTED') {
    // Show notification that job was captured
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  }

  // Always return true for async responses
  return true;
});

// Handle authentication with Google
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOGIN') {
    initiateGoogleAuth();
  }
  return true;
});

function initiateGoogleAuth(): void {
  // Google OAuth implementation
  const clientId = 'placeholder-client-id.apps.googleusercontent.com'; // Replace with your client ID
  const redirectUri = chrome.identity.getRedirectURL('oauth2');
  const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');

  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'email profile');

  chrome.identity.launchWebAuthFlow(
    { url: authUrl.toString(), interactive: true },
    (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        console.error('Auth error', chrome.runtime.lastError);
        return;
      }

      // Extract access token from URL
      const url = new URL(responseUrl);
      const params = new URLSearchParams(url.hash.substring(1));
      const accessToken = params.get('access_token');

      // Exchange with your backend for JWT
      if (accessToken) {
        exchangeTokenForJWT(accessToken);
      }
    }
  );
}

async function exchangeTokenForJWT(googleToken: string): Promise<void> {
  try {
    const response = await fetch('https://your-api.example.com/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleToken })
    });

    const data = await response.json();

    // Store the JWT
    chrome.storage.local.set({
      authToken: data.token,
      user: data.user
    });
  } catch (error) {
    console.error('Error exchanging token', error);
  }
}