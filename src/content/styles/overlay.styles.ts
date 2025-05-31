/**
 * Isolated styles for the Ascentio overlay component.
 * These styles are namespaced under #ascentio-root to prevent conflicts with host page styles.
 */
export const overlayStyles = `
  /* Reset and namespace all styles */
  #ascentio-root {
    all: initial;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  #ascentio-root * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* Container styles */
  #ascentio-root .ascentio-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 99999;
  }

  /* Floating action button - positioned higher to avoid LinkedIn messaging */
  #ascentio-root .ascentio-capture-button {
    position: fixed;
    bottom: 100px;
    right: 24px;
    z-index: 999999;
    transition: opacity 200ms, transform 200ms;
  }

  /* Responsive positioning for mobile */
  @media (max-width: 768px) {
    #ascentio-root .ascentio-capture-button {
      bottom: 80px;
      right: 16px;
    }
  }

  #ascentio-root .ascentio-fab {
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

  #ascentio-root .ascentio-fab:hover {
    background-color: #0B7A70;
    transform: scale(1.1);
  }

  #ascentio-root .ascentio-fab:active {
    transform: scale(0.95);
  }

  /* Panel styles */
  #ascentio-root .ascentio-capture-panel {
    position: fixed;
    bottom: 170px;
    right: 24px;
    width: 320px;
    max-width: calc(100vw - 48px);
    z-index: 999999;
    transition: opacity 200ms, transform 200ms;
  }

  #ascentio-root .ascentio-capture-panel.ascentio-hidden {
    opacity: 0;
    transform: translateY(10px);
    pointer-events: none;
  }

  /* Responsive panel positioning */
  @media (max-width: 768px) {
    #ascentio-root .ascentio-capture-panel {
      bottom: 150px;
      right: 16px;
      left: 16px;
      width: auto;
    }
  }

  /* Ensure panel doesn't go off-screen on small viewports */
  @media (max-height: 600px) {
    #ascentio-root .ascentio-capture-panel {
      bottom: 60px;
      max-height: calc(100vh - 120px);
    }
    
    #ascentio-root .ascentio-capture-button {
      bottom: 20px;
    }
  }

  #ascentio-root .ascentio-panel-inner {
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
  #ascentio-root .ascentio-panel-header {
    padding: 16px;
    border-bottom: 1px solid rgb(51, 65, 85);
    flex-shrink: 0;
  }

  #ascentio-root .ascentio-panel-title {
    display: block;
    margin: 0;
    font-size: 18px;
    line-height: 28px;
    font-weight: 500;
    color: white;
  }

  #ascentio-root .ascentio-close-button {
    display: inline-block;
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: rgb(156, 163, 175);
    transition: color 200ms;
    line-height: 0;
  }

  #ascentio-root .ascentio-close-button:hover {
    color: white;
  }

  /* Panel content */
  #ascentio-root .ascentio-panel-content {
    padding: 16px;
    max-height: 400px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Responsive content height */
  @media (max-height: 700px) {
    #ascentio-root .ascentio-panel-content {
      max-height: 250px;
    }
  }

  @media (max-height: 500px) {
    #ascentio-root .ascentio-panel-content {
      max-height: 150px;
    }
  }

  /* Panel footer */
  #ascentio-root .ascentio-panel-footer {
    padding: 16px;
    border-top: 1px solid rgb(51, 65, 85);
    flex-shrink: 0;
  }

  /* Buttons */
  #ascentio-root .ascentio-btn-primary {
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

  #ascentio-root .ascentio-btn-primary:hover {
    background-color: #0B7A70;
  }

  /* Utility classes */
  #ascentio-root .ascentio-flex {
    display: flex !important;
  }

  #ascentio-root .ascentio-items-center {
    align-items: center !important;
  }

  #ascentio-root .ascentio-justify-between {
    justify-content: space-between !important;
  }

  #ascentio-root .ascentio-gap-2 {
    gap: 8px !important;
  }

  #ascentio-root .ascentio-hidden {
    display: none !important;
  }

  /* Animation classes */
  #ascentio-root .ascentio-fade-in {
    animation: ascentio-fadeIn 200ms ease-out;
  }

  @keyframes ascentio-fadeIn {
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
  @keyframes ascentio-spin {
    to { transform: rotate(360deg); }
  }

  #ascentio-root .ascentio-spinner {
    display: inline-block;
    width: 40px;
    height: 40px;
    border: 3px solid rgb(51, 65, 85);
    border-top-color: #0D9488;
    border-radius: 50%;
    animation: ascentio-spin 1s linear infinite;
  }

  /* Text styles */
  #ascentio-root .ascentio-text-sm {
    display: block;
    font-size: 14px;
    line-height: 20px;
  }

  #ascentio-root .ascentio-text-xs {
    display: block;
    font-size: 12px;
    line-height: 16px;
  }

  #ascentio-root .ascentio-text-gray {
    color: rgb(156, 163, 175);
  }

  #ascentio-root .ascentio-text-white {
    color: white;
  }

  #ascentio-root .ascentio-text-center {
    text-align: center;
  }

  /* Ensure all text elements have proper display */
  #ascentio-root p,
  #ascentio-root div,
  #ascentio-root span {
    display: block;
  }

  #ascentio-root svg {
    display: inline-block;
    vertical-align: middle;
  }

  /* Success state */
  #ascentio-root .ascentio-success-icon {
    width: 60px;
    height: 60px;
    margin: 0 auto;
    background-color: rgba(16, 185, 129, 0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  #ascentio-root .ascentio-success-text {
    margin-top: 16px;
    color: #10B981;
    font-size: 16px;
    font-weight: 500;
  }

  /* Field styles */
  #ascentio-root .ascentio-field {
    margin-bottom: 16px;
  }

  #ascentio-root .ascentio-field-label {
    display: block;
    font-size: 12px;
    line-height: 16px;
    color: rgb(156, 163, 175);
    margin-bottom: 4px;
  }

  #ascentio-root .ascentio-field-value {
    display: block;
    font-size: 14px;
    line-height: 20px;
    color: white;
    word-wrap: break-word;
  }

  /* Logo styles */
  #ascentio-root .ascentio-logo {
    width: 24px;
    height: 24px;
    display: inline-block;
    vertical-align: middle;
  }

  #ascentio-root .ascentio-textarea {
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

  #ascentio-root .ascentio-textarea:hover,
  #ascentio-root .ascentio-textarea:focus {
    background-color: rgba(51, 65, 85, 0.7);
    border-color: #0D9488;
    outline: none;
  }

  #ascentio-root .ascentio-textarea::placeholder {
    color: rgba(156, 163, 175, 0.7);
  }

  /* Scrollbar styling for panel content */
  #ascentio-root .ascentio-panel-content::-webkit-scrollbar {
    width: 6px;
  }

  #ascentio-root .ascentio-panel-content::-webkit-scrollbar-track {
    background: rgba(51, 65, 85, 0.3);
    border-radius: 3px;
  }

  #ascentio-root .ascentio-panel-content::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.5);
    border-radius: 3px;
  }

  #ascentio-root .ascentio-panel-content::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.7);
  }
`;
