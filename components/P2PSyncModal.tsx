import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Smartphone, Wifi, Check, X, Loader, Camera, Copy, ArrowRight, ArrowLeft } from 'lucide-react';
import {
    createP2PSession,
    joinP2PSession,
    completeP2PConnection,
    sendP2PData,
    encodeForQR,
    decodeFromQR,
    closeP2PSession,
    P2PSyncSession,
    P2PSyncEvent
} from '../utils/p2pSync';
import { Folder, Bookmark, Notebook, Note } from '../types';
import QRCode from 'qrcode';

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
type SyncStep = 'generating' | 'show-qr' | 'scan-answer' | 'scanning' | 'show-answer' | 'connecting' | 'transferring' | 'complete' | 'error';

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
    const [step, setStep] = useState<SyncStep>('generating');
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [qrText, setQrText] = useState<string>('');
    const [scannedData, setScannedData] = useState<string>('');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string>('');
    const [session, setSession] = useState<P2PSyncSession | null>(null);
    const [receivedData, setReceivedData] = useState<Uint8Array | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (session) closeP2PSession(session);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, [session]);

    // Event handler for P2P events
    const handleP2PEvent = (event: P2PSyncEvent) => {
        switch (event.type) {
            case 'status-change':
                console.log('P2P Status:', event.status);
                break;
            case 'connected':
                setStep('transferring');
                break;
            case 'progress':
                setProgress(event.percent);
                break;
            case 'data-received':
                setReceivedData(event.data);
                break;
            case 'complete':
                setStep('complete');
                break;
            case 'error':
                setError(event.error);
                setStep('error');
                break;
        }
    };

    // Generate QR code image from data
    const generateQRImage = async (data: string) => {
        try {
            const url = await QRCode.toDataURL(data, {
                width: 256,
                margin: 2,
                color: { dark: '#1e293b', light: '#ffffff' }
            });
            setQrDataUrl(url);
            setQrText(data);
        } catch (err) {
            console.error('QR generation failed:', err);
            setError('Failed to generate QR code');
        }
    };

    // Start as sender (Device A)
    const startAsSender = async () => {
        setMode('send');
        setStep('generating');

        try {
            const { session: newSession, offer } = await createP2PSession(handleP2PEvent);
            setSession(newSession);

            const qrData = encodeForQR(offer);
            await generateQRImage(qrData);
            setStep('show-qr');
        } catch (err) {
            console.error('Failed to create session:', err);
            setError('Failed to create P2P session');
            setStep('error');
        }
    };

    // Start as receiver (Device B)
    const startAsReceiver = async () => {
        setMode('receive');
        setStep('scanning');

        // Start camera for QR scanning
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            // Start scanning loop
            scanQRFromVideo();
        } catch (err) {
            console.error('Camera access failed:', err);
            setError('Camera access denied. Please paste the QR data manually.');
        }
    };

    // Scan QR code from video feed
    const scanQRFromVideo = () => {
        // Use a library like jsQR for actual scanning
        // For now, we'll use manual input as fallback
    };

    // Handle manual QR data input
    const handleManualInput = async () => {
        if (!scannedData.trim()) return;

        try {
            const offer = decodeFromQR(scannedData);
            setStep('generating');

            const { session: newSession, answer } = await joinP2PSession(offer, handleP2PEvent);
            setSession(newSession);

            const answerQR = encodeForQR(answer);
            await generateQRImage(answerQR);
            setStep('show-answer');
        } catch (err) {
            console.error('Failed to process QR:', err);
            setError('Invalid QR data. Please try again.');
        }
    };

    // Handle sender receiving answer
    const handleAnswerInput = async () => {
        if (!scannedData.trim() || !session) return;

        try {
            const answer = decodeFromQR(scannedData);
            setStep('connecting');

            await completeP2PConnection(session, answer, handleP2PEvent);

            // Start data transfer
            const exportData = {
                folders,
                bookmarks,
                notebooks,
                notes,
                vaultBookmarks,
                exportedAt: new Date().toISOString()
            };
            const jsonBytes = new TextEncoder().encode(JSON.stringify(exportData));

            // Wait for connection to be ready
            await new Promise(resolve => setTimeout(resolve, 1000));

            await sendP2PData(session, jsonBytes, handleP2PEvent);
        } catch (err) {
            console.error('Transfer failed:', err);
            setError('Transfer failed. Please try again.');
            setStep('error');
        }
    };

    // Process received data
    const processReceivedData = () => {
        if (!receivedData) return;

        try {
            const jsonStr = new TextDecoder().decode(receivedData);
            const data = JSON.parse(jsonStr);

            onImport({
                folders: data.folders || [],
                bookmarks: data.bookmarks || [],
                notebooks: data.notebooks || [],
                notes: data.notes || [],
                vaultBookmarks: data.vaultBookmarks
            });

            onSuccess(`Imported ${data.bookmarks?.length || 0} bookmarks from other device!`);
            onClose();
        } catch (err) {
            console.error('Failed to process data:', err);
            setError('Failed to process received data');
        }
    };

    // Copy QR data to clipboard
    const copyQRData = async () => {
        try {
            await navigator.clipboard.writeText(qrText);
            onSuccess('QR data copied to clipboard!');
        } catch {
            onError('Failed to copy');
        }
    };

    // Stop camera
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <Wifi size={24} className="text-white" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">P2P Air-Gap Sync</h3>
                    <p className="text-sm text-slate-500">Sync devices without any cloud</p>
                </div>
            </div>

            {/* Mode Selection */}
            {mode === 'select' && (
                <div className="space-y-4">
                    <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-4 text-sm text-cyan-800">
                        <p className="font-medium">Zero-Cloud Sync</p>
                        <p className="text-cyan-600 mt-1">
                            Transfer data directly between devices using WebRTC.
                            No server ever sees your data.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={startAsSender}
                            className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-cyan-500 hover:bg-cyan-50/50 transition-all group"
                        >
                            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                                <QrCode size={28} className="text-cyan-600" />
                            </div>
                            <div className="text-center">
                                <div className="font-semibold text-slate-800">Send Data</div>
                                <div className="text-xs text-slate-500 mt-1">Show QR code</div>
                            </div>
                        </button>

                        <button
                            onClick={startAsReceiver}
                            className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-cyan-500 hover:bg-cyan-50/50 transition-all group"
                        >
                            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                                <Camera size={28} className="text-cyan-600" />
                            </div>
                            <div className="text-center">
                                <div className="font-semibold text-slate-800">Receive Data</div>
                                <div className="text-xs text-slate-500 mt-1">Scan QR code</div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* Show QR Code (Sender) */}
            {mode === 'send' && step === 'show-qr' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                        <span>Show this QR code to the receiving device</span>
                    </div>

                    <div className="flex justify-center p-6 bg-white border border-slate-200 rounded-xl">
                        {qrDataUrl ? (
                            <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
                        ) : (
                            <Loader size={32} className="animate-spin text-slate-400" />
                        )}
                    </div>

                    <button
                        onClick={copyQRData}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <Copy size={16} />
                        Copy QR Data (for manual entry)
                    </button>

                    <div className="border-t border-slate-100 pt-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                            <div className="w-6 h-6 bg-slate-300 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                            <span>Paste the answer from receiving device</span>
                        </div>
                        <textarea
                            value={scannedData}
                            onChange={(e) => setScannedData(e.target.value)}
                            placeholder="Paste answer code here..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none h-20"
                        />
                        <button
                            onClick={handleAnswerInput}
                            disabled={!scannedData.trim()}
                            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 rounded-lg transition-colors"
                        >
                            <ArrowRight size={16} />
                            Complete Connection
                        </button>
                    </div>
                </div>
            )}

            {/* Scanning / Manual Input (Receiver) */}
            {mode === 'receive' && step === 'scanning' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                        <span>Scan or paste the QR code from sending device</span>
                    </div>

                    {/* Camera view (if available) */}
                    <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">
                        <video ref={videoRef} className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-48 h-48 border-2 border-dashed border-white/50 rounded-xl" />
                        </div>
                    </div>

                    <div className="text-center text-sm text-slate-500">
                        — or paste manually —
                    </div>

                    <textarea
                        value={scannedData}
                        onChange={(e) => setScannedData(e.target.value)}
                        placeholder="Paste QR code data here..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none h-20"
                    />

                    <button
                        onClick={handleManualInput}
                        disabled={!scannedData.trim()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 rounded-lg transition-colors"
                    >
                        <ArrowRight size={16} />
                        Process QR Data
                    </button>
                </div>
            )}

            {/* Show Answer QR (Receiver) */}
            {mode === 'receive' && step === 'show-answer' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                        <span>Show this answer to the sending device</span>
                    </div>

                    <div className="flex justify-center p-6 bg-white border border-slate-200 rounded-xl">
                        {qrDataUrl ? (
                            <img src={qrDataUrl} alt="Answer QR Code" className="w-64 h-64" />
                        ) : (
                            <Loader size={32} className="animate-spin text-slate-400" />
                        )}
                    </div>

                    <button
                        onClick={copyQRData}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <Copy size={16} />
                        Copy Answer Data
                    </button>

                    <div className="bg-slate-50 rounded-lg p-3 text-center text-sm text-slate-500">
                        <Loader size={16} className="animate-spin inline mr-2" />
                        Waiting for connection...
                    </div>
                </div>
            )}

            {/* Connecting */}
            {step === 'connecting' && (
                <div className="py-12 text-center">
                    <Loader size={48} className="animate-spin text-cyan-500 mx-auto mb-4" />
                    <p className="text-slate-600">Establishing P2P connection...</p>
                </div>
            )}

            {/* Transferring */}
            {step === 'transferring' && (
                <div className="py-8 space-y-4">
                    <div className="flex items-center justify-center gap-4">
                        <Smartphone size={32} className="text-cyan-500" />
                        <div className="flex items-center gap-1">
                            {[...Array(3)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"
                                    style={{ animationDelay: `${i * 200}ms` }}
                                />
                            ))}
                        </div>
                        <Smartphone size={32} className="text-cyan-500" />
                    </div>

                    <div className="text-center">
                        <p className="text-slate-600 font-medium">Transferring data...</p>
                        <p className="text-2xl font-bold text-cyan-600 mt-1">{progress}%</p>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                            className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Complete */}
            {step === 'complete' && (
                <div className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                        <Check size={32} className="text-emerald-600" />
                    </div>
                    <p className="text-lg font-medium text-slate-800">Transfer Complete!</p>
                    <p className="text-slate-500">Your data has been synced successfully.</p>

                    {receivedData && (
                        <button
                            onClick={processReceivedData}
                            className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                        >
                            Import Data
                        </button>
                    )}
                </div>
            )}

            {/* Error */}
            {step === 'error' && (
                <div className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <X size={32} className="text-red-600" />
                    </div>
                    <p className="text-lg font-medium text-slate-800">Connection Failed</p>
                    <p className="text-slate-500">{error}</p>
                    <button
                        onClick={() => { setMode('select'); setStep('generating'); setError(''); }}
                        className="px-6 py-2 text-sm font-medium text-white bg-slate-600 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Footer Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <button
                    onClick={() => {
                        stopCamera();
                        if (mode !== 'select') {
                            setMode('select');
                            setStep('generating');
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
                    End-to-end encrypted • Zero cloud
                </div>
            </div>
        </div>
    );
};
