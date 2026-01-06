import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, QrCode, Copy, Check, Upload, Download, AlertCircle } from 'lucide-react';
import { Folder, Bookmark, Notebook, Note } from '../types';

interface QRSyncProps {
    folders: Folder[];
    bookmarks: Bookmark[];
    notebooks?: Notebook[];
    notes?: Note[];
    onImport: (folders: Folder[], bookmarks: Bookmark[], notebooks?: Notebook[], notes?: Note[]) => void;
    onClose: () => void;
}

// Simple compression for QR payload
function compressData(data: string): string {
    // Convert to base64 for QR safety
    return btoa(encodeURIComponent(data));
}

function decompressData(compressed: string): string {
    try {
        return decodeURIComponent(atob(compressed));
    } catch {
        return '';
    }
}

// Generate a simple shareable code (not actual QR, but text-based transfer)
function generateSyncCode(folders: Folder[], bookmarks: Bookmark[], notebooks?: Notebook[], notes?: Note[]): string {
    const payload: any = {
        v: 2, // version 2 includes notes
        t: Date.now(),
        f: folders.map(f => ({
            i: f.id,
            n: f.name,
            p: f.parentId,
            c: f.createdAt
        })),
        b: bookmarks.map(b => ({
            i: b.id,
            f: b.folderId,
            t: b.title,
            u: b.url,
            d: b.description,
            g: b.tags,
            c: b.createdAt
        }))
    };

    // Add notebooks and notes if present
    if (notebooks && notebooks.length > 0) {
        payload.nb = notebooks.map(n => ({
            i: n.id,
            n: n.name,
            p: n.parentId,
            c: n.createdAt
        }));
    }

    if (notes && notes.length > 0) {
        payload.nt = notes.map(n => ({
            i: n.id,
            nb: n.notebookId,
            t: n.title,
            ct: n.content,
            tg: n.tags,
            c: n.createdAt,
            u: n.updatedAt
        }));
    }

    return compressData(JSON.stringify(payload));
}

// Parse sync code back to data
function parseSyncCode(code: string): { folders: Folder[], bookmarks: Bookmark[], notebooks: Notebook[], notes: Note[] } | null {
    try {
        const json = decompressData(code);
        const payload = JSON.parse(json);

        if (!payload.v || !payload.f || !payload.b) {
            return null;
        }

        const folders: Folder[] = payload.f.map((f: any) => ({
            id: f.i,
            name: f.n,
            parentId: f.p || null,
            createdAt: f.c
        }));

        const bookmarks: Bookmark[] = payload.b.map((b: any) => ({
            id: b.i,
            folderId: b.f,
            title: b.t,
            url: b.u,
            description: b.d || '',
            tags: b.g || [],
            createdAt: b.c
        }));

        // Parse notebooks and notes (v2)
        const notebooks: Notebook[] = payload.nb ? payload.nb.map((n: any) => ({
            id: n.i,
            name: n.n,
            parentId: n.p || null,
            createdAt: n.c
        })) : [];

        const notes: Note[] = payload.nt ? payload.nt.map((n: any) => ({
            id: n.i,
            notebookId: n.nb,
            title: n.t,
            content: n.ct,
            tags: n.tg || [],
            createdAt: n.c,
            updatedAt: n.u
        })) : [];

        return { folders, bookmarks, notebooks, notes };
    } catch {
        return null;
    }
}

export const QRSync: React.FC<QRSyncProps> = ({
    folders,
    bookmarks,
    notebooks = [],
    notes = [],
    onImport,
    onClose
}) => {
    const [mode, setMode] = useState<'export' | 'import'>('export');
    const [syncCode, setSyncCode] = useState('');
    const [importCode, setImportCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (mode === 'export') {
            const code = generateSyncCode(folders, bookmarks, notebooks, notes);
            setSyncCode(code);
        }
    }, [mode, folders, bookmarks, notebooks, notes]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(syncCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleImport = () => {
        setError('');
        const result = parseSyncCode(importCode.trim());

        if (!result) {
            setError('Invalid sync code. Please check and try again.');
            return;
        }

        onImport(result.folders, result.bookmarks, result.notebooks, result.notes);
        onClose();
    };

    return (
        <div className="space-y-4">
            {/* Mode Tabs */}
            <div className="flex rounded-lg bg-slate-100 p-1">
                <button
                    onClick={() => setMode('export')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${mode === 'export'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                        }`}
                >
                    <Upload size={16} />
                    Send Data
                </button>
                <button
                    onClick={() => setMode('import')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${mode === 'import'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                        }`}
                >
                    <Download size={16} />
                    Receive Data
                </button>
            </div>

            {mode === 'export' ? (
                <>
                    {/* Export Mode */}
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 text-center">
                        <Smartphone size={48} className="mx-auto text-indigo-600 mb-3" />
                        <h3 className="font-semibold text-slate-800 mb-1">Transfer to Another Device</h3>
                        <p className="text-sm text-slate-600">
                            Copy this code and paste it on your other device
                        </p>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">Sync Code</span>
                            <span className="text-xs text-slate-400">
                                {folders.length} folders, {bookmarks.length} bookmarks
                            </span>
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={syncCode}
                            readOnly
                            className="w-full h-24 p-2 text-xs font-mono bg-white border border-slate-200 rounded resize-none"
                        />
                    </div>

                    <button
                        onClick={handleCopy}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'Copied!' : 'Copy Sync Code'}
                    </button>

                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-700">
                        <strong>Note:</strong> This code contains all your bookmarks. Only share with devices you trust.
                    </div>
                </>
            ) : (
                <>
                    {/* Import Mode */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 text-center">
                        <QrCode size={48} className="mx-auto text-green-600 mb-3" />
                        <h3 className="font-semibold text-slate-800 mb-1">Receive from Another Device</h3>
                        <p className="text-sm text-slate-600">
                            Paste the sync code from your other device
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Paste Sync Code
                        </label>
                        <textarea
                            value={importCode}
                            onChange={(e) => setImportCode(e.target.value)}
                            placeholder="Paste the sync code here..."
                            className="w-full h-24 p-3 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleImport}
                        disabled={!importCode.trim()}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
                    >
                        <Download size={18} />
                        Import Data
                    </button>

                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
                        <strong>Tip:</strong> This will merge with your existing bookmarks. Duplicates will be skipped.
                    </div>
                </>
            )}

            {/* Close Button */}
            <div className="pt-2 border-t border-slate-100">
                <button
                    onClick={onClose}
                    className="w-full py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
};
