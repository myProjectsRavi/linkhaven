// LinkHaven - Fuzzy Deduplication
// Finds duplicate/similar bookmarks using string similarity algorithms
// Optimized: Uses SimHash LSH for O(n) performance instead of O(n²)

import { Bookmark } from '../types';
import { generateSimHash, findSimilarPairs, distanceToSimilarity, type SimHash64 } from './simhash';

/**
 * Calculate Levenshtein distance between two strings
 * Time complexity: O(m*n) where m,n are string lengths
 * Space complexity: O(min(m,n)) with optimized version
 */
function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    // Use shorter string for column to save memory
    if (a.length > b.length) [a, b] = [b, a];

    const m = a.length;
    const n = b.length;

    // Only need two rows
    let prev = new Array(m + 1).fill(0).map((_, i) => i);
    let curr = new Array(m + 1).fill(0);

    for (let j = 1; j <= n; j++) {
        curr[0] = j;
        for (let i = 1; i <= m; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[i] = Math.min(
                prev[i] + 1,      // deletion
                curr[i - 1] + 1,  // insertion
                prev[i - 1] + cost // substitution
            );
        }
        [prev, curr] = [curr, prev];
    }

    return prev[m];
}

/**
 * Calculate similarity percentage between two strings
 * Returns 0-100 where 100 means identical
 */
export function stringSimilarity(a: string, b: string): number {
    if (!a && !b) return 100;
    if (!a || !b) return 0;

    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 100;

    const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
    return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Normalize URL for comparison
 * Removes protocol, www, trailing slashes, and common tracking params
 */
export function normalizeUrl(url: string): string {
    try {
        const parsed = new URL(url);

        // Remove tracking parameters
        const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
            'utm_term', 'ref', 'source', 'fbclid', 'gclid'];
        trackingParams.forEach(p => parsed.searchParams.delete(p));

        // Normalize
        let normalized = parsed.hostname.replace(/^www\./, '') +
            parsed.pathname.replace(/\/$/, '') +
            parsed.search;

        return normalized.toLowerCase();
    } catch {
        return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    }
}

/**
 * Calculate domain similarity (same domain = high base score)
 */
function domainMatch(url1: string, url2: string): number {
    try {
        const domain1 = new URL(url1).hostname.replace(/^www\./, '');
        const domain2 = new URL(url2).hostname.replace(/^www\./, '');
        return domain1 === domain2 ? 50 : 0;
    } catch {
        return 0;
    }
}

export interface DuplicateGroup {
    id: string;
    bookmarks: Bookmark[];
    similarity: number;
    reason: 'exact_url' | 'similar_url' | 'similar_title' | 'same_domain_similar';
}

export interface DeduplicationResult {
    duplicateGroups: DuplicateGroup[];
    totalDuplicates: number;
    potentialSavings: number; // Number of bookmarks that could be removed
}

/**
 * Find duplicate and similar bookmarks
 * 
 * Algorithm:
 * 1. Group by normalized URL (exact matches)
 * 2. Within same domain, check for similar URLs
 * 3. Check for similar titles across all bookmarks
 * 
 * Time complexity: O(n²) in worst case, but optimized with domain grouping
 */
