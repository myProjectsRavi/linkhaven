import React from 'react';
import { Bookmark, Copy, Check } from 'lucide-react';

interface BookmarkletModalProps {
    appUrl: string;
    onClose: () => void;
}

export const BookmarkletModal: React.FC<BookmarkletModalProps> = ({ appUrl, onClose }) => {
    const [copied, setCopied] = React.useState(false);

    // Bookmarklet code - opens LinkHaven with current page data
    const bookmarkletCode = `javascript:(function(){
    var url=encodeURIComponent(window.location.href);
    var title=encodeURIComponent(document.title);
    var desc=encodeURIComponent(window.getSelection().toString().slice(0,500));
    window.open('${appUrl}?add='+url+'&title='+title+'&desc='+desc,'_blank');
  })();`.replace(/\s+/g, ' ');

    const handleCopy = () => {
        navigator.clipboard.writeText(bookmarkletCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Draggable Bookmarklet */}
            <div className="text-center">
                <p className="text-sm text-slate-600 mb-4">
                    Drag this button to your bookmarks bar:
                </p>

                <a
                    href={bookmarkletCode}
                    onClick={(e) => e.preventDefault()}
                    draggable="true"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all cursor-grab active:cursor-grabbing"
                >
                    <Bookmark size={18} />
                    + LinkHaven
                </a>

                <p className="text-xs text-slate-400 mt-2">
                    (Click won't work - you must drag it!)
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
                        <span>Drag the "+ LinkHaven" button above to your bookmarks bar</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full text-xs flex items-center justify-center font-medium">3</span>
                        <span>On any page, click it to save the page to LinkHaven!</span>
                    </li>
                </ol>
            </div>

            {/* Manual Copy Option */}
            <div>
                <p className="text-xs text-slate-500 mb-2">Or copy the code manually:</p>
                <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-slate-100 p-2 rounded overflow-hidden text-ellipsis whitespace-nowrap">
                        {bookmarkletCode.substring(0, 60)}...
                    </code>
                    <button
                        onClick={handleCopy}
                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded text-sm flex items-center gap-1 transition-colors"
                    >
                        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end">
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
