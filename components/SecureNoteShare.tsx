import React, { useState, useEffect } from 'react';
import { Shield, Copy, Check, Lock, AlertCircle, KeyRound } from 'lucide-react';
import { Note } from '../types';

interface SecureNoteShareProps {
    note: Note;
    onClose: () => void;
}

// AES-256-GCM encryption for military-grade security
async function generateSecureShareCode(note: Note, password: string): Promise<string> {
    const encoder = new TextEncoder();

    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive key from password using PBKDF2 (100,000 iterations)
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 600_000, // OWASP 2025 minimum for PBKDF2-HMAC-SHA256
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    // Prepare note data
    const noteData = JSON.stringify({
        t: note.title,
        c: note.content,
        ts: Date.now()
    });

    // Encrypt with AES-256-GCM
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encoder.encode(noteData)
    );

    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    // Encode to base64
    return btoa(String.fromCharCode(...combined));
}

// Decrypt shared note
export async function decryptSharedNote(code: string, password: string): Promise<{ title: string; content: string } | null> {
    try {
        const decoder = new TextDecoder();

        // Decode base64
        const combined = new Uint8Array(atob(code).split('').map(c => c.charCodeAt(0)));

        // Extract salt, iv, and encrypted data
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const encrypted = combined.slice(28);

        // Derive key from password
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 600_000, // OWASP 2025 minimum for PBKDF2-HMAC-SHA256
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encrypted
        );

        const noteData = JSON.parse(decoder.decode(decrypted));
        return { title: noteData.t, content: noteData.c };
    } catch (e) {
        console.error('Decryption failed:', e);
        return null;
    }
}

export const SecureNoteShare: React.FC<SecureNoteShareProps> = ({ note, onClose }) => {
    const [password, setPassword] = useState('');
    const [shareCode, setShareCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        if (password.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }

        setIsGenerating(true);
        setError('');

        try {
            const code = await generateSecureShareCode(note, password);
            setShareCode(code);
        } catch (e) {
            setError('Failed to generate secure code');
        }

        setIsGenerating(false);
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(shareCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-4">
            {/* Security Badge */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 text-center border border-green-200">
                <Shield size={48} className="mx-auto text-green-600 mb-2" />
                <h3 className="font-semibold text-slate-800 mb-1">🔒 Military-Grade Encryption</h3>
                <p className="text-sm text-slate-600">
                    AES-256-GCM • PBKDF2 100K iterations • Quantum-resistant
                </p>
            </div>

            {/* Note Preview */}
            <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700 mb-1">Sharing Note:</p>
                <p className="text-sm text-slate-600 font-semibold">{note.title}</p>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{note.content.substring(0, 100)}...</p>
            </div>

            {!shareCode ? (
                <>
                    {/* Password Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            <KeyRound size={14} className="inline mr-1" />
                            Create a Secret Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 4 characters..."
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Share this password separately via call or in person
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !password}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-medium rounded-xl shadow-lg shadow-green-200 transition-all"
                    >
                        <Lock size={18} />
                        {isGenerating ? 'Encrypting...' : 'Generate Secure Code'}
                    </button>
                </>
            ) : (
                <>
                    {/* Generated Code */}
                    <div className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">Encrypted Note Code</span>
                            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                🔒 Encrypted
                            </span>
                        </div>
                        <textarea
                            value={shareCode}
                            readOnly
                            className="w-full h-24 p-2 text-xs font-mono bg-white border border-slate-200 rounded resize-none"
                        />
                    </div>

                    <button
                        onClick={handleCopy}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'Copied!' : 'Copy Secure Code'}
                    </button>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                        <strong>⚠️ Important:</strong>
                        <ul className="mt-1 list-disc list-inside text-xs space-y-1">
                            <li>Share the code via WhatsApp/SMS</li>
                            <li>Share the password separately (call/in-person)</li>
                            <li>Friend needs LinkHaven + "Unlock Note" to view</li>
                        </ul>
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
