# Development Guide

## Setup

You need Node.js 22+. Run `nvm use` if you have nvm.

```bash
git clone https://github.com/benidevo/vega-ai-extension.git
cd vega-ai-extension
npm install
npm run dev
```

Go to `chrome://extensions/`, enable Developer mode, click "Load unpacked", select the `dist` folder. Click the extension icon on any page to open the side panel.

## Commands

```bash
npm run dev              # watch mode
npm run build            # production build
npm run clean            # wipe dist/

npm run lint
npm run lint:fix
npm run typecheck
npm run format

npm test
npm run test:watch

npm run release:patch    # 1.0.0 -> 1.0.1
npm run release:minor    # 1.0.0 -> 1.1.0
npm run release:major    # 1.0.0 -> 2.0.0
```

## Backend

The extension hits `vega.benidevo.com` by default. For local development, open the side panel settings, switch to Local Mode, and set your host. Webpack adds `http://localhost:*/*` to `host_permissions` in dev builds so you do not need to configure CORS locally.

## Releasing

```bash
git checkout master && git pull

# bumps version in package.json, manifest.json, README badge, creates commit + tag
npm run release:patch

git push origin master
git push origin --tags
```

CI picks up the tag and publishes the ZIP. If a release fails, delete the tag and retry:

```bash
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
```

Before tagging: `npm test && npm run lint && npm run build` should all pass, and the capture flow should work end-to-end in the built extension.

## JOB_URL_PATTERNS

The capture form works on any site. `JOB_URL_PATTERNS` in `src/popup/index.ts` only controls a UI label ("Job page detected") shown when the current URL matches a known job site. To add a new site to that hint, append its URL pattern.

## Testing

Tests use Jest with Chrome APIs mocked. Run `npm test` or `npm run test:watch`. Mock at the boundary (`chrome.storage`, `chrome.runtime.sendMessage`) rather than the implementation.

```typescript
describe('isValidJobListing', () => {
  it('requires title and company', () => {
    expect(isValidJobListing({ company: 'Acme' })).toBe(false);
    expect(isValidJobListing({ title: 'Engineer', company: 'Acme', sourceUrl: '...' })).toBe(true);
  });
});
```

## Reloading Changes

- Background changes: reload the extension at `chrome://extensions/`
- Panel changes: close and reopen the side panel
- Manifest changes: always reload the extension

## Code Layout

```plaintext
src/
├── background/       # service worker + services (auth, API, storage, badge, messaging)
├── popup/            # side panel HTML and TypeScript
├── config/
├── types/
├── utils/            # logger, validation
└── styles/
```

## Contributing

Fork, branch off master, make changes, run `npm test && npm run lint`, open a PR. Keep PRs focused on one thing. Open an issue first if you are planning something large.
