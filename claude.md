# LinkHaven - Project Implementation Guide

> **Purpose**: This file provides complete implementation context for AI assistants and new developers.

## Project Overview

LinkHaven is a privacy-first bookmark and notes management application built with React + TypeScript + Vite.

**Live URL**: https://my-linkhaven.netlify.app  
**Repository**: https://github.com/myProjectsRavi/linkhaven

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript |
| Build | Vite |
| Styling | TailwindCSS |
| Icons | Lucide React |
| Deployment | Netlify (auto-deploys from main) |
| Storage | Browser localStorage (encrypted) |

---

## Core Architecture

### Data Types (`types.ts`)

```typescript
// Primary data structures
Folder       // Bookmark folders with hierarchy
Bookmark     // URL bookmarks with metadata, tags, health check
Notebook     // Note containers (similar to folders)
Note         // Rich text notes with tags

// Modal types for UI state
ModalType    // Union of all modal identifiers (~25 types)
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `App.tsx` | Root | Main app logic, state management, modals |
| `Sidebar.tsx` | components/ | Navigation (Folders, Notebooks, Notes) |
| `BookmarkGrid.tsx` | components/ | Bookmark card display |
| `NotesGrid.tsx` | components/ | Note card display with View/Share icons |
| `Modal.tsx` | components/ | Reusable modal wrapper (sm/md/lg/xl sizes) |
| `LockScreen.tsx` | components/ | PIN authentication |

### Premium Features

| Feature | Component | Description |
|---------|-----------|-------------|
| QR Sync | `QRSync.tsx` | Export/import all data via sync code |
| Secure Note Share | `SecureNoteShare.tsx` | AES-256-GCM per-note encryption |
| Unlock Note | `UnlockNote.tsx` | Decrypt received shared notes |
| Notebook Sync | `NotebookSync.tsx` | Notes-only sync code |
| Deduplication | `DeduplicationWizard.tsx` | Find duplicate bookmarks |
| Snapshots | `SnapshotCapture.tsx` | Page snapshots (Eternal Vault) |
| Ghost Vault | `VaultPinModal.tsx` | Hidden bookmarks with separate PIN |
| Smart Auto-Backup | `BackupConfigModal.tsx` | 5-min auto-backup to user folder |
| Smart Rules | `RulesManager.tsx` | Auto-tag/move based on URL patterns |
| Citations | `CitationView.tsx` | Generate academic citations |

---

## Security Implementation

### PIN Protection
- 4-digit PIN stored as SHA-256 hash
- All data encrypted in localStorage
- Session-based authentication

### Secure Note Sharing (AES-256-GCM)
```
Encryption Flow:
1. User enters password (min 4 chars)
2. Generate random salt (16 bytes) + IV (12 bytes)
3. Derive key using PBKDF2 (600,000 iterations, SHA-256)
4. Encrypt note data with AES-256-GCM
5. Combine: salt + iv + ciphertext → Base64

Decryption Flow:
1. Decode Base64
2. Extract salt (16b), IV (12b), ciphertext
3. Derive key using same PBKDF2 params
4. Decrypt with AES-256-GCM
```

---

## State Management

All state is managed via React useState hooks in `App.tsx`:

```typescript
// Data State
folders, setFolders
bookmarks, setBookmarks
notebooks, setNotebooks
notes, setNotes

// UI State
modalType, setModalType
activeFolderId, setActiveFolderId
activeNotebookId, setActiveNotebookId
searchQuery, setSearchQuery
viewingNote, setViewingNote

// Form State
newTitle, newUrl, newDesc, newTags...
```

---

## Custom Hooks (`hooks/`)

> **IMPORTANT**: When adding new features, use these hooks instead of inline logic.

### useStorage

Encrypted localStorage operations. Use for any data persistence.

```typescript
import { useStorage } from './hooks';

const { loadData, saveData, saveCollection } = useStorage(cryptoKey);

// Load all data with decryption
const data = await loadData();

// Save individual collection
await saveCollection('BOOKMARKS', bookmarks);
```

### useAuth

PIN verification, session management, auto-lock timer.

```typescript
import { useAuth } from './hooks';

const { 
  hasPin, 
  isAuthenticated, 
  cryptoKey,
  handleUnlock,
  handleSetupPin,
  handleLock 
} = useAuth();

// Unlock with PIN
const success = await handleUnlock('1234');
```

### useToast

Toast notifications with auto-dismiss.

```typescript
import { useToast } from './hooks';

const { toast, showToast } = useToast();

// Show notification
showToast('Bookmark saved!', 'success');
showToast('Error occurred', 'error');
```

### useKeyboardShortcuts

Global keyboard shortcuts (Ctrl+K, Ctrl+B, etc).

```typescript
import { useKeyboardShortcuts } from './hooks';

