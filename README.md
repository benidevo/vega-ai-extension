# Vega AI Job Capture Extension

[![CI](https://github.com/benidevo/vega-ai-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/benidevo/vega-ai-extension/actions/workflows/ci.yml)
[![Coverage Status](https://img.shields.io/badge/Coverage-88.57%25-green.svg)](https://github.com/benidevo/vega-ai-extension)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-4285F4?logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/vega-ai-job-capture/oboedhpojbjemdmojfchifppbgbfehol)
[![Version](https://img.shields.io/badge/version-1.0.1-green.svg)](https://github.com/benidevo/vega-ai-extension/releases)

**Save job listings to your personal dashboard with one click.**

This user-initiated Chrome extension adds a floating button to LinkedIn job pages that lets you save jobs directly to your Vega AI dashboard. All actions are initiated by you. The extension never collects or saves data automatically. Works with both the cloud service and self-hosted backends.

## ✨ Features

- 🎯 **Shows on** job pages on LinkedIn when you visit them
- 💾 **User-initiated save** with the floating button
- 📝 **Add notes** before saving (saved locally too)
- 🔐 **Two auth options**: username/password or Google OAuth
- 🌐 **Cloud or self-hosted**: your choice
- ⚡ **Keyboard shortcuts**: Ctrl+Shift+V to toggle, Ctrl+S to save
- 🔄 **Syncs across devices** when signed in
- 🛡️ **Privacy-focused**: only saves when you click, data encrypted

## 🎬 How it Works

1. Go to any LinkedIn job posting
2. Click the floating Vega AI button
3. Add your notes (optional)
4. Hit save and you're done

No more copy-pasting job details.

## 📥 Get Started

### Install the Extension

**Option 1: Chrome Web Store** (Recommended)

1. Go to the [Chrome Web Store page](https://chromewebstore.google.com/detail/vega-ai-job-capture/oboedhpojbjemdmojfchifppbgbfehol)
2. Click "Add to Chrome"
3. Click "Add extension" in the popup

#### Option 2: Direct Download

1. Visit the [latest release page](https://github.com/benidevo/vega-ai-extension/releases/latest)
2. Download the `vega-extension-*.zip` file
3. Unzip the file to a folder on your computer
4. Open Chrome and go to `chrome://extensions/`
5. Turn on "Developer mode" (toggle in top right)
6. Click "Load unpacked" and select your unzipped folder

### Set Up Your Account

1. Create an account at [vega.benidevo.com](https://vega.benidevo.com)
2. Click the Vega AI icon in your browser toolbar
3. If you're using the cloud service, just sign in
4. For self-hosted backends, switch to Local Mode in settings
5. Browse LinkedIn jobs and start saving!

---

## 🛠️ For Developers

<details>
<summary>Click to expand developer setup instructions</summary>

### Prerequisites

- Node.js 22+ and npm
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

### Development Commands

```bash
npm run dev        # Watch mode for development
npm run build      # Production build
npm run test       # Run tests
npm run lint       # Check code style
npm run typecheck  # Check TypeScript types
```

### Configuration

By default, the extension uses username/password auth and connects to the cloud backend. You can change these defaults:

**Backend Modes:**

- Cloud Mode: `https://vega.benidevo.com` (default)
- Local Mode: Your own backend (set host/port in settings)

**Authentication:**

- Username/Password (always available)
- Google OAuth (disabled by default)

To enable Google OAuth, edit `src/config/index.ts`:

```typescript
production: {
  features: {
    enableGoogleAuth: true,
  },
  auth: {
    providers: {
      google: {
        clientId: 'your-google-client-id.apps.googleusercontent.com'
      }
    }
  }
}
```

### Project Structure

The code is organized into these main parts:

- **Background**: Service worker that handles auth, API calls, and messaging
- **Content**: Scripts that run on LinkedIn pages to detect jobs
- **Popup**: The extension popup where users sign in and change settings
- **Services**: Reusable modules for common functionality

### 📚 Documentation

- 📖 **[Development Guide](docs/DEVELOPMENT_GUIDE.md)** - How to build and contribute
- 🏗️ **[Technical Design](docs/TECHNICAL_DESIGN.md)** - Architecture and implementation details

</details>

## 🔒 Privacy & Security

**Your privacy is priority:**

- ✅ **User-initiated only**: The extension never reads or saves data automatically
- ✅ **You control your data**: Only saves jobs when you explicitly click the save button
- ✅ **No tracking**: No analytics, no data collection beyond what you choose to save
- ✅ **Encrypted storage**: Your authentication tokens are encrypted locally
- ✅ **Open source**: Review the code to see exactly what the extension does
- ✅ **Minimal permissions**: Only accesses LinkedIn job pages, nothing else

Read the full **[Privacy Policy](https://vega.benidevo.com/privacy)** for complete details.

## 🆘 Need Help?

- 📖 **[FAQ](https://vega.benidevo.com/#faq)**
- 🐛 **[Report a bug](https://github.com/benidevo/vega-ai-extension/issues)**
- 💡 **[Request a feature](https://github.com/benidevo/vega-ai-extension/issues)**
- 💬 **[Discussions](https://github.com/benidevo/vega-ai-extension/discussions)**

## 📝 License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0).

What this means:

- ✅ You can use, study, modify, and distribute the code
- ✅ If you run this software on a server, you must make your source code available to users
- ✅ Any modifications must also be released under AGPL-3.0

For commercial licensing without AGPL requirements, email [benjaminidewor@gmail.com](mailto:benjaminidewor@gmail.com).
