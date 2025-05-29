# Ascentio Browser Extension

A focused Chrome extension that captures job listings from various job sites and posts them to the Ascentio backend service.

## 🚀 Features

- **Smart Job Detection**: Automatically detects job listings on supported sites
- **Data Extraction**: Captures job title, company, location, description, and job type
- **Interactive Overlay**: Floating UI for quick job preview and capture
- **Quick Notes**: Add personal notes before posting jobs
- **Google Authentication**: Secure login with Google OAuth 2.0
- **One-Click Capture**: Post jobs to the Ascentio backend service instantly
- **Visual Feedback**: Success/error badge notifications

## 📋 Purpose

This extension serves a single, focused purpose: to capture job listings from web pages and post them to the Ascentio backend service. It does not manage, store, or track jobs locally. All data is sent directly to the backend for centralized management.

## 🏗️ Architecture

### Modular Design

The extension follows a modular architecture with clear separation of concerns:

```
src/
├── background/          # Service worker and background services
│   ├── services/       # Modular service implementations
│   │   ├── auth/      # Authentication service (Google OAuth)
│   │   ├── api/       # Backend API communication
│   │   ├── message/   # Chrome extension messaging
│   │   ├── storage/   # Chrome storage wrapper
│   │   └── badge/     # Extension badge management
│   └── ServiceManager.ts # Coordinates all services
│
├── content/            # Content scripts injected into web pages
│   ├── extractors/    # Job data extraction modules
│   │   ├── IJobExtractor.ts    # Common interface
│   │   └── linkedin.ts         # LinkedIn-specific extractor
│   ├── overlay.ts     # Floating UI component
│   └── index.ts       # Content script entry point
│
├── popup/             # Extension popup UI
├── styles/            # Global styles (Tailwind CSS)
└── types/             # TypeScript type definitions
```

### Key Components

#### Background Services

- **AuthService**: Handles Google OAuth flow and token management
- **APIService**: Posts captured jobs to the Ascentio backend
- **MessageService**: Type-safe message passing between components
- **StorageService**: Simple wrapper for Chrome storage operations
- **BadgeService**: Success/error visual feedback through extension badge

#### Content Script Modules

- **Job Extractors**: Site-specific modules implementing `IJobExtractor` interface
- **Overlay Manager**: Creates and manages the floating capture UI
- **DOM Observer**: Watches for page changes and job listing updates

## 🛠️ Technology Stack

- **TypeScript**: Type-safe development
- **Webpack 5**: Module bundling and build optimization
- **Tailwind CSS**: Utility-first styling
- **HTMX & Hyperscript**: Dynamic UI interactions
- **Chrome Extension Manifest V3**: Latest extension platform
- **ESLint**: Code quality and consistency

## 📦 Installation

### Prerequisites

- Node.js 20+ and npm
- Chrome browser
- Google OAuth client ID (for authentication)

### Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/benidevo/ascentio-extension.git
   cd ascentio-extension
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure the extension:
   - Update `src/background/ServiceManager.ts` with the Google OAuth client ID
   - Update API endpoints to point to the backend service

4. Build the extension:

   ```bash
   npm run build
   ```

5. Load in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory

6. Load in Edge:
   - Navigate to `edge://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory

## 🔧 Development

### Available Scripts

```bash
npm run dev         # Development build with watch mode
npm run build       # Production build
npm run clean       # Clean dist directory
npm run lint        # Run ESLint
npm run typecheck   # Run TypeScript compiler checks
```

### Adding New Job Sites

1. Create a new extractor in `src/content/extractors/`:

   ```typescript
   export class IndeedExtractor implements IJobExtractor {
     canExtract(url: string): boolean {
       return url.includes('indeed.com');
     }

     extract(): JobListing | null {
       // Site-specific extraction logic
     }
   }
   ```

2. Register in `src/content/extractors/index.ts`

3. The content script will automatically use it for matching URLs

### Message Types

The extension uses typed messages for communication:

- `JOB_EXTRACTED`: Job detected on page
- `SAVE_JOB`: Request to save job
- `LOGIN`/`LOGOUT`: Authentication requests

## 🔒 Configuration

### Required Configuration

1. **Google OAuth Setup**:
   - Create a project in Google Cloud Console
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add `chrome-extension://[EXTENSION_ID]` to authorized redirects

2. **Backend API**:
   - Deploy the Ascentio backend service
   - Update API endpoints in `ServiceManager.ts`

### Optional Configuration

- Modify job extraction selectors for better accuracy
- Customize overlay styles in `overlay.styles.ts`
- Add new storage areas in `StorageService`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Ensure all tests pass before submitting

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 📞 Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/benidevo/ascentio-extension/issues).
