import { JobListing } from '@/types';

// Handle when extension is installed
chrome.runtime.onInstalled.addListener((details) => {
  chrome.action.setBadgeText({ text: '1' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JOB_EXTRACTED') {
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  }

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
  const clientId = 'placeholder-client-id.apps.googleusercontent.com';
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

      const url = new URL(responseUrl);
      const params = new URLSearchParams(url.hash.substring(1));
      const accessToken = params.get('access_token');

      if (accessToken) {
        exchangeTokenForJWT(accessToken);
      }
    }
  );
}

async function exchangeTokenForJWT(googleToken: string): Promise<void> {
  try {
    const response = await fetch('https://localhost:8000/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleToken })
    });

    const data = await response.json();

    chrome.storage.local.set({
      authToken: data.token,
      user: data.user
    });
  } catch (error) {
    console.error('Error exchanging token', error);
  }
}