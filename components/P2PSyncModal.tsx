import React, { useState, useEffect, useRef } from 'react';
import { Wifi, Check, X, Loader, Copy, Download, Upload, ArrowLeft, Camera, QrCode } from 'lucide-react';
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

type SyncMode = 'select' | 'send' | 'receive';

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
    notebooks: Notebook[],
    notes: Note[],
    vaultBookmarks: Bookmark[]
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
    const [syncCode, setSyncCode] = useState('');
    const [inputCode, setInputCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState('');
    const [qrTooLarge, setQrTooLarge] = useState(false);

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerContainerRef = useRef<HTMLDivElement>(null);

    // Cleanup scanner on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => { });
            }
        };
    }, []);

    // Generate sync code when entering send mode
    useEffect(() => {
        if (mode === 'send') {
            setIsGenerating(true);
            const code = generateSyncCode(folders, bookmarks, notebooks, notes, vaultBookmarks);
            setSyncCode(code);

            // QR codes work best under 2KB
            if (code.length < 2000) {
                setQrTooLarge(false);
                QRCode.toDataURL(code, {
                    width: 300,
                    margin: 2,
                    errorCorrectionLevel: 'L', // Lower error correction = more data capacity
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
        }
    }, [mode, folders, bookmarks, notebooks, notes, vaultBookmarks]);

    // Start QR scanner
    const startScanner = async () => {
        setScanError('');
        setIsScanning(true);

        try {
            const html5QrCode = new Html5Qrcode("qr-scanner-container");
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                },
                (decodedText) => {
                    // Successfully scanned
                    html5QrCode.stop().catch(() => { });
                    setIsScanning(false);
                    handleScannedCode(decodedText);
                },
                () => {
                    // Ignore parse errors during scanning
                }
            );
        } catch (err) {
            setIsScanning(false);
            setScanError('Camera access denied. Please paste the code manually.');
            console.error('Scanner error:', err);
        }
    };

    // Stop scanner
    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => { });
            scannerRef.current = null;
        }
        setIsScanning(false);
    };

    // Handle scanned code
    const handleScannedCode = (code: string) => {
        const data = parseSyncCode(code);
        if (data) {
            onImport({
                folders: data.folders,
                bookmarks: data.bookmarks,
                notebooks: data.notebooks,
                notes: data.notes,
                vaultBookmarks: data.vaultBookmarks
            });
            onSuccess(`Imported ${data.bookmarks.length} bookmarks!`);
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
            onError('Failed to copy to clipboard');
        }
    };

    const handleDownload = () => {
        const blob = new Blob([syncCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `linkhaven-sync-${Date.now()}.txt`;
        link.click();
        URL.revokeObjectURL(url);
        onSuccess('Sync file downloaded!');
    };

    const handleManualImport = () => {
        const data = parseSyncCode(inputCode);
        if (!data) {
            onError('Invalid sync code. Make sure you copied the entire code.');
            return;
        }

        onImport({
            folders: data.folders,
            bookmarks: data.bookmarks,
            notebooks: data.notebooks,
            notes: data.notes,
            vaultBookmarks: data.vaultBookmarks
        });
        onSuccess(`Imported ${data.bookmarks.length} bookmarks!`);
        onClose();
    };

    const dataStats = {
        folders: folders.length,
        bookmarks: bookmarks.length,
        notebooks: notebooks.length,
        notes: notes.length,
        vault: vaultBookmarks.length
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <Wifi size={24} className="text-white" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">QR Sync</h3>
                    <p className="text-sm text-slate-500">Scan to sync between devices</p>
                </div>
            </div>

            {/* Mode Selection */}
            {mode === 'select' && (
                <div className="space-y-4">
                    <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-4 text-sm text-cyan-800">
                        <p className="font-medium">📱 Quick QR Sync</p>
                        <p className="text-cyan-600 mt-1">
                            Show QR on one device, scan with the other. Zero cloud!
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setMode('send')}
                            className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-cyan-500 hover:bg-cyan-50/50 transition-all group"
                        >
                            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                                <QrCode size={28} className="text-cyan-600" />
                            </div>
                            <div className="text-center">
                                <div className="font-semibold text-slate-800">Show QR</div>
                                <div className="text-xs text-slate-500 mt-1">Display sync code</div>
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
                                <div className="text-xs text-slate-500 mt-1">Import from camera</div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* Send Mode - Show QR */}
            {mode === 'send' && (
                <div className="space-y-4">
                    {/* Data Summary */}
                    <div className="bg-slate-50 rounded-lg p-3 text-sm">
                        <div className="font-medium text-slate-700 mb-2">Syncing:</div>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-white rounded border text-xs">
                                📁 {dataStats.folders} folders
                            </span>
                            <span className="px-2 py-1 bg-white rounded border text-xs">
                                🔖 {dataStats.bookmarks} bookmarks
                            </span>
                            {dataStats.vault > 0 && (
                                <span className="px-2 py-1 bg-purple-100 rounded border border-purple-200 text-xs text-purple-700">
                                    👻 {dataStats.vault} vault
                                </span>
                            )}
                        </div>
                    </div>

                    {isGenerating ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader size={40} className="animate-spin text-cyan-500" />
                        </div>
                    ) : qrTooLarge ? (
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                                <p className="font-medium">⚠️ Data too large for QR</p>
                                <p className="mt-1">You have too many bookmarks for a QR code. Copy the sync code instead.</p>
                            </div>

                            <textarea
                                readOnly
                                value={syncCode}
                                className="w-full h-24 px-3 py-2 text-xs font-mono bg-slate-100 border border-slate-300 rounded-lg resize-none"
                            />

                            <div className="flex gap-2">
                                <button
                                    onClick={handleCopy}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg"
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                    {copied ? 'Copied!' : 'Copy Code'}
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                                >
                                    <Download size={16} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* QR Code Display */}
                            <div className="flex justify-center p-6 bg-white border-2 border-slate-200 rounded-xl">
                                <img src={qrDataUrl} alt="Sync QR Code" className="w-64 h-64" />
                            </div>

                            <p className="text-center text-sm text-slate-600">
                                📱 Scan this QR with your other device
                            </p>

                            {/* Fallback options */}
                            <details className="text-sm">
                                <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                                    Can't scan? Copy code instead
                                </summary>
                                <div className="mt-3 space-y-2">
                                    <textarea
                                        readOnly
                                        value={syncCode}
                                        className="w-full h-16 px-3 py-2 text-xs font-mono bg-slate-100 border border-slate-300 rounded-lg resize-none"
                                    />
                                    <button
                                        onClick={handleCopy}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                                    >
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                        {copied ? 'Copied!' : 'Copy Code'}
                                    </button>
                                </div>
                            </details>
                        </div>
                    )}
                </div>
            )}

            {/* Receive Mode - Scan QR */}
            {mode === 'receive' && (
                <div className="space-y-4">
                    {isScanning ? (
                        <div className="space-y-4">
                            <div
                                id="qr-scanner-container"
                                ref={scannerContainerRef}
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
                                    <div className="text-xs text-slate-500 mt-1">Point at QR code to scan</div>
                                </div>
                            </button>

                            <div className="flex items-center gap-2">
                                <div className="flex-1 border-t border-slate-200"></div>
                                <span className="text-xs text-slate-400">or paste code</span>
                                <div className="flex-1 border-t border-slate-200"></div>
                            </div>

                            <textarea
                                value={inputCode}
                                onChange={(e) => setInputCode(e.target.value)}
                                placeholder="Paste sync code here..."
                                className="w-full h-24 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none resize-none"
                            />

                            <button
                                onClick={handleManualImport}
                                disabled={!inputCode.trim()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                            >
                                <Download size={16} />
                                Import Data
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
                        if (mode !== 'select') {
                            setMode('select');
                            setSyncCode('');
                            setInputCode('');
                            setQrDataUrl('');
                            setScanError('');
                        } else {
                            onClose();
                        }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={16} />
                    {mode !== 'select' ? 'Back' : 'Cancel'}
                </button>

                <div className="text-xs text-slate-400">
                    Zero cloud • Direct transfer
                </div>
            </div>
        </div>
    );
};
