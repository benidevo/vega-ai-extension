# Vega AI Job Capture Extension

[![CI](https://github.com/benidevo/vega-ai-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/benidevo/vega-ai-extension/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)

**Capture job listings instantly from any job board.**

The Vega AI extension automatically detects job postings and lets you capture them instantly to your Vega AI dashboard for tracking and management. Currently supports LinkedIn with more job sites coming soon.

## ✨ What it does

- 🎯 **Auto-detects** job listings on LinkedIn (more sites coming soon)
- 💾 **One-click save** to your Vega AI account
- 📝 **Add notes** before saving (salary expectations, interest level, etc.)
- 🔐 **Secure login** with your Vega AI username/password
- ✅ **Visual confirmation** when jobs are saved successfully

## 🎬 How it works

1. **Browse jobs** on LinkedIn
2. **Click the floating capture button** that appears on job listings
3. **Add optional notes** in the popup
4. **Hit save** and the job is instantly added to your Vega AI dashboard

No manual copy-pasting of job details. No switching between tabs. Just seamless job tracking.

## 📥 Get Started

### Install the Extension

**Option 1: Direct Download** (Recommended)

1. Visit the [latest release page](https://github.com/benidevo/vega-ai-extension/releases/latest)
2. Download the `vega-extension-*.zip` file
3. Unzip the file to a folder on your computer
4. Open Chrome and go to `chrome://extensions/`
5. Turn on "Developer mode" (toggle in top right)
6. Click "Load unpacked" and select your unzipped folder

**Option 2: Chrome Web Store** *(Coming Soon)*
The extension will be available on the Chrome Web Store for one-click installation.

### Set Up Your Account

1. **Set up Vega AI** by visiting [vega.benidevo.com](https://vega.benidevo.com) for setup instructions
2. **Open the extension** (click the Vega AI icon in your browser toolbar)
3. **Sign in** with your Vega AI username and password
4. **Start browsing jobs** and the extension will automatically detect job listings!

---

## 🛠️ For Developers

<details>
<summary>Click to expand developer setup instructions</summary>

### Prerequisites

- Node.js 20+ and npm
- Chrome browser

### Quick Setup

```bash
# Clone and install
git clone https://github.com/benidevo/vega-ai-extension.git
cd vega-ai-extension
npm install

# Build and load
npm run build
```

Then load the `dist` folder as an unpacked extension in Chrome.

### Configuration

The extension uses **username/password authentication by default**. Google OAuth is available but disabled by default.

**Basic Setup** - Update API endpoint in `src/config/index.ts` if needed:

```typescript
api: {
  baseUrl: 'http://localhost:8765'  // Default port, change if your backend uses different port
}
```

**Optional: Enable Google OAuth** - Uncomment in production config:

```typescript
features: {
  enableGoogleAuth: true, // Uncomment and set to true
},
auth: {
  providers: {
    google: {
      clientId: 'your-google-client-id.apps.googleusercontent.com' // Add your client ID
    }
  }
}
```

### Technical Documentation

</details>

## 💻 For Developers

- 📖 **[Development Guide](docs/DEVELOPMENT_GUIDE.md)** - Setup, build instructions, and contribution guidelines
- 📋 **[Technical Design Document](docs/TECHNICAL_DESIGN.md)** - Architecture, security, and implementation details

## ❓ Need Help?

**Having trouble?** Check out these resources:

- 📖 **[Setup Guide & FAQ](https://vega.benidevo.com/#faq)** for installation and common questions
- 🐛 **[Report a Bug](https://github.com/benidevo/vega-ai-extension/issues)** if something isn't working
- 💡 **[Request a Feature](https://github.com/benidevo/vega-ai-extension/issues)** to suggest improvements

## 📝 License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0).

**What this means:**

- ✅ You can use, study, modify, and distribute the code
- ✅ If you run this software on a server, you must make your source code available to users
- ✅ Any modifications must also be released under AGPL-3.0

**Commercial licensing:** For commercial use without AGPL restrictions, contact [benjaminidewor@gmail.com](mailto:benjaminidewor@gmail.com) for licensing options.
