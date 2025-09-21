const CACHE_NAME = 'qr-generator-v0.1.0';
const urlsToCache = [
  '/QR-Code-Generator/',
  '/QR-Code-Generator/index.html',
  '/QR-Code-Generator/css/styles.css',
  '/QR-Code-Generator/css/responsive.css',
  '/QR-Code-Generator/js/app.js',
  '/QR-Code-Generator/js/qrGenerator.js',
  '/QR-Code-Generator/js/uiController.js',
  '/QR-Code-Generator/js/downloadManager.js',
  '/QR-Code-Generator/js/historyManager.js',
  '/QR-Code-Generator/js/themeManager.js',
  '/QR-Code-Generator/assets/logo.png',
  // UI icons
  '/QR-Code-Generator/assets/ui-icons/text.svg',
  '/QR-Code-Generator/assets/ui-icons/url.svg',
  '/QR-Code-Generator/assets/ui-icons/email.svg',
  '/QR-Code-Generator/assets/ui-icons/phone.svg',
  '/QR-Code-Generator/assets/ui-icons/sms.svg',
  '/QR-Code-Generator/assets/ui-icons/whatsapp.svg',
  '/QR-Code-Generator/assets/ui-icons/wifi.svg',
  '/QR-Code-Generator/assets/ui-icons/vcard.svg',
  '/QR-Code-Generator/assets/ui-icons/maps.svg',
  // PWA icons
  '/QR-Code-Generator/assets/icons/icon-192x192.png',
  '/QR-Code-Generator/assets/icons/icon-512x512.png',
  // External dependencies
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Cache hit - return response
      if (response) {
        return response;
      }

      // Clone the request
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then(response => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the fetched response for future use
        caches.open(CACHE_NAME).then(cache => {
          // Don't cache POST requests or non-GET requests
          if (event.request.method === 'GET') {
            cache.put(event.request, responseToCache);
          }
        });

        return response;
      }).catch(() => {
        // Network request failed, try to get offline page
        if (event.request.destination === 'document') {
          return caches.match('/QR-Code-Generator/offline.html');
        }
      });
    })
  );
});