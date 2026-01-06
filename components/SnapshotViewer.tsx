import React, { useState, useEffect } from 'react';
import { FileText, Copy, Check, ExternalLink, Shield, AlertTriangle } from 'lucide-react';
import { getSnapshot, getSnapshotContent, verifySnapshotIntegrity, PageSnapshot } from '../utils/snapshots';

interface SnapshotViewerProps {
    bookmarkId: string;
    bookmarkTitle: string;
    bookmarkUrl: string;
    onClose: () => void;
}

export const SnapshotViewer: React.FC<SnapshotViewerProps> = ({
    bookmarkId,
    bookmarkTitle,
    bookmarkUrl,
    onClose
}) => {
    const [snapshot, setSnapshot] = useState<PageSnapshot | null>(null);
    const [content, setContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [integrityVerified, setIntegrityVerified] = useState<boolean | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadSnapshot();
    }, [bookmarkId]);

    const loadSnapshot = async () => {
        setIsLoading(true);
        const snap = await getSnapshot(bookmarkId);

        if (snap) {
            setSnapshot(snap);
            setContent(getSnapshotContent(snap));

            // Verify integrity
            const isValid = await verifySnapshotIntegrity(snap);
            setIntegrityVerified(isValid);
        }

        setIsLoading(false);
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!snapshot) {
        return (
            <div className="text-center py-8">
                <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">No Snapshot Found</h3>
                <p className="text-sm text-slate-500">
                    This bookmark doesn't have a saved snapshot yet.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-1">{snapshot.title || bookmarkTitle}</h3>
                <a
                    href={bookmarkUrl}
                    target="_blank"
                    rel="noopener"
                    className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
                >
                    {new URL(bookmarkUrl).hostname}
                    <ExternalLink size={12} />
                </a>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-slate-500 mb-1">Captured</div>
                    <div className="font-medium text-slate-700">{formatDate(snapshot.capturedAt)}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-slate-500 mb-1">Size</div>
                    <div className="font-medium text-slate-700">
                        {formatBytes(snapshot.compressedBytes)}
                        <span className="text-slate-400 text-xs ml-1">
                            ({Math.round((1 - snapshot.compressedBytes / snapshot.sizeBytes) * 100)}% compressed)
                        </span>
                    </div>
                </div>
            </div>

            {/* Integrity */}
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${integrityVerified
                    ? 'bg-green-50 text-green-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                {integrityVerified ? (
                    <>
                        <Shield size={16} />
                        <span className="font-medium">Integrity Verified</span>
                        <span className="text-xs opacity-75">– Content unchanged since capture</span>
                    </>
                ) : (
                    <>
                        <AlertTriangle size={16} />
                        <span className="font-medium">Integrity Check Failed</span>
                        <span className="text-xs opacity-75">– Content may have been modified</span>
                    </>
                )}
            </div>

            {/* Content Hash */}
            <div className="text-xs">
                <span className="text-slate-500">SHA-256: </span>
                <code className="bg-slate-100 px-2 py-1 rounded text-slate-600 font-mono">
                    {snapshot.contentHash.substring(0, 32)}...
                </code>
            </div>

            {/* Content */}
            <div className="relative">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Saved Content</span>
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {content}
                    </pre>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                >
                    Done
                </button>
            </div>
        </div>
    );
};
