# LinkHaven Browser Extensions - Implementation Guide

> **Status**: TODO - Future Premium Feature  
> **Target**: Chrome Web Store ($5) + Firefox Add-ons (Free)  
> **Architecture**: Zero-infra, postMessage to web app

---

## Overview

Browser extensions that allow one-click bookmark saving to LinkHaven without manually copying URLs.

### How It Works

1. User clicks extension icon on any webpage
2. Extension captures current tab URL + title
3. Extension sends message to LinkHaven web app tab
4. Web app receives and saves bookmark locally
5. No server communication required

---

## Technical Architecture

### Communication Flow

```
Extension Popup → Background Script → Content Script → Web App (React)
                                              ↓
                              window.postMessage() or CustomEvent
```

### File Structure (Chrome Extension)

```
linkhaven-extension/
├── manifest.json          # Extension manifest (V3)
├── popup/
│   ├── popup.html         # Icon click popup UI
│   ├── popup.js           # Popup logic
│   └── popup.css          # Popup styles
├── background.js          # Service worker (Manifest V3)
├── content.js             # Injected into linkhaven-beige.vercel.app
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── LICENSE
```

---

## Implementation Details

### 1. manifest.json (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "LinkHaven - Save Bookmark",
  "version": "1.0.0",
  "description": "One-click save to LinkHaven",
  "permissions": [
    "activeTab",
    "storage"
  ],
  "host_permissions": [
    "https://linkhaven-beige.vercel.app/*"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://linkhaven-beige.vercel.app/*"],
      "js": ["content.js"]
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### 2. popup.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      width: 280px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .logo { font-size: 18px; font-weight: 600; color: #4f46e5; margin-bottom: 12px; }
    .preview { background: #f8fafc; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .title { font-weight: 500; font-size: 14px; color: #1e293b; margin-bottom: 4px; }
    .url { font-size: 12px; color: #64748b; word-break: break-all; }
    .btn { 
      width: 100%; padding: 10px; background: #4f46e5; color: white; 
      border: none; border-radius: 8px; font-weight: 500; cursor: pointer;
    }
    .btn:hover { background: #4338ca; }
    .btn:disabled { background: #94a3b8; cursor: not-allowed; }
    .status { text-align: center; margin-top: 8px; font-size: 12px; }
    .success { color: #16a34a; }
    .error { color: #dc2626; }
  </style>
</head>
<body>
  <div class="logo">📎 LinkHaven</div>
  <div class="preview">
    <div class="title" id="pageTitle">Loading...</div>
    <div class="url" id="pageUrl"></div>
  </div>
  <button class="btn" id="saveBtn">Save to LinkHaven</button>
  <div class="status" id="status"></div>
  <script src="popup.js"></script>
</body>
</html>
```

### 3. popup.js

```javascript
// Get current tab info
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  document.getElementById('pageTitle').textContent = tab.title || 'Untitled';
  document.getElementById('pageUrl').textContent = tab.url;
});

// Save button click
document.getElementById('saveBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saveBtn');
  const status = document.getElementById('status');
  
  btn.disabled = true;
  btn.textContent = 'Saving...';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Find LinkHaven tab
    const linkhavenTabs = await chrome.tabs.query({ 
      url: 'https://linkhaven-beige.vercel.app/*' 
    });
    
    if (linkhavenTabs.length === 0) {
      // Open LinkHaven in new tab
      await chrome.tabs.create({ url: 'https://linkhaven-beige.vercel.app' });
      status.textContent = 'LinkHaven opened. Please unlock and try again.';
      status.className = 'status error';
      btn.disabled = false;
      btn.textContent = 'Save to LinkHaven';
      return;
    }
    
    // Send message to content script
    await chrome.tabs.sendMessage(linkhavenTabs[0].id, {
      type: 'LINKHAVEN_ADD_BOOKMARK',
      url: tab.url,
      title: tab.title
    });
    
    status.textContent = '✓ Saved!';
    status.className = 'status success';
    
    // Close popup after 1s
    setTimeout(() => window.close(), 1000);
    
  } catch (error) {
    console.error('Error saving bookmark:', error);
    status.textContent = 'Error: ' + error.message;
    status.className = 'status error';
    btn.disabled = false;
    btn.textContent = 'Save to LinkHaven';
  }
});
```

### 4. content.js (Injected into LinkHaven web app)

```javascript
// Listen for messages from extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LINKHAVEN_ADD_BOOKMARK') {
    // Dispatch custom event to React app
    window.dispatchEvent(new CustomEvent('linkhaven-extension-add', {
      detail: {
        url: message.url,
        title: message.title,
        source: 'extension'
      }
    }));
    
    sendResponse({ success: true });
  }
  return true; // Keep message channel open
});
```

### 5. Web App Integration (Add to App.tsx)

```typescript
// Listen for extension events
useEffect(() => {
  const handleExtensionAdd = (event: CustomEvent) => {
    const { url, title } = event.detail;
    if (!url) return;
    
    // Add bookmark (reuse existing addBookmark logic)
    const newBookmark: Bookmark = {
      id: crypto.randomUUID(),
      folderId: activeFolderId === 'ALL' ? 'default' : activeFolderId,
      title: title || url,
      url: url,
      createdAt: Date.now()
    };
    
    setBookmarks(prev => [...prev, newBookmark]);
    showToast('Bookmark added from extension!', 'success');
  };
  
  window.addEventListener('linkhaven-extension-add', handleExtensionAdd as EventListener);
  return () => window.removeEventListener('linkhaven-extension-add', handleExtensionAdd as EventListener);
}, [activeFolderId]);
```

---

## Premium Validation (No Server Required)

### Option 1: License Key in localStorage

1. User buys from LemonSqueezy/Gumroad
2. User receives license key (e.g., `LH-XXXX-XXXX-XXXX`)
3. User enters key in extension options
4. Extension stores key in `chrome.storage.sync`
5. Extension validates key format client-side

### License Key Format

```
LH-[4 alphanumeric]-[4 alphanumeric]-[checksum]
Example: LH-A1B2-C3D4-7X
```

### Validation (Client-side, No API)

```javascript
function validateLicenseKey(key) {
  const pattern = /^LH-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/;
  if (!pattern.test(key)) return false;
  
  // Simple checksum: sum of char codes mod 100
  const mainPart = key.substring(3, 12).replace(/-/g, '');
  const checksum = key.substring(13);
  const computed = Array.from(mainPart)
    .reduce((sum, c) => sum + c.charCodeAt(0), 0) % 100;
  
  return computed.toString().padStart(2, '0') === checksum;
}
```

### Key Generation (For LemonSqueezy webhook)

```javascript
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part1 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const mainPart = part1 + part2;
  const checksum = Array.from(mainPart)
    .reduce((sum, c) => sum + c.charCodeAt(0), 0) % 100;
  
  return `LH-${part1}-${part2}-${checksum.toString().padStart(2, '0')}`;
}
```

---

## Firefox Porting

### Differences from Chrome

| Chrome | Firefox |
|--------|---------|
| `chrome.` namespace | `browser.` namespace (or use polyfill) |
| Manifest V3 required | Manifest V2 still supported |
| Service worker | Background script |
| `chrome.storage.sync` | `browser.storage.sync` |

### Recommended Approach

1. Use `webextension-polyfill` library
2. Write code using `browser.` namespace
3. Polyfill handles Chrome compatibility

```javascript
// Use browser namespace with polyfill
import browser from 'webextension-polyfill';

