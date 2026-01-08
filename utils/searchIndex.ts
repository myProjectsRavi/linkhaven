/**
 * Neural Search - Full-Text Offline Search Index
 * 
 * Uses MiniSearch for client-side full-text search with:
 * - Fuzzy matching (typo tolerance)
 * - Prefix search (search as you type)
 * - Field boosting (title > content)
 * - 100% offline operation
 * 
 * FEATURES:
 * - Search across titles, URLs, descriptions, tags, AND snapshot content
 * - "Find that article about 'crypto' even if 'crypto' wasn't in the title"
 * - Sub-millisecond search performance
 * 
 * COMPETITOR COMPARISON:
 * - Raindrop.io: Full-text is Pro-only AND requires cloud
 * - Pocket: Requires cloud sync
 * - LinkHaven: 100% offline, works on day 1
 * 
 * COMPLEXITY:
 * - Index build: O(n × m) where n = documents, m = avg words
 * - Search: O(log n) for most queries
 * 
 * DEPENDENCY: MiniSearch (7KB gzipped, MIT license)
 */

import MiniSearch, { SearchResult } from 'minisearch';
import { Bookmark, Note } from '../types';

// Document type for indexing
interface SearchDocument {
    id: string;
    type: 'bookmark' | 'note';
    title: string;
    url?: string;
    description?: string;
    tags?: string;
    content?: string; // Snapshot content for bookmarks, note content for notes
}

// Search result with highlighted excerpts
export interface SearchHit {
    id: string;
    type: 'bookmark' | 'note';
    title: string;
    score: number;
    matchedFields: string[];
    excerpt?: string;
}

// Singleton search index
let searchIndex: MiniSearch<SearchDocument> | null = null;
let documentMap: Map<string, SearchDocument> = new Map();

/**
 * Initialize or rebuild the search index
 * 
 * @param bookmarks - All bookmarks to index
 * @param notes - All notes to index
 * @param snapshotContents - Map of bookmarkId -> snapshot text content
 */
export function initSearchIndex(
    bookmarks: Bookmark[],
    notes: Note[],
    snapshotContents: Map<string, string> = new Map()
): void {
    // Create new MiniSearch instance
    searchIndex = new MiniSearch<SearchDocument>({
        // Fields to index for searching
        fields: ['title', 'url', 'description', 'tags', 'content'],
        // Fields to return with results
        storeFields: ['id', 'type', 'title'],
        // Search options
        searchOptions: {
            // Boost title matches higher than content
            boost: { title: 3, tags: 2, description: 1.5, content: 1, url: 0.5 },
            // Enable fuzzy matching for typo tolerance
            fuzzy: 0.2,
            // Enable prefix search for autocomplete
            prefix: true,
            // Combine term scores
            combineWith: 'AND'
        },
        // Field extraction
        extractField: (document, fieldName) => {
            const value = (document as any)[fieldName];
            if (value === undefined || value === null) return '';
            return String(value);
        }
    });

    // Clear document map
    documentMap.clear();

    // Prepare documents
    const documents: SearchDocument[] = [];

    // Add bookmarks
    for (const bookmark of bookmarks) {
        const doc: SearchDocument = {
            id: bookmark.id,
            type: 'bookmark',
            title: bookmark.title || '',
            url: bookmark.url || '',
            description: bookmark.description || '',
            tags: (bookmark.tags || []).join(' '),
            content: snapshotContents.get(bookmark.id) || ''
        };
        documents.push(doc);
        documentMap.set(doc.id, doc);
    }

    // Add notes
    for (const note of notes) {
        const doc: SearchDocument = {
            id: note.id,
            type: 'note',
            title: note.title || '',
            tags: (note.tags || []).join(' '),
            content: note.content || ''
        };
        documents.push(doc);
        documentMap.set(doc.id, doc);
    }

    // Add all documents to index
    searchIndex.addAll(documents);

    console.log(`Search index built: ${documents.length} documents indexed`);
}

/**
 * Add or update a single document in the index
 */
