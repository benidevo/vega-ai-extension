import { JobListing } from '@/types';
import { extractJobData } from './extractors';
import { overlayStyles } from './styles/overlay.styles';
import { overlayLogger } from '../utils/logger';
import { errorService } from '@/background/services/error';
import { sendMessage } from '@/utils/messageWrapper';
import { MessageType } from '@/background/services/message/IMessageService';

/**
 * Provides a floating overlay UI for capturing and displaying job listing information on a web page.
 * Includes a floating action button, a details panel, and integration with Chrome extension messaging and storage.
 */
export class VegaAIOverlay {
  private container: HTMLElement | null = null;
  private button: HTMLButtonElement | null = null;
  private panel: HTMLElement | null = null;
  private footer: HTMLElement | null = null;
  private isVisible: boolean = false;
  private isAuthenticated: boolean = false;
  private extractedJob: JobListing | null = null;
  private eventListeners: Array<{
    element: Element | Window | Document;
    event: string;
    handler: EventListener;
  }> = [];

  // Caching for extracted jobs
  private jobCache = new Map<string, { data: JobListing; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Auto-save for notes
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private readonly AUTO_SAVE_DELAY = 2000; // 2 seconds

  private constructor() {}

  private getCachedJob(url: string): JobListing | null {
    const cached = this.jobCache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    this.jobCache.delete(url);
    return null;
  }

  private setCachedJob(url: string, job: JobListing): void {
    this.jobCache.set(url, { data: job, timestamp: Date.now() });

    // Clean old cache entries
    if (this.jobCache.size > 10) {
      const oldestEntry = Array.from(this.jobCache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp
      )[0];
      this.jobCache.delete(oldestEntry[0]);
    }
  }

  public static async create(): Promise<VegaAIOverlay> {
    overlayLogger.debug('Creating VegaAI overlay instance');
    const instance = new VegaAIOverlay();
    await instance.init();
    overlayLogger.info('VegaAI overlay created successfully');
    return instance;
  }

  private async init(): Promise<void> {
    await this.checkAuthentication();

    this.createContainer();
    this.createFloatingButton();
    this.createPanel();
    this.attachEventListeners();

    // Listen for auth state changes from background
    chrome.runtime.onMessage.addListener(message => {
      if (message.type === MessageType.AUTH_STATE_CHANGED) {
        overlayLogger.info('Auth state changed', message.payload);

        this.isAuthenticated = message.payload.isAuthenticated;

        if (this.isVisible && !this.isAuthenticated) {
          const content = document.getElementById('vega-ai-job-preview');
          this.showAuthRequired(content);
        }
      }
    });
  }

  private async checkAuthentication(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('authToken');
      this.isAuthenticated = !!result.authToken;
    } catch (error) {
      errorService.handleError(error, {
        action: 'check_authentication',
        context: 'overlay',
      });
      this.isAuthenticated = false;
    }
  }

  private createContainer(): void {
    const root = document.createElement('div');
    root.id = 'vega-ai-root';
    root.style.cssText =
      'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
    document.body.appendChild(root);

    const style = document.createElement('style');
    style.textContent = overlayStyles;
    root.appendChild(style);

    this.container = document.createElement('div');
    this.container.id = 'vega-ai-overlay';
    this.container.className = 'vega-ai-container';
    root.appendChild(this.container);
  }

  private createFloatingButton(): void {
    const buttonWrapper = document.createElement('div');
    buttonWrapper.id = 'vega-ai-capture-button';
    buttonWrapper.className = 'vega-ai-capture-button';

    this.button = document.createElement('button');
    this.button.className = 'vega-ai-fab';
    this.button.setAttribute(
      'aria-label',
      'Capture job listing (Ctrl+Shift+V)'
    );
    this.button.setAttribute('title', 'Capture job listing (Ctrl+Shift+V)');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 5v14M5 12h14');
    svg.appendChild(path);

    this.button.appendChild(svg);
    buttonWrapper.appendChild(this.button);
    this.container?.appendChild(buttonWrapper);
  }

  private createPanel(): void {
    const panelWrapper = document.createElement('div');
    panelWrapper.id = 'vega-ai-capture-panel';
    panelWrapper.className = 'vega-ai-capture-panel vega-ai-hidden';

    this.panel = document.createElement('div');
    this.panel.className = 'vega-ai-panel-inner';

    const header = this.createPanelHeader();
    const content = this.createPanelContent();
    this.footer = this.createPanelFooter();

    this.panel.appendChild(header);
    this.panel.appendChild(content);
    this.panel.appendChild(this.footer);

    panelWrapper.appendChild(this.panel);
    this.container?.appendChild(panelWrapper);
  }