useKeyboardShortcuts({
  onSearch: () => searchInputRef.current?.focus(),
  onAddBookmark: () => setModalType('ADD_BOOKMARK'),
  onAddNote: () => setModalType('ADD_NOTE'),
  onLock: handleLock,
  onEscape: () => setModalType(null)
}, isAuthenticated);
```

---

## Key Functions

| Function | Purpose |
|----------|---------|
| `handleSaveBookmark` | Create/update bookmark |
| `handleSaveNote` | Create/update note |
| `openEditNoteModal` | Opens edit modal, validates notebook |
| `deleteNote` | Remove note |
| `deleteBookmark` | Remove bookmark |
| `handleTagClick` | Filter by tag |

---

## Data Flow

```
User Action → Event Handler → State Update → Re-render
                                    ↓
                            useEffect → localStorage
```

---

## Common Patterns

### Adding a new modal:
1. Add modal type to `types.ts` ModalType union
2. Create component in `components/`
3. Import in `App.tsx`
4. Add state if needed (e.g., `viewingNote`)
5. Add modal JSX in App.tsx return

### Adding a new note action:
1. Add handler in `App.tsx`
2. Add callback prop to `NotesGrid.tsx`
3. Wire onClick in note card

### Adding new features (RECOMMENDED):
1. Use `useToast()` instead of inline toast state
2. Use `useAuth()` for authentication logic
3. Use `useStorage()` for encrypted persistence
4. Use `useKeyboardShortcuts()` for shortcuts

---

## File Structure
```
/
├── App.tsx              # Main application (1700+ lines)
├── types.ts             # TypeScript interfaces
├── index.css            # Global styles
├── index.tsx            # Entry point
├── TODOs.md             # Browser extension implementation guide
├── components/
│   ├── Modal.tsx
│   ├── Sidebar.tsx
│   ├── BookmarkGrid.tsx
│   ├── NotesGrid.tsx
│   ├── LockScreen.tsx
│   ├── QRSync.tsx
│   ├── SecureNoteShare.tsx
│   ├── UnlockNote.tsx
│   ├── NoteViewer.tsx
│   ├── SnapshotViewer.tsx   # Eternal Vault reader mode
│   ├── KnowledgeGraph.tsx   # Connection Map visualization
│   ├── TrashView.tsx        # 7-day trash recovery
│   ├── VersionHistory.tsx   # Note version history
│   ├── VaultPinModal.tsx    # Ghost Vault PIN setup/unlock
│   ├── BackupConfigModal.tsx # Smart Backup folder config
│   ├── RulesManager.tsx     # Smart Rules automation
│   ├── CitationView.tsx     # Academic citation generator
│   └── ...
├── hooks/
│   ├── index.ts             # Central export
│   ├── useStorage.ts        # Encrypted localStorage
│   ├── useAuth.ts           # PIN/session management
│   ├── useToast.ts          # Toast notifications
│   ├── useKeyboardShortcuts.ts
│   ├── useAutoBackup.ts     # File System API auto-backup
│   ├── useRules.ts          # Smart Rules engine
│   ├── useCitations.ts      # Citation metadata fetching
│   └── useGhostVault.ts     # Ghost Vault state
└── utils/
    ├── crypto.ts            # AES-256-GCM encryption
    ├── importers.ts         # File import parsing
    ├── metadata.ts          # URL metadata fetching
    ├── linkChecker.ts       # Dead link detection
    ├── SnapshotDB.ts        # IndexedDB for snapshots
    ├── ruleEngine.ts        # Smart Rules logic
    ├── citationParser.ts    # Citation metadata parser
    ├── citationFormatter.ts # APA/MLA/Chicago formatting
    ├── contentExtractor.ts  # Readability.js extraction
    └── graphBuilder.ts      # Knowledge graph builder
```

---

## Development Commands

```bash
npm run dev      # Start dev server (Vite)
npm run build    # Production build
npm run preview  # Preview production build
```

---

## Deployment

Vercel auto-deploys on every push to `main` branch.

**Live URLs**:
- Vercel: https://linkhaven-beige.vercel.app
- Netlify: https://my-linkhaven.netlify.app

Manual deploy:
```bash
git add -A && git commit -m "message" && git push origin main
```

---

## Known Issues / Future Work

- [ ] Rich text editor for notes (currently plain text)
- [ ] Image attachments in notes
- [ ] PDF export for notes
- [x] Cross-device sync via cloud (QR Sync + Smart Auto-Backup)
- [x] Browser extension for quick save (see TODOs.md)
- [x] Ghost Vault - Hidden bookmarks with separate PIN
- [x] Smart Rules - Auto-tagging based on URL patterns
- [x] Citation Generator - APA/MLA/Chicago/Harvard formats

## Recent Updates (Jan 2026)

- **Smart Auto-Backup**: File System API auto-saves to user folder every 5 min
- **Ghost Vault**: Hidden bookmarks with separate PIN protection
- **Smart Rules**: Automatic tagging/moving based on URL patterns
- **Citations**: Generate academic citations from bookmarks
- **QR Sync**: Includes vault bookmarks in sync code

