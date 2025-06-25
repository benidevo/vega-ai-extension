# Development Guide

## 🛠️ Development Setup

### Prerequisites

- Node.js 20+ and npm
- Chrome browser for testing

### Getting Started

```bash
# Clone the repository
git clone https://github.com/benidevo/vega-ai-extension.git
cd vega-ai-extension

# Install dependencies
npm install

# Start development build with watch mode
npm run dev
```

### Google OAuth Configuration

For open source builds with OAuth:

- Replace `YOUR_GOOGLE_CLIENT_ID_HERE` in `webpack.config.js` with your actual Google Client ID
- Get your Client ID from [Google Cloud Console](https://console.cloud.google.com/)

### Available Scripts

```bash
npm run dev         # Development build with watch mode
npm run build       # Production build (standard)
npm run build:opensource  # Build with OAuth enabled
npm run build:marketplace # Build without OAuth (for Chrome Web Store)
npm run lint        # Run ESLint
npm run test        # Run Jest tests
npm run typecheck   # Run TypeScript type checking
```

### Build & Release

- **CI**: Runs on every push/PR (quality checks + build verification)
- **Manual Build**: Trigger from GitHub Actions for testing
- **Release**: Auto-triggered by git tags

## 📦 Creating a New Release

### Automated Release Process

The project uses GitHub Actions to automatically create releases when you push a version tag. Here's the complete process:

#### 1. Ensure your changes are merged to master

```bash
git checkout master
git pull origin master
```

#### 2. Update the version

The `npm version` command will:

- Update the version in `package.json`
- Create a git commit with message "vx.x.x"
- Create a git tag "vx.x.x"

```bash
# For bug fixes (v0.1.0 → v0.1.1)
npm version patch

# For new features (v0.1.0 → v0.2.0)
npm version minor

# For breaking changes (v0.1.0 → v1.0.0)
npm version major

# For pre-releases
npm version prerelease --preid=beta  # v0.1.0 → v0.1.1-beta.0
```

#### 3. Push the commit and tag

```bash
# Push the version commit
git push origin master

# Push the tag to trigger the release workflow
git push origin --tags
```

#### 4. GitHub Actions will automatically

- Build the extension for both open source and marketplace
- Run all tests
- Create a GitHub release with:
  - Changelog from commit messages
  - Built extension as `vega-extension-vX.X.X.zip`
  - Source code archives

#### 5. Manual verification

- Check the [Releases page](https://github.com/benidevo/vega-ai-extension/releases)
- Download and test the built extension
- Edit release notes if needed

### Version Management

The version is managed in a single place (`package.json`) and automatically propagated to:

- `manifest.json` during build
- GitHub release tags
- Built extension metadata

### Release Checklist

Before creating a release:

- [ ] All tests pass (`npm test`)
- [ ] TypeScript has no errors (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] Extension works in development (`npm run dev`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Update CHANGELOG.md if maintaining one
- [ ] Ensure README.md is up to date

### Troubleshooting Releases

If the release workflow fails:

1. Check [Actions tab](https://github.com/benidevo/vega-ai-extension/actions) for error logs
2. Fix any build or test issues
3. Delete the tag locally and remotely:

   ```bash
   git tag -d v0.1.2
   git push origin :refs/tags/v0.1.2
   ```

4. Start the release process again

### Code Quality

Pre-commit hooks run ESLint, Prettier, TypeScript checks, and tests automatically.

### Adding New Job Sites

1. Create extractor in `src/content/extractors/` implementing `IJobExtractor`
2. Register in `src/content/extractors/index.ts`
3. Content script auto-detects and uses it

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🔧 Loading the Extension for Development

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select the `dist` folder
4. The extension icon should appear in your toolbar

## 📁 Project Structure

```plaintext
src/
├── background/         # Background service worker
│   ├── services/      # Core services (auth, API, storage, etc.)
│   └── index.ts       # Service worker entry
├── content/           # Content scripts
│   ├── extractors/    # Job site extractors
│   └── overlay.ts     # UI overlay for job capture
├── popup/             # Extension popup
│   ├── index.html     # Popup UI
│   └── index.ts       # Popup logic
├── config/            # Configuration management
├── types/             # TypeScript type definitions
└── utils/             # Shared utilities
```

## 🔐 Security Notes

- OAuth client IDs are public (not secret)
- Never commit actual user credentials
- API endpoints can be configured per environment
- All sensitive operations happen on the backend

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and test thoroughly
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to your branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Pull Request Guidelines

- Fill out the PR template completely
- Ensure all tests pass
- Update documentation if needed
- Keep PRs focused on a single feature/fix
