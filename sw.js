// Service Worker untuk Blog Vinnesia
// Version: v1.0.0 (ubah versi ini tiap kali update besar)

const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `vinnesia-blog-${CACHE_VERSION}`;
const STATIC_CACHE = `vinnesia-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `vinnesia-dynamic-${CACHE_VERSION}`;

// Files to cache on install
const STATIC_FILES = [
  '/',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/logo.png',
  '/og-image.jpg'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...', CACHE_NAME);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('Service Worker: Failed to cache static files', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...', CACHE_NAME);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheName.includes(CACHE_VERSION) && cacheName.startsWith('vinnesia-')) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  // Network-first untuk HTML (biar update langsung muncul)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const resClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, resClone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Cache-first untuk asset (css/js/gambar/font)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            const responseClone = networkResponse.clone();
            const cacheToUse = isStaticAsset(request.url) ? STATIC_CACHE : DYNAMIC_CACHE;

            caches.open(cacheToUse).then((cache) => cache.put(request, responseClone));

            return networkResponse;
          })
          .catch((error) => {
            console.error('Service Worker: Network fetch failed:', error);
            return caches.match(request);
          });
      })
  );
});

// Helper function to determine if a URL is a static asset
function isStaticAsset(url) {
  const staticExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.css', '.js', '.woff', '.woff2', '.ttf'];
  const urlPath = new URL(url).pathname.toLowerCase();

  return staticExtensions.some(ext => urlPath.endsWith(ext)) ||
         urlPath.includes('/favicon') ||
         urlPath.includes('/logo') ||
         urlPath.includes('/apple-touch-icon');
}

// Background sync
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  if (event.tag === 'background-sync') {
    event.waitUntil(Promise.resolve(console.log('Service Worker: Performing background sync')));
  }
});

// Push notification
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');

  const options = {
    body: event.data ? event.data.text() : 'Update tersedia dari Blog Vinnesia',
    icon: '/logo.png',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    data: { url: '/' },
    actions: [
      { action: 'open', title: 'Buka Blog', icon: '/logo.png' },
      { action: 'close', title: 'Tutup', icon: '/favicon.ico' }
    ]
  };

  event.waitUntil(self.registration.showNotification('Blog Vinnesia', options));
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  event.notification.close();
  if (event.action === 'open') {
    event.waitUntil(clients.openWindow(event.notification.data.url || '/'));
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service Worker: Error occurred:', event.error);
});

// Unhandled promise rejection
self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker: Unhandled promise rejection:', event.reason);
});

// Message handling
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received:', event.data);

  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();

  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }

  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('vinnesia-')) {
              return caches.delete(cacheName);
            }
          })
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

console.log('Service Worker: Script loaded successfully', CACHE_NAME);
