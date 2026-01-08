import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Menu, LogOut, UploadCloud, AlertTriangle, Tag, Download, Loader, FileText, Lock, Crown } from 'lucide-react';
import { Folder, Bookmark, ModalType, Notebook, Note, MainView, TrashedItem, NoteVersion } from './types';
import { Sidebar } from './components/Sidebar';
import { BookmarkGrid } from './components/BookmarkGrid';
import { NotesGrid } from './components/NotesGrid';
import { Modal } from './components/Modal';
import { LockScreen } from './components/LockScreen';
import { Toast } from './components/Toast';
import { TagInput } from './components/TagInput';
import { BookmarkletModal } from './components/BookmarkletModal';
import { DeduplicationWizard } from './components/DeduplicationWizard';
import { SnapshotCapture } from './components/SnapshotCapture';
import { SnapshotViewer } from './components/SnapshotViewer';
import { QRSync } from './components/QRSync';
import { SecureNoteShare } from './components/SecureNoteShare';
import { NoteViewer } from './components/NoteViewer';
import { UnlockNote } from './components/UnlockNote';
import { NotebookSync } from './components/NotebookSync';
import { TrashView } from './components/TrashView';
import { VersionHistory } from './components/VersionHistory';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { PremiumModal } from './components/PremiumModal';
import { RulesManager } from './components/RulesManager';
import { CitationView } from './components/CitationView';
import { DuplicateFinder } from './components/DuplicateFinder';
import { VaultPinModal } from './components/VaultPinModal';
import { BackupConfigModal } from './components/BackupConfigModal';
import { useAutoBackup } from './hooks/useAutoBackup';
import { parseImportFile } from './utils/importers';
import { fetchUrlMetadata } from './utils/metadata';
import { checkMultipleLinks } from './utils/linkChecker';
import { SnapshotDB } from './utils/SnapshotDB';
import { extractContent, isExtractable, formatBytes } from './utils/contentExtractor';
import { useCitations, useRules } from './hooks';
import { useGhostVault } from './hooks/useGhostVault';
import {
  deriveKey,
  encrypt,
  decrypt,
  generateSalt,
  arrayToBase64,
  base64ToArray,
  isEncryptionSupported,
  createVerificationCanary,
  verifyPinWithCanary
} from './utils/crypto';
import {
  hideDataInImage,
  extractDataFromImage,
  loadImageToCanvas,
  downloadCanvasAsPng,
  createDefaultCarrierImage,
  calculateCapacity
} from './utils/steganography';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Storage keys
// Storage keys - NOTE: PIN is NO LONGER stored! Only encrypted canary is stored.
const STORAGE_KEYS = {
  CANARY: 'lh_canary',  // Encrypted verification string (NOT the PIN)
  SALT: 'lh_salt',
  FOLDERS: 'lh_folders',
  BOOKMARKS: 'lh_bookmarks',
  NOTEBOOKS: 'lh_notebooks',
  NOTES: 'lh_notes',
  TRASH: 'lh_trash',      // Trash bin items
  SESSION: 'lh_session',
  ENCRYPTED: 'lh_encrypted'
};

// Auto-lock timeout (5 minutes of inactivity)
const AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

