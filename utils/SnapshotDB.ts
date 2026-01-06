/**
 * SnapshotDB - IndexedDB wrapper for encrypted page snapshots
 * 
 * Architecture:
 * - Uses IndexedDB for persistent storage (survives browser restarts)
 * - Integrates with existing AES-256-GCM encryption
 * - LZ-String compression for efficient storage
 * - Designed for O(1) lookups by bookmarkId
 * 
 * Storage Flow:
 * 1. Content → LZ-String compress → AES encrypt → IndexedDB
 * 2. IndexedDB → AES decrypt → LZ-String decompress → Content
 */

import { openDB, IDBPDatabase } from 'idb';
import LZString from 'lz-string';
import { encrypt, decrypt, isEncryptionSupported } from './crypto';

// Database configuration
const DB_NAME = 'linkhaven_snapshots';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

// Snapshot record structure
export interface SnapshotRecord {
    bookmarkId: string;       // Primary key
    encryptedContent: string; // LZ-String compressed, then AES encrypted
    savedAt: number;          // Unix timestamp
    originalUrl: string;      // For reference
    title: string;            // Page title
    byline: string | null;    // Author if available
    siteName: string | null;  // Site name
    excerpt: string;          // First 200 chars for preview
    compressedSize: number;   // Size in bytes after compression
    originalSize: number;     // Original HTML size
}

// Metadata returned when listing snapshots (without content)
export interface SnapshotMetadata {
    bookmarkId: string;
    savedAt: number;
    title: string;
    excerpt: string;
    compressedSize: number;
    compressionRatio: number;
}

// Full snapshot data when viewing
export interface SnapshotContent {
    bookmarkId: string;
    content: string;          // Decrypted, decompressed HTML
    title: string;
    byline: string | null;
    siteName: string | null;
    savedAt: number;
    originalUrl: string;
}

// Storage statistics
export interface StorageStats {
    totalSnapshots: number;
    totalSize: number;        // Total compressed size in bytes
    averageSize: number;      // Average snapshot size
    averageCompressionRatio: number;
}

/**
 * SnapshotDB Class
 * 
 * Singleton pattern ensures single database connection
 * All operations are async and handle encryption transparently
 */
class SnapshotDBClass {
    private db: IDBPDatabase | null = null;
    private cryptoKey: CryptoKey | null = null;
    private initPromise: Promise<void> | null = null;

    /**
     * Initialize the database connection
     * Creates object store if it doesn't exist
     */
    private async init(): Promise<void> {
        if (this.db) return;

        if (this.initPromise) {
            await this.initPromise;
            return;
        }

        this.initPromise = (async () => {
            this.db = await openDB(DB_NAME, DB_VERSION, {
                upgrade(db) {
                    // Create object store with bookmarkId as key
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        const store = db.createObjectStore(STORE_NAME, { keyPath: 'bookmarkId' });
                        // Index for querying by save date
                        store.createIndex('savedAt', 'savedAt');
                    }
                },
            });
        })();

