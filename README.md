# Ascentio Job Capture Extension

A browser extension that helps users capture and save job listings while browsing job listing sites like LinkedIn and Indeed.

## Features

- Automatically detects job listings on LinkedIn and Indeed
- Extracts job details like title, company, location, and description
- Save jobs with notes
- Google authentication

## Development

### Building the Extension

1. Clone this repository

    ```bash
    git clone https://github.com/benidevo/ascentio-extension.git
    ```

2. Run `npm run build` to copy the source files to the dist directory

### Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by toggling the switch in the top right corner
3. Click "Load unpacked" and select the `dist` directory
4. The extension should now be loaded and ready to use

## Usage

1. Navigate to a job listing on LinkedIn or Indeed
2. The extension will automatically detect and extract the job details
3. Click the extension icon to view the extracted job details
4. Add your interest level and notes
5. Click "Save Job" to save the job to your account

## Configuration

Before using the extension, make sure to:

1. Obtain a Google OAuth client ID and add it to the appropriate places in the code
2. Update the API endpoint in the code to point to your backend service
