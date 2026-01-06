import React, { useState, useEffect } from 'react';
import { Trash2, Merge, Check, AlertTriangle, Loader, ExternalLink } from 'lucide-react';
import { Bookmark } from '../types';
import { findDuplicates, DeduplicationResult, DuplicateGroup } from '../utils/deduplication';

interface DeduplicationWizardProps {
    bookmarks: Bookmark[];
    onMerge: (keepId: string, deleteIds: string[]) => void;
    onClose: () => void;
}

export const DeduplicationWizard: React.FC<DeduplicationWizardProps> = ({
    bookmarks,
    onMerge,
    onClose
}) => {
    const [result, setResult] = useState<DeduplicationResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [keepSelection, setKeepSelection] = useState<Record<string, string>>({});
    const [mergedCount, setMergedCount] = useState(0);

    useEffect(() => {
        analyze();
    }, [bookmarks]);

    const analyze = async () => {
        setIsAnalyzing(true);
        // Run in next tick to not block UI
        await new Promise(r => setTimeout(r, 100));
        const duplicates = findDuplicates(bookmarks);
        setResult(duplicates);

        // Pre-select the oldest bookmark to keep in each group
        const selections: Record<string, string> = {};
        duplicates.duplicateGroups.forEach(group => {
            const oldest = group.bookmarks.reduce((a, b) =>
                a.createdAt < b.createdAt ? a : b
            );
            selections[group.id] = oldest.id;
        });
        setKeepSelection(selections);

        setIsAnalyzing(false);
    };

    const handleMergeGroup = (group: DuplicateGroup) => {
        const keepId = keepSelection[group.id];
        const deleteIds = group.bookmarks.filter(b => b.id !== keepId).map(b => b.id);

        onMerge(keepId, deleteIds);
        setMergedCount(prev => prev + deleteIds.length);

        // Remove this group from results
        if (result) {
            setResult({
                ...result,
                duplicateGroups: result.duplicateGroups.filter(g => g.id !== group.id),
                potentialSavings: result.potentialSavings - deleteIds.length
            });
        }
    };

    const handleMergeAll = () => {
        if (!result) return;

        result.duplicateGroups.forEach(group => {
            handleMergeGroup(group);
        });
    };

    const getReasonLabel = (reason: string) => {
        switch (reason) {
            case 'exact_url': return 'Exact URL Match';
            case 'similar_url': return 'Similar URL';
            case 'similar_title': return 'Similar Title';
            default: return reason;
        }
    };

    const getReasonColor = (reason: string) => {
        switch (reason) {
            case 'exact_url': return 'text-red-600 bg-red-50';
            case 'similar_url': return 'text-amber-600 bg-amber-50';
            case 'similar_title': return 'text-blue-600 bg-blue-50';
            default: return 'text-slate-600 bg-slate-50';
        }
    };

    if (isAnalyzing) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader size={32} className="animate-spin text-indigo-600 mb-4" />
                <p className="text-slate-600">Analyzing {bookmarks.length} bookmarks...</p>
            </div>
        );
    }

    if (!result || result.duplicateGroups.length === 0) {
        return (
            <div className="text-center py-8">
                <Check size={48} className="mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">
                    {mergedCount > 0 ? `Cleaned up ${mergedCount} duplicates!` : 'No Duplicates Found'}
                </h3>
                <p className="text-sm text-slate-500">
                    {mergedCount > 0
                        ? 'Your bookmark collection is now clean.'
                        : 'Your bookmark collection is already well-organized.'}
                </p>
                <button
                    onClick={onClose}
                    className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                    Done
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                    <AlertTriangle size={18} />
                    Found {result.duplicateGroups.length} duplicate groups
                </div>
                <p className="text-sm text-amber-600">
                    You can remove up to <strong>{result.potentialSavings} bookmarks</strong> to clean up your collection.
                </p>
            </div>

            {/* Merge All Button */}
            <button
                onClick={handleMergeAll}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
                <Merge size={18} />
                Merge All ({result.potentialSavings} bookmarks)
            </button>

            {/* Duplicate Groups */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {result.duplicateGroups.map(group => (
                    <div
                        key={group.id}
                        className="border border-slate-200 rounded-lg overflow-hidden"
                    >
                        {/* Group Header */}
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getReasonColor(group.reason)}`}>
                                    {getReasonLabel(group.reason)}
                                </span>
                                <span className="text-sm text-slate-500">
                                    {group.similarity}% similar
                                </span>
                            </div>
                            <button
                                onClick={() => handleMergeGroup(group)}
                                className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 font-medium"
                            >
                                <Trash2 size={14} />
                                Merge
                            </button>
                        </div>

                        {/* Group Items */}
                        <div className="divide-y divide-slate-100">
                            {group.bookmarks.map(bookmark => (
                                <label
                                    key={bookmark.id}
                                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${keepSelection[group.id] === bookmark.id ? 'bg-green-50' : ''
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name={`group-${group.id}`}
                                        checked={keepSelection[group.id] === bookmark.id}
                                        onChange={() => setKeepSelection({ ...keepSelection, [group.id]: bookmark.id })}
                                        className="mt-1 text-indigo-600"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-slate-800 truncate">{bookmark.title}</span>
                                            {keepSelection[group.id] === bookmark.id && (
                                                <span className="text-xs text-green-600 font-medium">KEEP</span>
                                            )}
                                        </div>
                                        <a
                                            href={bookmark.url}
                                            target="_blank"
                                            rel="noopener"
                                            className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-1 truncate"
                                        >
                                            {new URL(bookmark.url).hostname}
                                            <ExternalLink size={10} />
                                        </a>
                                        <div className="text-xs text-slate-400 mt-1">
                                            Added {new Date(bookmark.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
};
