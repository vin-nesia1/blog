// Service Worker untuk Blog Vinnesia
// Version: Auto (pakai timestamp)

const CACHE_NAME = `vinnesia-blog-${Date.now()}`;
const STATIC_CACHE = `vinnesia-static-${Date.now()}`;
const DYNAMIC_CACHE = `vinnesia-dynamic-${Date.now()}`;

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
      .then(() => {
        console.log('Service Worker: Static files cached successfully');
        return self.skipWaiting();
      })
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
          cacheNames
            .filter((cacheName) => {
              // Hapus cache lama (hanya simpan versi terbaru)
              return cacheName !== STATIC_CACHE && 
                     cacheName !== DYNAMIC_CACHE &&
                     cacheName.startsWith('vinnesia-');
            })
            .map((cacheName) => {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated successfully');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (request.method !== 'GET') return;
  if (url.origin !== location.origin) return;
  
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache:', request.url);
          return cachedResponse;
        }
        
        console.log('Service Worker: Fetching from network:', request.url);
        return fetch(request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            const responseClone = networkResponse.clone();
            const cacheToUse = isStaticAsset(request.url) ? STATIC_CACHE : DYNAMIC_CACHE;
            
            caches.open(cacheToUse)
              .then((cache) => {
                console.log('Service Worker: Caching new resource:', request.url);
                cache.put(request, responseClone);
              });
            
            return networkResponse;
          })
          .catch((error) => {
            console.error('Service Worker: Network fetch failed:', error);
            
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/')
                .then((fallback) => {
                  if (fallback) return fallback;
                  return new Response(
                    '<h1>Offline</h1><p>Halaman tidak tersedia saat offline. Silakan coba lagi nanti.</p>',
                    { 
                      headers: { 'Content-Type': 'text/html' },
                      status: 503,
                      statusText: 'Service Unavailable'
                    }
                  );
                });
            }
            
            throw error;
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
    event.waitUntil(
      console.log('Service Worker: Performing background sync')
    );
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
  
  event.waitUntil(
    self.registration.showNotification('Blog Vinnesia', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  event.notification.close();
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
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
