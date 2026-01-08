import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, FileText, Bookmark, Loader } from 'lucide-react';
import { Bookmark as BookmarkType, Note } from '../types';
import {
    initSearchIndex,
    search,
    getSuggestions,
    isSearchIndexReady,
    SearchHit,
    getSearchIndexStats
} from '../utils/searchIndex';

interface EnhancedSearchProps {
    bookmarks: BookmarkType[];
    notes: Note[];
    onSelectBookmark: (bookmark: BookmarkType) => void;
    onSelectNote: (note: Note) => void;
    onSearchChange?: (query: string) => void;
    snapshotContents?: Map<string, string>;
}

export const EnhancedSearch: React.FC<EnhancedSearchProps> = ({
    bookmarks,
    notes,
    onSelectBookmark,
    onSelectNote,
    onSearchChange,
    snapshotContents = new Map()
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchHit[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [isIndexing, setIsIndexing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initialize search index when data changes
    useEffect(() => {
        const initIndex = async () => {
            setIsIndexing(true);
            // Small delay to show loading state
            await new Promise(resolve => setTimeout(resolve, 100));
            initSearchIndex(bookmarks, notes, snapshotContents);
            setIsIndexing(false);
        };

        if (bookmarks.length > 0 || notes.length > 0) {
            initIndex();
        }
    }, [bookmarks, notes, snapshotContents]);

    // Get index stats for display
    const indexStats = useMemo(() => {
        if (isSearchIndexReady()) {
            return getSearchIndexStats();
        }
        return { documentCount: 0, termCount: 0 };
    }, [bookmarks, notes, isIndexing]);

    // Perform search when query changes
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setSuggestions([]);
            return;
        }

        // Get search results
        const searchResults = search(query, { maxResults: 10 });
        setResults(searchResults);

        // Get autocomplete suggestions
        const autoSuggestions = getSuggestions(query, 5);
        setSuggestions(autoSuggestions);

        // Notify parent of search change
        onSearchChange?.(query);
    }, [query, onSearchChange]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        const totalItems = results.length + suggestions.length;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % totalItems);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            if (selectedIndex < suggestions.length) {
                // Selected a suggestion
                setQuery(suggestions[selectedIndex]);
            } else {
                // Selected a result
                const resultIndex = selectedIndex - suggestions.length;
                const result = results[resultIndex];
                handleResultClick(result);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setQuery('');
            inputRef.current?.blur();
        }
    };

    // Handle result click
    const handleResultClick = (result: SearchHit) => {
        if (result.type === 'bookmark') {
            const bookmark = bookmarks.find(b => b.id === result.id);
            if (bookmark) onSelectBookmark(bookmark);
        } else {
            const note = notes.find(n => n.id === result.id);
            if (note) onSelectNote(note);
        }
        setIsOpen(false);
        setQuery('');
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const showDropdown = isOpen && (results.length > 0 || suggestions.length > 0 || query.trim());

    return (
        <div className="relative group flex-1 sm:w-80" ref={dropdownRef}>
            {/* Search Input */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {isIndexing ? (
                        <Loader size={16} className="text-indigo-500 animate-spin" />
                    ) : (
                        <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    )}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={isIndexing ? 'Indexing...' : `Search ${indexStats.documentCount} items...`}
                    className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all sm:text-sm"
                />
                {query && (
                    <button
                        onClick={() => { setQuery(''); setResults([]); setSuggestions([]); }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Dropdown */}
            {showDropdown && (
                <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden max-h-96 overflow-y-auto">
                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                        <div className="p-2 border-b border-slate-100">
                            <div className="text-xs text-slate-400 px-2 mb-1">Suggestions</div>
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={suggestion}
                                    onClick={() => setQuery(suggestion)}
                                    className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${selectedIndex === index
                                            ? 'bg-indigo-50 text-indigo-700'
                                            : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <Search size={12} className="inline mr-2 opacity-50" />
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Results */}
                    {results.length > 0 ? (
                        <div className="p-2">
                            <div className="text-xs text-slate-400 px-2 mb-1">Results</div>
                            {results.map((result, index) => {
                                const actualIndex = suggestions.length + index;
                                return (
                                    <button
                                        key={result.id}
                                        onClick={() => handleResultClick(result)}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedIndex === actualIndex
                                                ? 'bg-indigo-50'
                                                : 'hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className={`p-1 rounded ${result.type === 'bookmark'
                                                    ? 'bg-blue-100 text-blue-600'
                                                    : 'bg-purple-100 text-purple-600'
                                                }`}>
                                                {result.type === 'bookmark' ? (
                                                    <Bookmark size={12} />
                                                ) : (
                                                    <FileText size={12} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm text-slate-800 truncate">
                                                    {result.title}
                                                </div>
                                                {result.excerpt && (
                                                    <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                                                        {result.excerpt}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mt-1">
                                                    {result.matchedFields.map(field => (
                                                        <span
                                                            key={field}
                                                            className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded"
                                                        >
                                                            {field}
                                                        </span>
                                                    ))}
                                                    <span className="text-[10px] text-slate-400">
                                                        score: {result.score.toFixed(1)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : query.trim() && !isIndexing && (
                        <div className="p-6 text-center text-slate-400 text-sm">
                            No results found for "{query}"
                        </div>
                    )}

                    {/* Footer */}
                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                        <span>Full-text search • Offline</span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px]">↑↓</kbd>
                            <span>navigate</span>
                            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] ml-1">↵</kbd>
                            <span>select</span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
