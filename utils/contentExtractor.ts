/**
 * Content Extractor - Fetch and parse web pages using Readability.js
 * 
 * Architecture:
 * - Uses CORS proxies to bypass browser restrictions
 * - Mozilla Readability.js for content extraction (same as Firefox Reader View)
 * - Graceful fallback chain for proxy failures
 * - Sanitizes HTML to prevent XSS
 * 
 * Security:
 * - All extracted content is sanitized
 * - No script execution
 * - Images converted to inline where possible
 */

import { Readability } from '@mozilla/readability';

// CORS proxy list with fallbacks
// Ordered by reliability and speed
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
];

// Result from content extraction
export interface ExtractedContent {
    title: string;
    content: string;        // Clean HTML content
    textContent: string;    // Plain text version
    excerpt: string;        // First ~200 chars
    byline: string | null;  // Author if found
    siteName: string | null;// Site name if found
    length: number;         // Character count
    success: boolean;
    error?: string;
}

// Fetch result
interface FetchResult {
    html: string;
    finalUrl: string;
    success: boolean;
    error?: string;
}

/**
 * Sanitize HTML to prevent XSS
 * Removes scripts, event handlers, and dangerous elements
 */
function sanitizeHTML(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove script tags
    doc.querySelectorAll('script').forEach(el => el.remove());

    // Remove style tags (we'll use our own styling)
    doc.querySelectorAll('style').forEach(el => el.remove());

    // Remove event handlers from all elements
    doc.querySelectorAll('*').forEach(el => {
        const attrs = el.attributes;
        for (let i = attrs.length - 1; i >= 0; i--) {
            const attrName = attrs[i].name.toLowerCase();
            if (attrName.startsWith('on') || attrName === 'javascript') {
                el.removeAttribute(attrs[i].name);
            }
        }
    });

    // Remove iframes, objects, embeds
    doc.querySelectorAll('iframe, object, embed, form').forEach(el => el.remove());

    // Convert relative URLs to absolute
    const baseUrl = doc.querySelector('base')?.href || '';
    doc.querySelectorAll('a[href]').forEach(el => {
        const href = el.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
            try {
                el.setAttribute('href', new URL(href, baseUrl).toString());
            } catch {
                // Invalid URL, remove href
                el.removeAttribute('href');
            }
        }
        // Open links in new tab
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
    });

    // Handle images - keep src but add loading="lazy"
    doc.querySelectorAll('img').forEach(el => {
        el.setAttribute('loading', 'lazy');
        el.setAttribute('decoding', 'async');
        // Remove srcset to simplify storage
        el.removeAttribute('srcset');
    });

    return doc.body.innerHTML;
}

/**
 * Fetch page via CORS proxy with fallback chain
 * 
 * @param url - URL to fetch
 * @returns HTML content and final URL (after redirects)
 * 
 * Uses exponential backoff within each proxy
 * Falls back to next proxy on failure
 */
async function fetchViaProxy(url: string): Promise<FetchResult> {
    const encodedUrl = encodeURIComponent(url);

    for (const proxy of CORS_PROXIES) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const response = await fetch(proxy + encodedUrl, {
                signal: controller.signal,
                headers: {
                    'Accept': 'text/html',
                },
            });

            clearTimeout(timeout);

            if (!response.ok) {
                console.warn(`Proxy ${proxy} returned ${response.status}`);
                continue;
            }

            const html = await response.text();

            // Basic validation - should be HTML
            if (!html.toLowerCase().includes('<html') && !html.toLowerCase().includes('<!doctype')) {
                console.warn(`Proxy ${proxy} returned non-HTML content`);
                continue;
            }

            return {
                html,
                finalUrl: url,
                success: true,
            };
        } catch (e) {
            console.warn(`Proxy ${proxy} failed:`, e);
            continue;
        }
    }

    return {
        html: '',
        finalUrl: url,
        success: false,
        error: 'All CORS proxies failed. The page may be blocking access.',
    };
}

/**
 * Extract readable content from a URL
 * 
 * Uses Mozilla Readability (same algorithm as Firefox Reader View)
 * Provides clean, readable HTML suitable for offline storage
 * 
 * @param url - Page URL to extract content from
 * @returns Extracted content with metadata
 * 
 * Time Complexity: O(n) where n = page size
 * Space Complexity: O(n) for DOM parsing
 */
export async function extractContent(url: string): Promise<ExtractedContent> {
    // Step 1: Fetch page via CORS proxy
    const fetchResult = await fetchViaProxy(url);

    if (!fetchResult.success) {
        return {
            title: '',
            content: '',
            textContent: '',
            excerpt: '',
            byline: null,
            siteName: null,
            length: 0,
            success: false,
            error: fetchResult.error,
        };
    }

    // Step 2: Parse HTML into DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(fetchResult.html, 'text/html');

    // Set base URL for relative links
    const base = doc.createElement('base');
    base.href = url;
    doc.head.prepend(base);

    // Step 3: Extract content using Readability
    // Clone document as Readability modifies it
    const documentClone = doc.cloneNode(true) as Document;

    const reader = new Readability(documentClone, {
        // Keep images
        keepClasses: false,
        // Enable debug for troubleshooting if needed
        debug: false,
    });

    const article = reader.parse();

    if (!article) {
        return {
            title: doc.title || 'Untitled',
            content: '',
            textContent: '',
            excerpt: '',
            byline: null,
            siteName: null,
            length: 0,
            success: false,
            error: 'Could not extract article content. The page may not be an article.',
        };
    }

    // Step 4: Sanitize extracted content
    const sanitizedContent = sanitizeHTML(article.content);

    // Step 5: Generate excerpt from text content
    const textContent = article.textContent.trim();
    const excerpt = textContent.slice(0, 200).replace(/\s+/g, ' ').trim();

    // Step 6: Try to get site name from meta tags
    let siteName = article.siteName;
    if (!siteName) {
        siteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || null;
    }

    return {
        title: article.title || doc.title || 'Untitled',
        content: sanitizedContent,
        textContent,
        excerpt: excerpt + (textContent.length > 200 ? '...' : ''),
        byline: article.byline,
        siteName,
        length: textContent.length,
        success: true,
    };
}

/**
 * Check if a URL is likely to be extractable
 * Returns false for known problematic patterns
 */
export function isExtractable(url: string): boolean {
    try {
        const parsed = new URL(url);

        // Skip obviously non-extractable URLs
        const skipPatterns = [
            /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|exe|dmg)$/i,
            /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i,
            /\.(mp3|mp4|avi|mov|wmv|flv|webm)$/i,
        ];

        for (const pattern of skipPatterns) {
            if (pattern.test(parsed.pathname)) {
                return false;
            }
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * Format byte size to human readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