function App() {
  // --- Auth State ---
  // Check for CANARY (encrypted verification) instead of plain PIN
  const [hasPin, setHasPin] = useState<boolean>(!!localStorage.getItem(STORAGE_KEYS.CANARY));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!sessionStorage.getItem(STORAGE_KEYS.SESSION));
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

  // --- Data State ---
  const [folders, setFolders] = useState<Folder[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [activeFolderId, setActiveFolderId] = useState<string | 'ALL'>('ALL');
  const [activeNotebookId, setActiveNotebookId] = useState<string | 'ALL_NOTES' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string>('');
  const [modalType, setModalType] = useState<ModalType>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemUrl, setNewItemUrl] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemTags, setNewItemTags] = useState<string[]>([]);
  const [selectedFolderForAdd, setSelectedFolderForAdd] = useState<string>('');
  const [newFolderParentId, setNewFolderParentId] = useState<string>('');

  // Notes Form State
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const [selectedNotebookForAdd, setSelectedNotebookForAdd] = useState<string>('');

  // Edit State
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [historyNote, setHistoryNote] = useState<Note | null>(null);  // For version history

  // Main view navigation
  const [mainView, setMainView] = useState<MainView>('bookmarks');

  // Trash bin state
  const [trash, setTrash] = useState<TrashedItem[]>([]);

  // Eternal Vault - Snapshot viewing state
  const [viewingSnapshotBookmark, setViewingSnapshotBookmark] = useState<Bookmark | null>(null);

  // Import State
  const [pendingImportData, setPendingImportData] = useState<{ folders: Folder[], bookmarks: Bookmark[] } | null>(null);

  // Premium Features State
  const [citationBookmark, setCitationBookmark] = useState<Bookmark | null>(null);
  const citations = useCitations();

  // Rules Engine State
  const rulesEngine = useRules(cryptoKey);

  // Ghost Vault State
  const [isVaultMode, setIsVaultMode] = useState(false);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [vaultBookmarks, setVaultBookmarks] = useState<Bookmark[]>([]);
  const [showVaultPinModal, setShowVaultPinModal] = useState(false);
  const [vaultPinMode, setVaultPinMode] = useState<'setup' | 'unlock' | 'duress'>('setup');
  const hasVaultPin = !!localStorage.getItem('lh_vault_canary');

  // Duress PIN (Panic Mode) - Uses the hook
  const ghostVault = useGhostVault();
  const [isDuressMode, setIsDuressMode] = useState(false); // True when panic PIN was entered

  // Auto Backup State
  const autoBackup = useAutoBackup();
  const [showBackupModal, setShowBackupModal] = useState(false);

  // Health Check State
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthProgress, setHealthProgress] = useState({ current: 0, total: 0 });

  // Auto-fetch state
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);

  // --- Load Data (with decryption) ---
  const loadData = useCallback(async (key: CryptoKey | null) => {
    try {
      const isEncrypted = localStorage.getItem(STORAGE_KEYS.ENCRYPTED) === 'true';

      let foldersData = localStorage.getItem(STORAGE_KEYS.FOLDERS);
      let bookmarksData = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
      let notebooksData = localStorage.getItem(STORAGE_KEYS.NOTEBOOKS);
      let notesData = localStorage.getItem(STORAGE_KEYS.NOTES);
      let trashData = localStorage.getItem(STORAGE_KEYS.TRASH);

      if (isEncrypted && key) {
        try {
          if (foldersData) foldersData = await decrypt(foldersData, key);
          if (bookmarksData) bookmarksData = await decrypt(bookmarksData, key);
          if (notebooksData) notebooksData = await decrypt(notebooksData, key);
          if (notesData) notesData = await decrypt(notesData, key);
          if (trashData) trashData = await decrypt(trashData, key);
        } catch (e) {
          console.error('Decryption failed:', e);
        }
      }

      const loadedFolders = foldersData ? JSON.parse(foldersData) : [{ id: 'default', name: 'General', createdAt: Date.now() }];
      const loadedBookmarks = bookmarksData ? JSON.parse(bookmarksData) : [];
      const loadedNotebooks = notebooksData ? JSON.parse(notebooksData) : [{ id: 'default-notebook', name: 'General', createdAt: Date.now() }];
      const loadedNotes = notesData ? JSON.parse(notesData) : [];

      // Load trash and auto-cleanup expired items (7-day auto-delete)
      const loadedTrash: TrashedItem[] = trashData ? JSON.parse(trashData) : [];
      const now = Date.now();
      const validTrash = loadedTrash.filter(item => item.autoDeleteAt > now);
      if (validTrash.length !== loadedTrash.length) {
        console.log(`Auto-deleted ${loadedTrash.length - validTrash.length} expired trash items`);
      }

      // Ensure tags array exists
      const normalizedBookmarks = loadedBookmarks.map((b: Bookmark) => ({
        ...b,
        tags: b.tags || []
      }));
      const normalizedNotes = loadedNotes.map((n: Note) => ({
        ...n,
        tags: n.tags || []
      }));

      setFolders(loadedFolders);
      setBookmarks(normalizedBookmarks);
      setNotebooks(loadedNotebooks);
      setNotes(normalizedNotes);
      setTrash(validTrash);
      setDataLoaded(true);
    } catch (e) {
      console.error('Failed to load data:', e);
      setFolders([{ id: 'default', name: 'General', createdAt: Date.now() }]);
      setBookmarks([]);
      setNotebooks([{ id: 'default-notebook', name: 'General', createdAt: Date.now() }]);
      setNotes([]);
      setDataLoaded(true);
    }
  }, []);

  // --- Save Data (with encryption) ---
  const saveData = useCallback(async (
    foldersToSave: Folder[],
    bookmarksToSave: Bookmark[],
    notebooksToSave: Notebook[],
    notesToSave: Note[],
    trashToSave?: TrashedItem[]
  ) => {
    try {
      let foldersData = JSON.stringify(foldersToSave);
      let bookmarksData = JSON.stringify(bookmarksToSave);
      let notebooksData = JSON.stringify(notebooksToSave);
      let notesData = JSON.stringify(notesToSave);
      let trashData = trashToSave ? JSON.stringify(trashToSave) : null;

      if (cryptoKey && isEncryptionSupported()) {
        foldersData = await encrypt(foldersData, cryptoKey);
        bookmarksData = await encrypt(bookmarksData, cryptoKey);
        notebooksData = await encrypt(notebooksData, cryptoKey);
        notesData = await encrypt(notesData, cryptoKey);
        if (trashData) trashData = await encrypt(trashData, cryptoKey);
        localStorage.setItem(STORAGE_KEYS.ENCRYPTED, 'true');
      }

      localStorage.setItem(STORAGE_KEYS.FOLDERS, foldersData);
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, bookmarksData);
      localStorage.setItem(STORAGE_KEYS.NOTEBOOKS, notebooksData);
      localStorage.setItem(STORAGE_KEYS.NOTES, notesData);
      if (trashData) localStorage.setItem(STORAGE_KEYS.TRASH, trashData);
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  }, [cryptoKey]);

  // --- Effects ---
  useEffect(() => {
    if (dataLoaded) {
      saveData(folders, bookmarks, notebooks, notes, trash);
    }
  }, [folders, bookmarks, notebooks, notes, trash, dataLoaded, saveData]);

  // Sync data to auto backup
  useEffect(() => {
    if (dataLoaded && autoBackup.isEnabled) {
      autoBackup.updateData({
        folders,
        bookmarks,
        notebooks,
        notes,
        vaultBookmarks,
        rules: rulesEngine.rules,
      });
    }
  }, [folders, bookmarks, notebooks, notes, vaultBookmarks, rulesEngine.rules, dataLoaded, autoBackup.isEnabled]);

  // Handle URL params for bookmarklet
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addUrl = params.get('add');
    const addTitle = params.get('title');
    const addDesc = params.get('desc');
    const action = params.get('action');

    if (addUrl && isAuthenticated) {
      setNewItemUrl(decodeURIComponent(addUrl));
      setNewItemName(addTitle ? decodeURIComponent(addTitle) : '');
      setNewItemDescription(addDesc ? decodeURIComponent(addDesc) : '');
      setSelectedFolderForAdd(folders[0]?.id || 'default');
      setModalType('ADD_BOOKMARK');
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (action === 'add' && isAuthenticated) {
      openAddModal();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isAuthenticated, folders]);

  // --- Computations ---
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    bookmarks.forEach(b => {
      b.tags?.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [bookmarks]);

  // All note tags for autocomplete
  const allNoteTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(n => {
      n.tags?.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [notes]);

  const filteredBookmarks = useMemo(() => {
    // In vault mode, show vault bookmarks instead of normal bookmarks
    let result = (isVaultMode && isVaultUnlocked) ? vaultBookmarks : bookmarks;

    // Tag Filter
    if (activeTag) {
      result = result.filter(b => b.tags?.includes(activeTag));
    }

    // Search Filter (Global Search - Overrides Folder View)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return result.filter(b => {
        const title = (b.title || '').toLowerCase();
        const url = (b.url || '').toLowerCase();
        const desc = (b.description || '').toLowerCase();
        const tags = (b.tags || []).join(' ').toLowerCase();

        return title.includes(q) || url.includes(q) || desc.includes(q) || tags.includes(q);
      }).sort((a, b) => b.createdAt - a.createdAt);
    }

    // Folder Filter (Only if not searching and not in vault mode)
    if (activeFolderId !== 'ALL' && !(isVaultMode && isVaultUnlocked)) {
      result = result.filter(b => b.folderId === activeFolderId);
    }

    // Sort by newest
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [bookmarks, vaultBookmarks, isVaultMode, isVaultUnlocked, activeFolderId, searchQuery, activeTag]);

  const bookmarkCounts = useMemo(() => {
    // In vault mode, show vault bookmark counts (and 0 for others since vault = entire site in vault mode)
    if (isVaultMode && isVaultUnlocked) {
      const counts: Record<string, number> = { 'ALL': vaultBookmarks.length };
      // Vault bookmarks don't have folder structure, show 0 for all folders
      folders.forEach(f => {
        counts[f.id] = 0;
      });
      return counts;
    }

    // Normal mode - show regular bookmark counts
    const counts: Record<string, number> = { 'ALL': bookmarks.length };
    folders.forEach(f => {
      counts[f.id] = bookmarks.filter(b => b.folderId === f.id).length;
    });
    return counts;
  }, [bookmarks, vaultBookmarks, folders, isVaultMode, isVaultUnlocked]);


  const filteredNotes = useMemo(() => {
    let result = notes;

    // Tag Filter
    if (activeTag) {
      result = result.filter(n => n.tags?.includes(activeTag));
    }

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return result.filter(n => {
        const title = (n.title || '').toLowerCase();
        const content = (n.content || '').toLowerCase();
        const tags = (n.tags || []).join(' ').toLowerCase();
        return title.includes(q) || content.includes(q) || tags.includes(q);
      }).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    }

    // Notebook Filter
    if (activeNotebookId && activeNotebookId !== 'ALL_NOTES') {
      result = result.filter(n => n.notebookId === activeNotebookId);
    }

    return result.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  }, [notes, activeNotebookId, searchQuery, activeTag]);

  // --- Eternal Vault: Sync SnapshotDB with cryptoKey ---
  useEffect(() => {
    SnapshotDB.setCryptoKey(cryptoKey);
  }, [cryptoKey]);

  // --- Eternal Vault: Save snapshot handler ---
  const handleSaveSnapshot = async (bookmark: Bookmark): Promise<void> => {
    try {
      // Check if URL is extractable
      if (!isExtractable(bookmark.url)) {
        showToast('This file type cannot be saved offline', 'error');
        return;
      }

      showToast('Saving page...', 'success');

      // Extract content using Readability.js
      const extracted = await extractContent(bookmark.url);

      if (!extracted.success) {
        showToast(extracted.error || 'Could not extract page content', 'error');
        return;
      }

      // Save to IndexedDB
      const metadata = await SnapshotDB.saveSnapshot(bookmark.id, extracted.content, {
        originalUrl: bookmark.url,
        title: extracted.title,
        byline: extracted.byline,
        siteName: extracted.siteName,
        excerpt: extracted.excerpt,
      });

      // Update bookmark with snapshot metadata
      setBookmarks(prev => prev.map(b =>
        b.id === bookmark.id
          ? {
            ...b,
            snapshot: {
              savedAt: metadata.savedAt,
              size: metadata.compressedSize,
              excerpt: metadata.excerpt,
            }
          }
          : b
      ));

      showToast(
        `Page saved! (${formatBytes(metadata.compressedSize)}, ${metadata.compressionRatio}% compressed)`,
        'success'
      );
    } catch (error) {
      console.error('Failed to save snapshot:', error);
      showToast('Failed to save page. Please try again.', 'error');
    }
  };

  // --- Eternal Vault: View snapshot handler ---
  const handleViewSnapshot = (bookmark: Bookmark) => {
    if (!bookmark.snapshot) {
      showToast('No saved page found', 'error');
      return;
    }
    setViewingSnapshotBookmark(bookmark);
  };

  const noteCounts = useMemo(() => {
    // In vault mode, show 0 for notes (vault mode = entire site focuses on vault bookmarks)
    if (isVaultMode && isVaultUnlocked) {
      const counts: Record<string, number> = { 'ALL_NOTES': 0 };
      notebooks.forEach(nb => {
        counts[nb.id] = 0;
      });
      return counts;
    }

    const counts: Record<string, number> = { 'ALL_NOTES': notes.length };
    notebooks.forEach(nb => {
      counts[nb.id] = notes.filter(n => n.notebookId === nb.id).length;
    });
    return counts;
  }, [notes, notebooks, isVaultMode, isVaultUnlocked]);

  const activeFolderName = useMemo(() => {
    if (activeTag) return `Tag: #${activeTag}`;
    if (searchQuery.trim()) return 'Search Results';
    if (activeNotebookId === 'ALL_NOTES') return 'All Notes';
    if (activeNotebookId) return notebooks.find(n => n.id === activeNotebookId)?.name || 'Unknown Notebook';
    if (activeFolderId === 'ALL') return 'All Bookmarks';
    return folders.find(f => f.id === activeFolderId)?.name || 'Unknown Folder';
  }, [activeTag, searchQuery, activeNotebookId, activeFolderId, folders, notebooks]);

  // --- Handlers ---

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  // Auth Handlers - Using canary-based verification (never stores PIN)
  const handleUnlock = async (inputPin: string) => {
    try {
      // SECURITY: Check for Duress (Panic) PIN first!
      // If user is being forced to unlock, the panic PIN shows empty vault
      if (ghostVault.isDuressEnabled) {
        const isPanicPin = await ghostVault.isDuressPin(inputPin);
        if (isPanicPin) {
          // Duress PIN entered - show completely empty vault
          // This protects user from coercion (border crossing, abusive situations)
          sessionStorage.setItem(STORAGE_KEYS.SESSION, 'true');
          setIsAuthenticated(true);
          setIsDuressMode(true);
          // Clear all visible data - show empty state
          setFolders([{ id: 'default', name: 'General', createdAt: Date.now() }]);
          setBookmarks([]);
          setNotebooks([{ id: 'default-notebook', name: 'General', createdAt: Date.now() }]);
          setNotes([]);
          setTrash([]);
          setVaultBookmarks([]);
          // Don't load any real data
          return true;
        }
      }

      const saltBase64 = localStorage.getItem(STORAGE_KEYS.SALT);
      const encryptedCanary = localStorage.getItem(STORAGE_KEYS.CANARY);

      if (!saltBase64 || !encryptedCanary) {
        return false;
      }

      // Derive key from input PIN
      const salt = base64ToArray(saltBase64);
      const key = await deriveKey(inputPin, salt);

      // Verify PIN by attempting to decrypt the canary
      const isValid = await verifyPinWithCanary(encryptedCanary, key);

      if (isValid) {
        sessionStorage.setItem(STORAGE_KEYS.SESSION, 'true');
        setIsAuthenticated(true);
        setIsDuressMode(false);
        setCryptoKey(key);
        await loadData(key);
        return true;
      }

      return false;
    } catch (e) {
      console.error('Unlock failed:', e);
      return false;
    }
  };

  const handleSetupPin = async (newPin: string, vaultPin?: string) => {
    // SECURITY: Never store the PIN itself!
    // Instead, create an encrypted canary that can only be decrypted with correct PIN

    const salt = generateSalt();
    localStorage.setItem(STORAGE_KEYS.SALT, arrayToBase64(salt));

    const key = await deriveKey(newPin, salt);

    // Create and store encrypted canary (this proves correct PIN without storing it)
    const encryptedCanary = await createVerificationCanary(key);
    localStorage.setItem(STORAGE_KEYS.CANARY, encryptedCanary);

    // Store vault PIN hash if provided (for Ghost Vault)
    if (vaultPin) {
      const vaultSalt = generateSalt();
      const vaultKey = await deriveKey(vaultPin, vaultSalt);
      const vaultCanary = await createVerificationCanary(vaultKey);
      localStorage.setItem('lh_vault_salt', arrayToBase64(vaultSalt));
      localStorage.setItem('lh_vault_canary', vaultCanary);
    }

    setHasPin(true);
    sessionStorage.setItem(STORAGE_KEYS.SESSION, 'true');
    setIsAuthenticated(true);
    setCryptoKey(key);
    localStorage.setItem(STORAGE_KEYS.ENCRYPTED, 'true');

    // Initialize default data
    setFolders([{ id: 'default', name: 'General', createdAt: Date.now() }]);
    setBookmarks([]);
    setDataLoaded(true);
  };

  const handleLock = () => {
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    setIsAuthenticated(false);
    setCryptoKey(null);
    // Clear sensitive data from memory
    setFolders([]);
    setBookmarks([]);
    setDataLoaded(false);
  };

  // Auto-lock timer: Lock app after 5 minutes of inactivity
  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId: number;

    const resetTimer = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        handleLock();
        showToast('Locked due to inactivity', 'success');
      }, AUTO_LOCK_TIMEOUT_MS);
    };

    // Reset timer on user activity
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Start the timer
    resetTimer();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated]);

  // Data Handlers
  const handleAddFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const newFolder: Folder = {
      id: generateId(),
      name: newItemName.trim(),
      parentId: newFolderParentId || null,
      createdAt: Date.now()
    };
    setFolders([...folders, newFolder]);
    setModalType(null);
    setNewItemName('');
    setNewFolderParentId('');
    showToast(`Folder "${newFolder.name}" created`, 'success');
  };

  const handleSaveBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemUrl.trim()) return;

    let title = newItemName.trim();
    if (!title) {
      try {
        title = new URL(newItemUrl).hostname;
      } catch {
        title = "Untitled Bookmark";
      }
    }

    let folderId = selectedFolderForAdd;
    if (!folderId) {
      folderId = activeFolderId === 'ALL' ? folders[0]?.id || 'default' : activeFolderId;
    }

    if (modalType === 'EDIT_BOOKMARK' && editingBookmarkId) {
      // Edit Existing
      const updatedBookmark = {
        id: editingBookmarkId,
        folderId,
        title,
        url: newItemUrl.includes('://') ? newItemUrl : `https://${newItemUrl}`,
        description: newItemDescription.trim(),
        tags: newItemTags,
        createdAt: bookmarks.find(b => b.id === editingBookmarkId)?.createdAt || Date.now()
      };
      setBookmarks(bookmarks.map(b => b.id === editingBookmarkId ? updatedBookmark : b));
      showToast('Bookmark updated', 'success');
    } else {
      // Create New
      let newBookmark: Bookmark = {
        id: generateId(),
        folderId,
        title: title,
        description: newItemDescription.trim(),
        url: newItemUrl.includes('://') ? newItemUrl : `https://${newItemUrl}`,
        tags: newItemTags,
        createdAt: Date.now()
      };

      // AUTO-APPLY RULES to new bookmarks
      if (rulesEngine.enabledRules.length > 0) {
        const { result, matchedRules } = rulesEngine.processBookmark(newBookmark, folders);
        if (matchedRules.length > 0) {
          newBookmark = result;
          matchedRules.forEach(ruleId => rulesEngine.recordMatch(ruleId));
          showToast(`\u2728 ${matchedRules.length} rule(s) applied`, 'success');
        }
      }

      setBookmarks([newBookmark, ...bookmarks]);
      showToast('Bookmark added', 'success');
    }

    // Reset
    setModalType(null);
    setEditingBookmarkId(null);
    setNewItemName('');
    setNewItemUrl('');
    setNewItemDescription('');
    setNewItemTags([]);
  };

  const deleteFolder = (id: string) => {
    const getIdsToDelete = (folderId: string): string[] => {
      const children = folders.filter(f => f.parentId === folderId);
      let ids = [folderId];
      children.forEach(child => {
        ids = [...ids, ...getIdsToDelete(child.id)];
      });
      return ids;
    };

    const idsToDelete = getIdsToDelete(id);
    const folderToDelete = folders.find(f => f.id === id);

    setFolders(folders.filter(f => !idsToDelete.includes(f.id)));
    setBookmarks(bookmarks.filter(b => !idsToDelete.includes(b.folderId)));

    if (idsToDelete.includes(activeFolderId as string)) setActiveFolderId('ALL');
    showToast('Folder deleted', 'success');
  };

  const deleteBookmark = (id: string) => {
    const bookmarkToDelete = bookmarks.find(b => b.id === id);
    if (bookmarkToDelete) {
      const trashedItem: TrashedItem = {
        id: `trash_${Date.now()}_bookmark`,
        type: 'bookmark',
        item: bookmarkToDelete,
        deletedAt: Date.now(),
        autoDeleteAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        originalLocation: bookmarkToDelete.folderId,
      };
      setTrash(prev => [...prev, trashedItem]);
    }
    setBookmarks(bookmarks.filter(b => b.id !== id));
    showToast('Bookmark moved to trash', 'success');
  };

  // Auto-fetch metadata
  const handleUrlBlur = async () => {
    if (!newItemUrl.trim() || newItemName.trim()) return;

    setIsFetchingMeta(true);
    try {
      const metadata = await fetchUrlMetadata(newItemUrl);
      if (metadata.success && metadata.title) {
        setNewItemName(metadata.title);
        if (metadata.description && !newItemDescription) {
          setNewItemDescription(metadata.description);
        }
      }
    } catch (e) {
      console.error('Failed to fetch metadata:', e);
    }
    setIsFetchingMeta(false);
  };

  // Notes/Notebooks Handlers
  const handleAddNotebook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const newNotebook: Notebook = {
      id: generateId(),
      name: newItemName.trim(),
      parentId: null,
      createdAt: Date.now()
    };
    setNotebooks([...notebooks, newNotebook]);
    setModalType(null);
    setNewItemName('');
    showToast(`Notebook "${newNotebook.name}" created`, 'success');
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;

    let notebookId = selectedNotebookForAdd;
    if (!notebookId) {
      notebookId = activeNotebookId && activeNotebookId !== 'ALL_NOTES' ? activeNotebookId : notebooks[0]?.id || 'default-notebook';
    }

    const now = Date.now();
    if (modalType === 'EDIT_NOTE' && editingNoteId) {
      // Edit existing - save previous version to history
      const existingNote = notes.find(n => n.id === editingNoteId);
      if (existingNote) {
        const newVersion: NoteVersion = {
          id: `v_${now}`,
          title: existingNote.title,
          content: existingNote.content,
          timestamp: existingNote.updatedAt || existingNote.createdAt,
          changeType: 'edited'
        };
        // Keep only last 10 versions
        const updatedVersions = [...(existingNote.versions || []), newVersion].slice(-10);

        const updatedNote: Note = {
          id: editingNoteId,
          notebookId,
          title: newNoteTitle.trim(),
          content: newNoteContent.trim(),
          tags: newNoteTags,
          createdAt: existingNote.createdAt,
          updatedAt: now,
          versions: updatedVersions
        };
        setNotes(notes.map(n => n.id === editingNoteId ? updatedNote : n));
        showToast('Note updated', 'success');
      }
    } else {
      // Create new - add initial version
      const initialVersion: NoteVersion = {
        id: `v_${now}`,
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
        timestamp: now,
        changeType: 'created'
      };
      const newNote: Note = {
        id: generateId(),
        notebookId,
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
        tags: newNoteTags,
        createdAt: now,
        updatedAt: now,
        versions: [initialVersion]
      };
      setNotes([newNote, ...notes]);
      showToast('Note added', 'success');
    }

    // Reset
    setModalType(null);
    setEditingNoteId(null);
    setNewNoteTitle('');
    setNewNoteContent('');
    setNewNoteTags([]);
  };

  // Restore a note version
  const restoreNoteVersion = (version: NoteVersion) => {
    if (!historyNote) return;

    // Save current as a version
    const currentVersion: NoteVersion = {
      id: `v_${Date.now()}`,
      title: historyNote.title,
      content: historyNote.content,
      timestamp: Date.now(),
      changeType: 'restored'
    };

    const updatedVersions = [...(historyNote.versions || []), currentVersion].slice(-10);

    const restoredNote: Note = {
      ...historyNote,
      title: version.title,
      content: version.content,
      updatedAt: Date.now(),
      versions: updatedVersions
    };

    setNotes(notes.map(n => n.id === historyNote.id ? restoredNote : n));
    setHistoryNote(null);
    setModalType(null);
    showToast('Version restored', 'success');
  };

  const deleteNotebook = (id: string) => {
    const notebook = notebooks.find(n => n.id === id);
    if (notebook) {
      // Move notebook and its notes to trash
      const notebookNotes = notes.filter(n => n.notebookId === id);
      const trashedItems: TrashedItem[] = [
        {
          id: `trash_${Date.now()}_notebook`,
          type: 'notebook',
          item: notebook,
          deletedAt: Date.now(),
          autoDeleteAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        },
        ...notebookNotes.map((note, i) => ({
          id: `trash_${Date.now()}_note_${i}`,
          type: 'note' as const,
          item: note,
          deletedAt: Date.now(),
          autoDeleteAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        }))
      ];
      setTrash([...trash, ...trashedItems]);
    }
    setNotebooks(notebooks.filter(n => n.id !== id));
    setNotes(notes.filter(n => n.notebookId !== id));
    if (activeNotebookId === id) setActiveNotebookId('ALL_NOTES');
    showToast('Notebook moved to trash', 'success');
  };

  const deleteNote = (id: string) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      const trashedItem: TrashedItem = {
        id: `trash_${Date.now()}_note`,
        type: 'note',
        item: note,
        deletedAt: Date.now(),
        autoDeleteAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        originalLocation: note.notebookId,
      };
      setTrash([...trash, trashedItem]);
    }
    setNotes(notes.filter(n => n.id !== id));
    showToast('Note moved to trash', 'success');
  };

  // Trash handlers
  const restoreFromTrash = (item: TrashedItem) => {
    if (item.type === 'note') {
      setNotes([...notes, item.item as Note]);
    } else if (item.type === 'bookmark') {
      setBookmarks([...bookmarks, item.item as Bookmark]);
    } else if (item.type === 'folder') {
      setFolders([...folders, item.item as Folder]);
    } else if (item.type === 'notebook') {
      setNotebooks([...notebooks, item.item as Notebook]);
    }
    setTrash(trash.filter(t => t.id !== item.id));
    showToast('Item restored', 'success');
  };

  const deleteFromTrashPermanently = (id: string) => {
    setTrash(trash.filter(t => t.id !== id));
    showToast('Permanently deleted', 'success');
  };

  const emptyTrash = () => {
    setTrash([]);
    showToast('Trash emptied', 'success');
  };

  // Export / Import Handlers
  const handleExport = () => {
    try {
      const data = {
        version: 2,
        exportDate: new Date().toISOString(),
        folders,
        bookmarks
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = `linkhaven_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Backup downloaded successfully', 'success');
    } catch (e) {
      showToast('Failed to export data', 'error');
    }
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseImportFile(content, file.name);

        if (parsed.folders.length === 0 && parsed.bookmarks.length === 0) {
          showToast('No bookmarks found in file', 'error');
          return;
        }

        setPendingImportData(parsed);
        setModalType('IMPORT_CONFIRMATION');

      } catch (err) {
        console.error(err);
        showToast('Invalid file. Import failed.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = (merge: boolean = false) => {
    if (pendingImportData) {
      if (merge) {
        // Merge mode: add to existing
        const newFolders = pendingImportData.folders.filter(
          pf => !folders.some(f => f.name === pf.name)
        );
        setFolders([...folders, ...newFolders]);
        setBookmarks([...bookmarks, ...pendingImportData.bookmarks]);
        showToast(`Merged ${pendingImportData.bookmarks.length} bookmarks`, 'success');
      } else {
        // Replace mode
        setFolders(pendingImportData.folders);
        setBookmarks(pendingImportData.bookmarks);
        showToast('Data restored successfully', 'success');
      }
      setPendingImportData(null);
      setModalType(null);
    }
  };

  // Health Check
  const handleCheckHealth = async () => {
    if (isCheckingHealth || bookmarks.length === 0) return;

    setIsCheckingHealth(true);
    setHealthProgress({ current: 0, total: bookmarks.length });

    // Mark all as checking
    setBookmarks(prev => prev.map(b => ({ ...b, linkHealth: 'checking' as const })));

    const urls = bookmarks.map(b => b.url);
    const results = await checkMultipleLinks(urls, 10, (current, total) => {
      setHealthProgress({ current, total });
    });

    // Update bookmarks with results
    setBookmarks(prev => prev.map(b => {
      const result = results.get(b.url);
      return {
        ...b,
        linkHealth: result?.status || 'unknown',
        lastHealthCheck: Date.now()
      };
    }));

    // Count dead links
    const deadCount = Array.from(results.values()).filter(r => r.status === 'dead').length;

    setIsCheckingHealth(false);
    showToast(
      deadCount > 0
        ? `Found ${deadCount} potentially broken link${deadCount > 1 ? 's' : ''}`
        : 'All links appear to be working!',
      deadCount > 0 ? 'error' : 'success'
    );
  };

  // Modal Openers
  const openAddModal = () => {
    setNewItemName('');
    setNewItemUrl('');
    setNewItemDescription('');
    setNewItemTags([]);
    setSelectedFolderForAdd(activeFolderId === 'ALL' ? (folders[0]?.id || '') : activeFolderId);
    setEditingBookmarkId(null);
    setModalType('ADD_BOOKMARK');
  };

  const openEditModal = (bookmark: Bookmark) => {
    setNewItemName(bookmark.title);
    setNewItemUrl(bookmark.url);
    setNewItemDescription(bookmark.description || '');
    setNewItemTags(bookmark.tags || []);
    setSelectedFolderForAdd(bookmark.folderId);
    setEditingBookmarkId(bookmark.id);
    setModalType('EDIT_BOOKMARK');
  };

  const openFolderModal = () => {
    setNewItemName('');
    setNewFolderParentId('');
    setModalType('ADD_FOLDER');
  };

  const openAddNoteModal = () => {
    setNewNoteTitle('');
    setNewNoteContent('');
    setNewNoteTags([]);
    setSelectedNotebookForAdd(activeNotebookId && activeNotebookId !== 'ALL_NOTES' ? activeNotebookId : notebooks[0]?.id || '');
    setEditingNoteId(null);
    setModalType('ADD_NOTE');
  };

  const openEditNoteModal = (note: Note) => {
    setNewNoteTitle(note.title);
    setNewNoteContent(note.content);
    setNewNoteTags(note.tags || []);
    // Fix: If note's notebook doesn't exist, default to first real notebook
    const validNotebookId = notebooks.find(nb => nb.id === note.notebookId)?.id || notebooks[0]?.id || '';
    setSelectedNotebookForAdd(validNotebookId);
    setEditingNoteId(note.id);
    setModalType('EDIT_NOTE');
  };

  const openNotebookModal = () => {
    setNewItemName('');
    setModalType('ADD_NOTEBOOK');
  };

  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
    setSearchQuery('');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only when authenticated and no modal open
      if (!isAuthenticated || modalType) return;

      // Don't trigger shortcuts when typing in input/textarea
      const activeEl = document.activeElement;
      const isTyping = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

      // / for search focus (only when not typing)
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !isTyping) {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }

      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }

      // Cmd/Ctrl + N for new bookmark (only when not typing)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !isTyping) {
        e.preventDefault();
        openAddModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, modalType]);

  // --- Render ---

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-full bg-slate-900 font-sans">
        <LockScreen
          isSetupMode={!hasPin}
          onUnlock={handleUnlock}
          onSetup={handleSetupPin}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-30 transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <Sidebar
          folders={folders}
          activeFolderId={activeFolderId}
          onSelectFolder={(id) => {
            setActiveTag('');
            setActiveNotebookId(null);
            setMainView('bookmarks');
            if (!searchQuery.trim()) {
              setActiveFolderId(id);
            } else {
              setSearchQuery('');
              setActiveFolderId(id);
            }
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          onAddFolder={openFolderModal}
          onDeleteFolder={deleteFolder}
          bookmarkCounts={bookmarkCounts}
          onExport={handleExport}
          onImport={handleImportFile}
          onShowBookmarklet={() => setModalType('BOOKMARKLET')}
          onCheckHealth={handleCheckHealth}
          isCheckingHealth={isCheckingHealth}
          activeTag={activeTag}
          onClearTag={() => setActiveTag('')}
          onShowDeduplication={() => setModalType('DUPLICATE_FINDER')}
          onShowSync={() => setModalType('QR_SYNC')}
          onShowRules={() => setModalType('RULES_BUILDER')}
          onShowPremium={() => setModalType('PREMIUM_UPGRADE')}
          isPremium={true}
          notebooks={notebooks}
          noteCounts={noteCounts}
          activeNotebookId={activeNotebookId}
          onSelectNotebook={(id) => {
            setActiveTag('');
            setActiveFolderId('ALL');
            setActiveNotebookId(id);
            setMainView('notes');
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          onAddNotebook={openNotebookModal}
          onDeleteNotebook={deleteNotebook}
          onShowNotebookSync={() => setModalType('NOTEBOOK_SYNC')}
          mainView={mainView}
          onChangeView={setMainView}
          trashCount={trash.length}
          // Ghost Vault
          isVaultMode={isVaultMode}
          isVaultUnlocked={isVaultUnlocked}
          hasVaultPin={hasVaultPin}
          vaultBookmarkCount={vaultBookmarks.length}
          onToggleVault={() => {
            if (isVaultMode) {
              // Exiting vault mode
              setIsVaultMode(false);
              setIsVaultUnlocked(false);
            } else {
              // Entering vault mode
              if (!hasVaultPin) {
                setVaultPinMode('setup');
              } else {
                setVaultPinMode('unlock');
              }
              setShowVaultPinModal(true);
            }
          }}
          // Auto Backup
          backupEnabled={autoBackup.isEnabled}
          backupDirectoryName={autoBackup.directoryName}
          backupTimeSince={autoBackup.getTimeSinceBackup()}
          backupStatus={autoBackup.backupStatus}
          onShowBackupConfig={() => setShowBackupModal(true)}
        />
      </div>

      {/* Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full">

        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-10 shadow-sm/50">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">{activeFolderName}</h2>
              <span className="text-xs text-slate-500 font-medium">
                {filteredBookmarks.length} {filteredBookmarks.length === 1 ? 'bookmark' : 'bookmarks'}
                {isCheckingHealth && ` • Checking ${healthProgress.current}/${healthProgress.total}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative group flex-1 sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setActiveTag(''); }}
                placeholder="Search... (Press / to focus)"
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all sm:text-sm"
              />
            </div>

            {activeNotebookId ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalType('UNLOCK_NOTE')}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl font-medium transition-all active:scale-95 flex-shrink-0"
                  title="Unlock a shared note"
                >
                  <Lock size={16} />
                  <span className="hidden sm:inline">Unlock</span>
                </button>
                <button
                  onClick={openAddNoteModal}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm shadow-purple-200 transition-all active:scale-95 flex-shrink-0"
                >
                  <FileText size={18} />
                  <span className="hidden sm:inline">Add Note</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </div>
            ) : (
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm shadow-indigo-200 transition-all active:scale-95 flex-shrink-0"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Add URL</span>
                <span className="sm:hidden">Add</span>
              </button>
            )}

            <button
              onClick={handleLock}
              className="p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-xl transition-colors"
              title="Lock App"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {mainView === 'graph' ? (
            <KnowledgeGraph
              bookmarks={bookmarks}
              notes={notes}
              onNodeClick={(node) => {
                if (node.type === 'bookmark') {
                  const bookmarkId = node.id.replace('bookmark_', '');
                  const bookmark = bookmarks.find(b => b.id === bookmarkId);
                  if (bookmark) openEditModal(bookmark);
                } else if (node.type === 'note') {
                  const noteId = node.id.replace('note_', '');
                  const note = notes.find(n => n.id === noteId);
                  if (note) { setViewingNote(note); setModalType('VIEW_NOTE'); }
                }
              }}
            />
          ) : mainView === 'trash' ? (
            <TrashView
              trash={trash}
              onRestore={restoreFromTrash}
              onDeletePermanently={deleteFromTrashPermanently}
              onEmptyTrash={emptyTrash}
            />
          ) : (
            <div className="px-6 py-8">
              <div className="max-w-7xl mx-auto">
                {mainView === 'notes' ? (
                  <NotesGrid
                    notes={filteredNotes}
                    notebooks={notebooks}
                    onDeleteNote={deleteNote}
                    onEditNote={openEditNoteModal}
                    onViewNote={(note) => { setViewingNote(note); setModalType('VIEW_NOTE'); }}
                    onShareNote={(note) => { setViewingNote(note); setModalType('SHARE_NOTE'); }}
                    onTagClick={handleTagClick}
                    searchQuery={searchQuery}
                  />
                ) : (
                  <BookmarkGrid
                    bookmarks={filteredBookmarks}
                    onDeleteBookmark={deleteBookmark}
                    onEditBookmark={openEditModal}
                    onTagClick={handleTagClick}
                    onSaveSnapshot={handleSaveSnapshot}
                    onViewSnapshot={handleViewSnapshot}
                    isVaultMode={isVaultMode && isVaultUnlocked}
                    onMoveToVault={async (bm) => {
                      if (isVaultMode && isVaultUnlocked) {
                        // MOVE OUT of vault - restore to normal bookmarks
                        const newVaultBookmarks = vaultBookmarks.filter(b => b.id !== bm.id);
                        setVaultBookmarks(newVaultBookmarks);
                        // Add back to normal bookmarks
                        setBookmarks([...bookmarks, bm]);
                        // Save updated vault to localStorage
                        try {
                          localStorage.setItem('lh_vault_bookmarks', JSON.stringify(newVaultBookmarks));
                        } catch (e) {
                          console.error('Vault save error:', e);
                        }
                        showToast(`"${bm.title}" restored from Ghost Vault!`, 'success');
                      } else {
                        // MOVE TO vault
                        if (!hasVaultPin) {
                          showToast('Set up Ghost Vault first from the sidebar', 'error');
                          return;
                        }
                        // Move bookmark to vault
                        const newVaultBookmarks = [...vaultBookmarks, bm];
                        setVaultBookmarks(newVaultBookmarks);
                        // Remove from normal bookmarks
                        setBookmarks(bookmarks.filter(b => b.id !== bm.id));
                        // Save vault bookmarks to localStorage
                        try {
                          localStorage.setItem('lh_vault_bookmarks', JSON.stringify(newVaultBookmarks));
                        } catch (e) {
                          console.error('Vault save error:', e);
                        }
                        showToast(`"${bm.title}" moved to Ghost Vault!`, 'success');
                      }
                    }}
                    onShowCitation={(bm) => {
                      setCitationBookmark(bm);
                      setModalType('CITATION_VIEW');
                    }}
                    searchQuery={searchQuery}
                    folders={folders}
                  />
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- Modals --- */}

      {/* Import Confirmation Modal */}
      <Modal
        isOpen={modalType === 'IMPORT_CONFIRMATION'}
        onClose={() => setModalType(null)}
        title="Import Bookmarks"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <UploadCloud size={32} className="text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Import {pendingImportData?.bookmarks.length} bookmarks?</h3>
          <p className="text-sm text-slate-500 mb-6">
            Found <span className="font-semibold text-slate-800">{pendingImportData?.folders.length} folders</span> and
            <span className="font-semibold text-slate-800"> {pendingImportData?.bookmarks.length} bookmarks</span>.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => confirmImport(true)}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
            >
              Merge with existing data
            </button>
            <button
              onClick={() => confirmImport(false)}
              className="w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Replace all data
            </button>
            <button
              onClick={() => setModalType(null)}
              className="w-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Folder Modal */}
      <Modal
        isOpen={modalType === 'ADD_FOLDER'}
        onClose={() => setModalType(null)}
        title="Create New Folder"
      >
        <form onSubmit={handleAddFolder} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Folder Name</label>
            <input
              type="text"
              required
              autoFocus
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g., Design Inspiration"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nest under (Optional)</label>
            <select
              value={newFolderParentId}
              onChange={(e) => setNewFolderParentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white"
            >
              <option value="">No Parent (Root Folder)</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
            >
              Create Folder
            </button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Bookmark Modal */}
      <Modal
        isOpen={modalType === 'ADD_BOOKMARK' || modalType === 'EDIT_BOOKMARK'}
        onClose={() => setModalType(null)}
        title={modalType === 'EDIT_BOOKMARK' ? 'Edit Bookmark' : 'Add New Bookmark'}
      >
        <form onSubmit={handleSaveBookmark} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus={modalType === 'ADD_BOOKMARK'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all pr-10"
                placeholder="https://example.com"
                value={newItemUrl}
                onChange={(e) => setNewItemUrl(e.target.value)}
                onBlur={handleUrlBlur}
              />
              {isFetchingMeta && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader size={16} className="animate-spin text-slate-400" />
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Title will auto-fetch when you tab out
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title (Optional)</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="My Awesome Link"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[60px]"
              placeholder="Add notes for easier searching..."
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
            />
          </div>

          {/* Tags Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
            <TagInput
              tags={newItemTags}
              onChange={setNewItemTags}
              allTags={allTags}
              placeholder="Add tags (e.g., work, research)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Folder</label>
            <select
              value={selectedFolderForAdd}
              onChange={(e) => setSelectedFolderForAdd(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white"
            >
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
            >
              {modalType === 'EDIT_BOOKMARK' ? 'Save Changes' : 'Add Bookmark'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bookmarklet Modal */}
      <Modal
        isOpen={modalType === 'BOOKMARKLET'}
        onClose={() => setModalType(null)}
        title="Quick-Add Bookmarklet"
      >
        <BookmarkletModal
          appUrl={window.location.origin}
          onClose={() => setModalType(null)}
        />
      </Modal>

      {/* Deduplication Modal */}
      <Modal
        isOpen={modalType === 'DEDUPLICATION'}
        onClose={() => setModalType(null)}
        title="Find Duplicates"
      >
        <DeduplicationWizard
          bookmarks={bookmarks}
          onMerge={(keepId, deleteIds) => {
            setBookmarks(prev => prev.filter(b => !deleteIds.includes(b.id)));
            showToast(`Merged ${deleteIds.length} duplicate(s)`, 'success');
          }}
          onClose={() => setModalType(null)}
        />
      </Modal>

      {/* QR Sync Modal */}
      <Modal
        isOpen={modalType === 'QR_SYNC'}
        onClose={() => setModalType(null)}
        title="🔄 Sync Devices"
        size="lg"
      >
        <QRSync
          folders={folders}
          bookmarks={bookmarks}
          notebooks={notebooks}
          notes={notes}
          vaultBookmarks={vaultBookmarks}
          hasVaultPin={hasVaultPin}
          onImport={(importedFolders, importedBookmarks, importedNotebooks, importedNotes, importedVaultBookmarks) => {
            // Merge imported data (skip duplicates by ID)
            const existingFolderIds = new Set(folders.map(f => f.id));
            const existingBookmarkIds = new Set(bookmarks.map(b => b.id));
            const existingNotebookIds = new Set(notebooks.map(n => n.id));
            const existingNoteIds = new Set(notes.map(n => n.id));
            const existingVaultIds = new Set(vaultBookmarks.map(b => b.id));

            const newFolders = importedFolders.filter(f => !existingFolderIds.has(f.id));
            const newBookmarks = importedBookmarks.filter(b => !existingBookmarkIds.has(b.id));
            const newNotebooks = (importedNotebooks || []).filter(n => !existingNotebookIds.has(n.id));
            const newNotes = (importedNotes || []).filter(n => !existingNoteIds.has(n.id));
            const newVaultBookmarks = (importedVaultBookmarks || []).filter(b => !existingVaultIds.has(b.id));

            setFolders([...folders, ...newFolders]);
            setBookmarks([...bookmarks, ...newBookmarks]);
            if (newNotebooks.length > 0) setNotebooks([...notebooks, ...newNotebooks]);
            if (newNotes.length > 0) setNotes([...notes, ...newNotes]);

            // Merge vault bookmarks and save to localStorage
            if (newVaultBookmarks.length > 0) {
              const mergedVault = [...vaultBookmarks, ...newVaultBookmarks];
              setVaultBookmarks(mergedVault);
              localStorage.setItem('lh_vault_bookmarks', JSON.stringify(mergedVault));
            }

            const importedCount = newFolders.length + newBookmarks.length + newNotebooks.length + newNotes.length + newVaultBookmarks.length;
            let msg = `Imported ${newFolders.length} folders, ${newBookmarks.length} bookmarks`;
            if (newNotebooks.length > 0 || newNotes.length > 0) {
              msg += `, ${newNotebooks.length} notebooks, ${newNotes.length} notes`;
            }
            if (newVaultBookmarks.length > 0) {
              msg += `, ${newVaultBookmarks.length} vault bookmarks`;
              if (!hasVaultPin) {
                msg += ' (set up Ghost Vault to access them)';
              }
            }
            showToast(msg, 'success');
          }}
          onClose={() => setModalType(null)}
        />
      </Modal>

      {/* Add Notebook Modal */}
      <Modal
        isOpen={modalType === 'ADD_NOTEBOOK'}
        onClose={() => setModalType(null)}
        title="Create New Notebook"
      >
        <form onSubmit={handleAddNotebook} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notebook Name</label>
            <input
              type="text"
              required
              autoFocus
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
              placeholder="e.g., Work Notes"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors"
            >
              Create Notebook
            </button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Note Modal - Premium Rich Editor */}
      <Modal
        isOpen={modalType === 'ADD_NOTE' || modalType === 'EDIT_NOTE'}
        onClose={() => setModalType(null)}
        title={modalType === 'EDIT_NOTE' ? '✏️ Edit Note' : '📝 Create New Note'}
        size="lg"
      >
        <form onSubmit={handleSaveNote} className="space-y-5">
          {/* Title with premium styling */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Title
            </label>
            <input
              type="text"
              required
              autoFocus
              className="w-full px-4 py-3 text-lg font-medium border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none transition-all bg-slate-50/50"
              placeholder="Give your note a title..."
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
            />
          </div>

          {/* Content Area - Simplified */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Content
            </label>
            <textarea
              id="note-content"
              required
              rows={10}
              className="w-full px-4 py-4 text-base border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none transition-all resize-none leading-relaxed"
              placeholder="Write your note here..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1 text-right">
              {newNoteContent.length} characters
            </p>
          </div>

          {/* Two column layout for Notebook & Tags */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                📓 Notebook
              </label>
              <select
                value={selectedNotebookForAdd}
                onChange={(e) => setSelectedNotebookForAdd(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none transition-all bg-white"
              >
                {notebooks.map(nb => (
                  <option key={nb.id} value={nb.id}>{nb.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                🏷️ Tags
              </label>
              <TagInput
                tags={newNoteTags}
                onChange={setNewNoteTags}
                allTags={allNoteTags}
                placeholder="Add tags..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              💡 Tip: Use tags to organize and find notes quickly
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl shadow-lg shadow-purple-200 transition-all active:scale-95"
              >
                {modalType === 'EDIT_NOTE' ? '✓ Update Note' : '+ Create Note'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Notebook Sync Modal */}
      <Modal
        isOpen={modalType === 'NOTEBOOK_SYNC'}
        onClose={() => setModalType(null)}
        title="🔄 Sync Notebooks"
        size="lg"
      >
        <NotebookSync
          notebooks={notebooks}
          notes={notes}
          onImport={(importedNotebooks, importedNotes) => {
            // Generate new IDs to avoid conflicts
            const idMap = new Map<string, string>();

            const newNotebooks = importedNotebooks.map(nb => {
              const newId = generateId();
              idMap.set(nb.id, newId);
              return { ...nb, id: newId };
            });

            const newNotes = importedNotes.map(n => ({
              ...n,
              id: generateId(),
              notebookId: idMap.get(n.notebookId) || n.notebookId
            }));

            setNotebooks([...notebooks, ...newNotebooks]);
            setNotes([...notes, ...newNotes]);

            showToast(`Imported ${newNotebooks.length} notebooks and ${newNotes.length} notes`, 'success');
          }}
          onClose={() => setModalType(null)}
        />
      </Modal>

      {/* View Note Modal */}
      {viewingNote && modalType === 'VIEW_NOTE' && (
        <Modal
          isOpen={true}
          onClose={() => { setModalType(null); setViewingNote(null); }}
          title={viewingNote.title}
          size="lg"
        >
          <NoteViewer
            note={viewingNote}
            notebooks={notebooks}
            onClose={() => { setModalType(null); setViewingNote(null); }}
            onEdit={() => { openEditNoteModal(viewingNote); }}
          />
        </Modal>
      )}

      {/* Secure Share Note Modal */}
      {viewingNote && modalType === 'SHARE_NOTE' && (
        <Modal
          isOpen={true}
          onClose={() => { setModalType(null); setViewingNote(null); }}
          title="🔒 Secure Share"
          size="md"
        >
          <SecureNoteShare
            note={viewingNote}
            onClose={() => { setModalType(null); setViewingNote(null); }}
          />
        </Modal>
      )}

      {/* Unlock Shared Note Modal */}
      <Modal
        isOpen={modalType === 'UNLOCK_NOTE'}
        onClose={() => setModalType(null)}
        title="🔓 Unlock Shared Note"
        size="md"
      >
        <UnlockNote onClose={() => setModalType(null)} />
      </Modal>

      {/* Version History Modal */}
      {historyNote && (
        <Modal
          isOpen={modalType === 'VERSION_HISTORY'}
          onClose={() => { setModalType(null); setHistoryNote(null); }}
          title="📜 Version History"
          size="lg"
        >
          <VersionHistory
            note={historyNote}
            onRestore={restoreNoteVersion}
            onClose={() => { setModalType(null); setHistoryNote(null); }}
          />
        </Modal>
      )}

      {/* Premium Upgrade Modal */}
      <Modal
        isOpen={modalType === 'PREMIUM_UPGRADE'}
        onClose={() => setModalType(null)}
        title=""
        size="lg"
      >
        <PremiumModal
          currentPlan="free"
          onClose={() => setModalType(null)}
        />
      </Modal>

      {/* Eternal Vault - Snapshot Viewer */}
      {viewingSnapshotBookmark && (
        <SnapshotViewer
          bookmarkId={viewingSnapshotBookmark.id}
          bookmarkUrl={viewingSnapshotBookmark.url}
          onClose={() => setViewingSnapshotBookmark(null)}
        />
      )}

      {/* Premium: Rules Manager */}
      <RulesManager
        isOpen={modalType === 'RULES_BUILDER'}
        onClose={() => setModalType(null)}
        rules={rulesEngine.rules}
        onSaveRule={rulesEngine.saveRule}
        onDeleteRule={rulesEngine.deleteRule}
        onToggleRule={rulesEngine.toggleRule}
        onAddRule={async (name, condition, action) => {
          const rule = await rulesEngine.addRule(name, condition, action);

          // Immediately apply the new rule to ALL existing bookmarks
          let matchCount = 0;
          const updatedBookmarks = bookmarks.map(bm => {
            const { result, matchedRules } = rulesEngine.processBookmark(bm, folders);
            if (matchedRules.includes(rule.id)) {
              matchCount++;
              return result;
            }
            return bm;
          });

          if (matchCount > 0) {
            setBookmarks(updatedBookmarks);
            showToast(`Rule created! Applied to ${matchCount} existing bookmarks.`, 'success');
          } else {
            showToast('Rule created! Will auto-apply to matching bookmarks.', 'success');
          }
          return rule;
        }}
        onApplyAllRules={async () => {
          // Apply rules to all existing bookmarks
          let matchCount = 0;
          const updatedBookmarks = bookmarks.map(bm => {
            const { result, matchedRules } = rulesEngine.processBookmark(bm, folders);
            if (matchedRules.length > 0) {
              matchCount++;
              matchedRules.forEach(ruleId => rulesEngine.recordMatch(ruleId));
              return result;
            }
            return bm;
          });
          if (matchCount > 0) {
            setBookmarks(updatedBookmarks);
          }
          showToast(`Applied rules to ${matchCount} bookmarks!`, 'success');
          return { processed: bookmarks.length, matched: matchCount };
        }}
      />

      {/* Premium: Citation View */}
      {citationBookmark && (
        <CitationView
          isOpen={modalType === 'CITATION_VIEW'}
          onClose={() => {
            setModalType(null);
            setCitationBookmark(null);
          }}
          bookmark={citationBookmark}
          metadata={citations.metadataCache.get(citationBookmark.id) || null}
          isLoading={citations.isLoading(citationBookmark.id)}
          onFetchMetadata={async () => { await citations.fetchMetadata(citationBookmark); }}
        />
      )}

      {/* Premium: Duplicate Finder */}
      <DuplicateFinder
        isOpen={modalType === 'DUPLICATE_FINDER'}
        onClose={() => setModalType(null)}
        bookmarks={bookmarks}
        onDeleteBookmark={deleteBookmark}
      />

      {/* Ghost Vault PIN Modal */}
      <VaultPinModal
        isOpen={showVaultPinModal}
        onClose={() => setShowVaultPinModal(false)}
        mode={vaultPinMode}
        onSetup={async (pin) => {
          // Store vault PIN (same pattern as main PIN)
          const vaultSalt = generateSalt();
          const vaultKey = await deriveKey(pin, vaultSalt);
          const vaultCanary = await createVerificationCanary(vaultKey);
          localStorage.setItem('lh_vault_salt', arrayToBase64(vaultSalt));
          localStorage.setItem('lh_vault_canary', vaultCanary);
          setShowVaultPinModal(false);
          setIsVaultMode(true);
          setIsVaultUnlocked(true);
          showToast('Ghost Vault created! Move bookmarks here for privacy.', 'success');
        }}
        onUnlock={async (pin) => {
          try {
            const saltB64 = localStorage.getItem('lh_vault_salt');
            const canary = localStorage.getItem('lh_vault_canary');
            if (!saltB64 || !canary) return false;
            const salt = base64ToArray(saltB64);
            const key = await deriveKey(pin, salt);
            const verified = await verifyPinWithCanary(canary, key);
            if (verified) {
              setShowVaultPinModal(false);
              setIsVaultMode(true);
              setIsVaultUnlocked(true);

              // Load vault bookmarks from localStorage
              const vaultData = localStorage.getItem('lh_vault_bookmarks');
              if (vaultData) {
                try {
                  setVaultBookmarks(JSON.parse(vaultData));
                } catch {
                  setVaultBookmarks([]);
                }
              }
              showToast('Vault unlocked! Showing hidden bookmarks.', 'success');
              return true;
            }
            return false;
          } catch {
            return false;
          }
        }}
        onSetupDuress={async (pin) => {
          // Set up Duress (Panic) PIN using the ghostVault hook
          await ghostVault.setupDuressPin(pin);
          setShowVaultPinModal(false);
          showToast('Panic PIN set! Use it when forced to unlock - shows empty vault.', 'success');
        }}
      />

      {/* Smart Backup Config Modal */}
      <BackupConfigModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        isSupported={autoBackup.isSupported}
        isEnabled={autoBackup.isEnabled}
        hasDirectoryAccess={autoBackup.hasDirectoryAccess}
        directoryName={autoBackup.directoryName}
        lastBackupTime={autoBackup.lastBackupTime}
        backupStatus={autoBackup.backupStatus}
        errorMessage={autoBackup.errorMessage}
        onSelectFolder={async () => {
          const success = await autoBackup.selectBackupFolder();
          if (success) {
            // Trigger immediate backup with current data
            autoBackup.updateData({
              folders,
              bookmarks,
              notebooks,
              notes,
              vaultBookmarks,
              rules: rulesEngine.rules,
            });
            showToast('Backup folder selected! Auto-saving every 5 minutes.', 'success');
          }
          return success;
        }}
        onBackupNow={async () => {
          // Update data reference before backup
          autoBackup.updateData({
            folders,
            bookmarks,
            notebooks,
            notes,
            vaultBookmarks,
            rules: rulesEngine.rules,
          });
          const success = await autoBackup.backupNow();
          if (success) {
            showToast('Backup saved successfully!', 'success');
          } else {
            showToast('Backup failed. Please try again.', 'error');
          }
          return success;
        }}
        onDisableBackup={() => {
          autoBackup.disableBackup();
          showToast('Auto-backup disabled.', 'success');
        }}
        onRestoreFile={async (file) => {
          const data = await autoBackup.parseBackupFile(file);
          if (data) {
            // Restore all data
            setFolders(data.folders || []);
            setBookmarks(data.bookmarks || []);
            setNotebooks(data.notebooks || []);
            setNotes(data.notes || []);
            if (data.vaultBookmarks?.length > 0) {
              setVaultBookmarks(data.vaultBookmarks);
              localStorage.setItem('lh_vault_bookmarks', JSON.stringify(data.vaultBookmarks));
            }
            showToast(`Restored ${data.bookmarks?.length || 0} bookmarks and ${data.folders?.length || 0} folders!`, 'success');
            return true;
          }
          showToast('Failed to restore backup file.', 'error');
          return false;
        }}
        getTimeSinceBackup={autoBackup.getTimeSinceBackup}
        onExportToImage={async (carrierFile) => {
          try {
            // Prepare backup data
            const backupData = {
              folders,
              bookmarks,
              notebooks,
              notes,
              vaultBookmarks,
              rules: rulesEngine.rules,
              exportedAt: new Date().toISOString(),
            };
            const jsonStr = JSON.stringify(backupData);
            const jsonBytes = new TextEncoder().encode(jsonStr);

            // Encrypt the backup data
            const backupSalt = generateSalt();
            const backupKey = await deriveKey('linkhaven_stego_key', backupSalt);
            const encryptedData = await encrypt(jsonStr, backupKey);
            const encryptedBytes = new TextEncoder().encode(encryptedData);

            // Combine salt + encrypted data
            const fullData = new Uint8Array(backupSalt.length + encryptedBytes.length);
            fullData.set(backupSalt, 0);
            fullData.set(encryptedBytes, backupSalt.length);

            // Load or create carrier image
            let carrierCanvas: HTMLCanvasElement;
            if (carrierFile) {
              carrierCanvas = await loadImageToCanvas(carrierFile);
            } else {
              carrierCanvas = createDefaultCarrierImage(1024, 768);
            }

            // Check capacity
            const capacity = calculateCapacity(carrierCanvas.width, carrierCanvas.height);
            if (fullData.length > capacity) {
              showToast(`Data too large (${Math.round(fullData.length / 1024)}KB) for image (${Math.round(capacity / 1024)}KB capacity)`, 'error');
              return;
            }

            // Hide data in image
            const stegoCanvas = hideDataInImage(carrierCanvas, fullData);
            if (!stegoCanvas) {
              showToast('Failed to create hidden backup', 'error');
              return;
            }

            // Download the stego image
            const filename = `linkhaven_backup_${new Date().toISOString().split('T')[0]}.png`;
            await downloadCanvasAsPng(stegoCanvas, filename);
            showToast('Hidden backup created! Check your Downloads folder.', 'success');
          } catch (err) {
            console.error('Steganography export error:', err);
            showToast('Failed to create hidden backup', 'error');
          }
        }}
        onImportFromImage={async (stegoFile) => {
          try {
            // Load the stego image
            const stegoCanvas = await loadImageToCanvas(stegoFile);

            // Extract hidden data
            const extractedData = extractDataFromImage(stegoCanvas);
            if (!extractedData) {
              showToast('No hidden backup found in this image', 'error');
              return false;
            }

            // Split salt (16 bytes) and encrypted data
            const saltBytes = extractedData.slice(0, 16);
            const encryptedBytes = extractedData.slice(16);
            const encryptedStr = new TextDecoder().decode(encryptedBytes);

            // Decrypt
            const backupKey = await deriveKey('linkhaven_stego_key', saltBytes);
            const decryptedStr = await decrypt(encryptedStr, backupKey);
            const data = JSON.parse(decryptedStr);

            // Restore data
            setFolders(data.folders || []);
            setBookmarks(data.bookmarks || []);
            setNotebooks(data.notebooks || []);
            setNotes(data.notes || []);
            if (data.vaultBookmarks?.length > 0) {
              setVaultBookmarks(data.vaultBookmarks);
              localStorage.setItem('lh_vault_bookmarks', JSON.stringify(data.vaultBookmarks));
            }

            showToast(`Restored ${data.bookmarks?.length || 0} bookmarks from hidden backup!`, 'success');
            return true;
          } catch (err) {
            console.error('Steganography import error:', err);
            showToast('Failed to extract hidden backup', 'error');
            return false;
          }
        }}
      />

    </div>
  );
}

export default App;