/* eslint-env serviceworker */
/* global self, caches, fetch, console, URL, Response */

// Service Worker para The Ern PWA
// Estratégia: Network-First para HTML/Navegação, Cache-First para assets estáticos com hash, Network-Only para áudio/API
// Otimizado para atualização imediata de versão e iOS PWA Background Audio

const CACHE_NAME = 'the-ern-v1.0.0';
console.log('🎵 Service Worker do The Ern carregado:', CACHE_NAME);

// Lista de URLs que nunca devem ser cacheadas
const NEVER_CACHE = [
  '/audio/',
  '/api/',
  '/data/catalog.json',
  '/admin.html',
];

function isNeverCache(url) {
  return NEVER_CACHE.some(pattern => url.includes(pattern));
}

// Evento de instalação
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker (The Ern): Instalando...');
  // Força o novo Service Worker a assumir sem esperar que o anterior seja desativado
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

// Evento de ativação
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker (The Ern): Ativando e limpando caches antigos...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker (The Ern): Ativado e caches antigos limpos');
      // Toma controle de todas as abas abertas imediatamente
      return self.clients.claim();
    })
  );
});

// Evento de fetch - estratégia inteligente de cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requisições não-HTTP(S)
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Durante desenvolvimento local, sempre buscar da rede
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    event.respondWith(fetch(request));
    return;
  }

  // 1. Áudio, APIs e dados dinâmicos: Network-Only
  if (isNeverCache(request.url)) {
    event.respondWith(
      fetch(request).catch(() => new Response('Network error', { status: 500 }))
    );
    return;
  }
  
  // 2. HTML e Navegação principal: NETWORK-FIRST (garante sempre a UI mais recente!)
  const isHTML = request.mode === 'navigate' || 
                 request.headers.get('accept')?.includes('text/html') ||
                 url.pathname === '/' || 
                 url.pathname.endsWith('.html');

  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Se estiver offline, entrega o cache existente
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/');
          });
        })
    );
    return;
  }
  
  // 3. Assets estáticos (JS, CSS, Imagens, Fontes): CACHE-FIRST com fallback na rede
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        
        return networkResponse;
      });
    })
  );
});

// Evento de message para controle externo
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