        await this.initPromise;
    }

    /**
     * Set the encryption key (derived from user's PIN)
     * Must be called after user authentication
     */
    setCryptoKey(key: CryptoKey | null): void {
        this.cryptoKey = key;
    }

    /**
     * Save a page snapshot
     * 
     * @param bookmarkId - Unique identifier for the bookmark
     * @param content - Raw HTML content from Readability
     * @param metadata - Page metadata (title, url, etc.)
     * 
     * Time Complexity: O(n) where n = content length (for compression)
     * Space Complexity: O(n) for compressed content
     */
    async saveSnapshot(
        bookmarkId: string,
        content: string,
        metadata: {
            originalUrl: string;
            title: string;
            byline: string | null;
            siteName: string | null;
            excerpt: string;
        }
    ): Promise<SnapshotMetadata> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const originalSize = new Blob([content]).size;

        // Step 1: Compress with LZ-String (UTF-16 for IndexedDB efficiency)
        const compressed = LZString.compressToUTF16(content);
        if (!compressed) throw new Error('Compression failed');

        const compressedSize = new Blob([compressed]).size;

        // Step 2: Encrypt if key is available
        let encryptedContent: string;
        if (this.cryptoKey && isEncryptionSupported()) {
            encryptedContent = await encrypt(compressed, this.cryptoKey);
        } else {
            // Fallback to unencrypted (still compressed)
            encryptedContent = compressed;
        }

        // Step 3: Create record
        const record: SnapshotRecord = {
            bookmarkId,
            encryptedContent,
            savedAt: Date.now(),
            originalUrl: metadata.originalUrl,
            title: metadata.title,
            byline: metadata.byline,
            siteName: metadata.siteName,
            excerpt: metadata.excerpt.slice(0, 200),
            compressedSize,
            originalSize,
        };

        // Step 4: Store in IndexedDB
        await this.db.put(STORE_NAME, record);

        return {
            bookmarkId,
            savedAt: record.savedAt,
            title: record.title,
            excerpt: record.excerpt,
            compressedSize,
            compressionRatio: Math.round((1 - compressedSize / originalSize) * 100),
        };
    }

    /**
     * Retrieve and decrypt a snapshot
     * 
     * @param bookmarkId - Unique identifier for the bookmark
     * @returns Full snapshot content or null if not found
     * 
     * Time Complexity: O(n) for decompression
     * Space Complexity: O(n) for decompressed content
     */
    async getSnapshot(bookmarkId: string): Promise<SnapshotContent | null> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const record = await this.db.get(STORE_NAME, bookmarkId) as SnapshotRecord | undefined;
        if (!record) return null;

        // Step 1: Decrypt if encrypted
        let compressed: string;
        if (this.cryptoKey && isEncryptionSupported()) {
            try {
                compressed = await decrypt(record.encryptedContent, this.cryptoKey);
            } catch (e) {
                // If decryption fails, content might be unencrypted
                compressed = record.encryptedContent;
            }
        } else {
            compressed = record.encryptedContent;
        }

        // Step 2: Decompress
        const content = LZString.decompressFromUTF16(compressed);
        if (!content) throw new Error('Decompression failed - snapshot may be corrupted');

        return {
            bookmarkId,
            content,
            title: record.title,
            byline: record.byline,
            siteName: record.siteName,
            savedAt: record.savedAt,
            originalUrl: record.originalUrl,
        };
    }

    /**
     * Check if a snapshot exists for a bookmark
     * 
     * Time Complexity: O(1)
     */
    async hasSnapshot(bookmarkId: string): Promise<boolean> {
        await this.init();
        if (!this.db) return false;

        const count = await this.db.count(STORE_NAME, bookmarkId);
        return count > 0;
    }

    /**
     * Get snapshot metadata without decrypting content
     * Useful for displaying snapshot info without loading full content
     * 
     * Time Complexity: O(1)
     */
    async getSnapshotMetadata(bookmarkId: string): Promise<SnapshotMetadata | null> {
        await this.init();
        if (!this.db) return null;

        const record = await this.db.get(STORE_NAME, bookmarkId) as SnapshotRecord | undefined;
        if (!record) return null;

        return {
            bookmarkId: record.bookmarkId,
            savedAt: record.savedAt,
            title: record.title,
            excerpt: record.excerpt,
            compressedSize: record.compressedSize,
            compressionRatio: Math.round((1 - record.compressedSize / record.originalSize) * 100),
        };
    }

    /**
     * Delete a snapshot
     * 
     * Time Complexity: O(1)
     */
    async deleteSnapshot(bookmarkId: string): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        await this.db.delete(STORE_NAME, bookmarkId);
    }

    /**
     * Get all snapshot metadata
     * Returns list without content (for listing UI)
     * 
     * Time Complexity: O(n) where n = number of snapshots
     */
    async getAllSnapshots(): Promise<SnapshotMetadata[]> {
        await this.init();
        if (!this.db) return [];

        const records = await this.db.getAll(STORE_NAME) as SnapshotRecord[];

        return records.map(record => ({
            bookmarkId: record.bookmarkId,
            savedAt: record.savedAt,
            title: record.title,
            excerpt: record.excerpt,
            compressedSize: record.compressedSize,
            compressionRatio: Math.round((1 - record.compressedSize / record.originalSize) * 100),
        }));
    }

    /**
     * Get storage statistics
     * 
     * Time Complexity: O(n) where n = number of snapshots
     */
    async getStorageStats(): Promise<StorageStats> {
        await this.init();
        if (!this.db) {
            return { totalSnapshots: 0, totalSize: 0, averageSize: 0, averageCompressionRatio: 0 };
        }

        const records = await this.db.getAll(STORE_NAME) as SnapshotRecord[];

        if (records.length === 0) {
            return { totalSnapshots: 0, totalSize: 0, averageSize: 0, averageCompressionRatio: 0 };
        }

        const totalSize = records.reduce((sum, r) => sum + r.compressedSize, 0);
        const totalOriginalSize = records.reduce((sum, r) => sum + r.originalSize, 0);

        return {
            totalSnapshots: records.length,
            totalSize,
            averageSize: Math.round(totalSize / records.length),
            averageCompressionRatio: Math.round((1 - totalSize / totalOriginalSize) * 100),
        };
    }

    /**
     * Clear all snapshots
     * Use with caution - irreversible
     */
    async clearAll(): Promise<void> {
        await this.init();
        if (!this.db) return;

        await this.db.clear(STORE_NAME);
    }

    /**
     * Get IDs of all bookmarks with snapshots
     * Useful for batch operations
     * 
     * Time Complexity: O(n)
     */
    async getAllBookmarkIds(): Promise<string[]> {
        await this.init();
        if (!this.db) return [];

        const keys = await this.db.getAllKeys(STORE_NAME);
        return keys as string[];
    }
}

// Singleton instance
export const SnapshotDB = new SnapshotDBClass();