export function updateSearchDocument(
    item: Bookmark | Note,
    type: 'bookmark' | 'note',
    content?: string
): void {
    if (!searchIndex) return;

    const id = item.id;

    // Remove existing if present
    if (documentMap.has(id)) {
        try {
            searchIndex.discard(id);
        } catch {
            // Document might not exist in index
        }
    }

    // Create new document
    const doc: SearchDocument = type === 'bookmark'
        ? {
            id,
            type: 'bookmark',
            title: (item as Bookmark).title || '',
            url: (item as Bookmark).url || '',
            description: (item as Bookmark).description || '',
            tags: ((item as Bookmark).tags || []).join(' '),
            content: content || ''
        }
        : {
            id,
            type: 'note',
            title: (item as Note).title || '',
            tags: ((item as Note).tags || []).join(' '),
            content: (item as Note).content || ''
        };

    // Add to index
    searchIndex.add(doc);
    documentMap.set(id, doc);
}

/**
 * Remove a document from the index
 */
export function removeFromSearchIndex(id: string): void {
    if (!searchIndex || !documentMap.has(id)) return;

    try {
        searchIndex.discard(id);
        documentMap.delete(id);
    } catch {
        // Document might not exist
    }
}

/**
 * Perform full-text search
 * 
 * @param query - Search query string
 * @param options - Optional search options
 * @returns Array of search hits with scores
 */
export function search(
    query: string,
    options?: {
        type?: 'bookmark' | 'note' | 'all';
        maxResults?: number;
    }
): SearchHit[] {
    if (!searchIndex || !query.trim()) {
        return [];
    }

    const { type = 'all', maxResults = 50 } = options || {};

    // Perform search
    let results: SearchResult[];

    try {
        results = searchIndex.search(query, {
            // Filter by type if specified
            filter: type !== 'all'
                ? (result) => documentMap.get(result.id)?.type === type
                : undefined
        });
    } catch {
        // Fallback for invalid queries
        return [];
    }

    // Convert to SearchHit format
    const hits: SearchHit[] = results.slice(0, maxResults).map(result => {
        const doc = documentMap.get(result.id);
        const matchedFields = Object.keys(result.match);

        // Generate excerpt from matched content
        let excerpt: string | undefined;
        if (doc?.content && matchedFields.includes('content')) {
            // Find relevant snippet around first match
            const lowerContent = doc.content.toLowerCase();
            const lowerQuery = query.toLowerCase().split(/\s+/)[0];
            const matchIndex = lowerContent.indexOf(lowerQuery);

            if (matchIndex >= 0) {
                const start = Math.max(0, matchIndex - 50);
                const end = Math.min(doc.content.length, matchIndex + 150);
                excerpt = (start > 0 ? '...' : '') +
                    doc.content.slice(start, end).trim() +
                    (end < doc.content.length ? '...' : '');
            }
        }

        return {
            id: result.id,
            type: doc?.type || 'bookmark',
            title: doc?.title || '',
            score: result.score,
            matchedFields,
            excerpt
        };
    });

    return hits;
}

/**
 * Get search suggestions (autocomplete)
 * 
 * @param query - Partial query string
 * @param maxSuggestions - Maximum suggestions to return
 * @returns Array of suggested search terms
 */
export function getSuggestions(
    query: string,
    maxSuggestions: number = 5
): string[] {
    if (!searchIndex || !query.trim()) {
        return [];
    }

    try {
        const results = searchIndex.autoSuggest(query, {
            fuzzy: 0.2,
            prefix: true
        });

        return results
            .slice(0, maxSuggestions)
            .map(r => r.suggestion);
    } catch {
        return [];
    }
}

/**
 * Check if search index is initialized
 */
export function isSearchIndexReady(): boolean {
    return searchIndex !== null && documentMap.size > 0;
}

/**
 * Get index statistics
 */
export function getSearchIndexStats(): {
    documentCount: number;
    termCount: number;
} {
    if (!searchIndex) {
        return { documentCount: 0, termCount: 0 };
    }

    return {
        documentCount: documentMap.size,
        termCount: searchIndex.termCount
    };
}

/**
 * Clear the search index
 */
export function clearSearchIndex(): void {
    searchIndex = null;
    documentMap.clear();
}
