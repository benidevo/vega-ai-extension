import '@/styles/main.css';
import { SettingsService } from '@/background/services/settings/SettingsService';
import { errorService } from '@/background/services/error';
import { Logger } from '@/utils/logger';
import {
  validatePassword,
  validateUsername,
  validateHost,
  ValidationResult,
} from '@/utils/validation';
import { MessageType } from '@/background/services/message/IMessageService';

/**
 * Represents the popup UI logic.
 *
 * It handles initialization, job page detection, authentication status, and rendering of UI elements.
 */
class Popup {
  private statusElement: HTMLElement;
  private ctaElement: HTMLElement;
  private settingsView: HTMLElement;
  private isSigningIn = false;
  private currentView: 'main' | 'settings' = 'main';
  private statusTimeout: number | null = null;
  private logger = new Logger('Popup');

  constructor() {
    this.statusElement = document.getElementById('status')!;
    this.ctaElement = document.getElementById('cta')!;
    this.settingsView = document.getElementById('settings-view')!;
  }

  async initialize(): Promise<void> {
    try {
      const isJobPage = await this.checkIfJobPage();
      const isAuthenticated = await this.checkAuthStatus();

      await this.render(isAuthenticated, isJobPage);
      this.attachEventListeners(isAuthenticated);
      this.attachSettingsEventListeners();

      // Listen for auth state changes from background
      chrome.runtime.onMessage.addListener(message => {
        if (message.type === MessageType.AUTH_STATE_CHANGED) {
          // Only re-initialize if we're not in the middle of signing in
          // This prevents clearing error messages during failed login attempts
          if (!this.isSigningIn) {
            this.initialize();
          }
        }
      });
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'popup_initialize',
      });
      this.renderError(errorDetails.userMessage);
    }
  }

  private async checkAuthStatus(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(['authToken']);
      return !!result.authToken;
    } catch (error) {
      errorService.handleError(error, { action: 'check_auth_status' });
      return false;
    }
  }

  private async checkIfJobPage(): Promise<boolean> {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = tab.url || '';

    // Currently only LinkedIn is supported
    // TODO: Add support for Indeed and Glassdoor job pages
    return url.includes('linkedin.com/jobs/view/');
  }

  private async render(
    isAuthenticated: boolean,
    isJobPage: boolean
  ): Promise<void> {
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
          href="#"
          id="dashboard-link"
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
      await this.renderAuthOptions();
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

  private async renderAuthOptions(): Promise<void> {
    const isOAuthEnabled = await SettingsService.isOAuthEnabled();

    if (isOAuthEnabled) {
      // Cloud mode - show OAuth
      this.ctaElement.innerHTML = `
        <div class="space-y-4">
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
    } else {
      // Local mode - show username/password form
      this.ctaElement.innerHTML = `
        <div class="space-y-4">
          <!-- Username/Password Form -->
          <div class="space-y-3">
            <div>
              <input
                type="text"
                id="username-input"
                placeholder="Username (3-50 characters)"
                class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              >
              <div id="username-error" class="hidden mt-1 text-xs text-red-400"></div>
              <div id="username-help" class="mt-1 text-xs text-gray-500">Letters, numbers, periods, underscores, and hyphens allowed</div>
            </div>
            <div>
              <div class="relative">
                <input
                  type="password"
                  id="password-input"
                  placeholder="Password (8-64 characters)"
                  class="w-full px-3 py-2 pr-10 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                >
                <button
                  type="button"
                  id="password-toggle"
                  class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-300"
                  aria-label="Toggle password visibility"
                >
                  <svg id="password-show-icon" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg id="password-hide-icon" class="w-5 h-5 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </button>
              </div>
              <div id="password-error" class="hidden mt-1 text-xs text-red-400"></div>
              <div id="password-help" class="mt-1 text-xs text-gray-500">Use a strong, unique password for security</div>
            </div>
            <button
              id="password-signin-btn"
              class="vega-btn vega-btn-primary w-full text-sm"
              disabled
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
  }

  private attachAuthEventListeners(): void {
    // Attach Google OAuth listener if present
    const googleBtn = document.getElementById('google-signin-btn');
    if (googleBtn) {
      googleBtn.setAttribute('aria-label', 'Sign in with Google account');
      googleBtn.addEventListener('click', async () => {
        await this.handleGoogleSignIn();
      });
    }

    // Attach password form listeners if present
    const usernameInput = document.getElementById(
      'username-input'
    ) as HTMLInputElement;
    if (usernameInput) {
      usernameInput.setAttribute('aria-label', 'Username');
      usernameInput.setAttribute(
        'aria-describedby',
        'username-help username-error'
      );
      usernameInput.setAttribute('aria-required', 'true');
      usernameInput.addEventListener('input', () => {
        this.validateUsernameInput();
        this.updateSignInButtonState();
      });
      usernameInput.addEventListener('blur', () => {
        this.validateUsernameInput();
      });
    }

    const passwordInput = document.getElementById(
      'password-input'
    ) as HTMLInputElement;
    if (passwordInput) {
      passwordInput.setAttribute('aria-label', 'Password');
      passwordInput.setAttribute(
        'aria-describedby',
        'password-help password-error'
      );
      passwordInput.setAttribute('aria-required', 'true');
      passwordInput.addEventListener('input', () => {
        this.validatePasswordInput();
        this.updateSignInButtonState();
      });
      passwordInput.addEventListener('blur', () => {
        this.validatePasswordInput();
      });
      passwordInput.addEventListener('keypress', async e => {
        if (e.key === 'Enter' && this.isFormValid()) {
          await this.handlePasswordSignIn();
        }
      });
    }

    // Password visibility toggle
    const passwordToggle = document.getElementById('password-toggle');
    if (passwordToggle && passwordInput) {
      passwordToggle.addEventListener('click', () => {
        const showIcon = document.getElementById('password-show-icon');
        const hideIcon = document.getElementById('password-hide-icon');

        if (passwordInput.type === 'password') {
          passwordInput.type = 'text';
          showIcon?.classList.add('hidden');
          hideIcon?.classList.remove('hidden');
        } else {
          passwordInput.type = 'password';
          showIcon?.classList.remove('hidden');
          hideIcon?.classList.add('hidden');
        }
      });
    }

    // Password sign in button
    const passwordBtn = document.getElementById('password-signin-btn');
    if (passwordBtn) {
      passwordBtn.setAttribute(
        'aria-label',
        'Sign in with username and password'
      );
      passwordBtn.addEventListener('click', async () => {
        await this.handlePasswordSignIn();
      });
    }

    // Set up aria-live regions
    const authError = document.getElementById('auth-error');
    if (authError) {
      authError.setAttribute('role', 'alert');
      authError.setAttribute('aria-live', 'polite');
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
      const errorDetails = errorService.handleError(error, {
        action: 'google_auth',
      });
      this.showAuthError(errorDetails.userMessage);
    } finally {
      this.isSigningIn = false;
      googleBtn.disabled = false;
      googleBtn.textContent = originalText;
    }
  }

  private updateValidationUI(
    input: HTMLInputElement,
    errorElement: HTMLElement,
    helpElement: HTMLElement,
    validation: ValidationResult
  ): void {
    if (validation.isValid) {
      input.classList.remove('border-red-500');
      input.classList.add('border-green-500');
      errorElement.classList.add('hidden');
      helpElement.classList.remove('hidden');
    } else {
      input.classList.remove('border-green-500');
      input.classList.add('border-red-500');
      errorElement.textContent = validation.error || '';
      errorElement.classList.remove('hidden');
      helpElement.classList.add('hidden');
    }
  }

  private validateUsernameInput(): ValidationResult {
    const usernameInput = document.getElementById(
      'username-input'
    ) as HTMLInputElement;
    const usernameError = document.getElementById('username-error');
    const usernameHelp = document.getElementById('username-help');

    if (!usernameInput || !usernameError || !usernameHelp) {
      return { isValid: false };
    }

    const validation = validateUsername(usernameInput.value);
    this.updateValidationUI(
      usernameInput,
      usernameError,
      usernameHelp,
      validation
    );
    return validation;
  }

  private validatePasswordInput(): ValidationResult {
    const passwordInput = document.getElementById(
      'password-input'
    ) as HTMLInputElement;
    const passwordError = document.getElementById('password-error');
    const passwordHelp = document.getElementById('password-help');

    if (!passwordInput || !passwordError || !passwordHelp) {
      return { isValid: false };
    }

    const validation = validatePassword(passwordInput.value);
    this.updateValidationUI(
      passwordInput,
      passwordError,
      passwordHelp,
      validation
    );
    return validation;
  }

  private isFormValid(): boolean {
    const usernameInput = document.getElementById(
      'username-input'
    ) as HTMLInputElement;
    const passwordInput = document.getElementById(
      'password-input'
    ) as HTMLInputElement;

    if (!usernameInput || !passwordInput) return false;

    const usernameValid = validateUsername(usernameInput.value).isValid;
    const passwordValid = validatePassword(passwordInput.value).isValid;

    return usernameValid && passwordValid;
  }

  private updateSignInButtonState(): void {
    const passwordBtn = document.getElementById(
      'password-signin-btn'
    ) as HTMLButtonElement;
    if (!passwordBtn) return;

    const isValid = this.isFormValid();
    passwordBtn.disabled = !isValid || this.isSigningIn;

    if (isValid) {
      passwordBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      passwordBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }

  private async handlePasswordSignIn(): Promise<void> {
    if (this.isSigningIn || !this.isFormValid()) return;

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

    // Final validation before submission
    const usernameValidation = validateUsername(username);
    const passwordValidation = validatePassword(password);

    if (!usernameValidation.isValid) {
      this.showAuthError(usernameValidation.error || 'Invalid username');
      return;
    }

    if (!passwordValidation.isValid) {
      this.showAuthError(passwordValidation.error || 'Invalid password');
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
        // Small delay to ensure storage is synced
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.initialize();
      } else {
        const errorMessage = response?.error || 'Sign in failed';
        this.showAuthError(errorMessage);
      }
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'password_auth',
      });
      this.showAuthError(errorDetails.userMessage);
    } finally {
      this.isSigningIn = false;
      this.updateSignInButtonState();
      passwordBtn.textContent = originalText;
    }
  }

  private showAuthError(message: string): void {
    const errorDiv = document.getElementById('auth-error');
    const errorText = document.getElementById('auth-error-text');

    if (errorDiv && errorText) {
      errorText.textContent = message;
      errorDiv.classList.remove('hidden');

      // Auto-hide after 5 seconds - balanced for accessibility and UX
      setTimeout(() => {
        errorDiv.classList.add('hidden');
      }, 5000);
    } else {
      // If the error elements don't exist, display error in status area as fallback
      this.renderError(message);
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
      const errorDetails = errorService.handleError(error, {
        action: 'sign_out',
      });
      this.renderError(errorDetails.userMessage);
    }
  }

  private attachSettingsEventListeners(): void {
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.showSettings());
    }

    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.showMainView());
    }

    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveSettings());
    }

    // Add event listeners for backend mode radio buttons
    const cloudRadio = document.getElementById(
      'backend-cloud'
    ) as HTMLInputElement;
    const localRadio = document.getElementById(
      'backend-local'
    ) as HTMLInputElement;
    if (cloudRadio) {
      cloudRadio.addEventListener('change', () =>
        this.toggleLocalBackendSettings()
      );
    }
    if (localRadio) {
      localRadio.addEventListener('change', () =>
        this.toggleLocalBackendSettings()
      );
    }

    // Add event listener for custom host input validation
    const customHostInput = document.getElementById(
      'custom-host'
    ) as HTMLInputElement;
    if (customHostInput) {
      customHostInput.addEventListener('input', () => this.validateHostInput());
      customHostInput.addEventListener('blur', () => this.validateHostInput());
    }

    // Add test connection button listener
    const testConnectionBtn = document.getElementById('test-connection-btn');
    if (testConnectionBtn) {
      testConnectionBtn.addEventListener('click', () => this.testConnection());
    }

    this.updateDashboardLink();
  }

  private async showSettings(): Promise<void> {
    this.currentView = 'settings';

    this.statusElement.classList.add('hidden');
    this.ctaElement.classList.add('hidden');

    this.settingsView.classList.remove('hidden');

    const settings = await SettingsService.getSettings();
    const backendMode = settings.backendMode;

    // Set the appropriate radio button
    const cloudRadio = document.getElementById(
      'backend-cloud'
    ) as HTMLInputElement;
    const localRadio = document.getElementById(
      'backend-local'
    ) as HTMLInputElement;

    if (cloudRadio && localRadio) {
      cloudRadio.checked = backendMode === 'cloud';
      localRadio.checked = backendMode === 'local';
    }

    // Set custom host and scheme values
    const customHostInput = document.getElementById(
      'custom-host'
    ) as HTMLInputElement;
    const customSchemeSelect = document.getElementById(
      'custom-scheme'
    ) as HTMLSelectElement;

    if (customHostInput && customSchemeSelect) {
      // If in local mode, show the current settings
      // Otherwise, show the default local settings
      if (backendMode === 'local') {
        customHostInput.value = settings.apiHost;
        customSchemeSelect.value = settings.apiProtocol;
      } else {
        // Show default local settings when not in local mode
        customHostInput.value = 'localhost:8765';
        customSchemeSelect.value = 'http';
      }
    }

    // Show/hide local backend settings based on current mode
    this.toggleLocalBackendSettings();

    // Re-attach event listeners after showing settings
    this.attachSettingsEventListeners();
  }

  private showMainView(): void {
    this.currentView = 'main';

    this.statusElement.classList.remove('hidden');
    this.ctaElement.classList.remove('hidden');

    this.settingsView.classList.add('hidden');

    this.hideSettingsStatus();
  }

  private async saveSettings(): Promise<void> {
    const cloudRadio = document.getElementById(
      'backend-cloud'
    ) as HTMLInputElement;
    const localRadio = document.getElementById(
      'backend-local'
    ) as HTMLInputElement;
    const customHostInput = document.getElementById(
      'custom-host'
    ) as HTMLInputElement;
    const customSchemeSelect = document.getElementById(
      'custom-scheme'
    ) as HTMLSelectElement;

    if (!cloudRadio || !localRadio) return;

    const newMode = cloudRadio.checked ? 'cloud' : 'local';
    const currentSettings = await SettingsService.getSettings();
    const currentMode = currentSettings.backendMode;

    // Validate custom host for local mode
    if (newMode === 'local' && customHostInput) {
      const hostValidation = this.validateHostInput();
      if (!hostValidation.isValid) {
        this.showSettingsStatus(
          hostValidation.error || 'Invalid host',
          'error'
        );
        return;
      }
    }

    try {
      // Save the backend mode with custom settings if local
      if (newMode === 'local' && customHostInput && customSchemeSelect) {
        await SettingsService.setBackendMode(
          newMode,
          customHostInput.value.trim(),
          customSchemeSelect.value as 'http' | 'https'
        );
      } else {
        await SettingsService.setBackendMode(newMode);
      }

      this.showSettingsStatus('Settings saved successfully!', 'success');

      // Update dashboard link
      this.updateDashboardLink();

      // Notify background script to reload services with new settings
      await chrome.runtime.sendMessage({ type: 'RELOAD_SETTINGS' });

      // Check if significant settings changed
      const settingsChanged =
        currentMode !== newMode ||
        (newMode === 'local' &&
          (currentSettings.apiHost !== customHostInput?.value.trim() ||
            currentSettings.apiProtocol !== customSchemeSelect?.value));

      if (settingsChanged) {
        const isAuthenticated = await this.checkAuthStatus();
        if (isAuthenticated) {
          this.showSettingsStatus(
            'Backend settings changed. Please sign out and sign in again.',
            'info'
          );
          setTimeout(() => this.showMainView(), 3000);
        } else {
          // Reinitialize to show the correct auth form
          setTimeout(async () => {
            await this.initialize();
          }, 1500);
        }
      } else {
        // Go back to main view after a short delay
        setTimeout(() => this.showMainView(), 1500);
      }
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'save_settings',
        newMode,
      });
      this.showSettingsStatus(errorDetails.userMessage, 'error');
    }
  }

  private showSettingsStatus(
    message: string,
    type: 'info' | 'success' | 'error'
  ): void {
    const statusDiv = document.getElementById('settings-status');
    if (!statusDiv) return;

    // Clear any existing timeout
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }

    const colorClasses = {
      info: 'bg-blue-900/50 border-blue-500/50 text-blue-400',
      success: 'bg-green-900/50 border-green-500/50 text-green-400',
      error: 'bg-red-900/50 border-red-500/50 text-red-400',
    };

    statusDiv.className = `p-2 border rounded-md ${colorClasses[type]}`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden');

    // Auto-hide success and info messages after 3 seconds
    if (type === 'success' || type === 'info') {
      this.statusTimeout = window.setTimeout(() => {
        this.hideSettingsStatus();
      }, 5000);
    }
    // Auto-hide error messages after 3 seconds
    else if (type === 'error') {
      this.statusTimeout = window.setTimeout(() => {
        this.hideSettingsStatus();
      }, 5000);
    }
  }

  private hideSettingsStatus(): void {
    const statusDiv = document.getElementById('settings-status');
    if (statusDiv) {
      statusDiv.classList.add('hidden');
    }
  }

  private toggleLocalBackendSettings(): void {
    const localRadio = document.getElementById(
      'backend-local'
    ) as HTMLInputElement;
    const localSettingsDiv = document.getElementById('local-backend-settings');
    const customHostInput = document.getElementById(
      'custom-host'
    ) as HTMLInputElement;
    const customSchemeSelect = document.getElementById(
      'custom-scheme'
    ) as HTMLSelectElement;

    if (localRadio && localSettingsDiv) {
      if (localRadio.checked) {
        localSettingsDiv.classList.remove('hidden');

        // When switching to local mode, if the fields are empty or have cloud values,
        // set them to default local values
        if (customHostInput && customSchemeSelect) {
          if (
            !customHostInput.value ||
            customHostInput.value === 'vega.benidevo.com'
          ) {
            customHostInput.value = 'localhost:8765';
            customSchemeSelect.value = 'http';
          }
        }
      } else {
        localSettingsDiv.classList.add('hidden');
      }
    }
  }

  private validateHostInput(): ValidationResult {
    const hostInput = document.getElementById(
      'custom-host'
    ) as HTMLInputElement;
    const hostError = document.getElementById('host-error');
    const hostHelp = document.getElementById('host-help');

    if (!hostInput || !hostError || !hostHelp) {
      return { isValid: false };
    }

    const validation = validateHost(hostInput.value);

    if (validation.isValid) {
      hostInput.classList.remove('border-red-500');
      hostInput.classList.add('border-green-500');
      hostError.classList.add('hidden');
      hostHelp.classList.remove('hidden');
    } else {
      hostInput.classList.remove('border-green-500');
      hostInput.classList.add('border-red-500');
      hostError.textContent = validation.error || '';
      hostError.classList.remove('hidden');
      hostHelp.classList.add('hidden');
    }

    return validation;
  }

  private async testConnection(): Promise<void> {
    const connectionStatus = document.getElementById('connection-status');
    const testBtn = document.getElementById(
      'test-connection-btn'
    ) as HTMLButtonElement;
    if (!connectionStatus || !testBtn) return;

    // Clear previous status
    connectionStatus.className = 'hidden';
    connectionStatus.innerHTML = '';

    // Disable button during test
    testBtn.disabled = true;

    try {
      // Get current settings based on mode
      const cloudRadio = document.getElementById(
        'backend-cloud'
      ) as HTMLInputElement;
      const localRadio = document.getElementById(
        'backend-local'
      ) as HTMLInputElement;
      const customHostInput = document.getElementById(
        'custom-host'
      ) as HTMLInputElement;
      const customSchemeSelect = document.getElementById(
        'custom-scheme'
      ) as HTMLSelectElement;

      let host: string;
      let protocol: 'http' | 'https';

      if (cloudRadio?.checked) {
        // Use cloud settings
        host = 'vega.benidevo.com';
        protocol = 'https';
      } else if (localRadio?.checked && customHostInput && customSchemeSelect) {
        // Validate custom host first
        const hostValidation = validateHost(customHostInput.value);
        if (!hostValidation.isValid) {
          throw new Error(hostValidation.error || 'Invalid host');
        }
        host = customHostInput.value.trim();
        protocol = customSchemeSelect.value as 'http' | 'https';
      } else {
        throw new Error('Invalid configuration');
      }

      // Test the connection
      const isConnected = await SettingsService.testConnection(host, protocol);

      // Show result
      if (isConnected) {
        connectionStatus.className =
          'p-2 bg-green-900/50 border border-green-500/50 rounded-md text-sm';
        connectionStatus.innerHTML =
          '<span class="text-green-400">Connection successful!</span>';
      } else {
        throw new Error('Connection failed. Please check your settings.');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Connection test failed';
      connectionStatus.className =
        'p-2 bg-red-900/50 border border-red-500/50 rounded-md text-sm';
      connectionStatus.innerHTML = `<span class="text-red-400">${errorMessage}</span>`;
    } finally {
      // Re-enable button
      testBtn.disabled = false;
    }

    // Show status (outside of try-catch to ensure it always shows)
    connectionStatus.classList.remove('hidden');

    // Auto-hide status after 3 seconds
    setTimeout(() => {
      connectionStatus.classList.add('hidden');
    }, 5000);
  }

  private async updateDashboardLink(): Promise<void> {
    const dashboardLink = document.getElementById(
      'dashboard-link'
    ) as HTMLAnchorElement;
    if (dashboardLink) {
      const baseUrl = await SettingsService.getApiBaseUrl();
      dashboardLink.href = `${baseUrl}/jobs`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const popup = new Popup();
  popup.initialize();
});
