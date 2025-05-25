// Content script overlay components for Ascentio
export class AscentioOverlay {
  private captureButton: HTMLElement | null = null;
  private capturePanel: HTMLElement | null = null;
  private rootElement: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    // Create root element for all Ascentio injected content
    this.createRootElement();
    this.createCaptureButton();
    this.createCapturePanel();
    this.injectStyles();
  }

  private createRootElement(): void {
    this.rootElement = document.createElement('div');
    this.rootElement.id = 'ascentio-root';
    document.body.appendChild(this.rootElement);
  }

  private createCaptureButton(): void {
    const buttonHtml = `
      <div id="ascentio-capture-button" class="fixed bottom-4 right-4 z-[9999]">
        <button class="group p-3 bg-primary hover:bg-primary-dark text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                aria-label="Capture job listing">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = buttonHtml;
    this.captureButton = container.firstElementChild as HTMLElement;
    this.rootElement?.appendChild(this.captureButton);

    // Add click handler
    const button = this.captureButton.querySelector('button');
    button?.addEventListener('click', () => this.toggleCapturePanel());
  }

  private createCapturePanel(): void {
    const panelHtml = `
      <div id="ascentio-capture-panel" class="hidden fixed bottom-20 right-4 w-80 z-[9999]">
        <div class="bg-slate-900 bg-opacity-95 backdrop-blur-md rounded-lg shadow-2xl border border-slate-700 p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-medium text-white">Capture Job</h3>
            <button class="text-gray-400 hover:text-white transition-colors"
                    aria-label="Close panel">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div id="ascentio-job-preview" class="mb-4">
            <!-- Job data will be populated here -->
            <div class="text-center py-4">
              <p class="text-sm text-gray-400">Extracting job information...</p>
              <div class="mt-2">
                <svg class="animate-spin h-6 w-6 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </div>
          </div>
          
          <div class="space-y-3">
            <button id="ascentio-save-btn" class="w-full px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm rounded-md transition-colors duration-200">
              Save to Ascentio
            </button>
          </div>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = panelHtml;
    this.capturePanel = container.firstElementChild as HTMLElement;
    this.rootElement?.appendChild(this.capturePanel);

    // Add close handler
    const closeBtn = this.capturePanel.querySelector('button[aria-label="Close panel"]');
    closeBtn?.addEventListener('click', () => this.hideCapturePanel());
  }

  private toggleCapturePanel(): void {
    if (this.capturePanel?.classList.contains('hidden')) {
      this.showCapturePanel();
    } else {
      this.hideCapturePanel();
    }
  }

  private showCapturePanel(): void {
    this.capturePanel?.classList.remove('hidden');
    // Trigger job extraction when panel opens
    this.extractJobData();
  }

  private hideCapturePanel(): void {
    this.capturePanel?.classList.add('hidden');
  }

  private async extractJobData(): Promise<void> {
    // This will be implemented to extract job data from the current page
    const previewElement = document.querySelector('#ascentio-job-preview');
    if (previewElement) {
      // Simulated extraction - will be replaced with actual extraction logic
      setTimeout(() => {
        previewElement.innerHTML = `
          <div class="space-y-2">
            <div>
              <p class="text-xs text-gray-400">Position</p>
              <p class="text-sm text-white font-medium">Software Engineer</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Company</p>
              <p class="text-sm text-white">Example Corp</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Location</p>
              <p class="text-sm text-white">Remote</p>
            </div>
          </div>
        `;
      }, 1000);
    }
  }

  private injectStyles(): void {
    const styles = `
      #ascentio-root * {
        box-sizing: border-box;
        font-family: 'Inter', system-ui, sans-serif;
      }
      
      #ascentio-root {
        /* High specificity reset */
        all: initial;
      }
      
      /* Tailwind classes specific to Ascentio */
      #ascentio-root .fixed { position: fixed; }
      #ascentio-root .bottom-4 { bottom: 1rem; }
      #ascentio-root .right-4 { right: 1rem; }
      #ascentio-root .bottom-20 { bottom: 5rem; }
      #ascentio-root .w-80 { width: 20rem; }
      #ascentio-root .w-6 { width: 1.5rem; }
      #ascentio-root .h-6 { height: 1.5rem; }
      #ascentio-root .w-5 { width: 1.25rem; }
      #ascentio-root .h-5 { height: 1.25rem; }
      #ascentio-root .p-3 { padding: 0.75rem; }
      #ascentio-root .p-4 { padding: 1rem; }
      #ascentio-root .px-4 { padding-left: 1rem; padding-right: 1rem; }
      #ascentio-root .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
      #ascentio-root .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
      #ascentio-root .mb-3 { margin-bottom: 0.75rem; }
      #ascentio-root .mb-4 { margin-bottom: 1rem; }
      #ascentio-root .mt-2 { margin-top: 0.5rem; }
      #ascentio-root .mx-auto { margin-left: auto; margin-right: auto; }
      #ascentio-root .space-y-2 > * + * { margin-top: 0.5rem; }
      #ascentio-root .space-y-3 > * + * { margin-top: 0.75rem; }
      
      /* Colors */
      #ascentio-root .bg-primary { background-color: #0D9488; }
      #ascentio-root .bg-slate-900 { background-color: rgb(15 23 42); }
      #ascentio-root .bg-slate-700 { background-color: rgb(51 65 85); }
      #ascentio-root .bg-opacity-95 { background-color: rgb(15 23 42 / 0.95); }
      #ascentio-root .text-white { color: white; }
      #ascentio-root .text-primary { color: #0D9488; }
      #ascentio-root .text-gray-400 { color: rgb(156 163 175); }
      
      /* Border and shadows */
      #ascentio-root .border { border-width: 1px; }
      #ascentio-root .border-slate-700 { border-color: rgb(51 65 85); }
      #ascentio-root .rounded-full { border-radius: 9999px; }
      #ascentio-root .rounded-lg { border-radius: 0.5rem; }
      #ascentio-root .rounded-md { border-radius: 0.375rem; }
      #ascentio-root .shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }
      #ascentio-root .shadow-2xl { box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25); }
      
      /* Typography */
      #ascentio-root .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
      #ascentio-root .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      #ascentio-root .text-xs { font-size: 0.75rem; line-height: 1rem; }
      #ascentio-root .font-medium { font-weight: 500; }
      #ascentio-root .text-center { text-align: center; }
      
      /* Layout */
      #ascentio-root .flex { display: flex; }
      #ascentio-root .hidden { display: none; }
      #ascentio-root .items-center { align-items: center; }
      #ascentio-root .justify-between { justify-content: space-between; }
      #ascentio-root .w-full { width: 100%; }
      
      /* Effects */
      #ascentio-root .backdrop-blur-md { backdrop-filter: blur(12px); }
      #ascentio-root .transition-all { transition-property: all; }
      #ascentio-root .transition-colors { transition-property: color, background-color, border-color; }
      #ascentio-root .duration-200 { transition-duration: 200ms; }
      #ascentio-root .opacity-25 { opacity: 0.25; }
      #ascentio-root .opacity-75 { opacity: 0.75; }
      
      /* Hover states */
      #ascentio-root .hover\\:bg-primary-dark:hover { background-color: #0B7A70; }
      #ascentio-root .hover\\:text-white:hover { color: white; }
      #ascentio-root .hover\\:scale-110:hover { transform: scale(1.1); }
      
      /* Animation */
      @keyframes ascentio-spin {
        to { transform: rotate(360deg); }
      }
      
      #ascentio-root .animate-spin {
        animation: ascentio-spin 1s linear infinite;
      }
      
      /* Z-index management */
      #ascentio-root .z-\\[9999\\] { z-index: 9999; }
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  public destroy(): void {
    this.rootElement?.remove();
  }
}