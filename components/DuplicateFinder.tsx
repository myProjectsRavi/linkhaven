/**
 * DuplicateFinder - Content similarity detection UI
 * 
 * Shows similar/duplicate bookmarks based on SimHash fingerprinting.
 */

import React, { useState, useEffect } from 'react';
import { X, Search, Copy, Trash2, Merge, AlertTriangle, Check, Loader } from 'lucide-react';
import { Bookmark } from '../types';
import { useSimilarity } from '../hooks';

interface DuplicateFinderProps {
    isOpen: boolean;
    onClose: () => void;
    bookmarks: Bookmark[];
    onDeleteBookmark: (id: string) => void;
    onMergeBookmarks?: (keep: Bookmark, remove: Bookmark) => void;
}

interface DuplicatePair {
    bookmark1: Bookmark;
    bookmark2: Bookmark;
    similarity: number;
}

export const DuplicateFinder: React.FC<DuplicateFinderProps> = ({
    isOpen,
    onClose,
    bookmarks,
    onDeleteBookmark,
    onMergeBookmarks,
}) => {
    const { getDuplicateSuggestions, isProcessing } = useSimilarity();
    const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen && bookmarks.length > 0) {
            scanForDuplicates();
        }
    }, [isOpen, bookmarks]);

    const scanForDuplicates = () => {
        setIsScanning(true);
        // Use setTimeout to allow UI to update
        setTimeout(() => {
            const results = getDuplicateSuggestions(bookmarks);
            setDuplicates(results);
            setIsScanning(false);
        }, 100);
    };

    const handleKeep = (keep: Bookmark, remove: Bookmark) => {
        if (onMergeBookmarks) {
            onMergeBookmarks(keep, remove);
        } else {
            onDeleteBookmark(remove.id);
        }
        setResolvedIds(prev => new Set([...prev, keep.id, remove.id]));
    };

    const handleIgnore = (bookmark1: Bookmark, bookmark2: Bookmark) => {
        setResolvedIds(prev => new Set([...prev, bookmark1.id, bookmark2.id]));
    };

    const unresolvedDuplicates = duplicates.filter(
        d => !resolvedIds.has(d.bookmark1.id) && !resolvedIds.has(d.bookmark2.id)
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Copy size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Find Duplicates</h2>
                            <p className="text-amber-100 text-sm">Detect similar bookmarks</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {isScanning || isProcessing ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader className="animate-spin text-amber-500 mb-4" size={40} />
                            <p className="text-slate-600 font-medium">Scanning {bookmarks.length} bookmarks...</p>
                            <p className="text-sm text-slate-500 mt-1">Analyzing content similarity...</p>
                        </div>
                    ) : unresolvedDuplicates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <Check size={32} className="text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-1">No Duplicates Found!</h3>
                            <p className="text-sm text-slate-500 text-center">
                                Your bookmark collection is clean. No similar content detected.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-slate-600">
                                    Found <span className="font-semibold text-amber-600">{unresolvedDuplicates.length}</span> potential duplicates
                                </p>
                                <button
                                    onClick={scanForDuplicates}
                                    className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
                                >
                                    <Search size={14} />
                                    Rescan
                                </button>
                            </div>

                            {unresolvedDuplicates.map((pair, index) => (
                                <div
                                    key={`${pair.bookmark1.id}-${pair.bookmark2.id}`}
                                    className="bg-slate-50 rounded-xl p-4 border border-slate-200"
                                >
                                    {/* Similarity Badge */}
                                    <div className="flex items-center justify-between mb-3">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${pair.similarity >= 95
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {pair.similarity}% Similar
                                        </span>
                                        <button
                                            onClick={() => handleIgnore(pair.bookmark1, pair.bookmark2)}
                                            className="text-xs text-slate-500 hover:text-slate-700"
                                        >
                                            Not a duplicate
                                        </button>
                                    </div>

                                    {/* Bookmark Comparison */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {[pair.bookmark1, pair.bookmark2].map((bookmark, i) => (
                                            <div
                                                key={bookmark.id}
                                                className="bg-white rounded-lg p-3 border border-slate-200"
                                            >
                                                <h4 className="font-medium text-slate-800 text-sm line-clamp-2 mb-1">
                                                    {bookmark.title || bookmark.url}
                                                </h4>
                                                <p className="text-xs text-slate-500 truncate mb-2">
                                                    {new URL(bookmark.url).hostname}
                                                </p>
                                                <button
                                                    onClick={() => handleKeep(
                                                        bookmark,
                                                        i === 0 ? pair.bookmark2 : pair.bookmark1
                                                    )}
                                                    className="w-full px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition-colors"
                                                >
                                                    Keep this one
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                        {resolvedIds.size > 0 && `Resolved ${resolvedIds.size / 2} duplicates`}
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
