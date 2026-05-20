const CACHE_NAME = 'fonecheck-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon.svg'
];

// Instala o Service Worker e armazena em cache os arquivos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercepta as requisições para servir do cache (offline)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Retorna do cache se encontrar
        }
        return fetch(event.request); // Se não, busca da rede
      })
  );
});
