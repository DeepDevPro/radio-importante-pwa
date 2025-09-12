// Debug script para limpar Service Worker e cache completamente
// Cole este código no Console do Chrome para execução manual

(async function forceServiceWorkerUpdate() {
  console.log('🔄 Iniciando limpeza forçada...');
  
  // 1. Unregister todos os Service Workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (let registration of registrations) {
      console.log('🗑️ Removendo SW:', registration.scope);
      await registration.unregister();
    }
  }
  
  // 2. Limpar todos os caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    for (let cacheName of cacheNames) {
      console.log('🗑️ Removendo cache:', cacheName);
      await caches.delete(cacheName);
    }
  }
  
  // 3. Limpar localStorage
  localStorage.clear();
  sessionStorage.clear();
  
  console.log('✅ Limpeza completa finalizada!');
  console.log('🔄 Recarregando página...');
  
  // 4. Recarregar página com cache bust
  window.location.reload(true);
})();
