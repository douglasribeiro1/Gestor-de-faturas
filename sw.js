const CACHE_NAME = 'gestor-offline-v3';
const urlsToCache = [
    './gestor-cartoes.html',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/vue@3/dist/vue.global.prod.js',
    'https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache).catch(err => console.warn('PWA: Alguns recursos externos podem não ter feito cache', err));
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
                        return caches.match('./gestor-cartoes.html');
                    }
                    return new Response('Modo Offline: Verifique sua conexão.');
                });
            })
        );
    }
});
