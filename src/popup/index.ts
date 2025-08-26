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

class Popup {
  private statusElement: HTMLElement;
  private ctaElement: HTMLElement;
  private settingsView: HTMLElement;
  private isSigningIn = false;
  private initializationPromise: Promise<void> | null = null;
  private authStateListenerAttached = false;
  private buttonListenerCount = 0;
  private passwordClickHandler: ((e: Event) => Promise<void>) | null = null;
  private currentView: 'main' | 'settings' = 'main';
  private errorTimeout: number | null = null;
  private pendingModeSwitch = false;
  private currentLoginRequestId: string | null = null;
  private logger = new Logger('Popup');
  private currentVersion: string;
  private latestVersion: string | null = null;
  private isCheckingUpdate = false;
  private lastUpdateCheck: number = 0;
  private readonly UPDATE_CHECK_INTERVAL = 60000;

  constructor() {
    this.statusElement = document.getElementById('status')!;
    this.ctaElement = document.getElementById('cta')!;
    this.settingsView = document.getElementById('settings-view')!;
    this.currentVersion = chrome.runtime.getManifest().version;

    this.setupGlobalEventDelegation();
    this.setupAuthStateListener();
    this.setupVersionDisplay();
    this.setupUpdateChecker();
  }

  private setupGlobalEventDelegation(): void {
    const ctaWithFlag = this.ctaElement as HTMLElement & {
      __delegationSetup?: boolean;
    };
    if (ctaWithFlag.__delegationSetup) {
      return;
    }
    ctaWithFlag.__delegationSetup = true;

    this.ctaElement.addEventListener('click', async e => {
      const target = e.target as HTMLElement;

      if (
        target.id === 'password-signin-btn' ||
        target.closest('#password-signin-btn')
      ) {
        e.preventDefault();

        if (!this.isSigningIn && this.isFormValid()) {
          await this.handlePasswordSignIn();
        }
      }
    });

    this.ctaElement.addEventListener('keypress', async e => {
      const target = e.target as HTMLElement;

      if (
        target.id === 'password-input' &&
        e instanceof KeyboardEvent &&
        e.key === 'Enter'
      ) {
        e.preventDefault();

        if (!this.isSigningIn && this.isFormValid()) {
          await this.handlePasswordSignIn();
        }
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize().finally(() => {
      this.initializationPromise = null;
    });

    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      const globalNotification = document.getElementById('global-notification');
      if (globalNotification) {
        globalNotification.setAttribute('role', 'alert');
        globalNotification.setAttribute('aria-live', 'polite');
      }

      const isJobPage = await this.checkIfJobPage();
      const isAuthenticated = await this.checkAuthStatus();

      const activeNotification = this.preserveActiveNotification();

      await this.render(isAuthenticated, isJobPage);
      this.attachEventListeners(isAuthenticated);
      this.attachSettingsEventListeners();

      if (activeNotification) {
        this.showNotification(
          activeNotification.message,
          activeNotification.type
        );
      }
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'popup_initialize',
      });
      this.renderError(errorDetails.userMessage);
    }
  }

  private setupAuthStateListener(): void {
    if (this.authStateListenerAttached) {
      return;
    }
    this.authStateListenerAttached = true;

    chrome.runtime.onMessage.addListener(message => {
      if (message.type === MessageType.AUTH_STATE_CHANGED) {
        if (
          !this.isSigningIn &&
          !this.errorTimeout &&
          !this.pendingModeSwitch
        ) {
          this.logger.info('Auth state changed, re-initializing', {
            isSigningIn: this.isSigningIn,
            hasErrorTimeout: !!this.errorTimeout,
            pendingModeSwitch: this.pendingModeSwitch,
          });
          this.initialize();
        } else {
          this.logger.info('Auth state changed but skipping re-init', {
            isSigningIn: this.isSigningIn,
            hasErrorTimeout: !!this.errorTimeout,
            pendingModeSwitch: this.pendingModeSwitch,
            reason: this.isSigningIn
              ? 'sign-in in progress'
              : 'error notification active',
          });
        }
      }
    });
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
    return url.includes('linkedin.com/jobs/');
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
          <span class="text-sm font-medium text-primary">Ready to save job</span>
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
    this.ctaElement.innerHTML = `
      <div class="space-y-4">
        <div id="auth-form-container"></div>
      </div>
    `;

    const formContainer = document.getElementById('auth-form-container');
    if (!formContainer) return;

    formContainer.innerHTML = `
      <div class="space-y-3">
        <div>
          <input
            type="text"
            id="username-input"
            placeholder="Username or Email"
            class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          >
          <div id="username-error" class="hidden mt-1 text-xs text-red-400"></div>
          <div id="username-help" class="mt-1 text-xs text-gray-500">Enter your username or email address</div>
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
          type="button"
          class="vega-btn vega-btn-primary w-full text-sm"
          disabled
        >
          Sign In
        </button>
      </div>

      <div class="text-center mt-4">
        <a
          href="https://vega.benidevo.com"
          target="_blank"
          class="text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          Don't have an account, get started
        </a>
      </div>
    `;
  }

