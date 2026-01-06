import React, { useEffect, useRef } from 'react';
import { Bookmark, Copy, Check, ExternalLink } from 'lucide-react';

interface BookmarkletModalProps {
    appUrl: string;
    onClose: () => void;
}

export const BookmarkletModal: React.FC<BookmarkletModalProps> = ({ appUrl, onClose }) => {
    const [copied, setCopied] = React.useState(false);
    const linkRef = useRef<HTMLAnchorElement>(null);

    // Bookmarklet code - properly encoded for security
    // Uses void(0) to prevent navigation, encodes special characters
    const bookmarkletCode = `javascript:void(function(){var u=encodeURIComponent(location.href),t=encodeURIComponent(document.title),d=encodeURIComponent((window.getSelection()||'').toString().slice(0,500));window.open('${appUrl}?add='+u+'%26title='+t+'%26desc='+d,'linkhaven')}())`;

    // Set href after mount to bypass React's security check
    useEffect(() => {
        if (linkRef.current) {
            linkRef.current.setAttribute('href', bookmarkletCode);
        }
    }, [bookmarkletCode]);

    const handleCopy = () => {
        navigator.clipboard.writeText(bookmarkletCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', bookmarkletCode);
        e.dataTransfer.setData('text/uri-list', bookmarkletCode);
    };

    return (
        <div className="space-y-6">
            {/* Draggable Bookmarklet */}
            <div className="text-center">
                <p className="text-sm text-slate-600 mb-4">
                    Drag this button to your bookmarks bar:
                </p>

                <a
                    ref={linkRef}
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    onDragStart={handleDragStart}
                    draggable="true"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all cursor-grab active:cursor-grabbing"
                >
                    <Bookmark size={18} />
                    + LinkHaven
                </a>

                <p className="text-xs text-slate-400 mt-2">
                    (Drag to bookmarks bar, then click on any page!)
                </p>
            </div>

            {/* Instructions */}
            <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 mb-3">How to install:</h4>
                <ol className="text-sm text-slate-600 space-y-2">
                    <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full text-xs flex items-center justify-center font-medium">1</span>
                        <span>Show your bookmarks bar (Ctrl/Cmd + Shift + B)</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full text-xs flex items-center justify-center font-medium">2</span>
                        <span>Drag the "+ LinkHaven" button to your bookmarks bar</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full text-xs flex items-center justify-center font-medium">3</span>
                        <span>Visit any webpage and click the bookmarklet</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full text-xs flex items-center justify-center font-medium">4</span>
                        <span>LinkHaven opens with the page URL pre-filled!</span>
                    </li>
                </ol>
            </div>

            {/* Alternative: Create New Bookmark Manually */}
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                    <ExternalLink size={16} />
                    Alternative: Create bookmark manually
                </h4>
                <ol className="text-sm text-amber-700 space-y-1">
                    <li>1. Right-click bookmarks bar → "Add page..."</li>
                    <li>2. Name: <strong>+ LinkHaven</strong></li>
                    <li>3. URL: Click "Copy Code" below and paste</li>
                </ol>
            </div>

            {/* Manual Copy Option */}
            <div>
                <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-slate-100 p-2 rounded overflow-hidden text-ellipsis whitespace-nowrap font-mono">
                        {bookmarkletCode.substring(0, 50)}...
                    </code>
                    <button
                        onClick={handleCopy}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm flex items-center gap-2 transition-colors font-medium"
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Done
                </button>
            </div>
        </div>
    );
};
