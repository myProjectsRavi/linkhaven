import React, { useMemo } from 'react';
import { Sparkles, Folder as FolderIcon } from 'lucide-react';
import { Bookmark, Folder } from '../types';
import { trainClassifier, suggestFolders, NaiveBayesModel } from '../utils/naiveBayes';

interface FolderSuggestionsProps {
    url: string;
    title: string;
    description: string;
    bookmarks: Bookmark[];
    folders: Folder[];
    onSelectFolder: (folderId: string) => void;
    selectedFolderId?: string;
}

export const FolderSuggestions: React.FC<FolderSuggestionsProps> = ({
    url,
    title,
    description,
    bookmarks,
    folders,
    onSelectFolder,
    selectedFolderId
}) => {
    // Train model on existing bookmarks (memoized)
    const model = useMemo<NaiveBayesModel | null>(() => {
        if (bookmarks.length < 5) return null; // Need at least 5 bookmarks for meaningful suggestions
        try {
            return trainClassifier(bookmarks, folders);
        } catch {
            return null;
        }
    }, [bookmarks, folders]);

    // Get suggestions for current input
    const suggestions = useMemo(() => {
        if (!model || !url || (!title && !description)) return [];
        try {
            const text = `${title} ${description}`.trim();
            return suggestFolders(text, url, model, 3).filter(s => s.confidence > 10);
        } catch {
            return [];
        }
    }, [model, url, title, description]);

    if (suggestions.length === 0) {
        return null;
    }

    return (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-purple-500" />
                <span className="text-xs font-medium text-purple-700">
                    Smart Suggestions
                </span>
                <span className="text-xs text-purple-500 ml-auto">
                    No AI • Pure Math
                </span>
            </div>

            <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                    <button
                        key={suggestion.folderId}
                        onClick={() => onSelectFolder(suggestion.folderId)}
                        className={`
                            flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium
                            transition-all
                            ${selectedFolderId === suggestion.folderId
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-100'
                            }
                        `}
                    >
                        <FolderIcon size={12} />
                        <span>{suggestion.folderName}</span>
                        <span className={`text-xs ${selectedFolderId === suggestion.folderId
                                ? 'text-purple-200'
                                : 'text-purple-400'
                            }`}>
                            {suggestion.confidence}%
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};