  private createPanelHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'vega-ai-panel-header';

    const titleWrapper = document.createElement('div');
    titleWrapper.className =
      'vega-ai-flex vega-ai-items-center vega-ai-justify-between';

    const brandingWrapper = document.createElement('div');
    brandingWrapper.className =
      'vega-ai-flex vega-ai-items-center vega-ai-gap-2';

    const logo = document.createElement('img');
    logo.src = chrome.runtime.getURL('icons/logo.svg');
    logo.className = 'vega-ai-logo';
    logo.alt = 'Vega AI';

    const title = document.createElement('h3');
    title.className = 'vega-ai-panel-title';
    title.textContent = 'Vega AI';

    brandingWrapper.appendChild(logo);
    brandingWrapper.appendChild(title);

    const closeButton = document.createElement('button');
    closeButton.className = 'vega-ai-close-button';
    closeButton.setAttribute('aria-label', 'Close panel (Esc)');
    closeButton.setAttribute('title', 'Close (Esc)');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M6 18L18 6M6 6l12 12');
    svg.appendChild(path);

    closeButton.appendChild(svg);
    const closeHandler = () => this.hidePanel();
    closeButton.addEventListener('click', closeHandler);
    this.eventListeners.push({
      element: closeButton,
      event: 'click',
      handler: closeHandler,
    });

    titleWrapper.appendChild(brandingWrapper);
    titleWrapper.appendChild(closeButton);
    header.appendChild(titleWrapper);

