// LinkHaven - Link Health Checker
// Checks if bookmarked URLs are still accessible
// Uses fetch with no-cors mode for best compatibility

export type LinkHealth = 'alive' | 'dead' | 'unknown' | 'checking';

interface HealthCheckResult {
    url: string;
    status: LinkHealth;
    statusCode?: number;
    checkedAt: number;
}

/**
 * Check if a single URL is accessible
 * Uses multiple strategies for maximum compatibility
 * 
 * Time complexity: O(1)
 * Space complexity: O(1)
 */
export async function checkLinkHealth(url: string): Promise<HealthCheckResult> {
    const checkedAt = Date.now();

    try {
        const parsedUrl = new URL(url);

        // Skip non-http(s) URLs
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return { url, status: 'unknown', checkedAt };
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        try {
            // First try with cors mode (will work for many sites)
            const response = await fetch(url, {
                method: 'HEAD', // Just check headers, don't download content
                signal: controller.signal,
                mode: 'cors',
                cache: 'no-cache'
            });
            clearTimeout(timeout);

            if (response.ok) {
                return { url, status: 'alive', statusCode: response.status, checkedAt };
            } else if (response.status >= 400 && response.status < 500) {
                return { url, status: 'dead', statusCode: response.status, checkedAt };
            } else {
                return { url, status: 'unknown', statusCode: response.status, checkedAt };
            }

        } catch (corsError) {
            clearTimeout(timeout);

            // CORS blocked - try no-cors mode
            // Note: no-cors gives opaque response, can't read status
            // But if it doesn't throw, the server responded
            try {
                const controller2 = new AbortController();
                const timeout2 = setTimeout(() => controller2.abort(), 5000);

                await fetch(url, {
                    method: 'HEAD',
                    signal: controller2.signal,
                    mode: 'no-cors',
                    cache: 'no-cache'
                });
                clearTimeout(timeout2);

                // If we get here, server responded (opaque response)
                return { url, status: 'alive', checkedAt };

            } catch (noCorsError) {
                // Complete failure - likely offline or doesn't exist
                if ((noCorsError as Error).name === 'AbortError') {
                    return { url, status: 'unknown', checkedAt }; // Timeout
                }
                return { url, status: 'dead', checkedAt };
            }
        }

    } catch (e) {
        // Invalid URL or other error
        return { url, status: 'unknown', checkedAt };
    }
}

/**
 * Check health of multiple URLs in parallel
 * Uses batching to avoid overwhelming the browser
 * 
 * Time complexity: O(n) with parallel execution
 * Space complexity: O(n)
 */
export async function checkMultipleLinks(
    urls: string[],
    concurrency: number = 10,
    onProgress?: (completed: number, total: number) => void
): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    let completed = 0;

    // Remove duplicates
    const uniqueUrls = [...new Set(urls)];
    const total = uniqueUrls.length;

    // Process in batches
    for (let i = 0; i < uniqueUrls.length; i += concurrency) {
        const batch = uniqueUrls.slice(i, i + concurrency);

        const batchResults = await Promise.all(
            batch.map(async url => {
                const result = await checkLinkHealth(url);
                completed++;
                onProgress?.(completed, total);
                return result;
            })
        );

        batchResults.forEach(result => {
            results.set(result.url, result);
        });
    }

    return results;
}
