import React from 'react';
import { Trash2, RotateCcw, Clock, AlertTriangle, FileText, Link2, Folder, BookOpen } from 'lucide-react';
import { TrashedItem, Bookmark, Note, Folder as FolderType, Notebook } from '../types';

interface TrashViewProps {
    trash: TrashedItem[];
    onRestore: (item: TrashedItem) => void;
    onDeletePermanently: (id: string) => void;
    onEmptyTrash: () => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
    trash,
    onRestore,
    onDeletePermanently,
    onEmptyTrash
}) => {
    const getDaysRemaining = (autoDeleteAt: number) => {
        const now = Date.now();
        const remaining = Math.ceil((autoDeleteAt - now) / (1000 * 60 * 60 * 24));
        return Math.max(0, remaining);
    };

    const getItemTitle = (item: TrashedItem) => {
        if (item.type === 'bookmark') return (item.item as Bookmark).title || (item.item as Bookmark).url;
        if (item.type === 'note') return (item.item as Note).title;
        if (item.type === 'folder') return (item.item as FolderType).name;
        if (item.type === 'notebook') return (item.item as Notebook).name;
        return 'Unknown item';
    };

    const getItemIcon = (type: string) => {
        switch (type) {
            case 'bookmark': return <Link2 size={16} className="text-blue-500" />;
            case 'note': return <FileText size={16} className="text-purple-500" />;
            case 'folder': return <Folder size={16} className="text-amber-500" />;
            case 'notebook': return <BookOpen size={16} className="text-green-500" />;
            default: return <FileText size={16} />;
        }
    };

    const formatDeleteDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    if (trash.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-16 px-8">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <Trash2 size={32} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">Trash is empty</h3>
                    <p className="text-slate-500 max-w-sm">
                        Deleted items will appear here for 7 days before being permanently removed.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center">
                        <Trash2 size={20} className="text-red-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Trash</h2>
                        <p className="text-sm text-slate-500">{trash.length} item{trash.length !== 1 ? 's' : ''} • Auto-deleted after 7 days</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        if (confirm('Permanently delete all items in trash? This cannot be undone.')) {
                            onEmptyTrash();
                        }
                    }}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                    Empty Trash
                </button>
            </div>

            {/* Info Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm text-amber-800 font-medium">Items are automatically deleted after 7 days</p>
                    <p className="text-xs text-amber-700 mt-1">Restore items to recover them, or delete permanently to free up space.</p>
                </div>
            </div>

            {/* Trash Items */}
            <div className="space-y-3">
                {trash.map(item => {
                    const daysRemaining = getDaysRemaining(item.autoDeleteAt);
                    const isUrgent = daysRemaining <= 3;

                    return (
                        <div
                            key={item.id}
                            className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        {getItemIcon(item.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-slate-800 truncate">
                                            {getItemTitle(item)}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                            <span className="capitalize">{item.type}</span>
                                            <span>•</span>
                                            <span>Deleted {formatDeleteDate(item.deletedAt)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Days Remaining */}
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium mr-4 ${isUrgent
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    <Clock size={12} />
                                    {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onRestore(item)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    >
                                        <RotateCcw size={14} />
                                        Restore
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm(`Permanently delete "${getItemTitle(item)}"? This cannot be undone.`)) {
                                                onDeletePermanently(item.id);
                                            }
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
