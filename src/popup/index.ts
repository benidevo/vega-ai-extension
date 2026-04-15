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
import { JobListing } from '@/types';

class Popup {
  private statusElement: HTMLElement;
  private ctaElement: HTMLElement;
  private settingsView: HTMLElement;
  private captureView: HTMLElement;
  private isLoggingIn = false;
  private initializationPromise: Promise<void> | null = null;
  private authStateListenerAttached = false;
  private currentView: 'main' | 'settings' | 'capture' = 'main';
  private currentJob: JobListing | null = null;
  private errorTimeout: number | null = null;
  private pendingModeSwitch = false;
  private currentLoginRequestId: string | null = null;
  private logger = new Logger('Popup');
  private currentVersion: string;
  private latestVersion: string | null = null;
  private isCheckingUpdate = false;
  private lastUpdateCheck: number = 0;
  private readonly UPDATE_CHECK_INTERVAL = 60000;
  private hasUnsavedChanges = false;
  private settingsListenersAttached = false;
  private lastKnownJobPageState: boolean | null = null;

  constructor() {
    this.statusElement = document.getElementById('status')!;
    this.ctaElement = document.getElementById('cta')!;
    this.settingsView = document.getElementById('settings-view')!;
    this.captureView = document.getElementById('capture-view')!;
    this.currentVersion = chrome.runtime.getManifest().version;

    this.setupGlobalEventDelegation();
    this.setupAuthStateListener();
    this.setupTabChangeListeners();
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
        target.id === 'password-login-btn' ||
        target.closest('#password-login-btn')
      ) {
        e.preventDefault();

        if (!this.isLoggingIn && this.isFormValid()) {
          await this.handlePasswordLogin();
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

        if (!this.isLoggingIn && this.isFormValid()) {
          await this.handlePasswordLogin();
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

      const url = await this.getCurrentTabUrl();
      const isJobPage = this.isKnownJobPage(url);
      this.lastKnownJobPageState = isJobPage;
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
          !this.isLoggingIn &&
          !this.errorTimeout &&
          !this.pendingModeSwitch
        ) {
          this.logger.info('Auth state changed, re-initializing', {
            isLoggingIn: this.isLoggingIn,
            hasErrorTimeout: !!this.errorTimeout,
            pendingModeSwitch: this.pendingModeSwitch,
          });
          this.initialize();
        } else {
          this.logger.info('Auth state changed but skipping re-init', {
            isLoggingIn: this.isLoggingIn,
            hasErrorTimeout: !!this.errorTimeout,
            pendingModeSwitch: this.pendingModeSwitch,
            reason: this.isLoggingIn
              ? 'login in progress'
              : 'error notification active',
          });
        }
      }
    });
  }

  private setupTabChangeListeners(): void {
    const shouldRerender = () =>
      this.currentView === 'main' &&
      !this.isLoggingIn &&
      !this.pendingModeSwitch;

    try {
      // Panel is tab-specific — only re-render when the owning tab navigates
      // and the job-page status changes (e.g. user leaves a job listing).
      chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.url === undefined || !shouldRerender()) return;
        chrome.tabs.query(
          { active: true, lastFocusedWindow: true },
          ([activeTab]) => {
            if (activeTab?.id !== tabId) return;
            const isJobPage = this.isKnownJobPage(changeInfo.url!);
            if (isJobPage !== this.lastKnownJobPageState) this.initialize();
          }
        );
      });
    } catch {
      // tab listeners unavailable in some contexts
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

  private readonly JOB_URL_PATTERNS = [
    'linkedin.com/jobs/',
    'indeed.com/viewjob',
    'glassdoor.com/job-listing',
    'greenhouse.io/jobs/',
    'lever.co/',
    'workday.com/',
    'jobs.ashbyhq.com/',
    'boards.greenhouse.io/',
    'myworkdayjobs.com/',
    'careers.smartrecruiters.com/',
  ];

  private isKnownJobPage(url: string): boolean {
    return this.JOB_URL_PATTERNS.some(p => url.includes(p));
  }

  private async render(
    isAuthenticated: boolean,
    isJobPage: boolean
  ): Promise<void> {
    if (this.currentView === 'settings') {
      this.statusElement.classList.add('hidden');
      this.ctaElement.classList.add('hidden');
      this.captureView.classList.remove('flex', 'flex-1');
      this.captureView.classList.add('hidden');
      this.settingsView.classList.remove('hidden');
      this.settingsView.classList.add('flex', 'flex-1');
      return;
    }

    if (this.currentView === 'capture') {
      this.statusElement.classList.add('hidden');
      this.ctaElement.classList.add('hidden');
      this.settingsView.classList.remove('flex', 'flex-1');
      this.settingsView.classList.add('hidden');
      this.captureView.classList.remove('hidden');
      this.captureView.classList.add('flex', 'flex-1');
      return;
    }

    // Reset view-specific flex classes when returning to main
    this.settingsView.classList.remove('flex', 'flex-1');
    this.settingsView.classList.add('hidden');
    this.captureView.classList.remove('flex', 'flex-1');
    this.captureView.classList.add('hidden');

    if (isAuthenticated) {
      this.statusElement.classList.add('hidden');
      this.ctaElement.classList.remove('hidden');
      this.ctaElement.className = 'flex-1 flex flex-col gap-4 animate-fade-in';

      const baseUrl = await SettingsService.getApiBaseUrl();
      const dashboardUrl = `${baseUrl}/jobs`;

      const headerTitle = isJobPage
        ? 'Job page detected'
        : 'Save a job listing';
      const headerSubtitle = isJobPage
        ? 'Ready to save'
        : 'Fill in the details';

      this.ctaElement.innerHTML = `
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
          <div class="px-4 py-3 border-b border-gray-100">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">How to use</p>
          </div>
          <div class="divide-y divide-gray-50">
            <div class="flex items-start gap-3 px-4 py-3">
              <div class="flex-shrink-0 w-6 h-6 rounded-full bg-teal-50 flex items-center justify-center mt-0.5">
                <span class="text-[10px] font-bold text-teal-600">1</span>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-800">Browse any job site</p>
                <p class="text-[10px] text-gray-400 leading-tight">LinkedIn, Indeed, Glassdoor, etc.</p>
              </div>
            </div>
            <div class="flex items-start gap-3 px-4 py-3">
              <div class="flex-shrink-0 w-6 h-6 rounded-full bg-teal-50 flex items-center justify-center mt-0.5">
                <span class="text-[10px] font-bold text-teal-600">2</span>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-800">Click Capture Job</p>
                <p class="text-[10px] text-gray-400 leading-tight">Save details directly to your tracker</p>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-teal-200 overflow-hidden shadow-sm">
          <div class="px-4 py-3 bg-teal-50 border-b border-teal-100 flex items-center gap-3">
            <div class="p-1.5 bg-teal-100 rounded-lg flex-shrink-0">
              <svg class="w-4 h-4 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-teal-900">${headerTitle}</p>
              <p class="text-xs text-teal-600">${headerSubtitle}</p>
            </div>
          </div>
          <div class="px-4 py-3">
            <button id="capture-btn" class="w-full py-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow">
              Capture Job
            </button>
          </div>
        </div>

        <!-- Spacer pushes dashboard/logout to bottom -->
        <div class="flex-1"></div>

        <div class="space-y-2">
          <a
            href="${dashboardUrl}"
            id="dashboard-link"
            target="_blank"
            rel="noopener noreferrer"
            class="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all"
          >
            Open Dashboard
            <svg class="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <div class="text-center">
            <button id="logout-btn" class="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-red-50">
              Logout
            </button>
          </div>
        </div>
      `;
    } else {
      this.ctaElement.classList.remove('hidden');
      this.ctaElement.className = 'flex-1 flex flex-col gap-4 animate-fade-in';
      this.statusElement.classList.add('hidden');

      await this.renderAuthOptions();
    }
  }

  private renderError(message: string): void {
    this.statusElement.innerHTML = `
      <div class="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100 animate-fade-in">
        <div class="flex-shrink-0 p-1.5 bg-red-100 rounded-lg">
          <svg class="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold text-red-800 mb-0.5">Something went wrong</p>
          <p id="error-message-text" class="text-xs text-red-600 truncate"></p>
        </div>
      </div>
    `;
    const errorSpan = document.getElementById('error-message-text');
    if (errorSpan) {
      errorSpan.textContent = message;
    }
  }

  private attachEventListeners(isAuthenticated: boolean): void {
    if (this.currentView === 'capture') {
      this.attachCaptureEventListeners();
      return;
    }

    const captureBtn = document.getElementById('capture-btn');
    if (captureBtn) {
      captureBtn.addEventListener('click', async () => {
        await this.openCaptureForm();
      });
    }

    if (isAuthenticated) {
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async e => {
          e.preventDefault();
          await this.handleLogout();
        });
      }
    } else {
      this.attachAuthEventListeners();
    }
  }

  private async renderAuthOptions(): Promise<void> {
    this.ctaElement.innerHTML = `
      <div class="px-1 mb-6 animate-fade-in">
        <h2 class="text-base font-bold text-gray-900 mb-2 text-balance">Capture your next career move</h2>
        <p class="text-xs text-gray-500 leading-relaxed mb-4">
          The easiest way to track and organize your job search across the entire web.
        </p>

        <div class="grid grid-cols-1 gap-2.5">
          <div class="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
            <div class="flex-shrink-0 w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <svg class="w-3.5 h-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p class="text-[11px] text-gray-600 font-medium">Capture jobs from any platform</p>
          </div>
          <div class="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
            <div class="flex-shrink-0 w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <svg class="w-3.5 h-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p class="text-[11px] text-gray-600 font-medium">Keep notes and details organized</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-900">Login</h3>
          <p class="text-xs text-gray-400 mt-0.5">Access your personal tracker</p>
        </div>
        <div class="px-5 py-4 space-y-4">
          <div class="group">
            <label for="username-input" class="block text-sm font-medium text-gray-700 mb-1.5">Username / Email</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-4 w-4 text-gray-400 group-focus-within:text-teal-600 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input type="text" id="username-input" placeholder="e.g. alex@example.com" autocomplete="username"
                class="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-all duration-200">
            </div>
            <div id="username-help" class="hidden mt-1 text-xs text-teal-600"></div>
            <div id="username-error" class="hidden mt-1 text-xs text-red-500"></div>
          </div>
          <div class="group">
            <label for="password-input" class="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-4 w-4 text-gray-400 group-focus-within:text-teal-600 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input type="password" id="password-input" placeholder="••••••••" autocomplete="current-password"
                class="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-all duration-200">
              <button type="button" id="password-toggle" class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-teal-600 transition-colors" aria-label="Toggle password visibility">
                <svg id="password-show-icon" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg id="password-hide-icon" class="w-4 h-4 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </div>
            <div id="password-help" class="hidden mt-1 text-xs text-teal-600"></div>
            <div id="password-error" class="hidden mt-1 text-xs text-red-500"></div>
          </div>
          <button id="password-login-btn" type="button" disabled
            class="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
            Login
          </button>
        </div>
      </div>

      <!-- Spacer pushes create-account to bottom -->
      <div class="flex-1"></div>

      <div class="py-3 flex items-center justify-center gap-1.5">
        <span class="text-xs text-gray-400">New to Vega?</span>
        <a href="https://vega.benidevo.com" target="_blank"
          class="text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-0.5">
          Create your account
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    `;
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
        this.updateLoginButtonState();
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
        this.updateLoginButtonState();
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

    const passwordBtn = document.getElementById('password-login-btn');
    if (passwordBtn) {
      passwordBtn.setAttribute(
        'aria-label',
        'Login with username and password'
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

  private updateLoginButtonState(): void {
    const passwordBtn = document.getElementById(
      'password-login-btn'
    ) as HTMLButtonElement;
    if (!passwordBtn) return;

    const isValid = this.isFormValid();
    passwordBtn.disabled = !isValid || this.isLoggingIn;

    if (isValid) {
      passwordBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      passwordBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }

  private async handlePasswordLogin(): Promise<void> {
    if (this.isLoggingIn || !this.isFormValid()) {
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
      'password-login-btn'
    ) as HTMLButtonElement;

    if (!usernameInput || !passwordInput || !passwordBtn) {
      this.currentLoginRequestId = null;
      return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

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

    this.isLoggingIn = true;
    const originalText = passwordBtn.textContent;
    passwordBtn.disabled = true;
    passwordBtn.textContent = 'Logging in...';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'LOGIN_WITH_PASSWORD',
        payload: { username, password },
        requestId: requestId,
      });

      if (!response) {
        throw new Error('No response received from background service');
      }

      if (response.success) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.initialize();
        this.isLoggingIn = false;
        this.currentLoginRequestId = null;
      } else {
        const errorMessage =
          response?.error || 'Login failed. Check your credentials.';

        passwordBtn.disabled = false;
        passwordBtn.textContent = originalText;

        this.showAuthError(errorMessage);

        usernameInput.focus();

        setTimeout(() => {
          this.isLoggingIn = false;
          this.currentLoginRequestId = null;
          this.updateLoginButtonState();
        }, 5000);
      }
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'password_auth',
      });

      passwordBtn.disabled = false;
      passwordBtn.textContent = originalText;

      this.showAuthError(errorDetails.userMessage);

      usernameInput.focus();

      setTimeout(() => {
        this.isLoggingIn = false;
        this.currentLoginRequestId = null;
        this.updateLoginButtonState();
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
    const notificationEl = document.getElementById('global-notification');

    if (!notificationEl) {
      this.logger.error('Global notification element not found');
      return;
    }

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

    const bgClass =
      type === 'success'
        ? 'bg-emerald-50'
        : type === 'error'
          ? 'bg-red-50'
          : 'bg-blue-50';
    const borderClass =
      type === 'success'
        ? 'border-emerald-100'
        : type === 'error'
          ? 'border-red-100'
          : 'border-blue-100';
    const textClass =
      type === 'success'
        ? 'text-emerald-700'
        : type === 'error'
          ? 'text-red-700'
          : 'text-blue-700';
    const iconClass =
      type === 'success'
        ? 'text-emerald-500'
        : type === 'error'
          ? 'text-red-500'
          : 'text-blue-500';

    const icon =
      type === 'success'
        ? `<svg class="w-4 h-4 ${iconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
        : type === 'error'
          ? `<svg class="w-4 h-4 ${iconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
          : `<svg class="w-4 h-4 ${iconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;

    notificationEl.className = `p-3 ${bgClass} border ${borderClass} rounded-2xl flex items-center space-x-3 mb-4 animate-slide-in`;
    notificationEl.innerHTML = `
      <div class="flex-shrink-0">${icon}</div>
      <span id="notification-message-text" class="text-xs font-bold ${textClass}"></span>
    `;
    const msgSpan = notificationEl.querySelector('#notification-message-text');
    if (msgSpan) {
      msgSpan.textContent = message;
    }

    notificationEl.style.display = 'flex';

    // Auto-hide after 3 seconds
    this.errorTimeout = window.setTimeout(() => {
      notificationEl.classList.add(
        'opacity-0',
        'transition-opacity',
        'duration-300'
      );
      setTimeout(() => {
        notificationEl.style.display = 'none';
        notificationEl.classList.remove(
          'opacity-0',
          'transition-opacity',
          'duration-300'
        );
        this.errorTimeout = null;
      }, 300);

      if (this.isLoggingIn) {
        this.isLoggingIn = false;
      }
    }, 3000);
  }

  private showAuthError(message: string): void {
    this.logger.info('Showing auth error', { message });

    let notificationEl = document.getElementById('global-notification');
    if (!notificationEl) {
      this.logger.error(
        'Global notification element not found when showing auth error'
      );
      const mainContainer = document.querySelector('main');
      if (mainContainer) {
        const newNotificationEl = document.createElement('div');
        newNotificationEl.id = 'global-notification';
        newNotificationEl.style.display = 'none';
        mainContainer.insertBefore(newNotificationEl, mainContainer.firstChild);
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
    }
  }

  private async handleLogout(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'LOGOUT' });

      if (response && response.success) {
        await this.initialize();
      } else {
        this.renderError(response?.error || 'Failed to logout');
      }
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'logout',
      });
      this.renderError(errorDetails.userMessage);
    }
  }

  private attachSettingsEventListeners(): void {
    if (this.settingsListenersAttached) return;

    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.showSettings());
    }

    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', async () => await this.showMainView());
    }

    const cloudRadio = document.getElementById(
      'backend-cloud'
    ) as HTMLInputElement;
    const localRadio = document.getElementById(
      'backend-local'
    ) as HTMLInputElement;
    const handleBackendModeChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.checked) {
        this.toggleLocalBackendSettings();
        this.markDirty();
      }
    };

    if (cloudRadio) {
      cloudRadio.addEventListener('change', handleBackendModeChange);
    }
    if (localRadio) {
      localRadio.addEventListener('change', handleBackendModeChange);
    }

    const customHostInput = document.getElementById(
      'custom-host'
    ) as HTMLInputElement;
    if (customHostInput) {
      customHostInput.addEventListener('input', () => {
        this.validateHostInput();
        this.markDirty();
      });
      customHostInput.addEventListener('blur', () => this.validateHostInput());
    }

    const customSchemeSelect = document.getElementById(
      'custom-scheme'
    ) as HTMLSelectElement;
    if (customSchemeSelect) {
      customSchemeSelect.addEventListener('change', () => this.markDirty());
    }

    const testConnectionBtn = document.getElementById('test-connection-btn');
    if (testConnectionBtn) {
      testConnectionBtn.addEventListener('click', () => this.testConnection());
    }

    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    }

    this.updateDashboardLink();

    this.settingsListenersAttached = true;
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
          'text-center p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 shadow-sm animate-fade-in';
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

    const customHostInput = document.getElementById(
      'custom-host'
    ) as HTMLInputElement;
    const customSchemeSelect = document.getElementById(
      'custom-scheme'
    ) as HTMLSelectElement;

    if (customHostInput && customSchemeSelect) {
      if (backendMode === 'local') {
        customHostInput.value = settings.apiHost;
        customSchemeSelect.value = settings.apiProtocol;
      } else {
        customHostInput.value = 'localhost:8765';
        customSchemeSelect.value = 'http';
      }
    }

    this.toggleLocalBackendSettings();

    this.attachSettingsEventListeners();

    this.hasUnsavedChanges = false;
    this.updateSaveButtonState();
  }

  private async getCurrentTabUrl(): Promise<string> {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    return tab?.url || '';
  }

  private async showMainView(): Promise<void> {
    this.currentView = 'main';

    this.statusElement.classList.remove('hidden');
    this.ctaElement.classList.remove('hidden');

    this.settingsView.classList.add('hidden');

    // Re-render to ensure correct auth form is shown based on current settings
    const isAuthenticated = await this.checkAuthStatus();
    const url = await this.getCurrentTabUrl();
    const isJobPage = this.isKnownJobPage(url);
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
      if (newMode === 'local' && customHostInput && customSchemeSelect) {
        await SettingsService.setBackendMode(
          newMode,
          customHostInput.value.trim(),
          customSchemeSelect.value as 'http' | 'https'
        );
      } else {
        await SettingsService.setBackendMode(newMode);
      }

      this.showNotification('Settings saved', 'success');

      this.hasUnsavedChanges = false;
      this.updateSaveButtonState();

      this.updateDashboardLink();

      const reloadResponse = await chrome.runtime.sendMessage({
        type: 'RELOAD_SETTINGS',
      });

      if (reloadResponse && reloadResponse.success) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

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
            'Backend changed. Logout and login again to continue.',
            'info'
          );
          setTimeout(async () => {
            await this.showMainView();
            this.pendingModeSwitch = false;
          }, 3000);
        } else {
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

    if (!hostInput || !hostError) {
      return { isValid: false };
    }

    const validation = validateHost(hostInput.value);

    if (validation.isValid) {
      hostInput.classList.remove('border-red-500');
      hostInput.classList.add('border-green-500');
      hostError.classList.add('hidden');
    } else {
      hostInput.classList.remove('border-green-500');
      hostInput.classList.add('border-red-500');
      hostError.textContent = validation.error || '';
      hostError.classList.remove('hidden');
    }

    return validation;
  }

  private markDirty(): void {
    this.hasUnsavedChanges = true;
    this.updateSaveButtonState();
  }

  private updateSaveButtonState(): void {
    const saveBtn = document.getElementById(
      'save-settings-btn'
    ) as HTMLButtonElement;
    if (!saveBtn) return;

    if (this.hasUnsavedChanges) {
      saveBtn.textContent = 'Save Changes';
      saveBtn.disabled = false;
      saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      saveBtn.textContent = 'Save Settings';
      saveBtn.disabled = true;
      saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }

  private async testConnection(): Promise<void> {
    const testBtn = document.getElementById(
      'test-connection-btn'
    ) as HTMLButtonElement;
    if (!testBtn) return;

    testBtn.disabled = true;

    try {
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
        host = 'vega.benidevo.com';
        protocol = 'https';
      } else if (localRadio?.checked && customHostInput && customSchemeSelect) {
        const hostValidation = validateHost(customHostInput.value);
        if (!hostValidation.isValid) {
          throw new Error(hostValidation.error || 'Invalid host');
        }
        host = customHostInput.value.trim();
        protocol = customSchemeSelect.value as 'http' | 'https';
      } else {
        throw new Error('Invalid configuration');
      }

      const isConnected = await SettingsService.testConnection(host, protocol);

      if (isConnected) {
        this.showNotification('Connected', 'success');
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Connection test failed';
      this.showNotification(errorMessage, 'error');
    } finally {
      testBtn.disabled = false;
    }
  }

  private async openCaptureForm(): Promise<void> {
    const url = await this.getCurrentTabUrl();

    this.currentJob = {
      title: '',
      company: '',
      location: '',
      jobType: 'full_time',
      sourceUrl: url,
      description: '',
    };

    this.currentView = 'capture';
    const isJobPage = this.isKnownJobPage(url);
    const isAuthenticated = await this.checkAuthStatus();
    await this.render(isAuthenticated, isJobPage);
    this.renderCaptureView(this.currentJob);
    this.attachCaptureEventListeners();
  }

  private renderCaptureView(job: JobListing): void {
    const titleInput = document.getElementById('job-title') as HTMLInputElement;
    const companyInput = document.getElementById(
      'job-company'
    ) as HTMLInputElement;
    const locationInput = document.getElementById(
      'job-location'
    ) as HTMLInputElement;
    const typeSelect = document.getElementById('job-type') as HTMLSelectElement;
    const notesArea = document.getElementById(
      'job-notes'
    ) as HTMLTextAreaElement;
    const descriptionArea = document.getElementById(
      'job-description'
    ) as HTMLTextAreaElement;

    [titleInput, companyInput, locationInput, descriptionArea].forEach(el => {
      if (el) {
        el.classList.remove(
          'border-red-500',
          'focus:ring-red-500',
          'focus:border-red-500'
        );
        el.classList.add(
          'border-gray-200',
          'focus:ring-teal-500',
          'focus:border-teal-500'
        );
      }
    });

    if (titleInput) titleInput.value = job.title || '';
    if (companyInput) companyInput.value = job.company || '';
    if (locationInput) locationInput.value = job.location || '';
    if (typeSelect && job.jobType) {
      typeSelect.value = job.jobType;
    }
    if (notesArea) notesArea.value = job.notes || '';
    if (descriptionArea) descriptionArea.value = job.description || '';
  }

  private attachCaptureEventListeners(): void {
    const saveBtn = document.getElementById(
      'save-job-btn'
    ) as HTMLButtonElement;
    if (saveBtn) {
      const newSaveBtn = saveBtn.cloneNode(true) as HTMLButtonElement;
      newSaveBtn.textContent = 'Save';
      newSaveBtn.disabled = false;
      saveBtn.parentNode?.replaceChild(newSaveBtn, saveBtn);
      newSaveBtn.addEventListener('click', () => this.handleSaveJob());
    }

    const cancelBtn = document.getElementById('cancel-capture-btn');
    if (cancelBtn) {
      const newCancelBtn = cancelBtn.cloneNode(true);
      cancelBtn.parentNode?.replaceChild(newCancelBtn, cancelBtn);
      newCancelBtn.addEventListener('click', () => this.handleCancelCapture());
    }

    const fields = [
      'job-title',
      'job-company',
      'job-location',
      'job-description',
    ];
    fields.forEach(id => {
      const element = document.getElementById(id) as
        | HTMLInputElement
        | HTMLTextAreaElement;
      if (element) {
        const newElement = element.cloneNode(true) as
          | HTMLInputElement
          | HTMLTextAreaElement;
        newElement.value = element.value;
        element.parentNode?.replaceChild(newElement, element);

        newElement.addEventListener('input', () =>
          this.validateField(newElement)
        );
        newElement.addEventListener('blur', () =>
          this.validateField(newElement)
        );
      }
    });
  }

  private validateField(
    element: HTMLInputElement | HTMLTextAreaElement
  ): boolean {
    const value = element.value.trim();
    const isRequired = [
      'job-title',
      'job-company',
      'job-location',
      'job-description',
    ].includes(element.id);

    if (isRequired && !value) {
      element.classList.add(
        'border-red-500',
        'focus:ring-red-500',
        'focus:border-red-500'
      );
      element.classList.remove(
        'border-gray-200',
        'focus:ring-teal-500',
        'focus:border-teal-500'
      );
      return false;
    } else {
      element.classList.remove(
        'border-red-500',
        'focus:ring-red-500',
        'focus:border-red-500'
      );
      element.classList.add(
        'border-gray-200',
        'focus:ring-teal-500',
        'focus:border-teal-500'
      );
      return true;
    }
  }

  private validateCaptureForm(): boolean {
    const titleInput = document.getElementById('job-title') as HTMLInputElement;
    const companyInput = document.getElementById(
      'job-company'
    ) as HTMLInputElement;
    const locationInput = document.getElementById(
      'job-location'
    ) as HTMLInputElement;
    const descriptionArea = document.getElementById(
      'job-description'
    ) as HTMLTextAreaElement;

    const isTitleValid = this.validateField(titleInput);
    const isCompanyValid = this.validateField(companyInput);
    const isLocationValid = this.validateField(locationInput);
    const isDescriptionValid = this.validateField(descriptionArea);

    return (
      isTitleValid && isCompanyValid && isLocationValid && isDescriptionValid
    );
  }

  private async handleSaveJob(): Promise<void> {
    const saveBtn = document.getElementById(
      'save-job-btn'
    ) as HTMLButtonElement;
    if (!saveBtn || !this.currentJob) return;

    const titleInput = document.getElementById('job-title') as HTMLInputElement;
    const companyInput = document.getElementById(
      'job-company'
    ) as HTMLInputElement;
    const locationInput = document.getElementById(
      'job-location'
    ) as HTMLInputElement;
    const typeSelect = document.getElementById('job-type') as HTMLSelectElement;
    const notesArea = document.getElementById(
      'job-notes'
    ) as HTMLTextAreaElement;
    const descriptionArea = document.getElementById(
      'job-description'
    ) as HTMLTextAreaElement;

    const title = titleInput?.value.trim() || '';
    const company = companyInput?.value.trim() || '';

    if (!this.validateCaptureForm()) {
      this.showNotification('Please fill in all required fields', 'error');
      return;
    }

    // Capture the latest URL at save time, but only if it matches a known job page.
    // Otherwise, we fallback to the URL captured when they clicked 'Capture'.
    const latestUrl = await this.getCurrentTabUrl();
    const sourceUrl =
      latestUrl && this.isKnownJobPage(latestUrl)
        ? latestUrl
        : this.currentJob.sourceUrl;

    const updatedJob: JobListing = {
      ...this.currentJob,
      title,
      company,
      location: locationInput?.value.trim() || '',
      jobType: (typeSelect?.value as JobListing['jobType']) || 'full_time',
      notes: notesArea?.value.trim() || '',
      description: descriptionArea?.value.trim() || '',
      sourceUrl,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.SAVE_JOB,
        payload: updatedJob,
      });

      if (response && response.success) {
        this.showNotification('Job saved', 'success');
        setTimeout(() => this.handleCancelCapture(), 1500);
      } else {
        throw new Error(response?.error || 'Failed to save job');
      }
    } catch (error) {
      this.logger.error('Error saving job', error);
      this.showNotification(
        error instanceof Error ? error.message : 'Failed to save job',
        'error'
      );
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  }

  private async handleCancelCapture(): Promise<void> {
    this.currentView = 'main';
    this.currentJob = null;
    const isAuthenticated = await this.checkAuthStatus();
    const url = await this.getCurrentTabUrl();
    const isJobPage = this.isKnownJobPage(url);
    await this.render(isAuthenticated, isJobPage);
    this.attachEventListeners(isAuthenticated);
    this.attachSettingsEventListeners();
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
