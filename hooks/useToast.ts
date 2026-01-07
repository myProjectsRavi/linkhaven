/**
 * useToast - Toast notification hook
 * 
 * Provides a simple API for showing success/error notifications
 * with auto-dismiss functionality.
 */

import { useState, useCallback, useRef } from 'react';

export interface ToastState {
    message: string;
    type: 'success' | 'error';
}

export interface UseToastReturn {
    toast: ToastState | null;
    showToast: (message: string, type: 'success' | 'error') => void;
    hideToast: () => void;
}

/**
 * Hook for managing toast notifications
 */
export function useToast(autoDismissMs: number = 3000): UseToastReturn {
    const [toast, setToast] = useState<ToastState | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hideToast = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setToast(null);
    }, []);

    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        // Clear any existing timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        setToast({ message, type });

        // Auto-dismiss after specified time
        timerRef.current = setTimeout(() => {
            setToast(null);
            timerRef.current = null;
        }, autoDismissMs);
    }, [autoDismissMs]);

    return { toast, showToast, hideToast };
}
