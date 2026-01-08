import React, { useState } from 'react';
import { Book, Download, Loader, FileText, Folder as FolderIcon } from 'lucide-react';
import { Folder, Bookmark } from '../types';
import { exportFolderAsBook, downloadBook, BookConfig } from '../utils/eternalLibrary';

interface ExportAsBookModalProps {
    folders: Folder[];
    bookmarks: Bookmark[];
    defaultFolderId?: string;
    onClose: () => void;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
}

export const ExportAsBookModal: React.FC<ExportAsBookModalProps> = ({
    folders,
    bookmarks,
    defaultFolderId,
    onClose,
    onSuccess,
    onError
}) => {
    const [selectedFolderId, setSelectedFolderId] = useState(defaultFolderId || folders[0]?.id || '');
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [format, setFormat] = useState<'epub' | 'pdf'>('epub');
    const [includeSnapshots, setIncludeSnapshots] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const selectedFolder = folders.find(f => f.id === selectedFolderId);
    const bookmarkCount = bookmarks.filter(b => b.folderId === selectedFolderId).length;

    const handleExport = async () => {
        if (!selectedFolderId) {
            onError('Please select a folder');
            return;
        }

        if (bookmarkCount === 0) {
            onError('Selected folder has no bookmarks');
            return;
        }

        setIsExporting(true);

        try {
            const config: BookConfig = {
                title: title || selectedFolder?.name || 'My Collection',
                author: author || 'LinkHaven User',
                includeSnapshots,
                format
            };

            const blob = await exportFolderAsBook(selectedFolderId, folders, bookmarks, config);
            downloadBook(blob, config.title.replace(/\s+/g, '_'), format);

            onSuccess(`Exported ${bookmarkCount} bookmarks as ${format.toUpperCase()}`);
            onClose();
        } catch (error) {
            console.error('Export failed:', error);
            onError('Failed to export. Please try again.');
        }

        setIsExporting(false);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <Book size={24} className="text-white" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Export as Book</h3>
                    <p className="text-sm text-slate-500">Download folder as ePub or PDF</p>
                </div>
            </div>

            {/* Folder Selection */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Select Folder
                </label>
                <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                >
                    {folders.map(folder => (
                        <option key={folder.id} value={folder.id}>
                            {folder.name} ({bookmarks.filter(b => b.folderId === folder.id).length} bookmarks)
                        </option>
                    ))}
                </select>
            </div>

            {/* Book Details */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Book Title
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={selectedFolder?.name || 'My Collection'}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Author
                    </label>
                    <input
                        type="text"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        placeholder="Your Name"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    />
                </div>
            </div>

            {/* Format Selection */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Export Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setFormat('epub')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${format === 'epub'
                                ? 'border-amber-500 bg-amber-50 text-amber-700'
                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                    >
                        <Book size={18} />
                        <div className="text-left">
                            <div className="font-medium text-sm">ePub</div>
                            <div className="text-xs opacity-75">Kindle, iPad, Kobo</div>
                        </div>
                    </button>
                    <button
                        onClick={() => setFormat('pdf')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${format === 'pdf'
                                ? 'border-amber-500 bg-amber-50 text-amber-700'
                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                    >
                        <FileText size={18} />
                        <div className="text-left">
                            <div className="font-medium text-sm">PDF</div>
                            <div className="text-xs opacity-75">Universal format</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Include Snapshots */}
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                    type="checkbox"
                    checked={includeSnapshots}
                    onChange={(e) => setIncludeSnapshots(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                    <div className="font-medium text-sm text-slate-700">Include Saved Pages</div>
                    <div className="text-xs text-slate-500">Add snapshot content as chapters</div>
                </div>
            </label>

            {/* Preview */}
            {bookmarkCount > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-700">
                        <FolderIcon size={16} />
                        <span className="font-medium">{selectedFolder?.name}</span>
                        <span className="text-amber-500 ml-auto">
                            {bookmarkCount} bookmark{bookmarkCount !== 1 ? 's' : ''} → 1 {format.toUpperCase()}
                        </span>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleExport}
                    disabled={isExporting || bookmarkCount === 0}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 rounded-lg shadow-sm transition-colors"
                >
                    {isExporting ? (
                        <>
                            <Loader size={16} className="animate-spin" />
                            Exporting...
                        </>
                    ) : (
                        <>
                            <Download size={16} />
                            Export as {format.toUpperCase()}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
