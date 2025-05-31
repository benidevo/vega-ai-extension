import '@/styles/main.css';

/**
 * Represents the popup UI logic.
 *
 * It handles initialization, job page detection, authentication status, and rendering of UI elements.
 */
class Popup {
  private statusElement: HTMLElement;
  private ctaElement: HTMLElement;
  private isSigningIn = false;

  constructor() {
    this.statusElement = document.getElementById('status')!;
    this.ctaElement = document.getElementById('cta')!;
  }

  async initialize(): Promise<void> {
    try {
      const isJobPage = await this.checkIfJobPage();
      const isAuthenticated = await this.checkAuthStatus();

      this.render(isAuthenticated, isJobPage);
      this.attachEventListeners(isAuthenticated);
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.renderError('Unable to load extension status');
    }
  }

  private async checkAuthStatus(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(['authToken']);
      return !!result.authToken;
    } catch (error) {
      console.error('Failed to check auth status:', error);
      return false;
    }
  }

  private async checkIfJobPage(): Promise<boolean> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url || '';

    return url.includes('linkedin.com/jobs/view/')
  }

  private render(isAuthenticated: boolean, isJobPage: boolean): void {
    if (isJobPage) {
      this.statusElement.innerHTML = `
        <div class="flex items-center justify-center p-3 bg-primary bg-opacity-10 rounded-lg border border-primary border-opacity-30">
          <svg class="w-5 h-5 text-primary mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm font-medium text-primary">Ready to capture job</span>
        </div>
      `;
    } else {
      this.statusElement.innerHTML = `
        <div class="flex items-center justify-center p-3 bg-slate-800 bg-opacity-50 rounded-lg">
          <svg class="w-5 h-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm text-gray-400">Navigate to a job listing</span>
        </div>
      `;
    }

    if (isAuthenticated) {
      this.ctaElement.innerHTML = `
        <a
          href="http://localhost:8000/jobs"
          target="_blank"
          class="block w-full px-4 py-3 bg-primary hover:bg-primary-dark text-white font-medium text-center rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Open Dashboard
          <svg class="inline-block w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>

        <div class="mt-3 text-center">
          <a href="#" id="signout-btn" class="text-xs text-gray-500 hover:text-gray-400 transition-colors">
            Sign out
          </a>
        </div>
      `;
    } else {
      this.ctaElement.innerHTML = `
        <button
          id="signin-btn"
          class="w-full px-4 py-3 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-all duration-200"
        >
          Sign in to Ascentio
        </button>
      `;
    }
  }

  private renderError(message: string): void {
    this.statusElement.innerHTML = `
      <div class="flex items-center justify-center p-3 bg-red-900 bg-opacity-30 rounded-lg border border-red-600 border-opacity-30">
        <svg class="w-5 h-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-sm text-red-400">${message}</span>
      </div>
    `;
  }

  private attachEventListeners(isAuthenticated: boolean): void {
    if (isAuthenticated) {
      const signoutBtn = document.getElementById('signout-btn');
      if (signoutBtn) {
        signoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          await this.handleSignOut();
        });
      }
    } else {
      const signinBtn = document.getElementById('signin-btn');
      if (signinBtn) {
        signinBtn.addEventListener('click', async () => {
          await this.handleSignIn();
        });
      }
    }
  }

  private async handleSignIn(): Promise<void> {
    if (this.isSigningIn) {
      console.warn('Sign-in already in progress, ignoring duplicate request');
      return;
    }

    const signinBtn = document.getElementById('signin-btn') as HTMLButtonElement;
    if (!signinBtn) return;

    this.isSigningIn = true;
    const originalText = signinBtn.textContent;
    signinBtn.disabled = true;
    signinBtn.textContent = 'Signing in...';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'LOGIN' });

      if (response && response.success) {
        await this.initialize();
      } else {
        this.renderError(response?.error || 'Failed to sign in');
        signinBtn.disabled = false;
        signinBtn.textContent = originalText;
      }
    } catch (error) {
      console.error('Sign in error:', error);
      this.renderError('Unable to connect to Ascentio');
      signinBtn.disabled = false;
      signinBtn.textContent = originalText;
    } finally {
      this.isSigningIn = false;
    }
  }

  private async handleSignOut(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'LOGOUT' });

      if (response && response.success) {
        await this.initialize();
      } else {
        this.renderError(response?.error || 'Failed to sign out');
      }
    } catch (error) {
      console.error('Sign out error:', error);
      this.renderError('Unable to sign out');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const popup = new Popup();
  popup.initialize();
});
