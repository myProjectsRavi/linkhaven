/**
 * useAuth - Authentication hook with PIN-based encryption
 * 
 * Handles:
 * - PIN setup and verification
 * - Session management
 * - Auto-lock timeout
 * - CryptoKey derivation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    deriveKey,
    generateSalt,
    arrayToBase64,
    base64ToArray,
    createVerificationCanary,
    verifyPinWithCanary
} from '../utils/crypto';
import { STORAGE_KEYS } from './useStorage';

// Auto-lock timeout (5 minutes of inactivity)
const AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export interface AuthState {
    hasPin: boolean;
    isAuthenticated: boolean;
    cryptoKey: CryptoKey | null;
}

export interface AuthActions {
    handleUnlock: (inputPin: string) => Promise<boolean>;
    handleSetupPin: (newPin: string) => Promise<void>;
    handleLock: () => void;
    resetTimer: () => void;
}

/**
 * Authentication hook with auto-lock and PIN verification
 */
export function useAuth(
    onAuthenticated?: (key: CryptoKey) => void,
    onLocked?: () => void
): AuthState & AuthActions {
    // Check for existing canary (encrypted verification)
    const [hasPin, setHasPin] = useState<boolean>(
        !!localStorage.getItem(STORAGE_KEYS.CANARY)
    );
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
        !!sessionStorage.getItem(STORAGE_KEYS.SESSION)
    );
    const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

    const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /**
     * Unlock with PIN - verifies against stored canary
     */
    const handleUnlock = useCallback(async (inputPin: string): Promise<boolean> => {
        try {
            const storedSalt = localStorage.getItem(STORAGE_KEYS.SALT);
            const storedCanary = localStorage.getItem(STORAGE_KEYS.CANARY);

            if (!storedSalt || !storedCanary) {
                return false;
            }

            const salt = base64ToArray(storedSalt);
            const key = await deriveKey(inputPin, salt);

            // Verify PIN by decrypting canary
            const isValid = await verifyPinWithCanary(storedCanary, key);
            if (!isValid) {
                return false;
            }

            sessionStorage.setItem(STORAGE_KEYS.SESSION, 'true');
            setIsAuthenticated(true);
            setCryptoKey(key);
            onAuthenticated?.(key);
            return true;
        } catch (error) {
            console.error('Unlock failed:', error);
            return false;
        }
    }, [onAuthenticated]);

    /**
     * Setup new PIN - creates salt and encrypted canary
     */
    const handleSetupPin = useCallback(async (newPin: string): Promise<void> => {
        const salt = generateSalt();
        const key = await deriveKey(newPin, salt);

        // Store salt for future derivation
        localStorage.setItem(STORAGE_KEYS.SALT, arrayToBase64(salt));

        // Create and store encrypted canary (proves correct PIN without storing it)
        const encryptedCanary = await createVerificationCanary(key);
        localStorage.setItem(STORAGE_KEYS.CANARY, encryptedCanary);

        setHasPin(true);
        sessionStorage.setItem(STORAGE_KEYS.SESSION, 'true');
        setIsAuthenticated(true);
        setCryptoKey(key);
        localStorage.setItem(STORAGE_KEYS.ENCRYPTED, 'true');

        onAuthenticated?.(key);
    }, [onAuthenticated]);

    /**
     * Lock the application
     */
    const handleLock = useCallback(() => {
        sessionStorage.removeItem(STORAGE_KEYS.SESSION);
        setIsAuthenticated(false);
        setCryptoKey(null);
        onLocked?.();
    }, [onLocked]);

    /**
     * Reset the auto-lock timer
     */
    const resetTimer = useCallback(() => {
        if (lockTimerRef.current) {
            clearTimeout(lockTimerRef.current);
        }
        if (isAuthenticated) {
            lockTimerRef.current = setTimeout(() => {
                handleLock();
            }, AUTO_LOCK_TIMEOUT_MS);
        }
    }, [isAuthenticated, handleLock]);

    // Setup auto-lock on user activity
    useEffect(() => {
        if (!isAuthenticated) return;

        resetTimer();
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

        events.forEach(event => {
            document.addEventListener(event, resetTimer, { passive: true });
        });

        return () => {
            if (lockTimerRef.current) {
                clearTimeout(lockTimerRef.current);
            }
            events.forEach(event => {
                document.removeEventListener(event, resetTimer);
            });
        };
    }, [isAuthenticated, resetTimer]);

    return {
        hasPin,
        isAuthenticated,
        cryptoKey,
        handleUnlock,
        handleSetupPin,
        handleLock,
        resetTimer
    };
}
