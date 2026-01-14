import React, { useCallback, useState, useRef } from 'react';
import { FolderOpen, Download, Upload, Check, AlertCircle, Clock, HardDrive, X, Image, EyeOff } from 'lucide-react';

interface BackupConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Backup state
    isSupported: boolean;
    isEnabled: boolean;
    hasDirectoryAccess: boolean;
    directoryName: string;
    lastBackupTime: Date | null;
    backupStatus: 'idle' | 'saving' | 'error' | 'success';
    errorMessage: string | null;
    // Actions
    onSelectFolder: () => Promise<boolean>;
    onBackupNow: () => Promise<boolean>;
    onDisableBackup: () => void;
    onRestoreFile: (file: File) => Promise<boolean>;
    getTimeSinceBackup: () => string;
    // Steganography (Hidden Backup)
    onExportToImage?: (carrierImage: File | undefined, password: string) => Promise<void>;
    onImportFromImage?: (stegoImage: File, password: string) => Promise<boolean>;
}

export const BackupConfigModal: React.FC<BackupConfigModalProps> = ({
    isOpen,
    onClose,
    isSupported,
    isEnabled,
    hasDirectoryAccess,
    directoryName,
    backupStatus,
    errorMessage,
    onSelectFolder,
    onBackupNow,
    onDisableBackup,
    onRestoreFile,
    getTimeSinceBackup,
    onExportToImage,
    onImportFromImage,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [restoreStatus, setRestoreStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [stegoStatus, setStegoStatus] = useState<'idle' | 'exporting' | 'importing' | 'success' | 'error'>('idle');
    const [stegoPassword, setStegoPassword] = useState('');
    const stegoInputRef = useRef<HTMLInputElement>(null);
    const carrierInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.json')) {
            setRestoreStatus('loading');
            const success = await onRestoreFile(file);
            setRestoreStatus(success ? 'success' : 'error');
            if (success) {
                setTimeout(() => onClose(), 1500);
            }
        }
    }, [onRestoreFile, onClose]);

    const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRestoreStatus('loading');
            const success = await onRestoreFile(file);
            setRestoreStatus(success ? 'success' : 'error');
            if (success) {
                setTimeout(() => onClose(), 1500);
            }
        }
    }, [onRestoreFile, onClose]);

    // Steganography handlers
    const handleExportToImage = useCallback(async () => {
        if (!onExportToImage || !stegoPassword) return;
        setStegoStatus('exporting');
        try {
            const carrierFile = carrierInputRef.current?.files?.[0];
            await onExportToImage(carrierFile, stegoPassword);
            setStegoStatus('success');
            setTimeout(() => setStegoStatus('idle'), 2000);
        } catch {
            setStegoStatus('error');
        }
    }, [onExportToImage, stegoPassword]);

    const handleImportFromImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onImportFromImage || !stegoPassword) return;

        setStegoStatus('importing');
        const success = await onImportFromImage(file, stegoPassword);
        setStegoStatus(success ? 'success' : 'error');
        if (success) {
            setTimeout(() => onClose(), 1500);
        }
    }, [onImportFromImage, onClose, stegoPassword]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-sm w-full max-h-[80vh] overflow-y-auto"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-xl">
                            <HardDrive size={20} className="text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">Smart Backup</h2>
                            <p className="text-xs text-slate-500">Auto-save every 5 minutes</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Browser Support Warning */}
                    {!isSupported && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <div className="flex items-start gap-3">
                                <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-amber-800">Browser Not Supported</p>
                                    <p className="text-xs text-amber-600 mt-1">
                                        Auto-backup to folder requires Chrome or Edge. You can still use manual export/import.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Current Status */}
                    {isSupported && (
                        <div className={`p-4 rounded-xl border-2 transition-all ${isEnabled && hasDirectoryAccess
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-slate-50 border-slate-200'
                            }`}>
                            {isEnabled && hasDirectoryAccess ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Check size={18} className="text-emerald-500" />
                                            <span className="font-medium text-emerald-800">Auto-Backup Active</span>
                                        </div>
                                        {backupStatus === 'saving' && (
                                            <span className="text-xs bg-emerald-200 text-emerald-700 px-2 py-1 rounded-full animate-pulse">
                                                Saving...
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                                        <FolderOpen size={14} />
                                        <span className="font-mono">{directoryName}/</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-emerald-600">
                                        <Clock size={12} />
                                        <span>Last backup: {getTimeSinceBackup()}</span>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={onBackupNow}
                                            disabled={backupStatus === 'saving'}
                                            className="flex-1 px-3 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            Backup Now
                                        </button>
                                        <button
                                            onClick={onDisableBackup}
                                            className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                        >
                                            Disable
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center space-y-3">
                                    <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto">
                                        <FolderOpen size={24} className="text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-700">Choose a Backup Folder</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Pick a folder (Dropbox, iCloud, etc.) for automatic backups
                                        </p>
                                    </div>
                                    <button
                                        onClick={onSelectFolder}
                                        className="w-full px-4 py-3 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm"
                                    >
                                        Select Folder
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error Message */}
                    {errorMessage && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                            <AlertCircle size={16} className="text-red-500" />
                            <span className="text-sm text-red-700">{errorMessage}</span>
                        </div>
                    )}

                    {/* Restore Section */}
                    <div className="border-t border-slate-100 pt-6">
                        <h3 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                            <Upload size={16} />
                            Restore from Backup
                        </h3>
                        <div
                            className={`p-6 border-2 border-dashed rounded-xl text-center transition-all ${isDragging
                                ? 'border-indigo-400 bg-indigo-50'
                                : restoreStatus === 'success'
                                    ? 'border-emerald-400 bg-emerald-50'
                                    : restoreStatus === 'error'
                                        ? 'border-red-400 bg-red-50'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            {restoreStatus === 'loading' ? (
                                <div className="text-slate-600">
                                    <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                                    <p className="text-sm">Restoring...</p>
                                </div>
                            ) : restoreStatus === 'success' ? (
                                <div className="text-emerald-600">
                                    <Check size={32} className="mx-auto mb-2" />
                                    <p className="text-sm font-medium">Restored successfully!</p>
                                </div>
                            ) : restoreStatus === 'error' ? (
                                <div className="text-red-600">
                                    <AlertCircle size={32} className="mx-auto mb-2" />
                                    <p className="text-sm font-medium">Failed to restore</p>
                                </div>
                            ) : (
                                <>
                                    <Download size={24} className="mx-auto text-slate-400 mb-2" />
                                    <p className="text-sm text-slate-600 mb-1">
                                        Drag & drop <code className="bg-slate-100 px-1 rounded">linkhaven_backup_latest.json</code>
                                    </p>
                                    <p className="text-xs text-slate-400 mb-3">or</p>
                                    <label className="inline-block px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors">
                                        Browse Files
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={handleFileInput}
                                            className="hidden"
                                        />
                                    </label>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Steganography Section - Hidden Backup */}
                    {(onExportToImage || onImportFromImage) && (
                        <div className="border-t border-slate-100 pt-6">
                            <h3 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                                <EyeOff size={16} className="text-purple-500" />
                                Hidden Backup
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">PRO</span>
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">
                                Hide your encrypted backup inside a normal-looking image. Perfect for travel or privacy.
                            </p>

                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Encryption Password (Required)
                                </label>
                                <input
                                    type="password"
                                    value={stegoPassword}
                                    onChange={(e) => setStegoPassword(e.target.value)}
                                    placeholder="Enter a strong password..."
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">
                                    This password is required to unlock the hidden data. Don't lose it!
                                </p>
                            </div>

                            <div className="space-y-3">
                                {/* Export to Image */}
                                {onExportToImage && (
                                    <div className="p-4 bg-purple-50 rounded-xl space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Image size={16} className="text-purple-600" />
                                            <span className="text-sm font-medium text-purple-800">Export to Image</span>
                                        </div>
                                        <p className="text-xs text-purple-600">
                                            Your backup will be hidden inside a PNG image
                                        </p>
                                        <div className="flex gap-2">
                                            <label className="flex-1 text-center px-3 py-2 text-xs font-medium text-purple-600 border border-purple-200 hover:bg-purple-100 rounded-lg cursor-pointer transition-colors">
                                                Custom Image (optional)
                                                <input
                                                    ref={carrierInputRef}
                                                    type="file"
                                                    accept="image/png"
                                                    className="hidden"
                                                />
                                            </label>
                                            <button
                                                onClick={handleExportToImage}
                                                disabled={stegoStatus === 'exporting' || !stegoPassword}
                                                className="flex-1 px-3 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={!stegoPassword ? "Enter a password first" : ""}
                                            >
                                                {stegoStatus === 'exporting' ? 'Creating...' : 'Create Hidden Backup'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Import from Image */}
                                {onImportFromImage && (
                                    <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Upload size={16} className="text-slate-600" />
                                            <span className="text-sm font-medium text-slate-700">Restore from Image</span>
                                        </div>
                                        <label className={`block w-full text-center px-4 py-3 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                                            !stegoPassword
                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                : stegoStatus === 'importing'
                                                    ? 'bg-purple-100 text-purple-600'
                                                    : stegoStatus === 'success'
                                                        ? 'bg-emerald-100 text-emerald-600'
                                                        : stegoStatus === 'error'
                                                            ? 'bg-red-100 text-red-600'
                                                            : 'text-slate-600 border border-slate-200 hover:bg-slate-100'
                                            }`}
                                            title={!stegoPassword ? "Enter a password first" : ""}
                                        >
                                            {stegoStatus === 'importing' ? 'Extracting hidden data...'
                                                : stegoStatus === 'success' ? '✓ Restored successfully!'
                                                    : stegoStatus === 'error' ? 'No hidden backup found'
                                                        : 'Select Image with Hidden Backup'}
                                            <input
                                                ref={stegoInputRef}
                                                type="file"
                                                accept="image/png"
                                                onChange={handleImportFromImage}
                                                className="hidden"
                                                disabled={stegoStatus === 'importing' || !stegoPassword}
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer tip */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-500 text-center">
                        💡 Tip: Choose a Dropbox or iCloud folder for automatic cloud sync!
                    </p>
                </div>
            </div>
        </div>
    );
};
