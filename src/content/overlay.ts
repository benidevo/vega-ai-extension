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
    // Create root element with proper namespacing
    const root = document.createElement('div');
    root.id = 'ascentio-root';
    root.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
    document.body.appendChild(root);

    // Create style element for isolated styles
    const style = document.createElement('style');
    style.textContent = overlayStyles;
    root.appendChild(style);

    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'ascentio-overlay';
    this.container.className = 'ascentio-container';
    root.appendChild(this.container);
  }

  private createFloatingButton(): void {
    // Create wrapper div as per design spec
    const buttonWrapper = document.createElement('div');
    buttonWrapper.id = 'ascentio-capture-button';
    buttonWrapper.className = 'ascentio-capture-button';

    this.button = document.createElement('button');
    this.button.className = 'ascentio-fab';
    this.button.setAttribute('aria-label', 'Capture job listing');

    // SVG icon as per design
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
    // Create panel wrapper as per design spec
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

    // Add logo and branding
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

    // Create close icon SVG
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
    closeButton.addEventListener('click', () => this.hidePanel());

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

    saveButton.addEventListener('click', () => {
      if (this.extractedJob) {
        chrome.storage.local.set({ currentJob: this.extractedJob });
        chrome.runtime.sendMessage({
          type: 'JOB_EXTRACTED',
          payload: this.extractedJob
        });
        this.showSuccess();
      }
    });

    footer.appendChild(saveButton);

    return footer;
  }

  private createButton(text: string, variant: 'primary' | 'secondary'): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = variant === 'primary' ? 'ascentio-btn-primary' : 'ascentio-btn-secondary';
    return button;
  }

  private updatePanelContent(container: HTMLElement, state: 'loading' | 'success' | 'error' | 'data'): void {
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
        { label: 'Experience', value: this.extractedJob.experienceLevel },
        { label: 'Skills', value: this.extractedJob.skills?.join(', ') || 'Not specified' }
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
      
      // Add status dropdown
      const statusDiv = document.createElement('div');
      statusDiv.className = 'ascentio-field';
      
      const statusLabel = document.createElement('div');
      statusLabel.className = 'ascentio-field-label';
      statusLabel.textContent = 'Status';
      
      const statusSelect = document.createElement('select');
      statusSelect.className = 'ascentio-select';
      statusSelect.id = 'ascentio-status-select';
      
      const statusOptions = [
        { value: '', text: 'Select status...' },
        { value: 'interested', text: 'Interested' },
        { value: 'applied', text: 'Applied' }
      ];
      
      statusOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        if (this.extractedJob?.status === opt.value) {
          option.selected = true;
        }
        statusSelect.appendChild(option);
      });
      
      statusSelect.addEventListener('change', (e) => {
        if (this.extractedJob) {
          this.extractedJob.status = (e.target as HTMLSelectElement).value as 'applied' | 'interested' | undefined;
        }
      });
      
      statusDiv.appendChild(statusLabel);
      statusDiv.appendChild(statusSelect);
      container.appendChild(statusDiv);
      
      // Add notes field
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
      
      notesTextarea.addEventListener('input', (e) => {
        if (this.extractedJob) {
          this.extractedJob.notes = (e.target as HTMLTextAreaElement).value;
        }
      });
      
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
    }
  }

  private formatJobType(type?: string): string {
    if (!type) return 'Not specified';
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  private attachEventListeners(): void {
    this.button?.addEventListener('click', () => this.togglePanel());
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
    panelWrapper.classList.remove('ascentio-hidden');

    const content = document.getElementById('ascentio-job-preview');
    if (content) {
      this.updatePanelContent(content, 'loading');
    }

    this.extractedJob = extractJobData();

    setTimeout(() => {
      if (content) {
        if (this.extractedJob) {
          this.updatePanelContent(content, 'data');
        } else {
          this.updatePanelContent(content, 'error');
        }
      }
    }, 1000);
  }

  private hidePanel(): void {
    const panelWrapper = document.getElementById('ascentio-capture-panel');
    if (!panelWrapper) return;

    this.isVisible = false;
    panelWrapper.classList.add('ascentio-hidden');
  }

  private showSuccess(): void {
    const content = document.getElementById('ascentio-job-preview');
    if (content) {
      this.updatePanelContent(content, 'success');
      setTimeout(() => this.hidePanel(), 2000);
    }
  }

  public destroy(): void {
    const root = document.getElementById('ascentio-root');
    root?.remove();
  }
}