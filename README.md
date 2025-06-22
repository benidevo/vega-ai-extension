# Vega AI Browser Extension

[![CI](https://github.com/benidevo/vega-ai-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/benidevo/vega-ai-extension/actions/workflows/ci.yml)

A focused Chrome extension that captures job listings from various job sites and posts them to the Vega AI backend service.

## 🚀 Features

- **Smart Job Detection**: Automatically detects job listings on supported sites
- **Data Extraction**: Captures job title, company, location, description, and job type
- **Interactive Overlay**: Floating UI for quick job preview and capture
- **Quick Notes**: Add personal notes before posting jobs
- **Multi-Provider Authentication**: Secure login with Google OAuth or username/password
- **One-Click Capture**: Post jobs to the Vega AI backend service instantly
- **Visual Feedback**: Success/error badge notifications

## 📋 Purpose

This extension serves a single, focused purpose: to capture job listings from web pages and post them to the Vega AI backend service. It does not manage, store, or track jobs locally. All data is sent directly to the backend for centralized management.

## 🏗️ Architecture

### Modular Design

The extension follows a modular architecture with clear separation of concerns:

```plaintext
src/
├── background/          # Service worker and background services
│   ├── services/       # Modular service implementations
│   │   ├── auth/      # Multi-provider authentication (Google OAuth, username/password)
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

- **AuthService**: Handles Google OAuth and username/password authentication with token management
- **APIService**: Posts captured jobs to the Vega AI backend
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
- **Chrome Extension Manifest V3**: Latest extension platform
- **ESLint**: Code quality and consistency
- **Jest**: Testing framework with TypeScript support

## 📦 Installation

### For Users

Download the latest release from the [GitHub releases page](https://github.com/benidevo/vega-ai-extension/releases/latest):

1. Download the `vega-extension-*.zip` file
2. Extract the contents to a folder
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" (toggle in top right)
5. Click "Load unpacked" and select the extracted folder

### For Developers

#### Prerequisites

- Node.js 20+ and npm
- Chrome browser
- Google OAuth client ID (optional, for Google authentication)

#### Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/benidevo/vega-ai-extension.git
   cd vega-ai-extension
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
npm run lint:fix    # Run ESLint with auto-fix
npm run format      # Format code with Prettier
npm run format:check # Check code formatting
npm run typecheck   # Run TypeScript compiler checks
npm run test        # Run Jest tests
npm run test:watch  # Run Jest in watch mode
npm run test:coverage # Run Jest with coverage
```

### Build & Release

#### Automated Builds

The project includes GitHub Actions workflows for different scenarios:

- **CI Pipeline**: Runs on every push/PR to master
  - Quality checks (lint, test, typecheck)
  - Build verification
  - Artifact upload (7-day retention)
  
- **Manual Build**: Trigger manually from GitHub Actions tab
  - Same quality checks as CI
  - Creates timestamped build zip
  - Artifact upload (30-day retention)
  - Good for testing specific commits

- **Release**: Automatically triggered by git tags
  - Full build with quality checks
  - Creates GitHub release with downloadable extension
  - Ready for end-user installation

#### Creating a Release

To create a new release:

```bash
# Tag the current commit
git tag v1.0.0

# Push the tag to trigger release workflow
git push origin v1.0.0
```

This automatically:
1. Builds the extension
2. Runs all quality checks
3. Creates a GitHub release
4. Uploads the extension zip for users to download

### Code Quality

This project uses **Husky** and **lint-staged** for automated pre-commit hooks:

- **Linting & Formatting**: ESLint + Prettier on staged files
- **Type Checking**: TypeScript compilation check  
- **Testing**: Complete test suite

Manual quality checks:
```bash
npm run lint        # Check linting issues
npm run lint:fix    # Auto-fix linting issues
npm run format      # Auto-format all code  
npm run typecheck   # Check TypeScript types
npm run test        # Run full test suite
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
- `LOGIN_WITH_PASSWORD`: Username/password authentication

## 🔒 Configuration

### Required Configuration

1. **Backend API**:
   - Deploy the Vega AI backend service
   - Update API endpoints in `src/config/index.ts`

### Optional Configuration

1. **Google OAuth Setup** (if enabling Google authentication):
   - Create a project in Google Cloud Console
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add `chrome-extension://[EXTENSION_ID]` to authorized redirects
   - Set `features.enableGoogleAuth: true` in config

2. **Feature Flags** in `src/config/index.ts`:
   - `enableGoogleAuth`: Enable/disable Google OAuth (default: false)
   - `enableAnalytics`: Enable usage analytics
   - `maxJobsPerSession`: Limit jobs per session

3. **Customization**:
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

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/benidevo/vega-ai-extension/issues).