// Works in both Chrome and Firefox
browser.tabs.query({ active: true }).then(tabs => {
  // ...
});
```

---

## Publishing Checklist

### Chrome Web Store

- [ ] Create Chrome Developer account ($5 one-time)
- [ ] Prepare icon images (16x16, 48x48, 128x128)
- [ ] Take screenshots (1280x800 or 640x400)
- [ ] Write store description
- [ ] Create privacy policy (can be simple GitHub page)
- [ ] Submit for review (1-3 days)

### Firefox Add-ons

- [ ] Create Mozilla Developer account (free)
- [ ] Same icons work
- [ ] Sign extension (automated during submission)
- [ ] Submit for review (usually instant/same day)

---

## Testing

### Local Development

1. Chrome: `chrome://extensions` → Enable Developer Mode → Load Unpacked
2. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on

### Test Cases

- [ ] Save bookmark from any webpage
- [ ] Handle case when LinkHaven tab not open
- [ ] Handle case when user not authenticated
- [ ] Verify bookmark appears in LinkHaven
- [ ] Test license key validation
- [ ] Test Firefox compatibility

---

## Estimated Timeline

| Task | Time |
|------|------|
| Extension development | 4-6 hours |
| Testing & debugging | 2-3 hours |
| Store assets & submission | 1-2 hours |
| Chrome review wait | 1-3 days |
| Firefox port | 1-2 hours |
| **Total** | **1 week** |

---

## Cost Summary

| Item | Cost |
|------|------|
| Chrome Web Store registration | $5 (one-time) |
| Firefox Add-ons | Free |
| **Total** | **$5** |

---

## Notes

1. **No Safari** - Requires $99/year Apple Developer account
2. **No server needed** - All communication via postMessage
3. **Privacy compliant** - No data leaves the browser
4. **Manifest V3** - Future-proof for Chrome's requirements
5. **Minimal maintenance** - ~200 lines of code total
