import '@/styles/main.css';
import { config } from '@/config';

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
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = tab.url || '';

    return url.includes('linkedin.com/jobs/view/');
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
          href="http://localhost:8765/jobs"
          target="_blank"
          class="vega-btn vega-btn-primary w-full block text-center"
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
      this.renderAuthOptions();
    }
  }

  private renderError(message: string): void {
    this.statusElement.innerHTML = `
      <div class="vega-alert vega-alert-error">
        <div class="flex items-center justify-center">
          <svg class="w-5 h-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm text-red-400">${message}</span>
        </div>
      </div>
    `;
  }

  private attachEventListeners(isAuthenticated: boolean): void {
    if (isAuthenticated) {
      const signoutBtn = document.getElementById('signout-btn');
      if (signoutBtn) {
        signoutBtn.addEventListener('click', async e => {
          e.preventDefault();
          await this.handleSignOut();
        });
      }
    } else {
      this.attachAuthEventListeners();
    }
  }

  private renderAuthOptions(): void {
    const googleAuthSection = config.features.enableGoogleAuth
      ? `
        <!-- Google OAuth Button -->
        <button
          id="google-signin-btn"
          class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors flex items-center justify-center"
        >
          <svg class="w-4 h-4 mr-3" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <!-- Divider -->
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-600"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-slate-900 text-gray-400">or</span>
          </div>
        </div>`
      : '';

    this.ctaElement.innerHTML = `
      <div class="space-y-4">
        ${googleAuthSection}

        <!-- Username/Password Form -->
        <div class="space-y-3">
          <input
            type="text"
            id="username-input"
            placeholder="Username"
            class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          >
          <input
            type="password"
            id="password-input"
            placeholder="Password"
            class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          >
          <button
            id="password-signin-btn"
            class="vega-btn vega-btn-primary w-full text-sm"
          >
            Sign In
          </button>
        </div>

        <!-- Registration Link -->
        <div class="text-center">
          <a
            href="https://vega.benidevo.com"
            target="_blank"
            class="text-xs text-gray-400 hover:text-gray-300 transition-colors"
          >
            Don't have an account, get started
          </a>
        </div>

        <!-- Error Display -->
        <div id="auth-error" class="hidden p-2 bg-red-900/50 border border-red-500/50 rounded-md">
          <div class="flex items-center">
            <svg class="w-4 h-4 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span id="auth-error-text" class="text-xs text-red-400"></span>
          </div>
        </div>
      </div>
    `;
  }

  private attachAuthEventListeners(): void {
    // Google OAuth button (only if enabled)
    if (config.features.enableGoogleAuth) {
      const googleBtn = document.getElementById('google-signin-btn');
      if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
          await this.handleGoogleSignIn();
        });
      }
    }

    // Password sign in button
    const passwordBtn = document.getElementById('password-signin-btn');
    if (passwordBtn) {
      passwordBtn.addEventListener('click', async () => {
        await this.handlePasswordSignIn();
      });
    }

    // Enter key on password field
    const passwordInput = document.getElementById('password-input');
    if (passwordInput) {
      passwordInput.addEventListener('keypress', async e => {
        if (e.key === 'Enter') {
          await this.handlePasswordSignIn();
        }
      });
    }
  }

  private async handleGoogleSignIn(): Promise<void> {
    if (this.isSigningIn) return;

    const googleBtn = document.getElementById(
      'google-signin-btn'
    ) as HTMLButtonElement;
    if (!googleBtn) return;

    this.isSigningIn = true;
    const originalText = googleBtn.textContent;
    googleBtn.disabled = true;
    googleBtn.textContent = 'Signing in...';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'LOGIN' });

      if (response && response.success) {
        await this.initialize();
      } else {
        this.showAuthError(response?.error || 'Google sign-in failed');
      }
    } catch (error) {
      console.error('Google auth error:', error);
      this.showAuthError('Unable to connect to authentication service');
    } finally {
      this.isSigningIn = false;
      googleBtn.disabled = false;
      googleBtn.textContent = originalText;
    }
  }

  private async handlePasswordSignIn(): Promise<void> {
    if (this.isSigningIn) return;

    const usernameInput = document.getElementById(
      'username-input'
    ) as HTMLInputElement;
    const passwordInput = document.getElementById(
      'password-input'
    ) as HTMLInputElement;
    const passwordBtn = document.getElementById(
      'password-signin-btn'
    ) as HTMLButtonElement;

    if (!usernameInput || !passwordInput || !passwordBtn) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      this.showAuthError('Please enter both username and password');
      return;
    }

    this.isSigningIn = true;
    const originalText = passwordBtn.textContent;
    passwordBtn.disabled = true;
    passwordBtn.textContent = 'Signing in...';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'LOGIN_WITH_PASSWORD',
        payload: { username, password },
      });

      if (response && response.success) {
        await this.initialize();
      } else {
        this.showAuthError(response?.error || 'Sign in failed');
      }
    } catch (error) {
      console.error('Password auth error:', error);
      this.showAuthError('Unable to connect to authentication service');
    } finally {
      this.isSigningIn = false;
      passwordBtn.disabled = false;
      passwordBtn.textContent = originalText;
    }
  }

  private showAuthError(message: string): void {
    const errorDiv = document.getElementById('auth-error');
    const errorText = document.getElementById('auth-error-text');

    if (errorDiv && errorText) {
      errorText.textContent = message;
      errorDiv.classList.remove('hidden');

      // Auto-hide after 5 seconds
      setTimeout(() => {
        errorDiv.classList.add('hidden');
      }, 5000);
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
