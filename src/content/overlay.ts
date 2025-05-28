import { JobListing } from '@/types';
import { extractJobData } from './extractors';
import { overlayStyles } from './styles/overlay.styles';

/**
 * Provides a floating overlay UI for capturing and displaying job listing information on a web page.
 * Includes a floating action button, a details panel, and integration with Chrome extension messaging and storage.
 */
export class AscentioOverlay {
  private container: HTMLElement | null = null;
  private button: HTMLButtonElement | null = null;
  private panel: HTMLElement | null = null;
  private isVisible: boolean = false;
  private extractedJob: JobListing | null = null;
  private eventListeners: Array<{ element: Element | Window | Document; event: string; handler: EventListener }> = [];

  constructor() {
    this.init();
  }

  private init(): void {
    this.createContainer();
    this.createFloatingButton();
    this.createPanel();
    this.attachEventListeners();
  }

  private createContainer(): void {
    const root = document.createElement('div');
    root.id = 'ascentio-root';
    root.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
    document.body.appendChild(root);

    const style = document.createElement('style');
    style.textContent = overlayStyles;
    root.appendChild(style);

    this.container = document.createElement('div');
    this.container.id = 'ascentio-overlay';
    this.container.className = 'ascentio-container';
    root.appendChild(this.container);
  }

  private createFloatingButton(): void {
    const buttonWrapper = document.createElement('div');
    buttonWrapper.id = 'ascentio-capture-button';
    buttonWrapper.className = 'ascentio-capture-button';

    this.button = document.createElement('button');
    this.button.className = 'ascentio-fab';
    this.button.setAttribute('aria-label', 'Capture job listing');

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
    panelWrapper.id = 'ascentio-capture-panel';
    panelWrapper.className = 'ascentio-capture-panel ascentio-hidden';

    this.panel = document.createElement('div');
    this.panel.className = 'ascentio-panel-inner';

    const header = this.createPanelHeader();
    const content = this.createPanelContent();
    const footer = this.createPanelFooter();

    this.panel.appendChild(header);
    this.panel.appendChild(content);
    this.panel.appendChild(footer);

    panelWrapper.appendChild(this.panel);
    this.container?.appendChild(panelWrapper);
  }

  private createPanelHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'ascentio-panel-header';

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'ascentio-flex ascentio-items-center ascentio-justify-between';

    const brandingWrapper = document.createElement('div');
    brandingWrapper.className = 'ascentio-flex ascentio-items-center ascentio-gap-2';

    const logo = document.createElement('img');
    logo.src = chrome.runtime.getURL('icons/icon48.png');
    logo.className = 'ascentio-logo';
    logo.alt = 'Ascentio';

    const title = document.createElement('h3');
    title.className = 'ascentio-panel-title';
    title.textContent = 'Ascentio';

    brandingWrapper.appendChild(logo);
    brandingWrapper.appendChild(title);

    const closeButton = document.createElement('button');
    closeButton.className = 'ascentio-close-button';
    closeButton.setAttribute('aria-label', 'Close panel');

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
    this.eventListeners.push({ element: closeButton, event: 'click', handler: closeHandler });

    titleWrapper.appendChild(brandingWrapper);
    titleWrapper.appendChild(closeButton);
    header.appendChild(titleWrapper);

