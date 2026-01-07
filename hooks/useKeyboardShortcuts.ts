/**
 * useKeyboardShortcuts - Global keyboard shortcut handler
 * 
 * Manages application-wide keyboard shortcuts for power users.
 * Shortcuts are only active when authenticated.
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcuts {
    onSearch?: () => void;       // Ctrl/Cmd + K
    onAddBookmark?: () => void;  // Ctrl/Cmd + B
    onAddNote?: () => void;      // Ctrl/Cmd + N
    onLock?: () => void;         // Ctrl/Cmd + L
    onEscape?: () => void;       // Escape
}

/**
 * Hook for managing global keyboard shortcuts
 */
export function useKeyboardShortcuts(
    shortcuts: KeyboardShortcuts,
    isEnabled: boolean = true
) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isEnabled) return;

        // Don't trigger shortcuts when typing in inputs
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            // Only handle Escape in inputs
            if (e.key === 'Escape' && shortcuts.onEscape) {
                shortcuts.onEscape();
            }
            return;
        }

        const isMod = e.ctrlKey || e.metaKey;

        // Ctrl/Cmd + K: Focus search
        if (isMod && e.key === 'k') {
            e.preventDefault();
            shortcuts.onSearch?.();
            return;
        }

        // Ctrl/Cmd + B: Add bookmark
        if (isMod && e.key === 'b') {
            e.preventDefault();
            shortcuts.onAddBookmark?.();
            return;
        }

        // Ctrl/Cmd + N: Add note
        if (isMod && e.key === 'n') {
            e.preventDefault();
            shortcuts.onAddNote?.();
            return;
        }

        // Ctrl/Cmd + L: Lock
        if (isMod && e.key === 'l') {
            e.preventDefault();
            shortcuts.onLock?.();
            return;
        }

        // Escape: Close modals/clear search
        if (e.key === 'Escape') {
            shortcuts.onEscape?.();
        }
    }, [isEnabled, shortcuts]);

    useEffect(() => {
        if (!isEnabled) return;

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isEnabled, handleKeyDown]);
}
