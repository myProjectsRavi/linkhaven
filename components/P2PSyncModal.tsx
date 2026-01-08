import React, { useState, useEffect, useRef } from 'react';
import { Wifi, Check, X, Loader, Copy, Download, Upload, ArrowLeft, Camera, QrCode, Folder as FolderIcon, ChevronDown } from 'lucide-react';
import { Folder, Bookmark, Notebook, Note } from '../types';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';

interface P2PSyncModalProps {
    folders: Folder[];
    bookmarks: Bookmark[];
    notebooks: Notebook[];
    notes: Note[];
    vaultBookmarks: Bookmark[];
    onImport: (data: {
        folders: Folder[];
        bookmarks: Bookmark[];
        notebooks: Notebook[];
        notes: Note[];
        vaultBookmarks?: Bookmark[];
    }) => void;
    onClose: () => void;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
}

type SyncMode = 'select' | 'choose-folder' | 'send' | 'receive';
type SyncScope = 'all' | 'folder';

// Compress data for smaller sync codes
function compressData(data: string): string {
    return btoa(unescape(encodeURIComponent(data)));
}

function decompressData(compressed: string): string {
    return decodeURIComponent(escape(atob(compressed)));
}

// Generate sync code from data
function generateSyncCode(
    folders: Folder[],
    bookmarks: Bookmark[],
    notebooks: Notebook[] = [],
    notes: Note[] = [],
    vaultBookmarks: Bookmark[] = []
): string {
    const payload: any = {
        v: 4,
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

    if (notebooks.length > 0) {
        payload.nb = notebooks.map(n => ({
            i: n.id,
            n: n.name,
            p: n.parentId,
            c: n.createdAt
        }));
    }

    if (notes.length > 0) {
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

    if (vaultBookmarks.length > 0) {
        payload.vb = vaultBookmarks.map(b => ({
            i: b.id,
            f: b.folderId,
            t: b.title,
            u: b.url,
            d: b.description,
            g: b.tags,
            c: b.createdAt
        }));
    }

    return compressData(JSON.stringify(payload));
}

// Parse sync code back to data
function parseSyncCode(code: string): {
    folders: Folder[],
    bookmarks: Bookmark[],
    notebooks: Notebook[],
    notes: Note[],
    vaultBookmarks: Bookmark[]
} | null {
    try {
        const json = decompressData(code.trim());
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

        const notebooks: Notebook[] = (payload.nb || []).map((n: any) => ({
            id: n.i,
            name: n.n,
            parentId: n.p || null,
            createdAt: n.c
        }));

        const notes: Note[] = (payload.nt || []).map((n: any) => ({
            id: n.i,
            notebookId: n.nb,
            title: n.t,
            content: n.ct,
            tags: n.tg || [],
            createdAt: n.c,
            updatedAt: n.u
        }));

        const vaultBookmarks: Bookmark[] = (payload.vb || []).map((b: any) => ({
            id: b.i,
            folderId: b.f,
            title: b.t,
            url: b.u,
            description: b.d || '',
            tags: b.g || [],
            createdAt: b.c
        }));

        return { folders, bookmarks, notebooks, notes, vaultBookmarks };
    } catch (e) {
        console.error('Failed to parse sync code:', e);
        return null;
    }
}

export const P2PSyncModal: React.FC<P2PSyncModalProps> = ({
    folders,
    bookmarks,
    notebooks,
    notes,
    vaultBookmarks,
    onImport,
    onClose,
    onSuccess,
    onError
}) => {
    const [mode, setMode] = useState<SyncMode>('select');
    const [syncScope, setSyncScope] = useState<SyncScope>('all');
    const [selectedFolderId, setSelectedFolderId] = useState<string>('');
    const [syncCode, setSyncCode] = useState('');
    const [inputCode, setInputCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState('');
    const [qrTooLarge, setQrTooLarge] = useState(false);

    const scannerRef = useRef<Html5Qrcode | null>(null);

    // Get bookmarks count for each folder
    const folderBookmarkCounts = folders.reduce((acc, folder) => {
        acc[folder.id] = bookmarks.filter(b => b.folderId === folder.id).length;
        return acc;
    }, {} as Record<string, number>);

    // Cleanup scanner on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => { });
            }
        };
    }, []);

    // Generate QR when entering send mode
    useEffect(() => {
        if (mode === 'send') {
            generateQR();
        }
    }, [mode, selectedFolderId, syncScope]);

    const generateQR = () => {
        setIsGenerating(true);

        let foldersToSync: Folder[];
        let bookmarksToSync: Bookmark[];

        if (syncScope === 'folder' && selectedFolderId) {
            // Only sync selected folder and its bookmarks
            const folder = folders.find(f => f.id === selectedFolderId);
            foldersToSync = folder ? [folder] : [];
            bookmarksToSync = bookmarks.filter(b => b.folderId === selectedFolderId);
        } else {
            // Sync everything
            foldersToSync = folders;
            bookmarksToSync = bookmarks;
        }

        const code = generateSyncCode(
            foldersToSync,
            bookmarksToSync,
            syncScope === 'all' ? notebooks : [],
            syncScope === 'all' ? notes : [],
            syncScope === 'all' ? vaultBookmarks : []
        );
        setSyncCode(code);

        // QR codes work best under 2KB
        if (code.length < 2000) {
            setQrTooLarge(false);
            QRCode.toDataURL(code, {
                width: 300,
                margin: 2,
                errorCorrectionLevel: 'L',
                color: { dark: '#1e293b', light: '#ffffff' }
            }).then(url => {
                setQrDataUrl(url);
                setIsGenerating(false);
            }).catch(() => {
                setIsGenerating(false);
            });
        } else {
            setQrTooLarge(true);
            setQrDataUrl('');
            setIsGenerating(false);
        }
    };

    // Start QR scanner
    const startScanner = async () => {
        setScanError('');
        setIsScanning(true);

        try {
            const html5QrCode = new Html5Qrcode("qr-scanner-container");
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    html5QrCode.stop().catch(() => { });
                    setIsScanning(false);
                    handleScannedCode(decodedText);
                },
                () => { }
            );
        } catch (err) {
            setIsScanning(false);
            setScanError('Camera access denied. Please paste the code manually.');
        }
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => { });
            scannerRef.current = null;
        }
        setIsScanning(false);
    };

    const handleScannedCode = (code: string) => {
        const data = parseSyncCode(code);
        if (data) {
            onImport(data);
            onSuccess(`✨ Imported ${data.bookmarks.length} bookmarks from ${data.folders.length} folder(s)!`);
            onClose();
        } else {
            setScanError('Invalid QR code. Not a LinkHaven sync code.');
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(syncCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            onError('Failed to copy');
        }
    };

    const handleManualImport = () => {
        const data = parseSyncCode(inputCode);
        if (!data) {
            onError('Invalid sync code.');
            return;
        }
        onImport(data);
        onSuccess(`✨ Imported ${data.bookmarks.length} bookmarks!`);
        onClose();
    };

    const selectedFolder = folders.find(f => f.id === selectedFolderId);
    const selectedFolderBookmarks = selectedFolderId
        ? bookmarks.filter(b => b.folderId === selectedFolderId).length
        : 0;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <QrCode size={24} className="text-white" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">QR Sync</h3>
                    <p className="text-sm text-slate-500">Scan to sync instantly</p>
                </div>
            </div>

            {/* Mode: Select Send/Receive */}
            {mode === 'select' && (
                <div className="space-y-4">
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-100 rounded-lg p-4 text-sm">
                        <p className="font-medium text-cyan-800">📱 Magic QR Sync</p>
                        <p className="text-cyan-600 mt-1">
                            Show QR on one device, scan with another. Done!
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setMode('choose-folder')}
                            className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-cyan-500 hover:bg-cyan-50/50 transition-all group"
                        >
                            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                                <QrCode size={28} className="text-cyan-600" />
                            </div>
                            <div className="text-center">
                                <div className="font-semibold text-slate-800">Show QR</div>
                                <div className="text-xs text-slate-500 mt-1">Send data</div>
                            </div>
                        </button>

                        <button
                            onClick={() => setMode('receive')}
                            className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-cyan-500 hover:bg-cyan-50/50 transition-all group"
                        >
                            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                                <Camera size={28} className="text-cyan-600" />
                            </div>
                            <div className="text-center">
                                <div className="font-semibold text-slate-800">Scan QR</div>
                                <div className="text-xs text-slate-500 mt-1">Receive data</div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* Mode: Choose What to Sync */}
            {mode === 'choose-folder' && (
                <div className="space-y-4">
                    <div className="text-sm text-slate-600 font-medium">What do you want to sync?</div>

                    {/* Sync Everything */}
                    <button
                        onClick={() => {
                            setSyncScope('all');
                            setMode('send');
                        }}
                        className={`w-full flex items-center gap-3 p-4 border-2 rounded-xl transition-all ${bookmarks.length < 30
                                ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-500'
                                : 'border-amber-200 bg-amber-50'
                            }`}
                    >
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <Wifi size={20} className="text-cyan-600" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-slate-800">Sync Everything</div>
                            <div className="text-xs text-slate-500">
                                {folders.length} folders • {bookmarks.length} bookmarks
                                {bookmarks.length >= 30 && (
                                    <span className="text-amber-600 ml-1">(may need paste)</span>
                                )}
                            </div>
                        </div>
                        {bookmarks.length < 30 && (
                            <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                                ✓ QR fits
                            </span>
                        )}
                    </button>

                    {/* Folder Selection */}
                    <div className="text-xs text-slate-500 text-center">— or sync a single folder —</div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {folders.map(folder => {
                            const count = folderBookmarkCounts[folder.id] || 0;
                            const canFitQR = count < 30;

                            return (
                                <button
                                    key={folder.id}
                                    onClick={() => {
                                        setSelectedFolderId(folder.id);
                                        setSyncScope('folder');
                                        setMode('send');
                                    }}
                                    className={`w-full flex items-center gap-3 p-3 border-2 rounded-lg transition-all hover:border-cyan-500 ${canFitQR ? 'border-slate-200' : 'border-amber-200 bg-amber-50/50'
                                        }`}
                                >
                                    <FolderIcon size={18} className="text-slate-400" />
                                    <div className="flex-1 text-left">
                                        <div className="font-medium text-slate-700 text-sm">{folder.name}</div>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${canFitQR
                                            ? 'bg-slate-100 text-slate-600'
                                            : 'bg-amber-100 text-amber-700'
                                        }`}>
                                        {count} {count === 1 ? 'bookmark' : 'bookmarks'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Mode: Show QR */}
            {mode === 'send' && (
                <div className="space-y-4">
                    {/* What's being synced */}
                    <div className="bg-slate-50 rounded-lg p-3 text-sm flex items-center gap-2">
                        <div className="flex-1">
                            {syncScope === 'folder' && selectedFolder ? (
                                <span className="font-medium text-slate-700">
                                    📁 {selectedFolder.name} • {selectedFolderBookmarks} bookmarks
                                </span>
                            ) : (
                                <span className="font-medium text-slate-700">
                                    📦 Everything • {bookmarks.length} bookmarks
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setMode('choose-folder')}
                            className="text-xs text-cyan-600 hover:text-cyan-700"
                        >
                            Change
                        </button>
                    </div>

                    {isGenerating ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader size={40} className="animate-spin text-cyan-500" />
                        </div>
                    ) : qrTooLarge ? (
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                                <p className="font-medium">⚠️ Too many bookmarks for QR</p>
                                <p className="mt-1 text-amber-700">
                                    Try syncing a smaller folder, or copy the code below.
                                </p>
                            </div>

                            <textarea
                                readOnly
                                value={syncCode}
                                className="w-full h-20 px-3 py-2 text-xs font-mono bg-slate-100 border border-slate-300 rounded-lg resize-none"
                            />

                            <button
                                onClick={handleCopy}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg"
                            >
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                {copied ? 'Copied!' : 'Copy Code'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* QR Code */}
                            <div className="flex justify-center p-6 bg-white border-2 border-slate-200 rounded-xl">
                                <img src={qrDataUrl} alt="Sync QR Code" className="w-56 h-56" />
                            </div>

                            <p className="text-center text-sm text-slate-600">
                                📱 Point your other device's camera at this QR
                            </p>

                            <details className="text-xs">
                                <summary className="cursor-pointer text-slate-400 hover:text-slate-600 text-center">
                                    Can't scan? Copy code
                                </summary>
                                <div className="mt-2 space-y-2">
                                    <textarea
                                        readOnly
                                        value={syncCode}
                                        className="w-full h-16 px-2 py-1.5 text-xs font-mono bg-slate-50 border rounded resize-none"
                                    />
                                    <button
                                        onClick={handleCopy}
                                        className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
                                    >
                                        {copied ? <Check size={12} /> : <Copy size={12} />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </details>
                        </div>
                    )}
                </div>
            )}

            {/* Mode: Scan QR */}
            {mode === 'receive' && (
                <div className="space-y-4">
                    {isScanning ? (
                        <div className="space-y-4">
                            <div
                                id="qr-scanner-container"
                                className="w-full aspect-square bg-slate-900 rounded-xl overflow-hidden"
                            />
                            <button
                                onClick={stopScanner}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                            >
                                <X size={16} />
                                Stop Scanning
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {scanError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                                    {scanError}
                                </div>
                            )}

                            <button
                                onClick={startScanner}
                                className="w-full flex flex-col items-center gap-3 p-8 border-2 border-dashed border-slate-300 rounded-xl hover:border-cyan-500 hover:bg-cyan-50/50 transition-all"
                            >
                                <Camera size={48} className="text-cyan-600" />
                                <div className="text-center">
                                    <div className="font-semibold text-slate-800">Start Camera</div>
                                    <div className="text-xs text-slate-500 mt-1">Point at QR to import</div>
                                </div>
                            </button>

                            <div className="flex items-center gap-2">
                                <div className="flex-1 border-t border-slate-200"></div>
                                <span className="text-xs text-slate-400">or paste</span>
                                <div className="flex-1 border-t border-slate-200"></div>
                            </div>

                            <textarea
                                value={inputCode}
                                onChange={(e) => setInputCode(e.target.value)}
                                placeholder="Paste sync code..."
                                className="w-full h-20 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none resize-none"
                            />

                            <button
                                onClick={handleManualImport}
                                disabled={!inputCode.trim()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 rounded-lg"
                            >
                                <Download size={16} />
                                Import
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <button
                    onClick={() => {
                        stopScanner();
                        if (mode === 'send' || mode === 'receive') {
                            setMode(mode === 'send' ? 'choose-folder' : 'select');
                        } else if (mode === 'choose-folder') {
                            setMode('select');
                        } else {
                            onClose();
                        }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                    <ArrowLeft size={16} />
                    {mode === 'select' ? 'Cancel' : 'Back'}
                </button>
                <div className="text-xs text-slate-400">Zero cloud</div>
            </div>
        </div>
    );
};
