# Vega AI Job Capture Extension

[![CI](https://github.com/benidevo/vega-ai-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/benidevo/vega-ai-extension/actions/workflows/ci.yml)
[![Coverage Status](https://img.shields.io/badge/Coverage-84.97%25-green.svg)](https://github.com/benidevo/vega-ai-extension)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub Release](https://img.shields.io/github/v/release/benidevo/vega-ai-extension?logo=github&logoColor=white)](https://github.com/benidevo/vega-ai-extension/releases/latest)
[![Version](https://img.shields.io/badge/version-1.2.2-green.svg)](https://github.com/benidevo/vega-ai-extension/releases)

Save job listings from any site to your [Vega AI](https://vega.benidevo.com) dashboard. Click the icon, fill in the details, done. Works with the cloud service or a self-hosted backend.

## How it Works

Click the extension icon on any page. A side panel opens for that tab. Fill in the job details, add notes if you want, and save.

## Install

### Download from GitHub

1. Grab the `vega-extension-*.zip` from the [latest release](https://github.com/benidevo/vega-ai-extension/releases/latest)
2. Unzip it somewhere
3. Go to `chrome://extensions/`, turn on Developer mode, click "Load unpacked", select the unzipped folder

### Build from Source

You need Node.js 22+. Run `nvm use` if you have nvm.

```bash
git clone https://github.com/benidevo/vega-ai-extension.git
cd vega-ai-extension
npm install
npm run build
```

Then load the `dist` folder the same way as above.

## Setup

Create an account at [vega.benidevo.com](https://vega.benidevo.com), then sign in through the side panel. If you're running your own backend, switch to Local Mode in settings and point it at your host.

## For Developers

See [DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) to get up and running and [TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md) for architecture details.

## Privacy

The extension has no content scripts and never reads page content. It only sends data when you explicitly click save. Tokens are stored in Chrome's encrypted local storage. Permissions: `storage`, `alarms`, `sidePanel`, `tabs`.

Full [Privacy Policy](https://vega.benidevo.com/privacy).

## Support

[FAQ](https://vega.benidevo.com/#faq) · [Report a bug](https://github.com/benidevo/vega-ai-extension/issues) · [Discussions](https://github.com/benidevo/vega-ai-extension/discussions)

## License

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0). If you run a modified version on a server, you must make the source available. For commercial licensing, email [vega@benidevo.com](mailto:vega@benidevo.com).
