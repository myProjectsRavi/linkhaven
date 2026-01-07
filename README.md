# 🔗 LinkHaven

**A privacy-first, offline-only, encrypted bookmarks manager. Your data never leaves your browser.**

---

## ✨ Features

### Core Features
- **100% Offline** — All data stored in your browser's localStorage
- **AES-256 Encryption** — Your bookmarks are encrypted with your PIN
- **PIN Protection** — Secure your bookmarks with a local PIN
- **Zero Cloud** — No servers, no accounts, no tracking

### Organization
- **Folder System** — Nested folders for hierarchical organization
- **Tagging System** — Add multiple tags per bookmark
- **Global Search** — Search by title, URL, description, or tags

### Productivity
- **Auto Title Fetch** — Paste URL, title auto-fills
- **Browser Import** — Import from Chrome/Firefox/Safari (bookmarks.html)
- **Quick-Add Bookmarklet** — Save from any page with one click
- **Keyboard Shortcuts** — `/` for search, `⌘N` for new bookmark

### Data Management
- **Link Health Check** — Detect broken/dead links
- **Import/Export** — Backup and restore your data as JSON
- **PWA Support** — Install as a native app on any device

---

## 🚀 Quick Start

### Live App
> ## **[linkhaven-ravi.netlify.app](https://linkhaven-ravi.netlify.app)**

### Install as App (PWA)
1. Visit the link above
2. Click the install icon in your browser's address bar
3. Use LinkHaven like a native app!

### Run Locally
```bash
git clone https://github.com/myProjectsRavi/linkhaven.git
cd linkhaven
npm install
npm run dev
```

---

## 🔒 Privacy & Security

| Feature | Implementation |
|---------|---------------|
| **Encryption** | AES-256-GCM via Web Crypto API |
| **Key Derivation** | PBKDF2 with 100,000 iterations |
| **Storage** | Browser localStorage only |
| **Network** | Zero API calls for data |
| **Analytics** | None |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `⌘/Ctrl + K` | Focus search |
| `⌘/Ctrl + N` | New bookmark |
| `Escape` | Close modal |

---

## 📦 Browser Import

Supports standard bookmark export formats:
- **Chrome**: Bookmarks > Bookmark Manager > ⋮ > Export bookmarks
- **Firefox**: Bookmarks > Manage Bookmarks > Import and Backup > Export Bookmarks to HTML
- **Safari**: File > Export Bookmarks

Also supports:
- Pocket JSON export
- Raindrop.io JSON export
- LinkHaven backup files

---

## 🛠 Tech Stack

- React 19 + TypeScript
- Vite (build tool)
- Tailwind CSS (via CDN)
- Web Crypto API (encryption)
- Service Worker (PWA)
- lucide-react (icons)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LinkHaven PWA                            │
├─────────────────────────────────────────────────────────────────┤
│  Service Worker                                                 │
│  • Cache-first strategy • Offline support • Install prompt     │
├─────────────────────────────────────────────────────────────────┤
│  Utilities                                                      │
│  • crypto.ts (AES-256 encryption)                              │
│  • importers.ts (HTML/JSON parsers)                            │
│  • metadata.ts (URL title fetcher)                             │
│  • linkChecker.ts (Health checker)                             │
├─────────────────────────────────────────────────────────────────┤
│  Components                                                     │
│  • App.tsx (Main orchestrator)                                 │
│  • Sidebar.tsx (Navigation + actions)                          │
│  • BookmarkGrid.tsx (Card display)                             │
│  • TagInput.tsx (Tag management)                               │
│  • BookmarkletModal.tsx (Quick-add tool)                       │
│  • LockScreen.tsx (PIN authentication)                         │
├─────────────────────────────────────────────────────────────────┤
│  Storage Layer                                                  │
│  └── Encrypted localStorage                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📄 License

MIT License - Free for personal and commercial use.

---

<div align="center">
<strong>Simple. Fast. Private. Encrypted.</strong>

Made for students & professionals who value their privacy.
</div>
