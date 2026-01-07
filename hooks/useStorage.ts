/**
 * useStorage - Encrypted localStorage persistence hook
 * 
 * Handles loading and saving data with AES-256-GCM encryption.
 * This hook can be gradually adopted - doesn't require changing existing code.
 */

import { useCallback } from 'react';
import { Folder, Bookmark, Notebook, Note, TrashedItem } from '../types';
import { encrypt, decrypt, isEncryptionSupported } from '../utils/crypto';

// Storage keys for localStorage
export const STORAGE_KEYS = {
    CANARY: 'lh_canary',
    SALT: 'lh_salt',
    FOLDERS: 'lh_folders',
    BOOKMARKS: 'lh_bookmarks',
    NOTEBOOKS: 'lh_notebooks',
    NOTES: 'lh_notes',
    TRASH: 'lh_trash',
    SESSION: 'lh_session',
    ENCRYPTED: 'lh_encrypted'
} as const;

export interface StorageData {
    folders: Folder[];
    bookmarks: Bookmark[];
    notebooks: Notebook[];
    notes: Note[];
    trash: TrashedItem[];
}

/**
 * Hook for encrypted localStorage operations
 */
export function useStorage(cryptoKey: CryptoKey | null) {
    /**
     * Load all data from localStorage with decryption
     */
    const loadData = useCallback(async (): Promise<StorageData> => {
        try {
            const isEncrypted = localStorage.getItem(STORAGE_KEYS.ENCRYPTED) === 'true';

            let foldersData = localStorage.getItem(STORAGE_KEYS.FOLDERS);
            let bookmarksData = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
            let notebooksData = localStorage.getItem(STORAGE_KEYS.NOTEBOOKS);
            let notesData = localStorage.getItem(STORAGE_KEYS.NOTES);
            let trashData = localStorage.getItem(STORAGE_KEYS.TRASH);

            if (isEncrypted && cryptoKey) {
                try {
                    if (foldersData) foldersData = await decrypt(foldersData, cryptoKey);
                    if (bookmarksData) bookmarksData = await decrypt(bookmarksData, cryptoKey);
                    if (notebooksData) notebooksData = await decrypt(notebooksData, cryptoKey);
                    if (notesData) notesData = await decrypt(notesData, cryptoKey);
                    if (trashData) trashData = await decrypt(trashData, cryptoKey);
                } catch (e) {
                    console.error('Decryption failed:', e);
                }
            }

            const folders = foldersData
                ? JSON.parse(foldersData)
                : [{ id: 'default', name: 'General', createdAt: Date.now() }];

            const bookmarks = bookmarksData
                ? JSON.parse(bookmarksData).map((b: Bookmark) => ({ ...b, tags: b.tags || [] }))
                : [];

            const notebooks = notebooksData
                ? JSON.parse(notebooksData)
                : [{ id: 'default-notebook', name: 'General', createdAt: Date.now() }];

            const notes = notesData
                ? JSON.parse(notesData).map((n: Note) => ({ ...n, tags: n.tags || [] }))
                : [];

            // Auto-cleanup expired trash items (7-day auto-delete)
            const loadedTrash: TrashedItem[] = trashData ? JSON.parse(trashData) : [];
            const now = Date.now();
            const trash = loadedTrash.filter(item => item.autoDeleteAt > now);
            if (trash.length !== loadedTrash.length) {
                console.log(`Auto-deleted ${loadedTrash.length - trash.length} expired trash items`);
            }

            return { folders, bookmarks, notebooks, notes, trash };
        } catch (e) {
            console.error('Failed to load data:', e);
            return {
                folders: [{ id: 'default', name: 'General', createdAt: Date.now() }],
                bookmarks: [],
                notebooks: [{ id: 'default-notebook', name: 'General', createdAt: Date.now() }],
                notes: [],
                trash: []
            };
        }
    }, [cryptoKey]);

    /**
     * Save all data to localStorage with encryption
     */
    const saveData = useCallback(async (data: StorageData): Promise<void> => {
        try {
            let foldersData = JSON.stringify(data.folders);
            let bookmarksData = JSON.stringify(data.bookmarks);
            let notebooksData = JSON.stringify(data.notebooks);
            let notesData = JSON.stringify(data.notes);
            let trashData = JSON.stringify(data.trash);

            if (cryptoKey && isEncryptionSupported()) {
                foldersData = await encrypt(foldersData, cryptoKey);
                bookmarksData = await encrypt(bookmarksData, cryptoKey);
                notebooksData = await encrypt(notebooksData, cryptoKey);
                notesData = await encrypt(notesData, cryptoKey);
                trashData = await encrypt(trashData, cryptoKey);
                localStorage.setItem(STORAGE_KEYS.ENCRYPTED, 'true');
            }

            localStorage.setItem(STORAGE_KEYS.FOLDERS, foldersData);
            localStorage.setItem(STORAGE_KEYS.BOOKMARKS, bookmarksData);
            localStorage.setItem(STORAGE_KEYS.NOTEBOOKS, notebooksData);
            localStorage.setItem(STORAGE_KEYS.NOTES, notesData);
            localStorage.setItem(STORAGE_KEYS.TRASH, trashData);
        } catch (e) {
            console.error('Failed to save data:', e);
        }
    }, [cryptoKey]);

    /**
     * Save individual collection (more granular updates)
     */
    const saveCollection = useCallback(async <T>(
        key: keyof typeof STORAGE_KEYS,
        data: T
    ): Promise<void> => {
        try {
            let serialized = JSON.stringify(data);

            if (cryptoKey && isEncryptionSupported()) {
                serialized = await encrypt(serialized, cryptoKey);
            }

            localStorage.setItem(STORAGE_KEYS[key], serialized);
        } catch (e) {
            console.error(`Failed to save ${key}:`, e);
        }
    }, [cryptoKey]);

    /**
     * Clear all stored data (for logout/reset)
     */
    const clearData = useCallback(() => {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    }, []);

    /**
     * Check if user has existing data
     */
    const hasExistingData = useCallback(() => {
        return !!localStorage.getItem(STORAGE_KEYS.CANARY);
    }, []);

    return {
        loadData,
        saveData,
        saveCollection,
        clearData,
        hasExistingData,
        STORAGE_KEYS
    };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
