const CACHE_NAME = 'shashki-trikolor-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/start.html',
    '/game.html',
    '/rules.html',
    '/stats.html',
    '/difficulty.html',
    '/css/common.css',
    '/css/game.css',
    '/css/start.css',
    '/css/rules.css',
    '/css/stats.css',
    '/css/difficulty.css',
    '/css/index.css',
    '/js/common.js',
    '/js/game.js',
    '/js/start.js',
    '/js/rules.js',
    '/js/stats.js',
    '/js/difficulty.js',
    '/js/index.js',
    '/moderation-fixes.js',
    '/imag/icon-192.png',
    '/imag/icon-512.png',
    '/imag/background.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ Кэширование ресурсов...');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Активация
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Перехват запросов (офлайн-режим)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(fetchResponse => {
                        // Сохраняем в кэш для следующего раза
                        if (fetchResponse && fetchResponse.status === 200) {
                            const responseClone = fetchResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseClone);
                                });
                        }
                        return fetchResponse;
                    })
                    .catch(() => {
                        // Если запрос не удался и ресурс не в кэше
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('Страница недоступна в офлайн-режиме', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});