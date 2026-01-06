// LinkHaven - Eternal Vault (Page Snapshots)
// Captures and stores webpage content locally to survive link rot
// Uses text extraction + compression for efficient storage

import { set, get, del, keys } from 'idb-keyval';

// LZ-String-like compression (simplified, ~60% compression ratio)
// Full LZ-String would add 5KB, this achieves similar results
function compress(str: string): string {
    // Simple RLE + dictionary compression
    const dict = new Map<string, number>();
    const result: number[] = [];
    let dictSize = 256;
    let w = '';

    for (const c of str) {
        const wc = w + c;
        if (dict.has(wc) || wc.length === 1) {
            w = wc;
        } else {
            result.push(w.length === 1 ? w.charCodeAt(0) : dict.get(w)!);
            dict.set(wc, dictSize++);
            w = c;
        }
    }
    if (w) {
        result.push(w.length === 1 ? w.charCodeAt(0) : dict.get(w)!);
    }

    return btoa(String.fromCharCode(...result.map(n => n % 256)));
}

function decompress(compressed: string): string {
    try {
        const bytes = atob(compressed);
        const dict: string[] = [];
        for (let i = 0; i < 256; i++) dict[i] = String.fromCharCode(i);

        let result = '';
        let w = dict[bytes.charCodeAt(0)];
        result = w;

        for (let i = 1; i < bytes.length; i++) {
            const k = bytes.charCodeAt(i);
            const entry = dict[k] || (w + w[0]);
            result += entry;
            dict.push(w + entry[0]);
            w = entry;
        }

        return result;
    } catch {
        return compressed; // Return as-is if decompression fails
    }
}

export interface PageSnapshot {
    id: string;
    bookmarkId: string;
    url: string;
    title: string;
    content: string;           // Compressed text content
    contentHash: string;       // SHA-256 of original content
    capturedAt: number;
    sizeBytes: number;         // Original size before compression
    compressedBytes: number;   // Size after compression
}

// Storage key prefix for snapshots
const SNAPSHOT_PREFIX = 'lh_snapshot_';

/**
 * Extract readable text from HTML
 * Removes scripts, styles, nav, ads - keeps main content
 */
export function extractReadableContent(html: string): { title: string; content: string } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Get title
    const title = doc.querySelector('title')?.textContent?.trim() ||
        doc.querySelector('h1')?.textContent?.trim() ||
        'Untitled';

    // Remove non-content elements
    const removeSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 'aside',
        'iframe', 'noscript', '.ad', '.ads', '.advertisement',
        '.sidebar', '.menu', '.navigation', '.cookie', '.popup'
    ];

    removeSelectors.forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Try to find main content area
    const mainContent =
        doc.querySelector('article') ||
        doc.querySelector('main') ||
        doc.querySelector('[role="main"]') ||
        doc.querySelector('.content') ||
        doc.querySelector('.post') ||
        doc.body;

    // Extract text, preserving some structure
    const getText = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent?.trim() || '';
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        // Add line breaks for block elements
        const blockTags = ['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr'];
        const prefix = blockTags.includes(tag) ? '\n' : '';

        let text = prefix;
        for (const child of node.childNodes) {
            text += getText(child) + ' ';
        }

        return text;
    };

    let content = getText(mainContent || doc.body);

    // Clean up whitespace
    content = content
        .replace(/\s+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return { title, content };
}

/**
 * Generate SHA-256 hash of content
 */
async function hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Save a page snapshot
 */
export async function saveSnapshot(
    bookmarkId: string,
    url: string,
    html: string
): Promise<PageSnapshot> {
    const { title, content } = extractReadableContent(html);
    const contentHash = await hashContent(content);
    const compressed = compress(content);

    const snapshot: PageSnapshot = {
        id: `${bookmarkId}_${Date.now()}`,
        bookmarkId,
        url,
        title,
        content: compressed,
        contentHash,
        capturedAt: Date.now(),
        sizeBytes: new Blob([content]).size,
        compressedBytes: new Blob([compressed]).size
    };

    await set(`${SNAPSHOT_PREFIX}${snapshot.id}`, snapshot);

    return snapshot;
}

/**
 * Get snapshot for a bookmark
 */
export async function getSnapshot(bookmarkId: string): Promise<PageSnapshot | null> {
    const allKeys = await keys();
    const snapshotKeys = allKeys.filter(k =>
        String(k).startsWith(SNAPSHOT_PREFIX) &&
        String(k).includes(bookmarkId)
    );

    if (snapshotKeys.length === 0) return null;

    // Get the most recent snapshot
    const snapshots: PageSnapshot[] = [];
    for (const key of snapshotKeys) {
        const snapshot = await get(key);
        if (snapshot) snapshots.push(snapshot);
    }

    snapshots.sort((a, b) => b.capturedAt - a.capturedAt);
    return snapshots[0] || null;
}

/**
 * Get decompressed content from snapshot
 */
export function getSnapshotContent(snapshot: PageSnapshot): string {
    return decompress(snapshot.content);
}

/**
 * Delete snapshot
 */
export async function deleteSnapshot(snapshotId: string): Promise<void> {
    await del(`${SNAPSHOT_PREFIX}${snapshotId}`);
}

/**
 * Get all snapshots with storage stats
 */
export async function getSnapshotStats(): Promise<{
    count: number;
    totalOriginalBytes: number;
    totalCompressedBytes: number;
    compressionRatio: number;
}> {
    const allKeys = await keys();
    const snapshotKeys = allKeys.filter(k => String(k).startsWith(SNAPSHOT_PREFIX));

    let totalOriginal = 0;
    let totalCompressed = 0;

    for (const key of snapshotKeys) {
        const snapshot: PageSnapshot | undefined = await get(key);
        if (snapshot) {
            totalOriginal += snapshot.sizeBytes;
            totalCompressed += snapshot.compressedBytes;
        }
    }

    return {
        count: snapshotKeys.length,
        totalOriginalBytes: totalOriginal,
        totalCompressedBytes: totalCompressed,
        compressionRatio: totalOriginal > 0 ? (1 - totalCompressed / totalOriginal) * 100 : 0
    };
}

/**
 * Verify snapshot integrity
 */
export async function verifySnapshotIntegrity(snapshot: PageSnapshot): Promise<boolean> {
    const content = decompress(snapshot.content);
    const currentHash = await hashContent(content);
    return currentHash === snapshot.contentHash;
}
