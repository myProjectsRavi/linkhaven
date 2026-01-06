import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Menu, LogOut, UploadCloud, AlertTriangle, Tag, Download, Loader } from 'lucide-react';
import { Folder, Bookmark, ModalType } from './types';
import { Sidebar } from './components/Sidebar';
import { BookmarkGrid } from './components/BookmarkGrid';
import { Modal } from './components/Modal';
import { LockScreen } from './components/LockScreen';
import { Toast } from './components/Toast';
import { TagInput } from './components/TagInput';
import { BookmarkletModal } from './components/BookmarkletModal';
import { DeduplicationWizard } from './components/DeduplicationWizard';
import { SnapshotCapture } from './components/SnapshotCapture';
import { SnapshotViewer } from './components/SnapshotViewer';
import { QRSync } from './components/QRSync';
import { parseImportFile } from './utils/importers';
import { fetchUrlMetadata } from './utils/metadata';
import { checkMultipleLinks } from './utils/linkChecker';
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

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Storage keys
// Storage keys - NOTE: PIN is NO LONGER stored! Only encrypted canary is stored.
const STORAGE_KEYS = {
  CANARY: 'lh_canary',  // Encrypted verification string (NOT the PIN)
  SALT: 'lh_salt',
  FOLDERS: 'lh_folders',
  BOOKMARKS: 'lh_bookmarks',
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
  const [dataLoaded, setDataLoaded] = useState(false);

  const [activeFolderId, setActiveFolderId] = useState<string | 'ALL'>('ALL');
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

  // Edit State
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);

  // Import State
  const [pendingImportData, setPendingImportData] = useState<{ folders: Folder[], bookmarks: Bookmark[] } | null>(null);

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

      if (isEncrypted && key && foldersData && bookmarksData) {
        try {
          foldersData = await decrypt(foldersData, key);
          bookmarksData = await decrypt(bookmarksData, key);
        } catch (e) {
          console.error('Decryption failed:', e);
          // Data might not be encrypted yet
        }
      }

      const loadedFolders = foldersData ? JSON.parse(foldersData) : [{ id: 'default', name: 'General', createdAt: Date.now() }];
      const loadedBookmarks = bookmarksData ? JSON.parse(bookmarksData) : [];

      // Ensure tags array exists on all bookmarks
      const normalizedBookmarks = loadedBookmarks.map((b: Bookmark) => ({
        ...b,
        tags: b.tags || []
      }));

      setFolders(loadedFolders);
      setBookmarks(normalizedBookmarks);
      setDataLoaded(true);
    } catch (e) {
      console.error('Failed to load data:', e);
      setFolders([{ id: 'default', name: 'General', createdAt: Date.now() }]);
      setBookmarks([]);
      setDataLoaded(true);
    }
  }, []);

  // --- Save Data (with encryption) ---
  const saveData = useCallback(async (foldersToSave: Folder[], bookmarksToSave: Bookmark[]) => {
    try {
      let foldersData = JSON.stringify(foldersToSave);
      let bookmarksData = JSON.stringify(bookmarksToSave);

      if (cryptoKey && isEncryptionSupported()) {
        foldersData = await encrypt(foldersData, cryptoKey);
        bookmarksData = await encrypt(bookmarksData, cryptoKey);
        localStorage.setItem(STORAGE_KEYS.ENCRYPTED, 'true');
      }

      localStorage.setItem(STORAGE_KEYS.FOLDERS, foldersData);
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, bookmarksData);
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  }, [cryptoKey]);

  // --- Effects ---
  useEffect(() => {
    if (dataLoaded) {
      saveData(folders, bookmarks);
    }
  }, [folders, bookmarks, dataLoaded, saveData]);

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

  const filteredBookmarks = useMemo(() => {
    let result = bookmarks;

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

    // Folder Filter (Only if not searching)
    if (activeFolderId !== 'ALL') {
      result = result.filter(b => b.folderId === activeFolderId);
    }

    // Sort by newest
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [bookmarks, activeFolderId, searchQuery, activeTag]);

  const bookmarkCounts = useMemo(() => {
    const counts: Record<string, number> = { 'ALL': bookmarks.length };
    folders.forEach(f => {
      counts[f.id] = bookmarks.filter(b => b.folderId === f.id).length;
    });
    return counts;
  }, [bookmarks, folders]);

  const activeFolderName = useMemo(() => {
    if (activeTag) return `Tag: #${activeTag}`;
    if (searchQuery.trim()) return 'Search Results';
    if (activeFolderId === 'ALL') return 'All Bookmarks';
    return folders.find(f => f.id === activeFolderId)?.name || 'Unknown Folder';
  }, [activeTag, searchQuery, activeFolderId, folders]);

  // --- Handlers ---

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  // Auth Handlers - Using canary-based verification (never stores PIN)
  const handleUnlock = async (inputPin: string) => {
    try {
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

  const handleSetupPin = async (newPin: string) => {
    // SECURITY: Never store the PIN itself!
    // Instead, create an encrypted canary that can only be decrypted with correct PIN

    const salt = generateSalt();
    localStorage.setItem(STORAGE_KEYS.SALT, arrayToBase64(salt));

    const key = await deriveKey(newPin, salt);

    // Create and store encrypted canary (this proves correct PIN without storing it)
    const encryptedCanary = await createVerificationCanary(key);
    localStorage.setItem(STORAGE_KEYS.CANARY, encryptedCanary);

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
      const newBookmark: Bookmark = {
        id: generateId(),
        folderId,
        title: title,
        description: newItemDescription.trim(),
        url: newItemUrl.includes('://') ? newItemUrl : `https://${newItemUrl}`,
        tags: newItemTags,
        createdAt: Date.now()
      };
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
    setBookmarks(bookmarks.filter(b => b.id !== id));
    showToast('Bookmark deleted', 'success');
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

  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
    setSearchQuery('');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only when authenticated and no modal open
      if (!isAuthenticated || modalType) return;

      // / for search focus
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
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

      // Cmd/Ctrl + N for new bookmark
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
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
          onShowDeduplication={() => setModalType('DEDUPLICATION')}
          onShowSync={() => setModalType('QR_SYNC')}
          isPremium={true}
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

            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm shadow-indigo-200 transition-all active:scale-95 flex-shrink-0"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Add URL</span>
              <span className="sm:hidden">Add</span>
            </button>

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
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <BookmarkGrid
              bookmarks={filteredBookmarks}
              onDeleteBookmark={deleteBookmark}
              onEditBookmark={openEditModal}
              onTagClick={handleTagClick}
              searchQuery={searchQuery}
              folders={folders}
            />
          </div>
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
        title="Sync Devices"
      >
        <QRSync
          folders={folders}
          bookmarks={bookmarks}
          onImport={(importedFolders, importedBookmarks) => {
            // Merge imported data (skip duplicates by ID)
            const existingFolderIds = new Set(folders.map(f => f.id));
            const existingBookmarkIds = new Set(bookmarks.map(b => b.id));

            const newFolders = importedFolders.filter(f => !existingFolderIds.has(f.id));
            const newBookmarks = importedBookmarks.filter(b => !existingBookmarkIds.has(b.id));

            setFolders([...folders, ...newFolders]);
            setBookmarks([...bookmarks, ...newBookmarks]);

            showToast(`Imported ${newFolders.length} folders and ${newBookmarks.length} bookmarks`, 'success');
          }}
          onClose={() => setModalType(null)}
        />
      </Modal>

    </div>
  );
}

export default App;