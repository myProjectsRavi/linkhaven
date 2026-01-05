import React, { useState, useRef, useEffect } from 'react';
import { X, Tag } from 'lucide-react';

interface TagInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    allTags: string[]; // For autocomplete
    placeholder?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
    tags,
    onChange,
    allTags,
    placeholder = "Add tags..."
}) => {
    const [input, setInput] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter suggestions based on input
    const suggestions = input.trim()
        ? allTags
            .filter(t =>
                t.toLowerCase().includes(input.toLowerCase()) &&
                !tags.includes(t)
            )
            .slice(0, 5)
        : [];

    const addTag = (tag: string) => {
        const trimmed = tag.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
        if (trimmed && !tags.includes(trimmed)) {
            onChange([...tags, trimmed]);
        }
        setInput('');
        setShowSuggestions(false);
        setSelectedIndex(-1);
    };

    const removeTag = (tagToRemove: string) => {
        onChange(tags.filter(t => t !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                addTag(suggestions[selectedIndex]);
            } else if (input.trim()) {
                addTag(input);
            }
        } else if (e.key === 'Backspace' && !input && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
        } else if (e.key === 'ArrowDown' && showSuggestions) {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp' && showSuggestions) {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, -1));
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
            setSelectedIndex(-1);
        }
    };

    useEffect(() => {
        setShowSuggestions(input.length > 0 && suggestions.length > 0);
        setSelectedIndex(-1);
    }, [input, suggestions.length]);

    return (
        <div className="relative">
            <div className="flex flex-wrap gap-1.5 p-2 border border-slate-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 min-h-[42px]">
                {/* Existing Tags */}
                {tags.map(tag => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium"
                    >
                        <Tag size={10} />
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:bg-indigo-200 rounded-full p-0.5"
                        >
                            <X size={10} />
                        </button>
                    </span>
                ))}

                {/* Input */}
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowSuggestions(suggestions.length > 0)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder={tags.length === 0 ? placeholder : ''}
                    className="flex-1 min-w-[100px] outline-none text-sm bg-transparent"
                />
            </div>

            {/* Autocomplete Dropdown */}
            {showSuggestions && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={suggestion}
                            type="button"
                            onClick={() => addTag(suggestion)}
                            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${index === selectedIndex
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'hover:bg-slate-50'
                                }`}
                        >
                            <Tag size={12} className="text-slate-400" />
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}

            {/* Helper Text */}
            <p className="mt-1 text-xs text-slate-400">
                Press Enter or comma to add tags
            </p>
        </div>
    );
};
