import React from 'react';
import { ExternalLink, Trash2, Globe, Edit2, Tag, AlertCircle, CheckCircle, HelpCircle, Loader } from 'lucide-react';
import { Bookmark, Folder } from '../types';

interface BookmarkGridProps {
  bookmarks: Bookmark[];
  folders: Folder[];
  onDeleteBookmark: (id: string) => void;
  onEditBookmark: (bookmark: Bookmark) => void;
  onTagClick?: (tag: string) => void;
  searchQuery: string;
}

const getFaviconUrl = (url: string) => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch (e) {
    return '';
  }
};

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Health indicator component
const HealthBadge: React.FC<{ status?: string }> = ({ status }) => {
  if (!status || status === 'unknown') return null;

  switch (status) {
    case 'alive':
      return (
        <span className="absolute top-2 right-2 p-1 bg-green-100 rounded-full" title="Link is working">
          <CheckCircle size={12} className="text-green-600" />
        </span>
      );
    case 'dead':
      return (
        <span className="absolute top-2 right-2 p-1 bg-red-100 rounded-full animate-pulse" title="Link may be broken">
          <AlertCircle size={12} className="text-red-600" />
        </span>
      );
    case 'checking':
      return (
        <span className="absolute top-2 right-2 p-1 bg-blue-100 rounded-full" title="Checking...">
          <Loader size={12} className="text-blue-600 animate-spin" />
        </span>
      );
    default:
      return null;
  }
};

export const BookmarkGrid: React.FC<BookmarkGridProps> = ({
  bookmarks,
  onDeleteBookmark,
  onEditBookmark,
  onTagClick,
  searchQuery,
  folders
}) => {

  const getFolderName = (folderId: string) => {
    const f = folders.find(fo => fo.id === folderId);
    return f ? f.name : '';
  };

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 mt-20">
        <div className="bg-slate-100 p-6 rounded-full mb-4">
          <Globe size={48} className="text-slate-300" />
        </div>
        <h3 className="text-lg font-medium text-slate-600 mb-1">No bookmarks found</h3>
        <p className="text-sm text-slate-500 max-w-md text-center">
          {searchQuery ? `No results for "${searchQuery}"` : "Add a new bookmark to get started."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          className={`group bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col relative overflow-hidden ${bookmark.linkHealth === 'dead'
              ? 'border-red-200 bg-red-50/30'
              : 'border-slate-200 hover:border-indigo-200'
            }`}
        >
          {/* Health Badge */}
          <HealthBadge status={bookmark.linkHealth} />

          {/* Main Clickable Area - Draggable */}
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 p-5 flex flex-col h-full outline-none focus:bg-slate-50"
            draggable="true"
            title="Drag to tab or click to open"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 p-1.5 flex items-center justify-center flex-shrink-0">
                <img
                  src={getFaviconUrl(bookmark.url)}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>';
                  }}
                />
              </div>
              <ExternalLink size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors mt-2 mr-6" />
            </div>

            <h3 className="font-semibold text-slate-800 leading-snug mb-1 line-clamp-2 group-hover:text-indigo-600 transition-colors">
              {bookmark.title || bookmark.url}
            </h3>

            {/* Tags Display */}
            {bookmark.tags && bookmark.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 mb-2">
                {bookmark.tags.slice(0, 3).map(tag => (
                  <button
                    key={tag}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onTagClick?.(tag);
                    }}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-medium hover:bg-indigo-100 transition-colors"
                  >
                    <Tag size={8} />
                    {tag}
                  </button>
                ))}
                {bookmark.tags.length > 3 && (
                  <span className="text-[10px] text-slate-400 px-1">
                    +{bookmark.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            <div className="mt-auto pt-2 flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium text-slate-500 truncate max-w-[60%] hover:underline">
                {getDomain(bookmark.url)}
              </span>
            </div>
          </a>

          {/* Footer Metadata & Actions (Non-clickable for main link) */}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <span className="px-2 py-0.5 bg-slate-200/60 rounded text-slate-600 font-medium max-w-[100px] truncate">
                {getFolderName(bookmark.folderId)}
              </span>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditBookmark(bookmark);
                }}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                title="Edit Bookmark"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this bookmark?")) onDeleteBookmark(bookmark.id);
                }}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};