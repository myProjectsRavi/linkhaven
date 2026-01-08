import React, { useRef, useState } from 'react';
import {
  Folder as FolderIcon, Layers, Plus, FolderOpen, Trash2, Download,
  UploadCloud, Database, Bookmark, Activity, FileUp, Zap,
  Copy, Sparkles, Smartphone, FileText, BookOpen, Network, ChevronDown, ChevronRight, Crown, Ghost, Lock, Unlock, Cloud, Check, Shield, Book, Wifi
} from 'lucide-react';
import { Folder, Notebook, MainView } from '../types';

interface SidebarProps {
  folders: Folder[];
  activeFolderId: string | 'ALL';
  onSelectFolder: (id: string | 'ALL') => void;
  onAddFolder: () => void;
  onDeleteFolder: (id: string) => void;
  bookmarkCounts: Record<string, number>;
  onExport: () => void;
  onImport: (file: File) => void;
  onShowBookmarklet: () => void;
  onCheckHealth: () => void;
  isCheckingHealth?: boolean;
  activeTag?: string;
  onClearTag?: () => void;
  // Premium features
  onShowDeduplication?: () => void;
  onShowSync?: () => void;
  onShowPremium?: () => void;
  onShowRules?: () => void;
  isPremium?: boolean;
  // Notes features
  notebooks?: Notebook[];
  noteCounts?: Record<string, number>;
  activeNotebookId?: string | 'ALL_NOTES' | null;
  onSelectNotebook?: (id: string | 'ALL_NOTES') => void;
  onAddNotebook?: () => void;
  onDeleteNotebook?: (id: string) => void;
  onShowNotebookSync?: () => void;
  mainView?: MainView;
  onChangeView?: (view: MainView) => void;
  trashCount?: number;
  // Ghost Vault
  isVaultMode?: boolean;
  isVaultUnlocked?: boolean;
  hasVaultPin?: boolean;
  hasPanicPin?: boolean;
  vaultBookmarkCount?: number;
  onToggleVault?: () => void;
  onSetupPanicPin?: () => void;
  // Auto Backup
  backupEnabled?: boolean;
  backupDirectoryName?: string;
  backupTimeSince?: string;
  backupStatus?: 'idle' | 'saving' | 'error' | 'success';
  onShowBackupConfig?: () => void;
  // New Privacy Features
  onShowPrivacyAudit?: () => void;
  onShowExportAsBook?: () => void;
  onShowP2PSync?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  folders,
  activeFolderId,
  onSelectFolder,
  onAddFolder,
  onDeleteFolder,
  bookmarkCounts,
  onExport,
  onImport,
  onShowBookmarklet,
  onCheckHealth,
  isCheckingHealth = false,
  activeTag,
  onClearTag,
  // Premium
  onShowDeduplication,
  onShowSync,
  onShowPremium,
  onShowRules,
  isPremium = true,
  // Notes
  notebooks = [],
  noteCounts = {},
  activeNotebookId,
  onSelectNotebook,
  onAddNotebook,
  onDeleteNotebook,
  onShowNotebookSync,
  mainView = 'bookmarks',
  onChangeView,
  trashCount = 0,
  // Ghost Vault
  isVaultMode = false,
  isVaultUnlocked = false,
  hasVaultPin = false,
  hasPanicPin = false,
  vaultBookmarkCount = 0,
  onToggleVault,
  onSetupPanicPin,
  // Auto Backup
  backupEnabled = false,
  backupDirectoryName = '',
  backupTimeSince = '',
  backupStatus = 'idle',
  onShowBackupConfig,
  // New Privacy Features
  onShowPrivacyAudit,
  onShowExportAsBook,
  onShowP2PSync,
}) => {

  const fileInputRef = useRef<HTMLInputElement>(null);
  const browserImportRef = useRef<HTMLInputElement>(null);

  // Collapsible sections - collapsed by default for cleaner UI
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [notebooksOpen, setNotebooksOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
    // Reset value so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBrowserImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
    if (browserImportRef.current) browserImportRef.current.value = '';
  };

  // Track which parent folders are expanded (subfolders visible)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolderExpansion = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Recursive component to render folder tree
  const FolderTreeItem = ({ folder, level = 0 }: { folder: Folder, level?: number }) => {
    const childFolders = folders.filter(f => f.parentId === folder.id);
    const hasChildren = childFolders.length > 0;
    const isActive = activeFolderId === folder.id;
    const isExpanded = expandedFolders.has(folder.id);

    const count = bookmarkCounts[folder.id] || 0;

    return (
      <li className="relative group">
        <div className="flex items-center">
          {/* Expand/Collapse toggle for folders with children */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolderExpansion(folder.id);
              }}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
              style={{ marginLeft: `${level * 12}px` }}
            >
              {isExpanded ? (
                <ChevronDown size={12} className="text-slate-500" />
              ) : (
                <ChevronRight size={12} className="text-slate-500" />
              )}
            </button>
          )}

          <button
            onClick={() => onSelectFolder(folder.id)}
            style={{ paddingLeft: hasChildren ? '4px' : `${(level * 12) + 16}px` }}
            className={`flex-1 flex items-center justify-between pr-3 py-2 text-sm rounded-lg transition-colors duration-200 ${isActive
              ? 'bg-indigo-500/10 text-indigo-400 font-medium'
              : 'hover:bg-slate-800/50 hover:text-white'
              }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {isActive ? (
                <FolderOpen size={16} className="text-indigo-400 flex-shrink-0" />
              ) : (
                <FolderIcon size={16} className="text-slate-500 group-hover:text-slate-400 flex-shrink-0" />
              )}
              <span className="truncate">{folder.name}</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'
              }`}>
              {count}
            </span>
          </button>
        </div>

        {/* Delete Action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete folder "${folder.name}"? This will delete all bookmarks and subfolders inside it.`)) {
              onDeleteFolder(folder.id);
            }
          }}
          className="absolute right-1 top-2 p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 shadow-sm rounded z-10"
          title="Delete Folder"
        >
          <Trash2 size={12} />
        </button>

        {/* Only show children if expanded */}
        {hasChildren && isExpanded && (
          <ul className="mt-0.5 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
            {childFolders.map(child => (
              <FolderTreeItem key={child.id} folder={child} level={level + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  const rootFolders = folders.filter(f => !f.parentId);

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-300 border-r border-slate-800 w-64 flex-shrink-0 transition-all duration-300">
      {/* App Header */}
      <div className="p-6 flex items-center gap-3 text-white">
        <div className="bg-indigo-500 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
          <Layers size={24} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight">LinkHaven</h1>
          <p className="text-xs text-slate-500 font-medium">Privacy-First</p>
        </div>
      </div>

      {/* Active Tag Filter */}
      {activeTag && (
        <div className="mx-4 mb-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg flex items-center justify-between">
          <span className="text-xs text-indigo-300 flex items-center gap-1">
            <Bookmark size={12} />
            Tag: <strong>{activeTag}</strong>
          </span>
          <button
            onClick={onClearTag}
            className="text-indigo-400 hover:text-white text-xs"
          >
            Clear
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">

        {/* Main Section */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">Library</h3>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => { onSelectFolder('ALL'); onChangeView?.('bookmarks'); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors duration-200 group ${mainView === 'bookmarks' && activeFolderId === 'ALL'
                  ? 'bg-indigo-500/10 text-indigo-400 font-medium'
                  : 'hover:bg-slate-800/50 hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Layers size={18} className={mainView === 'bookmarks' && activeFolderId === 'ALL' ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'} />
                  <span>All Bookmarks</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${mainView === 'bookmarks' && activeFolderId === 'ALL' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}>
                  {bookmarkCounts['ALL'] || 0}
                </span>
              </button>
            </li>
            {/* All Notes */}
            {onSelectNotebook && (
              <li>
                <button
                  onClick={() => { onSelectNotebook('ALL_NOTES'); onChangeView?.('notes'); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors duration-200 group ${mainView === 'notes'
                    ? 'bg-purple-500/10 text-purple-400 font-medium'
                    : 'hover:bg-slate-800/50 hover:text-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText size={18} className={mainView === 'notes' ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-400'} />
                    <span>All Notes</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${mainView === 'notes' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-500'}`}>
                    {noteCounts['ALL_NOTES'] || 0}
                  </span>
                </button>
              </li>
            )}
            {/* Knowledge Graph */}
            {onChangeView && (
              <li>
                <button
                  onClick={() => onChangeView('graph')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors duration-200 group ${mainView === 'graph'
                    ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                    : 'hover:bg-slate-800/50 hover:text-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Network size={18} className={mainView === 'graph' ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'} />
                    <span>Knowledge Graph</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">PRO</span>
                </button>
              </li>
            )}
            {/* Trash */}
            {onChangeView && (
              <li>
                <button
                  onClick={() => onChangeView('trash')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors duration-200 group ${mainView === 'trash'
                    ? 'bg-red-500/10 text-red-400 font-medium'
                    : 'hover:bg-slate-800/50 hover:text-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Trash2 size={18} className={mainView === 'trash' ? 'text-red-400' : 'text-slate-500 group-hover:text-slate-400'} />
                    <span>Trash</span>
                  </div>
                  {trashCount > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${mainView === 'trash' ? 'bg-red-500/20 text-red-300' : 'bg-slate-800 text-slate-500'}`}>
                      {trashCount}
                    </span>
                  )}
                </button>
              </li>
            )}
          </ul>
        </div>

        {/* Folders Section - Collapsible */}
        <div>
          <button
            onClick={() => setFoldersOpen(!foldersOpen)}
            className="w-full flex items-center justify-between mb-2 px-2 py-1 hover:bg-slate-800/50 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2">
              {foldersOpen ? (
                <ChevronDown size={14} className="text-slate-500" />
              ) : (
                <ChevronRight size={14} className="text-slate-500" />
              )}
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Folders</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">{rootFolders.length}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onAddFolder(); }}
              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100"
              title="Add New Folder"
            >
              <Plus size={14} />
            </button>
          </button>

          {foldersOpen && (
            <ul className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
              {rootFolders.length === 0 && (
                <li className="px-3 py-4 text-center border-2 border-dashed border-slate-800 rounded-lg">
                  <p className="text-xs text-slate-500">No folders yet</p>
                </li>
              )}
              {rootFolders.map((folder) => (
                <FolderTreeItem key={folder.id} folder={folder} />
              ))}
            </ul>
          )}
        </div>

        {/* Notebooks Section - Collapsible */}
        {onSelectNotebook && (
          <div>
            <button
              onClick={() => setNotebooksOpen(!notebooksOpen)}
              className="w-full flex items-center justify-between mb-2 px-2 py-1 hover:bg-slate-800/50 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-2">
                {notebooksOpen ? (
                  <ChevronDown size={14} className="text-slate-500" />
                ) : (
                  <ChevronRight size={14} className="text-slate-500" />
                )}
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notebooks</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">{notebooks.filter(n => !n.parentId).length}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onAddNotebook?.(); }}
                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-purple-400 transition-colors opacity-0 group-hover:opacity-100"
                title="Add New Notebook"
              >
                <Plus size={14} />
              </button>
            </button>

            {notebooksOpen && (
              <ul className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                {notebooks.filter(n => !n.parentId).length === 0 && (
                  <li className="px-3 py-4 text-center border-2 border-dashed border-slate-800 rounded-lg">
                    <p className="text-xs text-slate-500">No notebooks yet</p>
                  </li>
                )}
                {notebooks.filter(n => !n.parentId).map((notebook) => {
                  const isActive = activeNotebookId === notebook.id;
                  const count = noteCounts[notebook.id] || 0;
                  return (
                    <li key={notebook.id} className="relative group">
                      <button
                        onClick={() => onSelectNotebook(notebook.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors duration-200 ${isActive
                          ? 'bg-purple-500/10 text-purple-400 font-medium'
                          : 'hover:bg-slate-800/50 hover:text-white'
                          }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <BookOpen size={16} className={isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-400'} />
                          <span className="truncate">{notebook.name}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${isActive ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-500'
                          }`}>
                          {count}
                        </span>
                      </button>
                      {/* Delete Action */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete notebook "${notebook.name}"? This will delete all notes inside it.`)) {
                            onDeleteNotebook?.(notebook.id);
                          }
                        }}
                        className="absolute right-1 top-2 p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 shadow-sm rounded z-10"
                        title="Delete Notebook"
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
            <Zap size={10} />
            <span>Quick Actions</span>
          </h3>
          <div className="space-y-1">
            <button
              onClick={onShowBookmarklet}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
            >
              <Bookmark size={16} />
              <span>Get Bookmarklet</span>
            </button>
            <button
              onClick={onCheckHealth}
              disabled={isCheckingHealth}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors disabled:opacity-50"
            >
              <Activity size={16} className={isCheckingHealth ? 'animate-pulse' : ''} />
              <span>{isCheckingHealth ? 'Checking...' : 'Check Dead Links'}</span>
            </button>
          </div>
        </div>

        {/* Premium Tools Section */}
        {isPremium && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
              <Sparkles size={10} className="text-amber-400" />
              <span>Premium Tools</span>
            </h3>
            <div className="space-y-1">
              {onShowDeduplication && (
                <button
                  onClick={onShowDeduplication}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  <Copy size={16} />
                  <span>Find Duplicates</span>
                </button>
              )}
              {onShowSync && (
                <button
                  onClick={onShowSync}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  <Smartphone size={16} />
                  <span>Sync Devices</span>
                </button>
              )}
              {onShowRules && (
                <button
                  onClick={onShowRules}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  <Zap size={16} />
                  <span>Smart Rules</span>
                </button>
              )}
              {onShowPrivacyAudit && (
                <button
                  onClick={onShowPrivacyAudit}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                >
                  <Shield size={16} />
                  <span>Privacy Audit</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 ml-auto">EU</span>
                </button>
              )}
              {onShowExportAsBook && (
                <button
                  onClick={onShowExportAsBook}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                >
                  <Book size={16} />
                  <span>Export as Book</span>
                </button>
              )}
              {onShowP2PSync && (
                <button
                  onClick={onShowP2PSync}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                >
                  <Wifi size={16} />
                  <span>P2P Sync</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 ml-auto">NEW</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Ghost Vault Section */}
        {onToggleVault && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
              <Ghost size={10} className="text-purple-400" />
              <span>Ghost Vault</span>
            </h3>
            <button
              onClick={onToggleVault}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-all duration-200 ${isVaultMode
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'hover:bg-slate-800/50 hover:text-white text-slate-400'
                }`}
            >
              <div className="flex items-center gap-3">
                {isVaultMode && isVaultUnlocked ? (
                  <Unlock size={16} className="text-purple-400" />
                ) : (
                  <Lock size={16} className={isVaultMode ? 'text-purple-400' : 'text-slate-500'} />
                )}
                <span>{isVaultMode ? 'Vault Mode Active' : 'Enable Vault Mode'}</span>
              </div>
              {isVaultMode && isVaultUnlocked && vaultBookmarkCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300">
                  {vaultBookmarkCount}
                </span>
              )}
              {!hasVaultPin && !isVaultMode && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Setup</span>
              )}
            </button>
            {isVaultMode && (
              <p className="text-xs text-purple-400/60 mt-1 px-3">
                👻 Hidden bookmarks are visible
              </p>
            )}

            {/* Panic PIN Setup - Only show after vault is set up */}
            {hasVaultPin && onSetupPanicPin && (
              <button
                onClick={onSetupPanicPin}
                className={`w-full mt-2 flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-200 ${hasPanicPin
                  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                  : 'text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 border border-dashed border-slate-600'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-orange-400">🚨</span>
                  <span>{hasPanicPin ? 'Panic PIN Active' : 'Setup Panic PIN'}</span>
                </div>
                {!hasPanicPin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">PRO</span>
                )}
              </button>
            )}
          </div>
        )}

        {/* Data Management Section */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
            <Database size={10} />
            <span>Data</span>
          </h3>
          <div className="space-y-1">
            {/* Smart Backup Status */}
            {onShowBackupConfig && (
              <button
                onClick={onShowBackupConfig}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-all duration-200 ${backupEnabled
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Cloud size={16} className={backupEnabled ? 'text-emerald-400' : 'text-slate-500'} />
                  <span>Smart Backup</span>
                </div>
                {backupEnabled ? (
                  <div className="flex items-center gap-1.5">
                    {backupStatus === 'saving' ? (
                      <span className="text-[10px] text-emerald-400 animate-pulse">Saving...</span>
                    ) : (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-[10px] text-emerald-400">{backupTimeSince}</span>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Setup</span>
                )}
              </button>
            )}
            <button
              onClick={() => browserImportRef.current?.click()}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
            >
              <FileUp size={16} />
              <span>Import from Browser</span>
            </button>
            <input
              type="file"
              ref={browserImportRef}
              onChange={handleBrowserImport}
              accept=".html,.htm"
              className="hidden"
            />

            <button
              onClick={onExport}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
            >
              <Download size={16} />
              <span>Export Backup</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
            >
              <UploadCloud size={16} />
              <span>Restore Backup</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-600 text-center">
        <p>100% Offline • Encrypted</p>
      </div>
    </div >
  );
};