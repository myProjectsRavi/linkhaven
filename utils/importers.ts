// LinkHaven - Browser Bookmarks Importers
// Supports Chrome/Firefox/Safari HTML exports and JSON formats
// Zero dependencies, pure TypeScript parsing

import { Folder, Bookmark } from '../types';

const generateId = () => Math.random().toString(36).substr(2, 9);

interface ParseResult {
    folders: Folder[];
    bookmarks: Bookmark[];
}

/**
 * Parse standard bookmarks.html file (Chrome/Firefox/Safari export)
 * Time complexity: O(n) where n is number of bookmarks
 * Space complexity: O(n)
 */
export function parseBookmarksHTML(html: string): ParseResult {
    const folders: Folder[] = [];
    const bookmarks: Bookmark[] = [];

    // Create a DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find all DT elements (bookmark entries)
    const processFolder = (dl: Element, parentId: string | null = null): string | null => {
        let currentFolderId = parentId;

        const children = dl.children;
        for (let i = 0; i < children.length; i++) {
            const dt = children[i];
            if (dt.tagName !== 'DT') continue;

            const h3 = dt.querySelector(':scope > H3');
            const a = dt.querySelector(':scope > A');
            const nestedDl = dt.querySelector(':scope > DL');

            if (h3) {
                // This is a folder
                const folder: Folder = {
                    id: generateId(),
                    name: h3.textContent?.trim() || 'Untitled Folder',
                    parentId: parentId,
                    createdAt: Date.now()
                };
                folders.push(folder);
                currentFolderId = folder.id;

                // Process nested bookmarks
                if (nestedDl) {
                    processFolder(nestedDl, folder.id);
                }
            } else if (a) {
                // This is a bookmark
                const href = a.getAttribute('href');
                if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                    const bookmark: Bookmark = {
                        id: generateId(),
                        folderId: currentFolderId || 'default',
                        title: a.textContent?.trim() || '',
                        url: href,
                        description: '',
                        tags: [],
                        createdAt: Date.now()
                    };
                    bookmarks.push(bookmark);
                }
            }
        }

        return currentFolderId;
    };

    // Find the main DL element
    const mainDl = doc.querySelector('DL');
    if (mainDl) {
        processFolder(mainDl, null);
    }

    // Ensure at least one folder exists
    if (folders.length === 0) {
        folders.push({
            id: 'imported',
            name: 'Imported',
            parentId: null,
            createdAt: Date.now()
        });
        // Assign all bookmarks to this folder
        bookmarks.forEach(b => b.folderId = 'imported');
    }

    return { folders, bookmarks };
}

/**
 * Parse Pocket export JSON
 * Time complexity: O(n)
 * Space complexity: O(n)
 */
export function parsePocketExport(data: unknown): Bookmark[] {
    const bookmarks: Bookmark[] = [];

    try {
        const items = (data as Record<string, unknown>)?.list || data;
        if (typeof items === 'object' && items !== null) {
            Object.values(items as Record<string, unknown>).forEach((item: unknown) => {
                const i = item as Record<string, unknown>;
                if (i.resolved_url || i.given_url) {
                    bookmarks.push({
                        id: generateId(),
                        folderId: 'pocket-import',
                        title: (i.resolved_title || i.given_title || '') as string,
                        url: (i.resolved_url || i.given_url) as string,
                        description: (i.excerpt || '') as string,
                        tags: Array.isArray(i.tags) ? i.tags.map((t: unknown) => String(t)) : [],
                        createdAt: i.time_added ? parseInt(i.time_added as string) * 1000 : Date.now()
                    });
                }
            });
        }
    } catch (e) {
        console.error('Failed to parse Pocket export:', e);
    }

    return bookmarks;
}

/**
 * Parse Raindrop.io export JSON
 * Time complexity: O(n)
 * Space complexity: O(n)
 */
export function parseRaindropExport(data: unknown): ParseResult {
    const folders: Folder[] = [];
    const bookmarks: Bookmark[] = [];

    try {
        const items = (data as Record<string, unknown>)?.items || data;
        if (Array.isArray(items)) {
            const collectionMap = new Map<number, string>();

            items.forEach((item: unknown) => {
                const i = item as Record<string, unknown>;
                if (i.link) {
                    // Handle collection/folder
                    const collectionId = (i.collection as Record<string, unknown>)?.$id as number;
                    let folderId = 'raindrop-import';

                    if (collectionId && !collectionMap.has(collectionId)) {
                        folderId = generateId();
                        collectionMap.set(collectionId, folderId);
                        folders.push({
                            id: folderId,
                            name: `Collection ${collectionId}`,
                            parentId: null,
                            createdAt: Date.now()
                        });
                    } else if (collectionId) {
                        folderId = collectionMap.get(collectionId) || 'raindrop-import';
                    }

                    bookmarks.push({
                        id: generateId(),
                        folderId,
                        title: (i.title || '') as string,
                        url: i.link as string,
                        description: (i.excerpt || i.note || '') as string,
                        tags: Array.isArray(i.tags) ? i.tags.map((t: unknown) => String(t)) : [],
                        createdAt: i.created ? new Date(i.created as string).getTime() : Date.now()
                    });
                }
            });
        }
    } catch (e) {
        console.error('Failed to parse Raindrop export:', e);
    }

    if (folders.length === 0) {
        folders.push({
            id: 'raindrop-import',
            name: 'Raindrop Import',
            parentId: null,
            createdAt: Date.now()
        });
    }

    return { folders, bookmarks };
}

/**
 * Auto-detect format and parse
 */
export function parseImportFile(content: string, filename: string): ParseResult {
    const lowerName = filename.toLowerCase();

    // HTML bookmarks export
    if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
        return parseBookmarksHTML(content);
    }

    // JSON exports
    if (lowerName.endsWith('.json')) {
        try {
            const json = JSON.parse(content);

            // LinkHaven native format
            if (json.folders && json.bookmarks) {
                return {
                    folders: json.folders,
                    bookmarks: json.bookmarks.map((b: Bookmark) => ({
                        ...b,
                        tags: b.tags || []
                    }))
                };
            }

            // Pocket format (has 'list' object)
            if (json.list) {
                const pocketBookmarks = parsePocketExport(json);
                return {
                    folders: [{ id: 'pocket-import', name: 'Pocket Import', parentId: null, createdAt: Date.now() }],
                    bookmarks: pocketBookmarks
                };
            }

            // Raindrop format (has 'items' array)
            if (json.items) {
                return parseRaindropExport(json);
            }

            // Generic array of bookmarks
            if (Array.isArray(json)) {
                return parseRaindropExport({ items: json });
            }

        } catch (e) {
            console.error('Failed to parse JSON:', e);
        }
    }

    return { folders: [], bookmarks: [] };
}
