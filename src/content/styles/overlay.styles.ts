/**
 * Isolated styles for the Vega AI overlay component.
 * These styles are namespaced under #vega-ai-root to prevent conflicts with host page styles.
 */
export const overlayStyles = `
  /* Reset and namespace all styles */
  #vega-ai-root {
    all: initial;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  #vega-ai-root * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* Container styles */
  #vega-ai-root .vega-ai-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 99999;
  }

  /* Floating action button - positioned higher to avoid LinkedIn messaging */
  #vega-ai-root .vega-ai-save-button {
    position: fixed;
    bottom: 100px;
    right: 24px;
    z-index: 999999;
    transition: opacity 200ms, transform 200ms;
  }

  /* Responsive positioning for mobile */
  @media (max-width: 768px) {
    #vega-ai-root .vega-ai-save-button {
      bottom: 80px;
      right: 16px;
    }
  }

  #vega-ai-root .vega-ai-fab {
    width: 56px;
    height: 56px;
    padding: 0;
    background-color: #0D9488;
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    transition: all 200ms;
  }

  #vega-ai-root .vega-ai-fab:hover {
    background-color: #0B7A70;
    transform: scale(1.1);
  }

  #vega-ai-root .vega-ai-fab:active {
    transform: scale(0.95);
  }

  /* Panel styles */
  #vega-ai-root .vega-ai-save-panel {
    position: fixed;
    bottom: 170px;
    right: 24px;
    width: 320px;
    max-width: calc(100vw - 48px);
    z-index: 999999;
    transition: opacity 200ms, transform 200ms;
  }

  #vega-ai-root .vega-ai-save-panel.vega-ai-hidden {
    opacity: 0;
    transform: translateY(10px);
    pointer-events: none;
  }

  /* Responsive panel positioning */
  @media (max-width: 768px) {
    #vega-ai-root .vega-ai-save-panel {
      bottom: 150px;
      right: 16px;
      left: 16px;
      width: auto;
    }
  }

  /* Ensure panel doesn't go off-screen on small viewports */
  @media (max-height: 600px) {
    #vega-ai-root .vega-ai-save-panel {
      bottom: 60px;
      max-height: calc(100vh - 120px);
    }
    
    #vega-ai-root .vega-ai-save-button {
      bottom: 20px;
    }
  }

  #vega-ai-root .vega-ai-panel-inner {
    background-color: rgb(15, 23, 42);
    background-color: rgba(15, 23, 42, 0.98);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border-radius: 8px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(51, 65, 85, 0.8);
    overflow: hidden;
    max-height: calc(100vh - 100px);
    display: flex;
    flex-direction: column;
  }

  /* Panel header */
  #vega-ai-root .vega-ai-panel-header {
    padding: 16px;
    border-bottom: 1px solid rgb(51, 65, 85);
    flex-shrink: 0;
  }

  #vega-ai-root .vega-ai-panel-title {
    display: block;
    margin: 0;
    font-size: 18px;
    line-height: 28px;
    font-weight: 500;
    color: white;
  }

  #vega-ai-root .vega-ai-close-button {
    display: inline-block;
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: rgb(156, 163, 175);
    transition: color 200ms;
    line-height: 0;
  }

  #vega-ai-root .vega-ai-close-button:hover {
    color: white;
  }

  /* Panel content */
  #vega-ai-root .vega-ai-panel-content {
    padding: 16px;
    max-height: 400px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Responsive content height */
  @media (max-height: 700px) {
    #vega-ai-root .vega-ai-panel-content {
      max-height: 250px;
    }
  }

  @media (max-height: 500px) {
    #vega-ai-root .vega-ai-panel-content {
      max-height: 150px;
    }
  }

  /* Panel footer */
  #vega-ai-root .vega-ai-panel-footer {
    padding: 16px;
    border-top: 1px solid rgb(51, 65, 85);
    flex-shrink: 0;
  }

  /* Buttons */
  #vega-ai-root .vega-ai-btn-primary {
    width: 100%;
    padding: 8px 16px;
    background-color: #0D9488;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 200ms;
  }

  #vega-ai-root .vega-ai-btn-primary:hover {
    background-color: #0B7A70;
  }

  /* Utility classes */
  #vega-ai-root .vega-ai-flex {
    display: flex !important;
  }

  #vega-ai-root .vega-ai-items-center {
    align-items: center !important;
  }

  #vega-ai-root .vega-ai-justify-between {
    justify-content: space-between !important;
  }

  #vega-ai-root .vega-ai-gap-2 {
    gap: 8px !important;
  }

  #vega-ai-root .vega-ai-hidden {
    display: none !important;
  }

  /* Animation classes */
  #vega-ai-root .vega-ai-fade-in {
    animation: vega-ai-fadeIn 200ms ease-out;
  }

  @keyframes vega-ai-fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Loading spinner */
  @keyframes vega-ai-spin {
    to { transform: rotate(360deg); }
  }

  #vega-ai-root .vega-ai-spinner {
    display: inline-block;
    width: 40px;
    height: 40px;
    border: 3px solid rgb(51, 65, 85);
    border-top-color: #0D9488;
    border-radius: 50%;
    animation: vega-ai-spin 1s linear infinite;
  }

  /* Text styles */
  #vega-ai-root .vega-ai-text-sm {
    display: block;
    font-size: 14px;
    line-height: 20px;
  }

  #vega-ai-root .vega-ai-text-xs {
    display: block;
    font-size: 12px;
    line-height: 16px;
  }

  #vega-ai-root .vega-ai-text-gray {
    color: rgb(156, 163, 175);
  }

  #vega-ai-root .vega-ai-text-white {
    color: white;
  }

  #vega-ai-root .vega-ai-text-center {
    text-align: center;
  }

  /* Ensure all text elements have proper display */
  #vega-ai-root p,
  #vega-ai-root div,
  #vega-ai-root span {
    display: block;
  }

  #vega-ai-root svg {
    display: inline-block;
    vertical-align: middle;
  }

  /* Success state */
  #vega-ai-root .vega-ai-success-icon {
    width: 60px;
    height: 60px;
    margin: 0 auto;
    background-color: rgba(16, 185, 129, 0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  #vega-ai-root .vega-ai-success-text {
    margin-top: 16px;
    color: #10B981;
    font-size: 16px;
    font-weight: 500;
  }

  /* Field styles */
  #vega-ai-root .vega-ai-field {
    margin-bottom: 16px;
  }

  #vega-ai-root .vega-ai-field-label {
    display: block;
    font-size: 12px;
    line-height: 16px;
    color: rgb(156, 163, 175);
    margin-bottom: 4px;
  }

  #vega-ai-root .vega-ai-field-value {
    display: block;
    font-size: 14px;
    line-height: 20px;
    color: white;
    word-wrap: break-word;
  }

  /* Logo styles */
  #vega-ai-root .vega-ai-logo {
    width: 24px;
    height: 24px;
    display: inline-block;
    vertical-align: middle;
  }

  #vega-ai-root .vega-ai-textarea {
    width: 100%;
    padding: 8px 12px;
    background-color: rgba(51, 65, 85, 0.5);
    color: white;
    border: 1px solid rgba(71, 85, 105, 0.5);
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    min-height: 60px;
    transition: all 200ms;
  }

  #vega-ai-root .vega-ai-textarea:hover,
  #vega-ai-root .vega-ai-textarea:focus {
    background-color: rgba(51, 65, 85, 0.7);
    border-color: #0D9488;
    outline: none;
  }

  #vega-ai-root .vega-ai-textarea::placeholder {
    color: rgba(156, 163, 175, 0.7);
  }

  /* Scrollbar styling for panel content */
  #vega-ai-root .vega-ai-panel-content::-webkit-scrollbar {
    width: 6px;
  }

  #vega-ai-root .vega-ai-panel-content::-webkit-scrollbar-track {
    background: rgba(51, 65, 85, 0.3);
    border-radius: 3px;
  }

  #vega-ai-root .vega-ai-panel-content::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.5);
    border-radius: 3px;
  }

  #vega-ai-root .vega-ai-panel-content::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.7);
  }
`;