export function findDuplicates(
    bookmarks: Bookmark[],
    urlThreshold: number = 85,
    titleThreshold: number = 80
): DeduplicationResult {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    // Step 1: Group by exact normalized URL
    const urlMap = new Map<string, Bookmark[]>();
    for (const bookmark of bookmarks) {
        const normalizedUrl = normalizeUrl(bookmark.url);
        if (!urlMap.has(normalizedUrl)) {
            urlMap.set(normalizedUrl, []);
        }
        urlMap.get(normalizedUrl)!.push(bookmark);
    }

    // Add exact URL duplicates to groups
    for (const [_, group] of urlMap) {
        if (group.length > 1) {
            groups.push({
                id: `exact_${group[0].id}`,
                bookmarks: group,
                similarity: 100,
                reason: 'exact_url'
            });
            group.forEach(b => processed.add(b.id));
        }
    }

    // Step 2: Group by domain for efficient comparison
    const domainMap = new Map<string, Bookmark[]>();
    for (const bookmark of bookmarks) {
        if (processed.has(bookmark.id)) continue;
        try {
            const domain = new URL(bookmark.url).hostname.replace(/^www\./, '');
            if (!domainMap.has(domain)) {
                domainMap.set(domain, []);
            }
            domainMap.get(domain)!.push(bookmark);
        } catch {
            // Invalid URL, skip
        }
    }

    // Step 3: Within each domain, find similar URLs
    for (const [_, domainBookmarks] of domainMap) {
        if (domainBookmarks.length < 2) continue;

        for (let i = 0; i < domainBookmarks.length; i++) {
            if (processed.has(domainBookmarks[i].id)) continue;

            const similarGroup: Bookmark[] = [domainBookmarks[i]];
            let maxSimilarity = 0;

            for (let j = i + 1; j < domainBookmarks.length; j++) {
                if (processed.has(domainBookmarks[j].id)) continue;

                const urlSim = stringSimilarity(
                    normalizeUrl(domainBookmarks[i].url),
                    normalizeUrl(domainBookmarks[j].url)
                );

                const titleSim = stringSimilarity(
                    domainBookmarks[i].title,
                    domainBookmarks[j].title
                );

                const combinedSim = Math.max(urlSim, titleSim * 0.8);

                if (combinedSim >= urlThreshold) {
                    similarGroup.push(domainBookmarks[j]);
                    maxSimilarity = Math.max(maxSimilarity, combinedSim);
                    processed.add(domainBookmarks[j].id);
                }
            }

            if (similarGroup.length > 1) {
                groups.push({
                    id: `similar_${domainBookmarks[i].id}`,
                    bookmarks: similarGroup,
                    similarity: maxSimilarity,
                    reason: 'similar_url'
                });
                processed.add(domainBookmarks[i].id);
            }
        }
    }

    // Step 4: Find similar titles using SimHash LSH (O(n) instead of O(n²))
    // This prevents browser freezing with 2000+ bookmarks
    const remaining = bookmarks.filter(b => !processed.has(b.id));

    if (remaining.length >= 2) {
        // Generate SimHash for each remaining bookmark (combining title + normalized URL)
        const hashes: SimHash64[] = remaining.map(b =>
            generateSimHash(b.title + ' ' + normalizeUrl(b.url))
        );

        // Find similar pairs using LSH bucketing (O(n) complexity)
        // Hamming distance 6 ≈ 90% similarity
        const similarPairs = findSimilarPairs(hashes, 6);

        // Build groups from pairs using Union-Find approach
        const parent = new Map<number, number>();
        const find = (x: number): number => {
            if (!parent.has(x)) parent.set(x, x);
            if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
            return parent.get(x)!;
        };
        const union = (x: number, y: number) => {
            parent.set(find(x), find(y));
        };

        // Union similar pairs
        for (const pair of similarPairs) {
            union(pair.i, pair.j);
        }

        // Group by root
        const groupMap = new Map<number, { indices: number[]; maxSimilarity: number }>();
        for (const pair of similarPairs) {
            const root = find(pair.i);
            if (!groupMap.has(root)) {
                groupMap.set(root, { indices: [], maxSimilarity: 0 });
            }
            const group = groupMap.get(root)!;
            if (!group.indices.includes(pair.i)) group.indices.push(pair.i);
            if (!group.indices.includes(pair.j)) group.indices.push(pair.j);
            group.maxSimilarity = Math.max(group.maxSimilarity, pair.similarity);
        }

        // Convert to DuplicateGroup format
        for (const [_, { indices, maxSimilarity }] of groupMap) {
            if (indices.length > 1) {
                const groupBookmarks = indices.map(i => remaining[i]);
                // Skip if any bookmark already processed
                if (groupBookmarks.some(b => processed.has(b.id))) continue;

                groups.push({
                    id: `title_${groupBookmarks[0].id}`,
                    bookmarks: groupBookmarks,
                    similarity: maxSimilarity,
                    reason: 'similar_title'
                });
                groupBookmarks.forEach(b => processed.add(b.id));
            }
        }
    }

    // Calculate totals
    const totalDuplicates = groups.reduce((sum, g) => sum + g.bookmarks.length, 0);
    const potentialSavings = groups.reduce((sum, g) => sum + g.bookmarks.length - 1, 0);

    // Sort by similarity (highest first)
    groups.sort((a, b) => b.similarity - a.similarity);

    return {
        duplicateGroups: groups,
        totalDuplicates,
        potentialSavings
    };
}

/**
 * Find stale bookmarks (not accessed in X days)
 */
export function findStaleBookmarks(
    bookmarks: Bookmark[],
    staleDays: number = 365
): Bookmark[] {
    const staleThreshold = Date.now() - (staleDays * 24 * 60 * 60 * 1000);

    return bookmarks
        .filter(b => b.createdAt < staleThreshold)
        .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Get cleanup recommendations
 */
export interface CleanupRecommendation {
    duplicates: DeduplicationResult;
    staleBookmarks: Bookmark[];
    brokenLinks: Bookmark[];
    totalCleanupPotential: number;
}

export function getCleanupRecommendations(bookmarks: Bookmark[]): CleanupRecommendation {
    const duplicates = findDuplicates(bookmarks);
    const staleBookmarks = findStaleBookmarks(bookmarks, 365);
    const brokenLinks = bookmarks.filter(b => b.linkHealth === 'dead');

    return {
        duplicates,
        staleBookmarks,
        brokenLinks,
        totalCleanupPotential:
            duplicates.potentialSavings +
            Math.floor(staleBookmarks.length * 0.5) + // Assume 50% of stale can be removed
            brokenLinks.length
    };
}
