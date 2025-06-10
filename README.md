# NotebookLM MB-230 Learning Path Scraper

Add all the module units in a Microsoft Learn path to NotebookLM using playwright.

## Prerequisites

- Node.js
- A Google account with access to NotebookLM

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Chrome:
The script uses Chromium's remote debugging capabilities to interact with your authenticated browser session. You need to start Chrome with remote debugging enabled:

```powershell
Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--remote-debugging-port=9222"
```

3. Sign in to your Google account:
- Once Chrome launches, sign in to your Google account
- Navigate to NotebookLM (https://notebooklm.google.com/)

## Usage

1. Run the script:
```bash
npm run start  
```

The script will:
1. Connect to your Chrome browser
2. Navigate to the Microsoft learn page (currently set to MB-230 certification)
3. Extract all learning paths and their modules
4. Create NotebookLM notebooks for each module
5. Add all relevant learning resources to the notebooks