/**
 * VaultPinModal - PIN entry for Ghost Vault
 * 
 * Handles setting up vault PIN, duress PIN (panic mode), or entering existing PIN.
 * 
 * MODES:
 * - setup: Create new vault PIN
 * - unlock: Enter existing vault PIN  
 * - duress: Set up panic PIN (shows empty vault when forced to unlock)
 */

import React, { useState } from 'react';
import { X, Ghost, ShieldCheck, Eye, EyeOff, AlertCircle, AlertTriangle } from 'lucide-react';

interface VaultPinModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'setup' | 'unlock' | 'duress';
    onSetup: (pin: string) => Promise<void>;
    onUnlock: (pin: string) => Promise<boolean>;
    onSetupDuress?: (pin: string) => Promise<void>;
}

export const VaultPinModal: React.FC<VaultPinModalProps> = ({
    isOpen,
    onClose,
    mode,
    onSetup,
    onUnlock,
    onSetupDuress,
}) => {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (pin.length < 4) {
            setError('PIN must be at least 4 digits');
            return;
        }

        setIsLoading(true);
        try {
            if (mode === 'setup') {
                if (pin !== confirmPin) {
                    setError('PINs do not match');
                    setIsLoading(false);
                    return;
                }
                await onSetup(pin);
                setPin('');
                setConfirmPin('');
            } else if (mode === 'duress') {
                if (pin !== confirmPin) {
                    setError('PINs do not match');
                    setIsLoading(false);
                    return;
                }
                if (onSetupDuress) {
                    await onSetupDuress(pin);
                }
                setPin('');
                setConfirmPin('');
            } else {
                const success = await onUnlock(pin);
                if (!success) {
                    setError('Incorrect vault PIN');
                    setIsLoading(false);
                    return;
                }
                setPin('');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Header */}
                <div className={`px-6 py-4 flex items-center justify-between ${mode === 'duress' ? 'bg-gradient-to-r from-red-600 to-orange-600' : 'bg-gradient-to-r from-purple-600 to-violet-600'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            {mode === 'duress' ? <AlertTriangle size={20} className="text-white" /> : <Ghost size={20} className="text-white" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">
                                {mode === 'setup' ? 'Setup Ghost Vault'
                                    : mode === 'duress' ? 'Setup Panic Mode'
                                        : 'Unlock Ghost Vault'}
                            </h2>
                            <p className={`text-sm ${mode === 'duress' ? 'text-orange-100' : 'text-purple-100'}`}>
                                {mode === 'setup' ? 'Create a separate PIN for your vault'
                                    : mode === 'duress' ? 'PIN that shows empty vault under coercion'
                                        : 'Enter PIN to access hidden bookmarks'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Duress warning */}
                    {mode === 'duress' && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                            <p className="text-xs text-red-400 text-center">
                                ⚠️ When this PIN is entered, LinkHaven will show a <strong>completely empty</strong> vault. Use this if forced to unlock at a border crossing or in an abusive situation.
                            </p>
                        </div>
                    )}

                    {/* PIN Input */}
                    <div className="relative">
                        <input
                            type={showPin ? "text" : "password"}
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                            placeholder={mode === 'setup' ? "Create vault PIN (min 4 digits)"
                                : mode === 'duress' ? "Create panic PIN (min 4 digits)"
                                    : "Enter vault PIN"}
                            className={`w-full bg-slate-900/50 border focus:border-purple-500 rounded-xl px-4 py-3 text-center text-white text-lg tracking-[0.3em] placeholder:tracking-normal placeholder:text-slate-500 placeholder:text-sm focus:outline-none focus:ring-2 transition-all pr-12 ${mode === 'duress' ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-600 focus:ring-purple-500/20'}`}
                            autoFocus
                            inputMode="numeric"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPin(!showPin)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    {/* Confirm PIN (setup and duress only) */}
                    {(mode === 'setup' || mode === 'duress') && (
                        <div className="relative">
                            <input
                                type={showPin ? "text" : "password"}
                                value={confirmPin}
                                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                placeholder={mode === 'duress' ? "Confirm panic PIN" : "Confirm vault PIN"}
                                className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-center text-white text-lg tracking-[0.3em] placeholder:tracking-normal placeholder:text-slate-500 placeholder:text-sm focus:outline-none focus:ring-2 transition-all ${mode === 'duress' ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-600 focus:border-purple-500 focus:ring-purple-500/20'}`}
                                inputMode="numeric"
                            />
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="flex items-center justify-center gap-2 text-red-400 text-xs font-medium bg-red-500/10 py-2 rounded-lg">
                            <AlertCircle size={14} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full font-medium py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 ${mode === 'duress'
                            ? 'bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white shadow-red-500/20'
                            : 'bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white shadow-purple-500/20'}`}
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                {mode === 'duress' ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
                                <span>
                                    {mode === 'setup' ? 'Create Vault'
                                        : mode === 'duress' ? 'Enable Panic Mode'
                                            : 'Unlock Vault'}
                                </span>
                            </>
                        )}
                    </button>

                    {mode === 'setup' && (
                        <p className="text-xs text-center text-slate-500">
                            🔒 Vault bookmarks are stored separately with their own encryption
                        </p>
                    )}

                    {mode === 'duress' && (
                        <p className="text-xs text-center text-red-400/70">
                            🚨 No competitor offers this feature - you are protected
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
};
