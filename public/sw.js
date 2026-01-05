// LinkHaven Service Worker
// Provides offline support and caching for PWA
// Cache-first strategy for static assets

const CACHE_NAME = 'linkhaven-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    // Take control immediately
    self.clients.claim();
});

// Fetch event - cache-first for static assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip external requests (CDN, fonts, etc.) - let them go to network
    if (url.origin !== self.location.origin) {
        // For external resources like Tailwind CDN, try network first
        event.respondWith(
            fetch(request).catch(() => caches.match(request))
        );
        return;
    }

    // For same-origin requests, use cache-first strategy
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached version, but also update cache in background
                event.waitUntil(
                    fetch(request).then((networkResponse) => {
                        if (networkResponse.ok) {
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, networkResponse);
                            });
                        }
                    }).catch(() => { })
                );
                return cachedResponse;
            }

            // Not in cache, fetch from network
            return fetch(request).then((networkResponse) => {
                // Cache the response for future
                if (networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return networkResponse;
            });
        })
    );
});

// Handle messages from main app
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
