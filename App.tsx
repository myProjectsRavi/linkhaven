import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Menu, LogOut, UploadCloud, AlertTriangle } from 'lucide-react';
import { Folder, Bookmark, ModalType } from './types';
import { Sidebar } from './components/Sidebar';
import { BookmarkGrid } from './components/BookmarkGrid';
import { Modal } from './components/Modal';
import { LockScreen } from './components/LockScreen';
import { Toast } from './components/Toast';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

function App() {
  // --- Auth State ---
  const [hasPin, setHasPin] = useState<boolean>(!!localStorage.getItem('lh_pin'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!sessionStorage.getItem('lh_session'));
  
  // --- Data State ---
  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem('lh_folders');
    return saved ? JSON.parse(saved) : [{ id: 'default', name: 'General', createdAt: Date.now() }];
  });

  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    const saved = localStorage.getItem('lh_bookmarks');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeFolderId, setActiveFolderId] = useState<string | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalType, setModalType] = useState<ModalType>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemUrl, setNewItemUrl] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [selectedFolderForAdd, setSelectedFolderForAdd] = useState<string>('');
  const [newFolderParentId, setNewFolderParentId] = useState<string>('');
  
  // Edit State
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);

  // Import State
  const [pendingImportData, setPendingImportData] = useState<{folders: Folder[], bookmarks: Bookmark[]} | null>(null);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('lh_folders', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('lh_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  // --- Computations ---
  const filteredBookmarks = useMemo(() => {
    let result = bookmarks;

    // Search Filter (Global Search - Overrides Folder View)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return result.filter(b => {
        const title = (b.title || '').toLowerCase();
        const url = (b.url || '').toLowerCase();
        const desc = (b.description || '').toLowerCase();
        
        return title.includes(q) || url.includes(q) || desc.includes(q);
      }).sort((a, b) => b.createdAt - a.createdAt);
    }

    // Folder Filter (Only if not searching)
    if (activeFolderId !== 'ALL') {
      result = result.filter(b => b.folderId === activeFolderId);
    }

    // Sort by newest
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [bookmarks, activeFolderId, searchQuery]);

  const bookmarkCounts = useMemo(() => {
    const counts: Record<string, number> = { 'ALL': bookmarks.length };
    folders.forEach(f => {
      counts[f.id] = bookmarks.filter(b => b.folderId === f.id).length;
    });
    return counts;
  }, [bookmarks, folders]);

  const activeFolderName = searchQuery.trim() 
    ? 'Search Results' 
    : (activeFolderId === 'ALL' 
        ? 'All Bookmarks' 
        : folders.find(f => f.id === activeFolderId)?.name || 'Unknown Folder');

  // --- Handlers ---

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };
  
  // Auth Handlers
  const handleUnlock = (inputPin: string) => {
    const storedPin = localStorage.getItem('lh_pin');
    if (inputPin === storedPin) {
      sessionStorage.setItem('lh_session', 'true');
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const handleSetupPin = (newPin: string) => {
    localStorage.setItem('lh_pin', newPin);
    setHasPin(true);
    sessionStorage.setItem('lh_session', 'true');
    setIsAuthenticated(true);
  };

  const handleLock = () => {
    sessionStorage.removeItem('lh_session');
    setIsAuthenticated(false);
  };

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
        setBookmarks(bookmarks.map(b => b.id === editingBookmarkId ? {
            ...b,
            title,
            url: newItemUrl.includes('://') ? newItemUrl : `https://${newItemUrl}`,
            description: newItemDescription.trim(),
            folderId
        } : b));
        showToast('Bookmark updated', 'success');
    } else {
        // Create New
        const newBookmark: Bookmark = {
          id: generateId(),
          folderId,
          title: title,
          description: newItemDescription.trim(),
          url: newItemUrl.includes('://') ? newItemUrl : `https://${newItemUrl}`,
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
    
    setFolders(folders.filter(f => !idsToDelete.includes(f.id)));
    setBookmarks(bookmarks.filter(b => !idsToDelete.includes(b.folderId)));
    
    if (idsToDelete.includes(activeFolderId as string)) setActiveFolderId('ALL');
    showToast('Folder deleted', 'success');
  };

  const deleteBookmark = (id: string) => {
    setBookmarks(bookmarks.filter(b => b.id !== id));
    showToast('Bookmark deleted', 'success');
  };

  // Export / Import Handlers
  const handleExport = () => {
    try {
        const data = {
            version: 1,
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
            const json = JSON.parse(e.target?.result as string);
            
            // Basic validation
            if (!Array.isArray(json.folders) || !Array.isArray(json.bookmarks)) {
                throw new Error("Invalid backup file format");
            }
            
            setPendingImportData({
                folders: json.folders,
                bookmarks: json.bookmarks
            });
            setModalType('IMPORT_CONFIRMATION');

        } catch (err) {
            console.error(err);
            showToast('Invalid backup file. Import failed.', 'error');
        }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
      if (pendingImportData) {
          setFolders(pendingImportData.folders);
          setBookmarks(pendingImportData.bookmarks);
          setPendingImportData(null);
          setModalType(null);
          showToast('Data restored successfully', 'success');
      }
  };

  // Modal Openers
  const openAddModal = () => {
    setNewItemName('');
    setNewItemUrl('');
    setNewItemDescription('');
    setSelectedFolderForAdd(activeFolderId === 'ALL' ? (folders[0]?.id || '') : activeFolderId);
    setEditingBookmarkId(null);
    setModalType('ADD_BOOKMARK');
  };

  const openEditModal = (bookmark: Bookmark) => {
    setNewItemName(bookmark.title);
    setNewItemUrl(bookmark.url);
    setNewItemDescription(bookmark.description || '');
    setSelectedFolderForAdd(bookmark.folderId);
    setEditingBookmarkId(bookmark.id);
    setModalType('EDIT_BOOKMARK');
  };

  const openFolderModal = () => {
    setNewItemName('');
    setNewFolderParentId(''); 
    setModalType('ADD_FOLDER');
  };

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
                if (!searchQuery.trim()) {
                    setActiveFolderId(id); 
                } else {
                    // Clear search if user clicks a folder
                    setSearchQuery('');
                    setActiveFolderId(id);
                }
                if(window.innerWidth < 768) setIsSidebarOpen(false); 
            }}
            onAddFolder={openFolderModal}
            onDeleteFolder={deleteFolder}
            bookmarkCounts={bookmarkCounts}
            onExport={handleExport}
            onImport={handleImportFile}
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
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description, title, url..."
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
        title="Restore Backup"
      >
        <div className="text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <UploadCloud size={32} className="text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Overwrite existing data?</h3>
            <p className="text-sm text-slate-500 mb-6">
                This will replace your current collection with the backup, which contains 
                <span className="font-semibold text-slate-800"> {pendingImportData?.folders.length} folders</span> and 
                <span className="font-semibold text-slate-800"> {pendingImportData?.bookmarks.length} bookmarks</span>.
                <br /><br />
                This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
                <button
                    onClick={() => setModalType(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={confirmImport}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                >
                    Restore Data
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
            <input
              type="text"
              required
              autoFocus={modalType === 'ADD_BOOKMARK'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="https://example.com"
              value={newItemUrl}
              onChange={(e) => setNewItemUrl(e.target.value)}
            />
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
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[80px]"
              placeholder="Add keywords, notes, or context for easier searching..."
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
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

    </div>
  );
}

export default App;