/**
 * SnapshotViewer - Reader-mode component for viewing saved page snapshots
 * 
 * Design Goals:
 * - Clean, distraction-free reading experience
 * - Similar to Safari Reader View / Firefox Reader Mode
 * - Dark mode support
 * - Print-friendly
 * - Mobile responsive
 */

import React, { useEffect, useState, useCallback } from 'react';
import { X, ExternalLink, Clock, Printer, Moon, Sun, ChevronLeft, Archive, AlertCircle } from 'lucide-react';
import { SnapshotDB, SnapshotContent } from '../utils/SnapshotDB';

interface SnapshotViewerProps {
    bookmarkId: string;
    bookmarkUrl: string;
    onClose: () => void;
}

export const SnapshotViewer: React.FC<SnapshotViewerProps> = ({
    bookmarkId,
    bookmarkUrl,
    onClose,
}) => {
    const [snapshot, setSnapshot] = useState<SnapshotContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [darkMode, setDarkMode] = useState(false);
    const [fontSize, setFontSize] = useState(18);

    // Load snapshot on mount
    useEffect(() => {
        const loadSnapshot = async () => {
            try {
                setLoading(true);
                const data = await SnapshotDB.getSnapshot(bookmarkId);
                if (data) {
                    setSnapshot(data);
                } else {
                    setError('Snapshot not found');
                }
            } catch (e) {
                console.error('Failed to load snapshot:', e);
                setError('Failed to load snapshot. It may be corrupted.');
            } finally {
                setLoading(false);
            }
        };

        loadSnapshot();
    }, [bookmarkId]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === '+' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                setFontSize(prev => Math.min(prev + 2, 32));
            }
            if (e.key === '-' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                setFontSize(prev => Math.max(prev - 2, 12));
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Print handler
    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    // Format date
    const formatDate = (timestamp: number): string => {
        return new Date(timestamp).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-400">Loading saved page...</p>
                </div>
            </div>
        );
    }

    if (error || !snapshot) {
        return (
            <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex items-center justify-center">
                <div className="text-center max-w-md px-4">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
                        {error || 'Snapshot not found'}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                        The saved page could not be loaded. You may need to save it again.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`fixed inset-0 z-50 overflow-auto transition-colors duration-300 ${darkMode ? 'bg-slate-900' : 'bg-stone-50'
                }`}
        >
            {/* Print styles */}
            <style>
                {`
          @media print {
            .snapshot-toolbar { display: none !important; }
            .snapshot-content { padding: 0 !important; max-width: none !important; }
          }
        `}
            </style>

            {/* Toolbar */}
            <div className={`snapshot-toolbar sticky top-0 z-10 border-b backdrop-blur-xl ${darkMode
                    ? 'bg-slate-900/90 border-slate-800'
                    : 'bg-stone-50/90 border-stone-200'
                }`}>
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    {/* Left: Back button */}
                    <button
                        onClick={onClose}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${darkMode
                                ? 'text-slate-300 hover:bg-slate-800'
                                : 'text-slate-600 hover:bg-stone-200'
                            }`}
                    >
                        <ChevronLeft size={20} />
                        <span className="hidden sm:inline">Back</span>
                    </button>

                    {/* Center: Title (mobile hidden) */}
                    <div className="hidden md:block text-center flex-1 mx-4">
                        <p className={`text-sm font-medium truncate ${darkMode ? 'text-slate-300' : 'text-slate-700'
                            }`}>
                            {snapshot.title}
                        </p>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        {/* Font size controls */}
                        <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-stone-200'
                            }`}>
                            <button
                                onClick={() => setFontSize(prev => Math.max(prev - 2, 12))}
                                className={`px-2 py-1 rounded text-sm font-medium ${darkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-stone-300 text-slate-600'
                                    }`}
                            >
                                A-
                            </button>
                            <span className={`text-xs px-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {fontSize}
                            </span>
                            <button
                                onClick={() => setFontSize(prev => Math.min(prev + 2, 32))}
                                className={`px-2 py-1 rounded text-sm font-medium ${darkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-stone-300 text-slate-600'
                                    }`}
                            >
                                A+
                            </button>
                        </div>

                        {/* Dark mode toggle */}
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className={`p-2 rounded-lg transition-colors ${darkMode
                                    ? 'text-amber-400 hover:bg-slate-800'
                                    : 'text-slate-600 hover:bg-stone-200'
                                }`}
                            title={darkMode ? 'Light mode' : 'Dark mode'}
                        >
                            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        {/* Print */}
                        <button
                            onClick={handlePrint}
                            className={`p-2 rounded-lg transition-colors ${darkMode
                                    ? 'text-slate-300 hover:bg-slate-800'
                                    : 'text-slate-600 hover:bg-stone-200'
                                }`}
                            title="Print"
                        >
                            <Printer size={18} />
                        </button>

                        {/* Open original */}
                        <a
                            href={snapshot.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-2 rounded-lg transition-colors ${darkMode
                                    ? 'text-slate-300 hover:bg-slate-800'
                                    : 'text-slate-600 hover:bg-stone-200'
                                }`}
                            title="Open original"
                        >
                            <ExternalLink size={18} />
                        </a>

                        {/* Close */}
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-lg transition-colors ${darkMode
                                    ? 'text-slate-300 hover:bg-slate-800'
                                    : 'text-slate-600 hover:bg-stone-200'
                                }`}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <article className="snapshot-content max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* Header */}
                <header className="mb-8">
                    <h1
                        className={`text-2xl sm:text-3xl font-serif font-bold leading-tight mb-4 ${darkMode ? 'text-white' : 'text-slate-900'
                            }`}
                    >
                        {snapshot.title}
                    </h1>

                    {/* Meta info */}
                    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                        {snapshot.byline && (
                            <span className="font-medium">{snapshot.byline}</span>
                        )}
                        {snapshot.siteName && (
                            <span className={`px-2 py-0.5 rounded ${darkMode ? 'bg-slate-800' : 'bg-stone-200'
                                }`}>
                                {snapshot.siteName}
                            </span>
                        )}
                    </div>

                    {/* Saved badge */}
                    <div className={`mt-4 flex items-center gap-4 text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'
                        }`}>
                        <div className="flex items-center gap-1.5">
                            <Archive size={14} className="text-emerald-500" />
                            <span>Saved offline</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock size={14} />
                            <span>{formatDate(snapshot.savedAt)}</span>
                        </div>
                    </div>
                </header>

                {/* Divider */}
                <hr className={`mb-8 ${darkMode ? 'border-slate-800' : 'border-stone-200'}`} />

                {/* Article content */}
                <div
                    className={`
            prose max-w-none
            ${darkMode ? 'prose-invert' : ''}
            prose-headings:font-serif
            prose-p:leading-relaxed
            prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-lg prose-img:shadow-md
            prose-blockquote:border-l-indigo-500 prose-blockquote:italic
            prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded
            ${darkMode ? 'prose-code:bg-slate-800' : ''}
          `}
                    style={{ fontSize: `${fontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: snapshot.content }}
                />

                {/* Footer */}
                <footer className={`mt-12 pt-8 border-t ${darkMode ? 'border-slate-800' : 'border-stone-200'
                    }`}>
                    <div className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                        <p className="mb-2">
                            📦 This page was saved by <strong>LinkHaven Eternal Vault</strong>
                        </p>
                        <p>
                            Original URL:{' '}
                            <a
                                href={snapshot.originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline break-all"
                            >
                                {snapshot.originalUrl}
                            </a>
                        </p>
                    </div>
                </footer>
            </article>
        </div>
    );
};
