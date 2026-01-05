import React, { useRef } from 'react';
import { Folder as FolderIcon, Layers, Plus, FolderOpen, Trash2, Download, UploadCloud, Database } from 'lucide-react';
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
}) => {
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
    // Reset value so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Recursive component to render folder tree
  const FolderTreeItem = ({ folder, level = 0 }: { folder: Folder, level?: number }) => {
    const childFolders = folders.filter(f => f.parentId === folder.id);
    const hasChildren = childFolders.length > 0;
    const isActive = activeFolderId === folder.id;

    const count = bookmarkCounts[folder.id] || 0;

    return (
      <li className="relative">
        <button
          onClick={() => onSelectFolder(folder.id)}
          style={{ paddingLeft: `${(level * 12) + 12}px` }}
          className={`w-full flex items-center justify-between pr-3 py-2 text-sm rounded-lg transition-colors duration-200 group ${
            isActive
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
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${
            isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'
          }`}>
            {count}
          </span>
        </button>
        
        {/* Delete Action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if(confirm(`Delete folder "${folder.name}"? This will delete all bookmarks and subfolders inside it.`)) {
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
          <p className="text-xs text-slate-500 font-medium">Workspace</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
        
        {/* Main Section */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">Library</h3>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => onSelectFolder('ALL')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors duration-200 group ${
                  activeFolderId === 'ALL'
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

        {/* Data Management Section */}
        <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                <Database size={10} />
                <span>Backup & Restore</span>
            </h3>
            <div className="space-y-1">
                <button 
                    onClick={onExport}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                    <Download size={16} />
                    <span>Export Data</span>
                </button>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                    <UploadCloud size={16} />
                    <span>Import Data</span>
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
        <p>Simple. Fast. Focused.</p>
      </div>
    </div>
  );
};