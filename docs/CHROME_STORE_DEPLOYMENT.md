# Chrome Web Store Deployment

## Setup

### 1. Get API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Chrome Web Store API
3. Create OAuth 2.0 credentials (Desktop app)
4. Download the credentials JSON

### 2. Generate Refresh Token

```bash
npm install -g chrome-webstore-upload-cli
chrome-webstore-upload generate-refresh-token --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET
```

### 3. Add GitHub Secrets

Add these to your repo's Actions secrets:

- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

## Deployment

### Automatic (Recommended)

```bash
npm version patch  # or minor/major
git push && git push --tags
```

GitHub Actions will automatically:

- Run tests
- Build extension
- Upload to Chrome Web Store
- Create GitHub release

### Manual

Go to Actions tab → Run workflow → Select version type

## Versions

- **Patch** (1.0.0 → 1.0.1): Bug fixes
- **Minor** (1.0.0 → 1.1.0): New features
- **Major** (1.0.0 → 2.0.0): Breaking changes

## Pre-release Checklist

- [ ] Tests pass: `npm test`
- [ ] Linting clean: `npm run lint`
- [ ] Types check: `npm run typecheck`
- [ ] Build works: `npm run build`
- [ ] Manual testing done

### Manual Upload

```bash
npm run build
cd dist && zip -r ../extension.zip . && cd ..
```

Upload at [Chrome Web Store Dashboard](https://chrome.google.com/webstore/devconsole)

## Resources

- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/using_webstore_api/)
- [GitHub Actions](https://docs.github.com/en/actions)