  private removeExistingEventListeners(): void {
    const elementsToClean = [
      'username-input',
      'password-input',
      'password-toggle',
      'password-signin-btn',
    ];

    elementsToClean.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        const newElement = element.cloneNode(true) as HTMLElement;
        element.parentNode?.replaceChild(newElement, element);
      }
    });
  }

  private attachAuthEventListeners(): void {
    const usernameInput = document.getElementById(
      'username-input'
    ) as HTMLInputElement;
    if (usernameInput) {
      usernameInput.setAttribute('aria-label', 'Username or Email');
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
    }

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

    const passwordBtn = document.getElementById('password-signin-btn');
    if (passwordBtn) {
      passwordBtn.setAttribute(
        'aria-label',
        'Sign in with username and password'
      );
    }

    const globalNotification = document.getElementById('global-notification');
    if (globalNotification) {
      globalNotification.setAttribute('role', 'alert');
      globalNotification.setAttribute('aria-live', 'polite');
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
    if (this.isSigningIn || !this.isFormValid()) {
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (this.currentLoginRequestId) {
      return;
    }

    this.currentLoginRequestId = requestId;

    const usernameInput = document.getElementById(
      'username-input'
    ) as HTMLInputElement;
    const passwordInput = document.getElementById(
      'password-input'
    ) as HTMLInputElement;
    const passwordBtn = document.getElementById(
      'password-signin-btn'
    ) as HTMLButtonElement;

    if (!usernameInput || !passwordInput || !passwordBtn) {
      this.currentLoginRequestId = null;
      return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Final validation before submission
    const usernameValidation = validateUsername(username);
    const passwordValidation = validatePassword(password);

    if (!usernameValidation.isValid) {
      this.showAuthError(usernameValidation.error || 'Invalid username');
      this.currentLoginRequestId = null;
      return;
    }

    if (!passwordValidation.isValid) {
      this.showAuthError(passwordValidation.error || 'Invalid password');
      this.currentLoginRequestId = null;
      return;
    }

    this.isSigningIn = true;
    const originalText = passwordBtn.textContent;
    passwordBtn.disabled = true;
    passwordBtn.textContent = 'Signing in...';

    try {
      if (chrome.runtime.lastError) {
        console.error(
          '[Popup] Chrome runtime error before send:',
          chrome.runtime.lastError
        );
      }

      console.trace('[Popup] sendMessage call stack');

      const response = await chrome.runtime.sendMessage({
        type: 'LOGIN_WITH_PASSWORD',
        payload: { username, password },
        requestId: requestId,
      });

      if (chrome.runtime.lastError) {
        console.error(
          '[Popup] Chrome runtime error after send:',
          chrome.runtime.lastError
        );
      }

      if (!response) {
        throw new Error('No response received from background service');
      }

      if (response.success) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.initialize();
        this.isSigningIn = false;
        this.currentLoginRequestId = null;
      } else {
        const errorMessage = response?.error || 'Sign in failed';

        passwordBtn.disabled = false;
        passwordBtn.textContent = originalText;

        this.showAuthError(errorMessage);

        usernameInput.focus();

        setTimeout(() => {
          this.isSigningIn = false;
          this.currentLoginRequestId = null;
          this.updateSignInButtonState();
        }, 5000);
      }
    } catch (error) {
      console.error('[Popup] Login error:', error);
      const errorDetails = errorService.handleError(error, {
        action: 'password_auth',
      });

      passwordBtn.disabled = false;
      passwordBtn.textContent = originalText;

      this.showAuthError(errorDetails.userMessage);

      usernameInput.focus();

      setTimeout(() => {
        this.isSigningIn = false;
        this.currentLoginRequestId = null;
        this.updateSignInButtonState();
      }, 5000);
    }
  }

  private preserveActiveNotification(): {
    message: string;
    type: 'success' | 'error' | 'info';
  } | null {
    const notificationEl = document.getElementById('global-notification');

    if (
      notificationEl &&
      notificationEl.style.display !== 'none' &&
      notificationEl.innerHTML
    ) {
      // Extract the message from the notification
      const messageEl = notificationEl.querySelector('span');
      if (messageEl) {
        const message = messageEl.textContent || '';
        // Determine type based on color
        const color = messageEl.style.color;
        let type: 'success' | 'error' | 'info' = 'info';
        if (color === '#10b981') type = 'success';
        else if (color === '#f87171') type = 'error';
        else if (color === '#60a5fa') type = 'info';

        return { message, type };
      }
    }

    return null;
  }

  private showNotification(
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
  ): void {
    this.logger.info('showNotification called', {
      message,
      type,
      currentView: this.currentView,
    });

    const notificationEl = document.getElementById('global-notification');

    if (!notificationEl) {
      this.logger.error('Global notification element not found!');
      return;
    }

    this.logger.info('Displaying notification in global area');
    this.displayNotificationContent(notificationEl, message, type);
  }

  private displayNotificationContent(
    notificationEl: HTMLElement,
    message: string,
    type: 'success' | 'error' | 'info'
  ): void {
    // Clear any existing timeout
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
      this.errorTimeout = null;
    }

    const bgColor =
      type === 'success'
        ? 'rgba(16, 185, 129, 0.1)'
        : type === 'error'
          ? 'rgba(127, 29, 29, 0.5)'
          : 'rgba(59, 130, 246, 0.1)';
    const borderColor =
      type === 'success'
        ? 'rgba(16, 185, 129, 0.5)'
        : type === 'error'
          ? 'rgba(239, 68, 68, 0.5)'
          : 'rgba(59, 130, 246, 0.5)';
    const textColor =
      type === 'success' ? '#10b981' : type === 'error' ? '#f87171' : '#60a5fa';

    notificationEl.innerHTML = `
      <div style="padding: 0.5rem; background-color: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 0.375rem;">
        <span style="font-size: 0.75rem; line-height: 1rem; color: ${textColor}; display: block;">${message}</span>
      </div>
    `;

    notificationEl.style.display = 'block';

    // Auto-hide after 2.5 seconds
    this.errorTimeout = window.setTimeout(() => {
      notificationEl.style.display = 'none';
      this.errorTimeout = null;

      // Reset isSigningIn flag after error is hidden
      if (this.isSigningIn) {
        this.isSigningIn = false;
        this.logger.info('Reset isSigningIn after notification timeout');
      }
    }, 2500);
  }

  private showAuthError(message: string): void {
    this.logger.info('Showing auth error', { message });

    let notificationEl = document.getElementById('global-notification');
    if (!notificationEl) {
      this.logger.error(
        'Global notification element not found when showing auth error'
      );
      const mainContainer = document.querySelector('#status')?.parentElement;
      if (mainContainer) {
        const newNotificationEl = document.createElement('div');
        newNotificationEl.id = 'global-notification';
        newNotificationEl.style.display = 'none';
        newNotificationEl.style.marginBottom = '1rem';
        newNotificationEl.setAttribute('role', 'alert');
        newNotificationEl.setAttribute('aria-live', 'polite');
        const statusEl = document.getElementById('status');
        if (statusEl) {
          mainContainer.insertBefore(newNotificationEl, statusEl);
        } else {
          mainContainer.insertBefore(
            newNotificationEl,
            mainContainer.firstChild
          );
        }
        this.logger.info('Created missing global notification element');
        notificationEl = newNotificationEl;
      }
    }

    if (notificationEl) {
      this.displayNotificationContent(notificationEl, message, 'error');
    } else {
      this.logger.error(
        'Failed to show auth error notification, using fallback',
        { message }
      );
      console.error('Authentication Error:', message);
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
      backBtn.addEventListener('click', async () => await this.showMainView());
    }

    // Add event listeners for backend mode radio buttons
    const cloudRadio = document.getElementById(
      'backend-cloud'
    ) as HTMLInputElement;
    const localRadio = document.getElementById(
      'backend-local'
    ) as HTMLInputElement;
    const handleBackendModeChange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.checked) {
        this.toggleLocalBackendSettings();
        await this.saveSettings();
      }
    };

    if (cloudRadio) {
      cloudRadio.addEventListener('change', handleBackendModeChange);
    }
    if (localRadio) {
      localRadio.addEventListener('change', handleBackendModeChange);
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

  private setupVersionDisplay(): void {
    const versionDisplay = document.getElementById('version-display');
    if (versionDisplay) {
      versionDisplay.textContent = `v${this.currentVersion}`;
    }
  }

  private setupUpdateChecker(): void {
    const checkUpdatesBtn = document.getElementById('check-updates-btn');
    if (checkUpdatesBtn) {
      checkUpdatesBtn.addEventListener('click', () => this.checkForUpdates());
    }
  }

  private async checkForUpdates(): Promise<void> {
    if (this.isCheckingUpdate) return;

    const now = Date.now();
    if (now - this.lastUpdateCheck < this.UPDATE_CHECK_INTERVAL) {
      const updateMessage = document.getElementById('update-message');
      if (updateMessage) {
        updateMessage.className =
          'text-center p-2 rounded bg-yellow-900/50 text-yellow-400';
        updateMessage.textContent = 'Please wait before checking again';
        const updateStatus = document.getElementById('update-status');
        if (updateStatus) {
          updateStatus.classList.remove('hidden');
          setTimeout(() => updateStatus.classList.add('hidden'), 2000);
        }
      }
      return;
    }

    this.isCheckingUpdate = true;
    this.lastUpdateCheck = now;
    const updateText = document.getElementById('update-text');
    const updateStatus = document.getElementById('update-status');
    const updateMessage = document.getElementById('update-message');

    if (!updateText || !updateStatus || !updateMessage) return;

    try {
      updateText.textContent = 'Checking...';

      const response = await fetch(
        'https://api.github.com/repos/benidevo/vega-ai-extension/releases/latest'
      );

      if (!response.ok) {
        throw new Error('Failed to check for updates');
      }

      const data = await response.json();
      const latestVersion =
        data.tag_name?.replace('v', '') || data.name?.replace('v', '');

      if (!latestVersion) {
        throw new Error('Could not determine latest version');
      }

      this.latestVersion = latestVersion;

      const isUpdateAvailable =
        this.compareVersions(this.currentVersion, latestVersion) < 0;

      updateStatus.classList.remove('hidden');

      if (isUpdateAvailable) {
        updateMessage.className =
          'text-center p-2 rounded bg-green-900/50 text-green-400';

        while (updateMessage.firstChild) {
          updateMessage.removeChild(updateMessage.firstChild);
        }

        const versionDiv = document.createElement('div');
        const sanitizedVersion = this.sanitizeVersionString(latestVersion);
        versionDiv.textContent = `New version ${sanitizedVersion} available!`;

        const link = document.createElement('a');

        let isValidUrl = false;
        if (data.html_url && typeof data.html_url === 'string') {
          try {
            const url = new URL(data.html_url);
            // Strict whitelist pattern to prevent path traversal attacks
            const releasePattern =
              /^\/benidevo\/vega-ai-extension\/releases\/(tag\/v?\d+\.\d+\.\d+(-[\w.]+)?|latest)$/;
            if (
              url.protocol === 'https:' &&
              url.hostname === 'github.com' &&
              releasePattern.test(url.pathname)
            ) {
              link.href = url.toString();
              isValidUrl = true;
            }
          } catch (e) {
            this.logger.warn('Invalid release URL from GitHub API', e);
          }
        }

        if (!isValidUrl) {
          link.href = 'https://github.com/benidevo/vega-ai-extension/releases';
        }

        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'underline hover:text-green-300 mt-1 inline-block';
        link.textContent = 'Download update';

        updateMessage.appendChild(versionDiv);
        updateMessage.appendChild(link);
        updateText.textContent = 'Update available!';
      } else {
        updateMessage.className =
          'text-center p-2 rounded bg-slate-800 text-gray-400';
        updateMessage.textContent = 'You have the latest version';
        updateText.textContent = 'Check for updates';

        setTimeout(() => {
          updateStatus.classList.add('hidden');
        }, 3000);
      }
    } catch (error) {
      updateMessage.className =
        'text-center p-2 rounded bg-red-900/50 text-red-400';
      updateMessage.textContent = 'Failed to check for updates';
      updateText.textContent = 'Check for updates';

      setTimeout(() => {
        updateStatus.classList.add('hidden');
      }, 3000);

      this.logger.error('Failed to check for updates', error);
    } finally {
      this.isCheckingUpdate = false;
    }
  }

  private compareVersions(current: string, latest: string): number {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    for (
      let i = 0;
      i < Math.max(currentParts.length, latestParts.length);
      i++
    ) {
      const currentPart = currentParts[i] || 0;
      const latestPart = latestParts[i] || 0;

      if (currentPart < latestPart) return -1;
      if (currentPart > latestPart) return 1;
    }

    return 0;
  }

  private sanitizeVersionString(version: string): string {
    const sanitized = version.replace(/[^0-9.-]/g, '').slice(0, 20);
    return sanitized || 'unknown';
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

  private async showMainView(): Promise<void> {
    this.currentView = 'main';

    this.statusElement.classList.remove('hidden');
    this.ctaElement.classList.remove('hidden');

    this.settingsView.classList.add('hidden');

    // Re-render to ensure correct auth form is shown based on current settings
    const isAuthenticated = await this.checkAuthStatus();
    const isJobPage = await this.checkIfJobPage();
    await this.render(isAuthenticated, isJobPage);
    this.attachEventListeners(isAuthenticated);
    this.attachSettingsEventListeners();
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
        this.showNotification(hostValidation.error || 'Invalid host', 'error');
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

      this.showNotification('Settings saved successfully!', 'success');

      // Update dashboard link
      this.updateDashboardLink();

      // Notify background script to reload services with new settings
      const reloadResponse = await chrome.runtime.sendMessage({
        type: 'RELOAD_SETTINGS',
      });

      if (reloadResponse && reloadResponse.success) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Check if significant settings changed
      const settingsChanged =
        currentMode !== newMode ||
        (newMode === 'local' &&
          (currentSettings.apiHost !== customHostInput?.value.trim() ||
            currentSettings.apiProtocol !== customSchemeSelect?.value));

      if (settingsChanged) {
        this.pendingModeSwitch = true;

        const isAuthenticated = await this.checkAuthStatus();
        if (isAuthenticated) {
          this.showNotification(
            'Backend settings changed. Please sign out and sign in again.',
            'info'
          );
          setTimeout(async () => {
            await this.showMainView();
            this.pendingModeSwitch = false;
          }, 3000);
        } else {
          // If not authenticated and settings changed, re-render to show correct login form
          await this.showMainView();
          setTimeout(() => {
            this.pendingModeSwitch = false;
          }, 1000);
        }
      } else {
        // No significant changes, just show success
        setTimeout(async () => await this.showMainView(), 1500);
      }
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'save_settings',
        newMode,
      });
      this.showNotification(errorDetails.userMessage, 'error');
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
    const testBtn = document.getElementById(
      'test-connection-btn'
    ) as HTMLButtonElement;
    if (!testBtn) return;

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
        this.showNotification('Connection successful!', 'success');
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Connection test failed';
      this.showNotification(errorMessage, 'error');
    } finally {
      // Re-enable button
      testBtn.disabled = false;
    }
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
