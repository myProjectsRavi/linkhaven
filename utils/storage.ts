// LinkHaven - IndexedDB Storage Layer
// Uses idb-keyval for async, scalable storage (replaces localStorage for large data)
// Maintains backwards compatibility with existing localStorage data

import { set, get, del, keys, clear } from 'idb-keyval';

// Storage keys (same as before for compatibility)
export const STORAGE_KEYS = {
    CANARY: 'lh_canary',
    SALT: 'lh_salt',
    FOLDERS: 'lh_folders',
    BOOKMARKS: 'lh_bookmarks',
    SESSION: 'lh_session',
    ENCRYPTED: 'lh_encrypted',
    // Premium feature flags
    PREMIUM_ACTIVE: 'lh_premium',
    PREMIUM_FEATURES: 'lh_premium_features'
};

// Small/critical data stays in localStorage (sync access needed)
const LOCALSTORAGE_KEYS = [
    STORAGE_KEYS.CANARY,
    STORAGE_KEYS.SALT,
    STORAGE_KEYS.SESSION,
    STORAGE_KEYS.ENCRYPTED,
    STORAGE_KEYS.PREMIUM_ACTIVE
];

/**
 * Check if a key should use localStorage (small/critical data)
 */
function usesLocalStorage(key: string): boolean {
    return LOCALSTORAGE_KEYS.includes(key);
}

/**
 * Set a value in appropriate storage
 */
export async function setItem(key: string, value: string): Promise<void> {
    if (usesLocalStorage(key)) {
        localStorage.setItem(key, value);
    } else {
        await set(key, value);
    }
}

/**
 * Get a value from appropriate storage
 */
export async function getItem(key: string): Promise<string | null> {
    if (usesLocalStorage(key)) {
        return localStorage.getItem(key);
    }
    const value = await get(key);
    return value ?? null;
}

/**
 * Remove a value from storage
 */
export async function removeItem(key: string): Promise<void> {
    if (usesLocalStorage(key)) {
        localStorage.removeItem(key);
    } else {
        await del(key);
    }
}

/**
 * Get all keys in IndexedDB storage
 */
export async function getAllKeys(): Promise<string[]> {
    const idbKeys = await keys();
    return idbKeys.map(k => String(k));
}

/**
 * Clear all data (both localStorage and IndexedDB)
 */
export async function clearAll(): Promise<void> {
    localStorage.clear();
    await clear();
}

/**
 * Migrate data from localStorage to IndexedDB (one-time operation)
 */
export async function migrateFromLocalStorage(): Promise<{
    migrated: boolean;
    bookmarkCount?: number;
    folderCount?: number;
}> {
    // Check if migration is needed
    const alreadyMigrated = localStorage.getItem('lh_migrated_to_idb');
    if (alreadyMigrated) {
        return { migrated: false };
    }

    try {
        // Get data from localStorage
        const foldersData = localStorage.getItem(STORAGE_KEYS.FOLDERS);
        const bookmarksData = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);

        if (!foldersData && !bookmarksData) {
            localStorage.setItem('lh_migrated_to_idb', 'true');
            return { migrated: false };
        }

        // Move to IndexedDB
        if (foldersData) {
            await set(STORAGE_KEYS.FOLDERS, foldersData);
            localStorage.removeItem(STORAGE_KEYS.FOLDERS);
        }

        if (bookmarksData) {
            await set(STORAGE_KEYS.BOOKMARKS, bookmarksData);
            localStorage.removeItem(STORAGE_KEYS.BOOKMARKS);
        }

        // Mark as migrated
        localStorage.setItem('lh_migrated_to_idb', 'true');

        // Count migrated items
        let folderCount = 0;
        let bookmarkCount = 0;

        try {
            if (foldersData) folderCount = JSON.parse(foldersData).length;
            if (bookmarksData) bookmarkCount = JSON.parse(bookmarksData).length;
        } catch {
            // Data might be encrypted, that's fine
        }

        return { migrated: true, folderCount, bookmarkCount };

    } catch (e) {
        console.error('Migration failed:', e);
        return { migrated: false };
    }
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(): Promise<{
    localStorageUsed: number;
    indexedDBUsed: number;
    totalUsed: number;
    localStorageLimit: number;
    percentUsed: number;
}> {
    // localStorage usage
    let localStorageUsed = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            const value = localStorage.getItem(key);
            if (value) {
                localStorageUsed += key.length + value.length;
            }
        }
    }
    localStorageUsed *= 2; // UTF-16 = 2 bytes per char

    // IndexedDB usage (approximate)
    let indexedDBUsed = 0;
    const allKeys = await keys();
    for (const key of allKeys) {
        const value = await get(key);
        if (typeof value === 'string') {
            indexedDBUsed += value.length * 2;
        } else if (value) {
            indexedDBUsed += JSON.stringify(value).length * 2;
        }
    }

    const totalUsed = localStorageUsed + indexedDBUsed;
    const localStorageLimit = 5 * 1024 * 1024; // 5MB

    return {
        localStorageUsed,
        indexedDBUsed,
        totalUsed,
        localStorageLimit,
        percentUsed: Math.round((localStorageUsed / localStorageLimit) * 100)
    };
}

/**
 * Check if storage is available
 */
export function isStorageAvailable(): boolean {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check IndexedDB availability
 */
export async function isIndexedDBAvailable(): Promise<boolean> {
    try {
        await set('__idb_test__', 'test');
        await del('__idb_test__');
        return true;
    } catch {
        return false;
    }
}
