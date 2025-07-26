# Development Guide

## 🛠️ Getting Started

### What You'll Need

- Node.js 22+ and npm
- Chrome browser
- Git
- VS Code (or any editor with TypeScript support)

### Quick Setup

```bash
# Clone and install
git clone https://github.com/benidevo/vega-ai-extension.git
cd vega-ai-extension
npm install

# Start development
npm run dev

# In another terminal (optional)
npm run test:watch
```

### Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist` folder from your project directory
5. The extension icon will appear in your toolbar

### Backend Configuration

The extension can connect to:

- **Cloud** (default): The hosted Vega AI service
- **Local**: Your own backend

Users can switch modes in the extension popup.

### Authentication Options

- **Username/Password**: Always available
- **Google OAuth**: Disabled by default

To enable Google OAuth, edit `src/config/index.ts`:

```typescript
production: {
  features: {
    enableGoogleAuth: true,
  },
  auth: {
    providers: {
      google: {
        clientId: 'your-client-id.apps.googleusercontent.com'
      }
    }
  }
}
```

### Useful Commands

```bash
# Development
npm run dev              # Watch mode
npm run build            # Production build
npm run clean            # Clean dist folder

# Code Quality
npm run lint             # Check code style
npm run lint:fix         # Fix style issues
npm run typecheck        # Check types
npm run format           # Format code

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode

# Releases
npm run release:patch    # 1.0.0 → 1.0.1
npm run release:minor    # 1.0.0 → 1.1.0
npm run release:major    # 1.0.0 → 2.0.0
```

### Build & Release

- **CI**: Runs on every push/PR (quality checks + build verification)
- **Manual Build**: Trigger from GitHub Actions for testing
- **Release**: Auto-triggered by git tags

## 📦 Creating Releases

Releases happen automatically when you push a version tag:

#### 1. Ensure your changes are merged to master

```bash
git checkout master
git pull origin master
```

#### 2. Update the version

The `npm version` command will:

- Update the version in `package.json` and `manifest.json`
- Create a git commit with message "vx.x.x"
- Create a git tag "vx.x.x"

```bash
# For bug fixes (v0.1.0 → v0.1.1)
npm run release:patch

# For new features (v0.1.0 → v0.2.0)
npm run release:minor

# For breaking changes (v0.1.0 → v1.0.0)
npm run release:major
```

Note: These scripts automatically sync versions between package.json and manifest.json

#### 3. Push the commit and tag

```bash
# Push the version commit
git push origin master

# Push the tag to trigger the release workflow
git push origin --tags
```

#### 4. Manual release process

- Run tests and linting: `npm test && npm run lint`
- Build the extension: `npm run build`
- Create a ZIP file: `cd dist && zip -r ../extension.zip . && cd ..`
- Upload to Chrome Web Store manually via Developer Dashboard
- Create a GitHub release with the ZIP

#### 5. Manual verification

- Check the [Releases page](https://github.com/benidevo/vega-ai-extension/releases)
- Download and test the built extension
- Edit release notes if needed

### Version Management

The version in `package.json` is the source of truth. The `prepare-release.js` script syncs it to `manifest.json`.

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

Pre-commit hooks run automatically to check your code. They run ESLint, Prettier, and TypeScript checks. If something fails, fix it and try again.

### Adding New Job Sites

Want to add Indeed or another job site? Here's how:

1. Create a new extractor in `src/content/extractors/`:

   ```typescript
   export class IndeedExtractor implements IJobExtractor {
     canExtract(url: string): boolean {
       return url.includes('indeed.com/viewjob');
     }

     extract(): JobListing | null {
       // Pull data from the page
     }
   }
   ```

2. Add it to `src/content/extractors/index.ts`

3. Add the domain to `manifest.json`:

   ```json
   "host_permissions": [
     "https://*.linkedin.com/jobs/*",
     "https://*.indeed.com/jobs/*"
   ]
   ```

   Note: Only request access to job-specific paths to minimize permissions.

## 🧪 Testing

### Running Tests

```bash
npm test              # Run once
npm run test:watch    # Keep running
```

### Writing Tests

Tests use Jest and mock the Chrome APIs. Example:

```typescript
describe('IndeedExtractor', () => {
  it('extracts job data', () => {
    document.body.innerHTML = '<div>Mock Indeed HTML</div>';
    const extractor = new IndeedExtractor();
    const job = extractor.extract();

    expect(job?.title).toBe('Software Engineer');
  });
});
```

## 🔧 Development Tips

### Loading Your Changes

After running `npm run dev`:

1. Go to `chrome://extensions/`
2. Click "Reload" on the Vega AI extension
3. Refresh the LinkedIn page you're testing on

### What Needs Reloading

- **Content script changes**: Refresh the LinkedIn page
- **Background changes**: Reload the extension
- **Popup changes**: Just close and reopen the popup
- **Manifest changes**: Always reload the extension

## 📁 Code Organization

```
src/
├── background/          # Service worker (runs in background)
│   ├── services/       # All the main logic
│   └── index.ts        # Entry point
│
├── content/            # Runs on LinkedIn pages
│   ├── extractors/     # Gets job data from pages
│   ├── overlay.ts      # The floating button/panel
│   └── index.ts        # Entry point
│
├── popup/              # The extension popup
│   ├── index.html      # UI structure
│   └── index.ts        # Sign in logic
│
├── config/             # Settings
├── types/              # TypeScript types
├── utils/              # Helper functions
└── styles/             # CSS files
```

## 🔐 Security Notes

- OAuth client IDs are public (safe in code)
- Never log user passwords or tokens
- Always use HTTPS in production
- Run `npm audit` regularly to check dependencies
- Test with minimal permissions first

## 🤝 Contributing

### How to Contribute

1. Fork the repo and clone it
2. Create a branch: `git checkout -b feature/cool-feature`
3. Make your changes
4. Test everything: `npm test && npm run lint`
5. Push and open a PR

### PR Guidelines

Write a clear title and description. Make sure tests pass. Keep changes focused on one thing.

### Getting Help

Open an issue if you're stuck or have questions.
