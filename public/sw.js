// Service Worker para Radio Importante PWA
// Estratégia: Cache-first para UI, Network-only para áudio
// Otimizado para iOS PWA Background Audio

const CACHE_NAME = 'radio-importante-v2';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.webmanifest',
  // Incluir apenas recursos essenciais
];

// Lista de URLs que nunca devem ser cacheadas
const NEVER_CACHE = [
  '/audio/',
  '/api/',
  '/data/catalog.json', // Sempre buscar versão mais recente
  'localhost:', // Evitar cache durante desenvolvimento
];

// Função para verificar se uma URL deve ser cacheada
function shouldCache(url) {
  // Durante desenvolvimento, cachear menos
  if (url.includes('localhost:')) {
    return false;
  }
  return !NEVER_CACHE.some(pattern => url.includes(pattern));
}

// Evento de instalação
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Service Worker: Cache aberto');
      // Não pre-cachear durante desenvolvimento
      return Promise.resolve();
    }).then(() => {
      console.log('✅ Service Worker: Instalado');
      // Força a ativação imediata
      return self.skipWaiting();
    })
  );
});

// Evento de ativação
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Ativando...');
  
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
      console.log('✅ Service Worker: Ativado');
      // Toma controle de todas as abas imediatamente
      return self.clients.claim();
    })
  );
});

// Evento de fetch - estratégia de cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requisições que não são HTTP/HTTPS
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Durante desenvolvimento, sempre usar network para recursos locais
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    event.respondWith(fetch(request));
    return;
  }
  
  // Estratégia Network-first para arquivos que não devem ser cacheados
  if (!shouldCache(request.url)) {
    event.respondWith(
      fetch(request).catch(() => {
        // Se falhar e for uma requisição de áudio, não fazer nada
        // Deixar o erro ser tratado pela aplicação
        return new Response('Network error', { status: 500 });
      })
    );
    return;
  }
  
  // Estratégia Cache-first para UI e recursos estáticos
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Encontrou no cache, retornar
        return cachedResponse;
      }
      
      // Não encontrou no cache, buscar na rede
      return fetch(request).then((networkResponse) => {
        // Verificar se a resposta é válida
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        // Clonar a resposta para armazenar no cache
        const responseToCache = networkResponse.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        
        return networkResponse;
      });
    })
  );
});

// Evento de message - para comunicação com a aplicação
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Log de debug
console.log('🎵 Service Worker do Radio Importante carregado (v2 - iOS otimizado)');
