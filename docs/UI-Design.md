# Ascentio Browser Extension UI Design System

This document outlines the UI design system for the Ascentio browser extension, adapted from the main web application's design system for browser extension constraints and capabilities.

## 1. Design Foundations

### 1.1 Typography

* **Primary Font (Body)**: Inter - A clean, modern sans-serif with excellent readability at small sizes
* **Heading Font**: Poppins - Used sparingly for branding elements due to space constraints
* **Font Weights**: 400/500/600/700 - Limited weights for file size optimization
* **Scale**: Text-xs to text-xl - Adjusted for extension popup constraints (320px width)

### 1.2 Color Theme

* **Primary**: Teal (#0D9488)
* **Primary-Dark**: Darker Teal (#0B7A70) - Used for hover states
* **Secondary**: Amber (#F59E0B)
* **Background**: Slate shades for dark mode support
  * Popup: slate-900 with subtle opacity
  * Content Script Overlays: slate-800 with backdrop blur
* **Text**: White/Gray scale optimized for readability in compact spaces

### 1.3 Extension-Specific Layout Considerations

* **Popup Dimensions**: Fixed width of 320px, max height of 600px
* **Content Script Overlays**: Floating panels with z-index management
* **Responsive Design**: Optimized for consistent 320px width
* **Glass-morphism**: Simplified for performance in content scripts
* **Animations**: Minimal, performance-optimized animations

### 1.4 UI Framework

* HTML with HTMX for dynamic updates without page reloads
* Tailwind CSS with PurgeCSS for minimal bundle size
* _hyperscript for declarative interactions
* No Particles.js in extension context (performance consideration)
* Chrome Extension APIs for native browser integration

## 2. Extension-Specific Components

### 2.1 Popup Container

```html
<!-- Main popup container -->
<body class="w-80 min-h-[400px] max-h-[600px] bg-slate-900 text-white">
  <div class="p-4">
    <!-- Header with branding -->
    <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-700">
      <div class="flex items-center">
        <img src="../icons/icon48.png" class="w-8 h-8 mr-2" alt="Ascentio">
        <h1 class="text-lg font-heading font-semibold text-primary">Ascentio</h1>
      </div>
      <button class="text-gray-400 hover:text-white transition-colors" _="on click toggle .hidden on #settings">
        <svg class="w-5 h-5"><!-- Settings icon --></svg>
      </button>
    </div>

    <!-- Content area -->
    <div id="content" class="overflow-y-auto max-h-[500px]">
      <!-- Dynamic content -->
    </div>
  </div>
</body>
```

### 2.2 Content Script Overlay

```html
<!-- Floating capture button -->
<div id="ascentio-capture-button" class="fixed bottom-4 right-4 z-[9999]">
  <button class="group p-3 bg-primary hover:bg-primary-dark text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
          _="on click toggle .hidden on #ascentio-capture-panel">
    <svg class="w-6 h-6"><!-- Capture icon --></svg>
  </button>
</div>

<!-- Capture panel overlay -->
<div id="ascentio-capture-panel" class="hidden fixed bottom-20 right-4 w-80 z-[9999]">
  <div class="bg-slate-900 bg-opacity-95 backdrop-blur-md rounded-lg shadow-2xl border border-slate-700 p-4">
    <!-- Panel content -->
  </div>
</div>
```

### 2.3 Compact Form Fields

```html
<!-- Compact input field -->
<div class="mb-3">
  <label class="block text-xs font-medium text-gray-300 mb-1">Field Label</label>
  <input type="text"
         class="w-full px-3 py-2 text-sm rounded-md bg-slate-800 bg-opacity-50 border border-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
         placeholder="Enter value...">
</div>

<!-- Compact select dropdown -->
<select class="w-full px-3 py-2 text-sm rounded-md bg-slate-800 bg-opacity-50 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-primary">
  <option value="">Select option...</option>
</select>
```

### 2.4 Extension-Specific Buttons

```html
<!-- Primary Action Button (Compact) -->
<button class="w-full px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm rounded-md transition-colors duration-200">
  Save Job
</button>

<!-- Icon Button -->
<button class="p-2 bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white rounded-md transition-colors">
  <svg class="w-4 h-4"><!-- Icon --></svg>
</button>

<!-- Loading State with HTMX -->
<button hx-post="/api/capture"
        hx-target="#result"
        class="w-full px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm rounded-md transition-colors duration-200">
  <span class="htmx-indicator">
    <svg class="inline-block w-4 h-4 mr-2 animate-spin"><!-- Spinner --></svg>
  </span>
  <span class="htmx-request:hidden">Capture Job</span>
  <span class="htmx-request:inline-block hidden">Capturing...</span>
</button>
```

### 2.5 Status Messages

```html
<!-- Success message -->
<div class="p-3 mb-3 bg-green-900 bg-opacity-50 border border-green-700 rounded-md"
     _="on load wait 3s then remove me">
  <p class="text-sm text-green-300">Job captured successfully!</p>
</div>

<!-- Error message -->
<div class="p-3 mb-3 bg-red-900 bg-opacity-50 border border-red-700 rounded-md">
  <p class="text-sm text-red-300">Error: Unable to capture job data</p>
</div>
```

### 2.6 Job Card Component

```html
<div class="mb-3 p-3 bg-slate-800 bg-opacity-50 rounded-md border border-slate-700 hover:border-primary transition-colors">
  <h3 class="font-medium text-sm text-white mb-1">Job Title</h3>
  <p class="text-xs text-gray-400 mb-2">Company Name • Location</p>
  <div class="flex items-center justify-between">
    <span class="text-xs text-primary">Applied 2 days ago</span>
    <button class="text-xs text-gray-400 hover:text-white transition-colors">View</button>
  </div>
</div>
```

## 3. Extension-Specific UI States

### 3.1 Authentication States

```html
<!-- Not authenticated -->
<div class="text-center py-8">
  <svg class="w-16 h-16 text-gray-600 mx-auto mb-4"><!-- Lock icon --></svg>
  <h2 class="text-lg font-medium mb-2">Sign in to Ascentio</h2>
  <p class="text-sm text-gray-400 mb-4">Connect your account to start capturing jobs</p>
  <button class="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm rounded-md transition-colors">
    Sign In
  </button>
</div>
```

### 3.2 Page Detection States

```html
<!-- Job page detected -->
<div class="p-3 bg-primary bg-opacity-10 border border-primary border-opacity-30 rounded-md mb-3">
  <p class="text-sm text-primary flex items-center">
    <svg class="w-4 h-4 mr-2"><!-- Check icon --></svg>
    Job listing detected on this page
  </p>
</div>

<!-- No job detected -->
<div class="text-center py-8">
  <p class="text-sm text-gray-400">Navigate to a job listing to capture it</p>
</div>
```

## 4. Content Script Injection Styles

### 4.1 Injected Elements Styling

```css
/* Namespace all injected styles to avoid conflicts */
#ascentio-root * {
  box-sizing: border-box;
  font-family: 'Inter', system-ui, sans-serif;
}

/* High specificity for injected components */
#ascentio-root .ascentio-button {
  all: initial;
  /* Apply specific styles */
}
```

### 4.2 Z-Index Management

```css
/* Extension UI layers */
.ascentio-overlay { z-index: 2147483640; }
.ascentio-modal { z-index: 2147483641; }
.ascentio-tooltip { z-index: 2147483642; }
```

## 5. Performance Considerations

### 5.1 Bundle Size Optimization

* Use Tailwind's PurgeCSS to remove unused styles
* Limit custom animations to essential interactions
* Avoid heavy libraries in content scripts
* Lazy load components when possible

### 5.2 Runtime Performance

* Minimize DOM manipulation in content scripts
* Use CSS transforms for animations instead of position changes
* Debounce user interactions
* Implement virtual scrolling for long lists

## 6. Browser Compatibility

### 6.1 Cross-Browser Support

* Chrome/Edge: Full support for Manifest V3
* Firefox: Provide Manifest V2 fallback if needed
* Safari: Limited support, core features only

### 6.2 Dark Mode Support

```html
<!-- Automatic dark mode detection -->
<div class="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
  <!-- Content adapts to browser theme -->
</div>
```

## 7. Accessibility in Extensions

### 7.1 Keyboard Navigation

* All interactive elements must be keyboard accessible
* Implement focus trapping in modal overlays
* Provide keyboard shortcuts for common actions

### 7.2 Screen Reader Support

```html
<!-- Accessible button with label -->
<button aria-label="Capture job listing" class="p-2 bg-primary rounded-md">
  <svg aria-hidden="true" class="w-4 h-4"><!-- Icon --></svg>
</button>
```

## 8. HTMX & _hyperscript Patterns

### 8.1 HTMX in Popup

```html
<!-- Load user data on popup open -->
<div hx-get="/api/user"
     hx-trigger="load"
     hx-target="#user-info"
     class="htmx-request:opacity-50 transition-opacity">
  <div id="user-info">
    <!-- User info loads here -->
  </div>
</div>
```

### 8.2 _hyperscript Interactions

```html
<!-- Toggle settings panel -->
<button _="on click toggle .hidden on #settings-panel
           then if #settings-panel matches .hidden
           remove .rotate-180 from me
           else add .rotate-180 to me">
  <svg class="w-5 h-5 transition-transform"><!-- Gear icon --></svg>
</button>

<!-- Auto-dismiss notifications -->
<div class="notification"
     _="on load wait 3s then transition opacity to 0 over 0.5s then remove me">
  Notification message
</div>
```

## 9. Implementation Guidelines

### 9.1 File Structure

```
src/
├── popup/
│   ├── index.html
│   ├── index.ts
│   └── components/
├── content/
│   ├── index.ts
│   ├── overlay.ts
│   └── extractors/
├── styles/
│   ├── popup.css
│   ├── content.css
│   └── shared.css
└── background/
    └── index.ts
```

### 9.2 Style Injection

```typescript
// Content script style injection
const injectStyles = () => {
  const style = document.createElement('style');
  style.textContent = contentStyles;
  document.head.appendChild(style);
};
```

### 9.3 Message Passing for UI Updates

```typescript
// Send UI update from content script
chrome.runtime.sendMessage({
  type: 'JOB_CAPTURED',
  data: { title, company, url }
});

// Update popup UI
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'JOB_CAPTURED') {
    htmx.ajax('GET', '/api/jobs/latest', '#job-list');
  }
});
```

This design system ensures a consistent, performant, and user-friendly interface across all components of the Ascentio browser extension while respecting the constraints and capabilities of the browser extension environment.
