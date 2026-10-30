// Service worker do Gestor de Faturas.
// - App shell: pré-cache; HTML/JS/CSS usam "rede primeiro" para que atualizações cheguem na hora.
// - Demais arquivos estáticos e CDNs (fontes, Firebase SDK): "stale-while-revalidate".
// - Chamadas de API (Firestore, Auth, Groq) nunca passam pelo cache.
const CACHE_NAME = 'gestor-v23';
const SHELL = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './vendor/vue.global.prod.js',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png'
];
const CACHEABLE_CDNS = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

const putInCache = (request, response) => {
    if (response && (response.ok || response.type === 'opaque')) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return response;
};

self.addEventListener('fetch', (e) => {
    const { request } = e;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    const sameOrigin = url.origin === self.location.origin;
    if (!sameOrigin && !CACHEABLE_CDNS.includes(url.hostname)) return;

    const isCode = sameOrigin && (request.mode === 'navigate' || /\.(html|js|css|json)$/.test(url.pathname) || url.pathname.endsWith('/'));

    if (isCode) {
        // Rede primeiro; offline cai para o cache.
        e.respondWith(
            fetch(request)
                .then((res) => putInCache(request, res))
                .catch(() => caches.match(request).then((c) => c || caches.match('./index.html')))
        );
        return;
    }

    e.respondWith(
        caches.match(request).then((cached) => {
            const network = fetch(request).then((res) => putInCache(request, res)).catch(() => cached);
            return cached || network;
        })
    );
});
