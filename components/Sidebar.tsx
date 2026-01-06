import React, { useRef } from 'react';
import {
  Folder as FolderIcon, Layers, Plus, FolderOpen, Trash2, Download,
  UploadCloud, Database, Bookmark, Activity, FileUp, Zap,
  Copy, Sparkles, Smartphone
} from 'lucide-react';
import { Folder } from '../types';

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
  isPremium?: boolean;
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
  isPremium = true, // Default to true for now (will be gated later)
}) => {

  const fileInputRef = useRef<HTMLInputElement>(null);
  const browserImportRef = useRef<HTMLInputElement>(null);

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

  // Recursive component to render folder tree
  const FolderTreeItem = ({ folder, level = 0 }: { folder: Folder, level?: number }) => {
    const childFolders = folders.filter(f => f.parentId === folder.id);
    const hasChildren = childFolders.length > 0;
    const isActive = activeFolderId === folder.id;

    const count = bookmarkCounts[folder.id] || 0;

    return (
      <li className="relative group">
        <button
          onClick={() => onSelectFolder(folder.id)}
          style={{ paddingLeft: `${(level * 12) + 12}px` }}
          className={`w-full flex items-center justify-between pr-3 py-2 text-sm rounded-lg transition-colors duration-200 ${isActive
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

        {hasChildren && (
          <ul className="mt-0.5 space-y-0.5">
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
                onClick={() => onSelectFolder('ALL')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors duration-200 group ${activeFolderId === 'ALL'
                  ? 'bg-indigo-500/10 text-indigo-400 font-medium'
                  : 'hover:bg-slate-800/50 hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Layers size={18} className={activeFolderId === 'ALL' ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'} />
                  <span>All Bookmarks</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeFolderId === 'ALL' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}>
                  {bookmarkCounts['ALL'] || 0}
                </span>
              </button>
            </li>
          </ul>
        </div>

        {/* Folders Section */}
        <div>
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Folders</h3>
            <button
              onClick={onAddFolder}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-400 transition-colors"
              title="Add New Folder"
            >
              <Plus size={14} />
            </button>
          </div>

          <ul className="space-y-0.5">
            {rootFolders.length === 0 && (
              <li className="px-3 py-4 text-center border-2 border-dashed border-slate-800 rounded-lg">
                <p className="text-xs text-slate-500">No folders yet</p>
              </li>
            )}
            {rootFolders.map((folder) => (
              <FolderTreeItem key={folder.id} folder={folder} />
            ))}
          </ul>
        </div>

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
            </div>
          </div>
        )}

        {/* Data Management Section */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
            <Database size={10} />
            <span>Data</span>
          </h3>
          <div className="space-y-1">
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