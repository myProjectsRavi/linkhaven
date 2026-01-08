import React, { useState } from 'react';
import { FileText, Camera, Check, AlertCircle, Loader, Monitor, FileCode } from 'lucide-react';
import { saveSnapshot, extractReadableContent, createRichSnapshot, supportsRichSnapshots } from '../utils/snapshots';

interface SnapshotCaptureProps {
    bookmarkId: string;
    bookmarkUrl: string;
    bookmarkTitle: string;
    onComplete: (snapshotId: string) => void;
    onClose: () => void;
}

export const SnapshotCapture: React.FC<SnapshotCaptureProps> = ({
    bookmarkId,
    bookmarkUrl,
    bookmarkTitle,
    onComplete,
    onClose
}) => {
    const [htmlContent, setHtmlContent] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [preview, setPreview] = useState<{ title: string; content: string; charCount: number } | null>(null);
    const [error, setError] = useState('');
    const [useRichSnapshot, setUseRichSnapshot] = useState(supportsRichSnapshots()); // Default to rich if supported
    const handlePaste = (e: React.ClipboardEvent) => {
        const pasted = e.clipboardData.getData('text');
        setHtmlContent(pasted);
        setError('');

        // Preview extraction
        if (pasted.includes('<')) {
            try {
                const extracted = extractReadableContent(pasted);
                setPreview({
                    title: extracted.title,
                    content: extracted.content.substring(0, 500) + (extracted.content.length > 500 ? '...' : ''),
                    charCount: extracted.content.length
                });
            } catch {
                setPreview(null);
            }
        }
    };

    const handleSave = async () => {
        if (!htmlContent.trim()) {
            setError('Please paste the page HTML first');
            return;
        }

        setIsProcessing(true);
        setError('');

        try {
            // Use rich snapshot for exact offline copy, or text-only for smaller size
            const snapshot = useRichSnapshot
                ? await createRichSnapshot(bookmarkId, bookmarkUrl, htmlContent)
                : await saveSnapshot(bookmarkId, bookmarkUrl, htmlContent);
            onComplete(snapshot.id);
        } catch (e) {
            setError('Failed to save snapshot. Please try again.');
            console.error('Snapshot save failed:', e);
        }

        setIsProcessing(false);
    };

    return (
        <div className="space-y-4">
            {/* Instructions */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                <h3 className="font-medium text-indigo-900 flex items-center gap-2 mb-2">
                    <Camera size={18} />
                    Capture Page Snapshot
                </h3>
                <p className="text-sm text-indigo-700">
                    Save a permanent copy of <strong>{bookmarkTitle}</strong> to survive link rot.
                </p>
            </div>

            {/* How to */}
            <div className="bg-slate-50 rounded-lg p-4 text-sm">
                <p className="font-medium text-slate-700 mb-2">How to capture:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>Open the page: <a href={bookmarkUrl} target="_blank" rel="noopener" className="text-indigo-600 hover:underline">{new URL(bookmarkUrl).hostname}</a></li>
                    <li>Right-click → "View Page Source" (or Ctrl+U)</li>
                    <li>Select all (Ctrl+A) and copy (Ctrl+C)</li>
                    <li>Paste below (Ctrl+V)</li>
                </ol>
            </div>

            {/* CORS Privacy Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <div className="flex items-start gap-2 text-amber-800">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-medium">Privacy Note</p>
                        <p className="text-amber-700 text-xs mt-1">
                            If using auto-fetch, URLs are routed via public proxies (CORS bypass).
                            The proxy can see the URL being accessed. <strong>Your bookmark data stays 100% local.</strong>
                        </p>
                        <p className="text-amber-600 text-xs mt-1">
                            For complete privacy, paste HTML manually (no proxy needed) or use our Browser Extension.
                        </p>
                    </div>
                </div>
            </div>

            {/* Snapshot Mode Toggle */}
            {supportsRichSnapshots() && (
                <div className="flex gap-2">
                    <button
                        onClick={() => setUseRichSnapshot(true)}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${useRichSnapshot
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                    >
                        <Monitor size={18} />
                        <div className="text-left">
                            <div className="font-medium text-sm">Rich Snapshot</div>
                            <div className="text-xs opacity-75">Exact offline copy with images</div>
                        </div>
                    </button>
                    <button
                        onClick={() => setUseRichSnapshot(false)}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${!useRichSnapshot
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                    >
                        <FileCode size={18} />
                        <div className="text-left">
                            <div className="font-medium text-sm">Text Only</div>
                            <div className="text-xs opacity-75">Smaller, faster save</div>
                        </div>
                    </button>
                </div>
            )}

            {/* Paste area */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Paste HTML Source
                </label>
                <textarea
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Paste the page source HTML here..."
                    className="w-full h-32 px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                    {htmlContent.length > 0 ? `${htmlContent.length.toLocaleString()} characters` : 'Waiting for HTML...'}
                </p>
            </div>

            {/* Preview */}
            {preview && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                        <Check size={16} />
                        Content Extracted
                    </div>
                    <p className="text-sm text-slate-600">
                        <strong>Title:</strong> {preview.title}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                        <strong>Content:</strong> {preview.charCount.toLocaleString()} characters
                    </p>
                    <p className="text-xs text-slate-500 mt-2 line-clamp-3">
                        {preview.content}
                    </p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                    <AlertCircle size={16} />
                    {error}
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
                    onClick={handleSave}
                    disabled={isProcessing || !htmlContent.trim()}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 rounded-lg shadow-sm transition-colors"
                >
                    {isProcessing ? (
                        <>
                            <Loader size={16} className="animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <FileText size={16} />
                            Save Snapshot
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
