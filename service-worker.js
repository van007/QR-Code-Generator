const CACHE_NAME = 'qr-generator-v0.1.1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/responsive.css',
  '/js/app.js',
  '/js/qrGenerator.js',
  '/js/uiController.js',
  '/js/downloadManager.js',
  '/js/historyManager.js',
  '/js/themeManager.js',
  '/js/installPrompt.js',
  '/js/fileUploadManager.js',
  '/assets/logo.png',
  // UI icons
  '/assets/ui-icons/text.svg',
  '/assets/ui-icons/url.svg',
  '/assets/ui-icons/email.svg',
  '/assets/ui-icons/phone.svg',
  '/assets/ui-icons/sms.svg',
  '/assets/ui-icons/whatsapp.svg',
  '/assets/ui-icons/youtube.svg',
  '/assets/ui-icons/wifi.svg',
  '/assets/ui-icons/vcard.svg',
  '/assets/ui-icons/maps.svg',
  '/assets/ui-icons/event.svg',
  '/assets/ui-icons/upi.svg',
  '/assets/ui-icons/attendance.svg',
  '/assets/ui-icons/file.svg',
  // PWA icons
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
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
          return caches.match('/offline.html');
        }
      });
    })
  );
});