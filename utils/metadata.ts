// LinkHaven - URL Metadata Fetcher
// Attempts to fetch page title and description without backend
// Uses multiple fallback strategies

interface UrlMetadata {
    title: string;
    description?: string;
    success: boolean;
}

/**
 * Fetch metadata from a URL
 * Strategy 1: Direct fetch (works for CORS-enabled sites)
 * Strategy 2: Extract from URL structure as fallback
 * 
 * Time complexity: O(1) - single fetch + parsing
 * Space complexity: O(1)
 */
export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
    try {
        // Validate URL
        const parsedUrl = new URL(url);

        // Try direct fetch with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'text/html'
                }
            });
            clearTimeout(timeout);

            if (response.ok) {
                const html = await response.text();

                // Extract title
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                const title = titleMatch ? titleMatch[1].trim() : '';

                // Extract meta description
                const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
                const description = descMatch ? descMatch[1].trim() : '';

                if (title) {
                    return { title, description, success: true };
                }
            }
        } catch (fetchError) {
            clearTimeout(timeout);
            // CORS blocked or network error - fall through to fallback
        }

        // Fallback: Extract meaningful title from URL
        return extractFromUrl(parsedUrl);

    } catch (e) {
        // Invalid URL
        return { title: '', success: false };
    }
}

/**
 * Extract a readable title from URL structure
 */
function extractFromUrl(url: URL): UrlMetadata {
    // Try to get meaningful title from path
    const pathParts = url.pathname.split('/').filter(p => p.length > 0);

    if (pathParts.length > 0) {
        // Get last meaningful path segment
        let title = pathParts[pathParts.length - 1];

        // Remove file extensions
        title = title.replace(/\.(html|htm|php|asp|aspx|jsp)$/i, '');

        // Replace dashes and underscores with spaces
        title = title.replace(/[-_]/g, ' ');

        // Capitalize first letter of each word
        title = title.replace(/\b\w/g, c => c.toUpperCase());

        if (title.length > 2) {
            return {
                title: `${title} - ${url.hostname.replace('www.', '')}`,
                success: true
            };
        }
    }

    // Just use hostname
    const hostname = url.hostname.replace('www.', '');
    const readableName = hostname
        .split('.')[0]
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

    return {
        title: readableName,
        success: true
    };
}

/**
 * Batch fetch metadata for multiple URLs
 * Processes in parallel with concurrency limit
 * 
 * Time complexity: O(n) parallel fetches
 * Space complexity: O(n)
 */
export async function fetchMultipleMetadata(
    urls: string[],
    concurrency: number = 5
): Promise<Map<string, UrlMetadata>> {
    const results = new Map<string, UrlMetadata>();

    // Process in batches
    for (let i = 0; i < urls.length; i += concurrency) {
        const batch = urls.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(async url => ({ url, metadata: await fetchUrlMetadata(url) }))
        );
        batchResults.forEach(({ url, metadata }) => results.set(url, metadata));
    }

    return results;
}