    return header;
  }

  private createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.id = 'ascentio-job-preview';
    content.className = 'ascentio-panel-content';

    this.updatePanelContent(content, 'loading');

    return content;
  }

  private createPanelFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'ascentio-panel-footer';

    const saveButton = this.createButton('Save to Ascentio', 'primary');
    saveButton.id = 'ascentio-save-btn';

    const saveHandler = async () => {
      if (this.extractedJob) {
        try {
          await chrome.storage.local.set({ currentJob: this.extractedJob });
          await chrome.runtime.sendMessage({
            type: 'JOB_EXTRACTED',
            payload: this.extractedJob
          });
          this.showSuccess();
        } catch (error) {
          console.error('Ascentio: Failed to save job:', error);
          this.showError('Failed to save job. Please try again.');
        }
      }
    };

    saveButton.addEventListener('click', saveHandler);
    this.eventListeners.push({ element: saveButton, event: 'click', handler: saveHandler });

    footer.appendChild(saveButton);

    return footer;
  }

  private createButton(text: string, variant: 'primary' | 'secondary'): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = variant === 'primary' ? 'ascentio-btn-primary' : 'ascentio-btn-secondary';
    return button;
  }

  private updatePanelContent(container: HTMLElement | null, state: 'loading' | 'success' | 'error' | 'data', errorMessage?: string): void {
    if (!container) return;

    container.innerHTML = '';

    if (state === 'loading') {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'ascentio-text-center';
      loadingDiv.style.padding = '40px 0';

      const spinner = document.createElement('div');
      spinner.className = 'ascentio-spinner';

      const text = document.createElement('p');
      text.className = 'ascentio-text-sm ascentio-text-gray';
      text.style.marginTop = '16px';
      text.textContent = 'Extracting job information...';

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
          fieldDiv.className = 'ascentio-field';

          const label = document.createElement('div');
          label.className = 'ascentio-field-label';
          label.textContent = field.label;

          const value = document.createElement('div');
          value.className = 'ascentio-field-value';
          value.textContent = field.value;

          fieldDiv.appendChild(label);
          fieldDiv.appendChild(value);
          container.appendChild(fieldDiv);
        }
      });

      const notesDiv = document.createElement('div');
      notesDiv.className = 'ascentio-field';

      const notesLabel = document.createElement('div');
      notesLabel.className = 'ascentio-field-label';
      notesLabel.textContent = 'Notes';

      const notesTextarea = document.createElement('textarea');
      notesTextarea.className = 'ascentio-textarea';
      notesTextarea.id = 'ascentio-notes-textarea';
      notesTextarea.placeholder = 'Add your notes here...';
      notesTextarea.rows = 3;
      notesTextarea.value = this.extractedJob.notes || '';

      const notesHandler = (e: Event) => {
        if (this.extractedJob && e.target instanceof HTMLTextAreaElement) {
          this.extractedJob.notes = e.target.value;
        }
      };

      notesTextarea.addEventListener('input', notesHandler);
      this.eventListeners.push({ element: notesTextarea, event: 'input', handler: notesHandler });

      notesDiv.appendChild(notesLabel);
      notesDiv.appendChild(notesTextarea);
      container.appendChild(notesDiv);
    } else if (state === 'success') {
      const successDiv = document.createElement('div');
      successDiv.className = 'ascentio-text-center';
      successDiv.style.padding = '40px 0';

      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'ascentio-success-icon';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '30');
      svg.setAttribute('height', '30');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', '#10B981');
      svg.setAttribute('stroke-width', '3');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M20 6L9 17l-5-5');
      svg.appendChild(path);

      iconWrapper.appendChild(svg);

      const text = document.createElement('p');
      text.className = 'ascentio-success-text';
      text.textContent = 'Job saved successfully!';

      successDiv.appendChild(iconWrapper);
      successDiv.appendChild(text);
      container.appendChild(successDiv);
    } else if (state === 'error') {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'ascentio-text-center';
      errorDiv.style.padding = '40px 0';

      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'ascentio-error-icon';
      iconWrapper.style.cssText = 'width: 60px; height: 60px; margin: 0 auto; background-color: rgba(239, 68, 68, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center;';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '30');
      svg.setAttribute('height', '30');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', '#EF4444');
      svg.setAttribute('stroke-width', '3');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M6 18L18 6M6 6l12 12');
      svg.appendChild(path);

      iconWrapper.appendChild(svg);

      const text = document.createElement('p');
      text.className = 'ascentio-error-text';
      text.style.cssText = 'margin-top: 16px; color: #EF4444; font-size: 16px; font-weight: 500;';
      text.textContent = errorMessage || 'Failed to extract job data';

      errorDiv.appendChild(iconWrapper);
      errorDiv.appendChild(text);
      container.appendChild(errorDiv);
    }
  }

  private formatJobType(type?: string): string {
    if (!type) return 'Not specified';
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  private attachEventListeners(): void {
    if (this.button) {
      const clickHandler = () => this.togglePanel();
      this.button.addEventListener('click', clickHandler);
      this.eventListeners.push({ element: this.button, event: 'click', handler: clickHandler });
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
    const panelWrapper = document.getElementById('ascentio-capture-panel');
    if (!panelWrapper) return;

    this.isVisible = true;
    panelWrapper.style.display = 'block';

    // Force a reflow by accessing offsetHeight to ensure the browser applies the initial styles
    // before adding the animation class. This is necessary to trigger the CSS transition effect.
    panelWrapper.offsetHeight;

    panelWrapper.classList.remove('ascentio-hidden');
    panelWrapper.classList.add('ascentio-fade-in');

    const content = document.getElementById('ascentio-job-preview');
    this.updatePanelContent(content, 'loading');

    setTimeout(() => {
      try {
        this.extractedJob = extractJobData();

        if (this.extractedJob) {
          this.updatePanelContent(content, 'data');
        } else {
          this.updatePanelContent(content, 'error', 'No job data found on this page');
        }
      } catch (error) {
        console.error('Ascentio: Error extracting job data:', error);
        this.updatePanelContent(content, 'error', 'Failed to extract job data');
      }
    }, 300);
  }

  private hidePanel(): void {
    const panelWrapper = document.getElementById('ascentio-capture-panel');
    if (!panelWrapper) return;

    this.isVisible = false;
    panelWrapper.classList.add('ascentio-hidden');
    panelWrapper.classList.remove('ascentio-fade-in');

    setTimeout(() => {
      if (!this.isVisible) {
        panelWrapper.style.display = 'none';
      }
    }, 200);
  }

  private showSuccess(): void {
    const content = document.getElementById('ascentio-job-preview');
    this.updatePanelContent(content, 'success');
    setTimeout(() => this.hidePanel(), 2000);
  }

  private showError(message: string): void {
    const content = document.getElementById('ascentio-job-preview');
    this.updatePanelContent(content, 'error', message);
  }

  public destroy(): void {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // Clear references
    this.container = null;
    this.button = null;
    this.panel = null;
    this.extractedJob = null;
    this.isVisible = false;

    // Remove DOM element
    const root = document.getElementById('ascentio-root');
    root?.remove();
  }
}
