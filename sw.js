const CACHE_NAME = 'gestor-offline-v5';
const urlsToCache = [
    './index.html',
    './manifest.json',
    './icon.png'
];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
    if(e.request.url.startsWith('http')) {
        e.respondWith(
            caches.match(e.request).then(cached => {
                if (cached) return cached;
                
                return fetch(e.request).then(res => {
                    const cacheCopy = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, cacheCopy));
                    return res;
                }).catch(() => {
                    // Se falhar (offline), tenta retornar a página principal salva
                    if (e.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return new Response('Modo Offline: Verifique sua conexão.');
                });
            })
        );
    }
});