    return header;
  }

  private createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.id = 'vega-ai-job-preview';
    content.className = 'vega-ai-panel-content';

    this.updatePanelContent(content, 'loading');

    return content;
  }

  private createPanelFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.id = 'vega-ai-panel-footer';
    footer.className = 'vega-ai-panel-footer';

    const saveButton = this.createButton('Save', 'primary');
    saveButton.id = 'vega-ai-save-btn';
    saveButton.title = 'Save job (Ctrl+S / Cmd+S)';

    const saveHandler = async () => {
      await this.checkAuthentication();

      if (!this.isAuthenticated) {
        this.showError(
          'Sign in required. Click the Vega AI icon in your toolbar to sign in.'
        );
        return;
      }

      if (!this.extractedJob) {
        this.showError(
          'No job information captured. Please try capturing the job again.'
        );
        return;
      }

      const saveButton = document.getElementById(
        'vega-ai-save-btn'
      ) as HTMLButtonElement;
      if (!saveButton) return;

      // Disable button and show loading state
      const originalText = saveButton.textContent || 'Save';
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';

      try {
        // Save job data to local storage
        await chrome.storage.local.set({ currentJob: this.extractedJob });

        // Send to background for API call
        const response = await sendMessage<{
          success: boolean;
          error?: string;
        }>({
          type: 'SAVE_JOB',
          payload: this.extractedJob,
        });

        if (response && response.success) {
          this.showSuccess();
        } else {
          const errorMessage = response?.error || 'Failed to save job';
          this.showError(this.getErrorMessage(errorMessage));
        }
      } catch (error) {
        errorService.handleError(error, {
          action: 'save_job',
          context: 'overlay',
        });

        // Handle specific error types without suggesting page reload
        if (
          error instanceof Error &&
          error.message.includes('Extension context invalidated')
        ) {
          // Try to re-establish connection instead of suggesting refresh
          try {
            const response = await chrome.runtime.sendMessage({ type: 'PING' });
            if (response) {
              // Retry the save
              const retryResponse = await chrome.runtime.sendMessage({
                type: 'SAVE_JOB',
                payload: this.extractedJob,
              });
              if (retryResponse?.success) {
                this.showSuccess();
                return;
              }
            }
          } catch {
            this.showError(
              'Extension was updated. Please close and reopen this panel.'
            );
          }
        } else if (
          error instanceof Error &&
          error.message.includes('Could not establish connection')
        ) {
          this.showError(
            'Connection lost. Please close and reopen this panel.'
          );
        } else {
          this.showError(
            'Unable to save. Please check your internet connection and try again.'
          );
        }
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = originalText;
      }
    };

    saveButton.addEventListener('click', saveHandler);
    this.eventListeners.push({
      element: saveButton,
      event: 'click',
      handler: saveHandler,
    });

    footer.appendChild(saveButton);

    return footer;
  }

  private createButton(
    text: string,
    variant: 'primary' | 'secondary'
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.className =
      variant === 'primary' ? 'vega-ai-btn-primary' : 'vega-ai-btn-secondary';
    return button;
  }

  private updatePanelContent(
    container: HTMLElement | null,
    state: 'loading' | 'success' | 'error' | 'data' | 'info',
    message?: string
  ): void {
    if (!container) return;

    container.innerHTML = '';

    // Show footer only when displaying data
    if (this.footer) {
      this.footer.style.display = state === 'data' ? 'block' : 'none';
    }

    if (state === 'loading') {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'vega-ai-text-center';
      loadingDiv.style.padding = '40px 0';

      const spinner = document.createElement('div');
      spinner.className = 'vega-ai-spinner';

      const text = document.createElement('p');
      text.className = 'vega-ai-text-sm vega-ai-text-gray';
      text.style.marginTop = '16px';
      text.textContent = 'Analyzing job listing...';

      loadingDiv.appendChild(spinner);
      loadingDiv.appendChild(text);
      container.appendChild(loadingDiv);
    } else if (state === 'data' && this.extractedJob) {
      const fields = [
        { label: 'Position', value: this.extractedJob.title },
        { label: 'Company', value: this.extractedJob.company },
        { label: 'Location', value: this.extractedJob.location },
        { label: 'Type', value: this.formatJobType(this.extractedJob.jobType) },
      ];

      fields.forEach(field => {
        if (field.value) {
          const fieldDiv = document.createElement('div');
          fieldDiv.className = 'vega-ai-field';

          const label = document.createElement('div');
          label.className = 'vega-ai-field-label';
          label.textContent = field.label;

          const value = document.createElement('div');
          value.className = 'vega-ai-field-value';
          value.textContent = field.value;

          fieldDiv.appendChild(label);
          fieldDiv.appendChild(value);
          container.appendChild(fieldDiv);
        }
      });

      const notesDiv = document.createElement('div');
      notesDiv.className = 'vega-ai-field';

      const notesLabel = document.createElement('div');
      notesLabel.className = 'vega-ai-field-label';
      notesLabel.textContent = 'Notes';

      const notesTextarea = document.createElement('textarea');
      notesTextarea.className = 'vega-ai-textarea';
      notesTextarea.id = 'vega-ai-notes-textarea';
      notesTextarea.placeholder = 'Add your notes about this position...';
      notesTextarea.setAttribute('aria-label', 'Personal notes about this job');
      notesTextarea.rows = 3;
      notesTextarea.value = this.extractedJob.notes || '';

      const notesHandler = (e: Event) => {
        if (this.extractedJob && e.target instanceof HTMLTextAreaElement) {
          this.extractedJob.notes = e.target.value;

          // Auto-save notes after delay
          if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
          }

          this.autoSaveTimer = setTimeout(() => {
            this.autoSaveNotes();
          }, this.AUTO_SAVE_DELAY);
        }
      };

      notesTextarea.addEventListener('input', notesHandler);
      this.eventListeners.push({
        element: notesTextarea,
        event: 'input',
        handler: notesHandler,
      });

      notesDiv.appendChild(notesLabel);
      notesDiv.appendChild(notesTextarea);
      container.appendChild(notesDiv);

      // Add keyboard shortcuts help
      const helpDiv = document.createElement('div');
      helpDiv.className = 'vega-ai-help';
      helpDiv.style.cssText =
        'margin-top: 16px; padding: 8px; background-color: #f8f9fa; border-radius: 6px; font-size: 12px; color: #6b7280;';

      const helpText = document.createElement('div');
      helpText.innerHTML = `
        <strong>Keyboard shortcuts:</strong><br>
        • <kbd>Esc</kbd> - Close panel<br>
        • <kbd>Ctrl/Cmd + S</kbd> - Save job<br>
        • <kbd>Ctrl/Cmd + Shift + V</kbd> - Toggle panel
      `;
      helpText.style.cssText = 'line-height: 1.4;';

      helpDiv.appendChild(helpText);
      container.appendChild(helpDiv);
    } else if (state === 'success') {
      const successDiv = document.createElement('div');
      successDiv.className = 'vega-ai-text-center';
      successDiv.style.padding = '40px 0';

      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'vega-ai-success-icon';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '30');
      svg.setAttribute('height', '30');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', '#10B981');
      svg.setAttribute('stroke-width', '3');

      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      );
      path.setAttribute('d', 'M20 6L9 17l-5-5');
      svg.appendChild(path);

      iconWrapper.appendChild(svg);

      const text = document.createElement('p');
      text.className = 'vega-ai-success-text';
      text.textContent = 'Job saved successfully!';

      successDiv.appendChild(iconWrapper);
      successDiv.appendChild(text);
      container.appendChild(successDiv);
    } else if (state === 'info') {
      const infoDiv = document.createElement('div');
      infoDiv.className = 'vega-ai-text-center';
      infoDiv.style.padding = '40px 0';

      const iconWrapper = document.createElement('div');
      iconWrapper.style.cssText =
        'width: 60px; height: 60px; margin: 0 auto; background-color: rgba(59, 130, 246, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center;';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '30');
      svg.setAttribute('height', '30');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', '#3B82F6');
      svg.setAttribute('stroke-width', '2');

      const circle = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle'
      );
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '10');
      svg.appendChild(circle);

      const line = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'line'
      );
      line.setAttribute('x1', '12');
      line.setAttribute('y1', '16');
      line.setAttribute('x2', '12');
      line.setAttribute('y2', '12');
      svg.appendChild(line);

      const dot = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle'
      );
      dot.setAttribute('cx', '12');
      dot.setAttribute('cy', '8');
      dot.setAttribute('r', '1');
      dot.setAttribute('fill', '#3B82F6');
      svg.appendChild(dot);

      iconWrapper.appendChild(svg);

      const text = document.createElement('p');
      text.style.cssText =
        'margin-top: 16px; color: #3B82F6; font-size: 16px; font-weight: 500;';
      text.textContent = message || 'Processing...';

      infoDiv.appendChild(iconWrapper);
      infoDiv.appendChild(text);
      container.appendChild(infoDiv);
    } else if (state === 'error') {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'vega-ai-text-center';
      errorDiv.style.padding = '40px 0';

      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'vega-ai-error-icon';
      iconWrapper.style.cssText =
        'width: 60px; height: 60px; margin: 0 auto; background-color: rgba(239, 68, 68, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center;';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '30');
      svg.setAttribute('height', '30');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', '#EF4444');
      svg.setAttribute('stroke-width', '3');

      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      );
      path.setAttribute('d', 'M6 18L18 6M6 6l12 12');
      svg.appendChild(path);

      iconWrapper.appendChild(svg);

      const text = document.createElement('p');
      text.className = 'vega-ai-error-text';
      text.style.cssText =
        'margin-top: 16px; color: #EF4444; font-size: 16px; font-weight: 500;';
      text.textContent = message || 'Failed to extract job data';

      errorDiv.appendChild(iconWrapper);
      errorDiv.appendChild(text);

      // Add retry button for certain errors
      if (
        message &&
        (message.includes('try again') ||
          message.includes('connection') ||
          message.includes('refresh'))
      ) {
        const retryButton = this.createButton('Try Again', 'primary');
        retryButton.style.marginTop = '20px';

        const retryHandler = async () => {
          this.updatePanelContent(container, 'loading');
          setTimeout(async () => {
            try {
              // Re-check authentication first
              await this.checkAuthentication();
              if (!this.isAuthenticated) {
                this.showAuthRequired(container);
                return;
              }

              // Try extraction again
              this.extractedJob = extractJobData();
              if (this.extractedJob) {
                this.updatePanelContent(container, 'data');
              } else {
                this.updatePanelContent(
                  container,
                  'error',
                  'Unable to extract job data'
                );
              }
            } catch {
              this.updatePanelContent(
                container,
                'error',
                'Please try closing and reopening the panel'
              );
            }
          }, 300);
        };

        retryButton.addEventListener('click', retryHandler);
        this.eventListeners.push({
          element: retryButton,
          event: 'click',
          handler: retryHandler,
        });

        errorDiv.appendChild(retryButton);
      }

      container.appendChild(errorDiv);
    }
  }

  private formatJobType(type?: string): string {
    if (!type) return 'Not specified';
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private attachEventListeners(): void {
    if (this.button) {
      const clickHandler = () => {
        overlayLogger.info('User interaction: overlay_button_clicked');
        this.togglePanel();
      };
      this.button.addEventListener('click', clickHandler);
      this.eventListeners.push({
        element: this.button,
        event: 'click',
        handler: clickHandler,
      });
    }

    // Add keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts(): void {
    const keydownHandler = (e: KeyboardEvent) => {
      // Escape key to close panel
      if (e.key === 'Escape' && this.isVisible) {
        e.preventDefault();
        e.stopPropagation();
        overlayLogger.info('User interaction: keyboard_shortcut_escape');
        this.hidePanel();
        return;
      }

      // Ctrl+S or Cmd+S to save job (when panel is visible)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === 's' &&
        this.isVisible &&
        this.extractedJob
      ) {
        e.preventDefault();
        e.stopPropagation();
        overlayLogger.info('User interaction: keyboard_shortcut_save');
        this.handleSaveJob();
        return;
      }

      // Ctrl+Shift+V or Cmd+Shift+V to toggle panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        e.stopPropagation();
        overlayLogger.info('User interaction: keyboard_shortcut_toggle');
        this.togglePanel();
        return;
      }
    };

    document.addEventListener('keydown', keydownHandler as EventListener, true);
    this.eventListeners.push({
      element: document,
      event: 'keydown',
      handler: keydownHandler as EventListener,
    });
  }

  private async handleSaveJob(): Promise<void> {
    if (!this.extractedJob || !this.isAuthenticated) {
      return;
    }

    const saveButton = document.getElementById(
      'vega-ai-save-btn'
    ) as HTMLButtonElement;
    if (saveButton && !saveButton.disabled) {
      // Trigger the save button click to reuse existing logic
      saveButton.click();
    }
  }

  private async togglePanel(): Promise<void> {
    if (this.isVisible) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }

  private async showPanel(): Promise<void> {
    const panelWrapper = document.getElementById('vega-ai-capture-panel');
    if (!panelWrapper) return;

    await this.checkAuthentication();

    this.isVisible = true;
    panelWrapper.style.display = 'block';

    // Force a reflow by accessing offsetHeight to ensure the browser applies the initial styles
    // before adding the animation class. This is necessary to trigger the CSS transition effect.
    panelWrapper.offsetHeight;

    panelWrapper.classList.remove('vega-ai-hidden');
    panelWrapper.classList.add('vega-ai-fade-in');

    const content = document.getElementById('vega-ai-job-preview');

    if (!this.isAuthenticated) {
      this.showAuthRequired(content);
      return;
    }

    this.updatePanelContent(content, 'loading');

    setTimeout(async () => {
      try {
        const currentUrl = window.location.href;

        // Try to get cached job first
        let cachedJob = this.getCachedJob(currentUrl);
        if (cachedJob) {
          this.extractedJob = cachedJob;
          this.updatePanelContent(content, 'data');
          return;
        }

        // Extract fresh job data
        this.extractedJob = extractJobData();

        if (this.extractedJob) {
          // Try to restore saved notes
          try {
            const savedNotes = await chrome.storage.local.get(
              `notes_${currentUrl}`
            );
            if (savedNotes[`notes_${currentUrl}`]) {
              this.extractedJob.notes = savedNotes[`notes_${currentUrl}`];
              overlayLogger.debug('Restored saved notes for job');
            }
          } catch (error) {
            overlayLogger.warn('Failed to restore saved notes', error);
          }

          // Cache the extracted job
          this.setCachedJob(currentUrl, this.extractedJob);
          this.updatePanelContent(content, 'data');
        } else {
          this.updatePanelContent(
            content,
            'error',
            'No job listing found. Please navigate to a job details page.'
          );
        }
      } catch (error) {
        const errorDetails = errorService.handleError(error, {
          action: 'extract_job_data',
          context: 'overlay',
        });
        this.updatePanelContent(content, 'error', errorDetails.userMessage);
      }
    }, 300);
  }

  private hidePanel(): void {
    const panelWrapper = document.getElementById('vega-ai-capture-panel');
    if (!panelWrapper) return;

    this.isVisible = false;
    panelWrapper.classList.add('vega-ai-hidden');
    panelWrapper.classList.remove('vega-ai-fade-in');

    setTimeout(() => {
      if (!this.isVisible) {
        panelWrapper.style.display = 'none';
      }
    }, 200);
  }

  private showSuccess(): void {
    const content = document.getElementById('vega-ai-job-preview');
    this.updatePanelContent(content, 'success');
    setTimeout(() => this.hidePanel(), 2000);
  }

  private showError(message: string): void {
    const content = document.getElementById('vega-ai-job-preview');
    this.updatePanelContent(content, 'error', message);
  }

  private showRetryStatus(attemptNumber: number, maxAttempts: number): void {
    const content = document.getElementById('vega-ai-job-preview');
    const message = `Retrying... (${attemptNumber}/${maxAttempts})`;
    this.updatePanelContent(content, 'info', message);
  }

  private showAuthRequired(container: HTMLElement | null): void {
    if (!container) return;

    container.innerHTML = '';

    if (this.footer) {
      this.footer.style.display = 'none';
    }

    const authDiv = document.createElement('div');
    authDiv.className = 'vega-ai-text-center';
    authDiv.style.padding = '40px 20px';

    const iconWrapper = document.createElement('div');
    iconWrapper.style.cssText =
      'width: 60px; height: 60px; margin: 0 auto; background-color: rgba(59, 130, 246, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center;';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '30');
    svg.setAttribute('height', '30');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#3B82F6');
    svg.setAttribute('stroke-width', '2');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
    );
    svg.appendChild(path);

    iconWrapper.appendChild(svg);

    const title = document.createElement('h3');
    title.style.cssText =
      'margin-top: 16px; color: #1F2937; font-size: 18px; font-weight: 600;';
    title.textContent = 'Sign In Required';

    const text = document.createElement('p');
    text.style.cssText = 'margin-top: 8px; color: #6B7280; font-size: 14px;';
    text.textContent = 'Please sign in to save job listings';

    const signInButton = this.createButton('Sign In', 'primary');
    signInButton.style.marginTop = '20px';

    const signInHandler = () => {
      // Send message to background to set attention badge
      chrome.runtime.sendMessage({ type: 'OPEN_POPUP' }, () => {
        const instruction = document.createElement('p');
        instruction.style.cssText =
          'margin-top: 12px; color: #059669; font-size: 13px; font-weight: 500;';
        instruction.textContent = '→ Click the Vega AI icon in your toolbar';
        authDiv.appendChild(instruction);

        signInButton.style.display = 'none';
      });
    };

    signInButton.addEventListener('click', signInHandler);
    this.eventListeners.push({
      element: signInButton,
      event: 'click',
      handler: signInHandler,
    });

    authDiv.appendChild(iconWrapper);
    authDiv.appendChild(title);
    authDiv.appendChild(text);
    authDiv.appendChild(signInButton);
    container.appendChild(authDiv);
  }

  private getErrorMessage(error: string): string {
    const errorMap: Record<string, string> = {
      'Network request failed':
        'Unable to connect to Vega AI. Please check your internet connection and try again.',
      'Request timed out':
        'The request took too long. Please check your connection and try again.',
      Unauthorized: 'Please sign in to save job listings.',
      'Invalid token': 'Your session has expired. Please sign in again.',
      'Server error':
        'Our servers are temporarily unavailable. Please try again in a few moments.',
      'Save failed':
        "Unable to save this job. Please ensure you're signed in and try again.",
      AUTH_EXPIRED:
        'Your session has expired. Please sign in again to continue.',
      AUTH_REFRESH_FAILED:
        'Unable to refresh your session. Please sign in again.',
      fetch: 'Connection error. Please check your internet connection.',
      'Extension context invalidated':
        'The extension was updated. Please close and reopen this panel.',
      'Could not establish connection':
        'Connection lost. Please close and reopen this panel.',
      'No job data':
        "Unable to capture job information from this page. Please ensure you're on a job listing.",
    };

    for (const [key, value] of Object.entries(errorMap)) {
      if (error.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    return error;
  }

  private async autoSaveNotes(): Promise<void> {
    if (!this.extractedJob) return;

    try {
      // Save notes to local storage
      await chrome.storage.local.set({
        [`notes_${window.location.href}`]: this.extractedJob.notes,
      });
    } catch (error) {
      errorService.handleError(error, {
        action: 'auto_save_notes',
        context: 'overlay',
      });
    }
  }

  public destroy(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    this.container = null;
    this.button = null;
    this.panel = null;
    this.footer = null;
    this.extractedJob = null;
    this.isVisible = false;

    this.jobCache.clear();

    // Remove DOM element
    const root = document.getElementById('vega-ai-root');
    root?.remove();
  }
}
