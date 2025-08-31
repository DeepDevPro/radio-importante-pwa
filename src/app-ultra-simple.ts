// src/app-ultra-simple.ts - Versão mínima que DEVE funcionar

console.log('🎵 Ultra Simple App iniciando...');

// Função de debug inline
function createDebugButton(): void {
  const debugBtn = document.createElement('button');
  debugBtn.innerHTML = '🐛';
  debugBtn.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #271F30;
    color: white;
    border: none;
    padding: 10px;
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;
  debugBtn.onclick = () => {
    window.location.href = '/debug.html';
  };
  document.body.appendChild(debugBtn);
  console.log('✅ Debug button criado');
}

// HTML inline ultra simples
function createSimpleInterface(): void {
  const container = document.getElementById('app');
  if (!container) {
    console.error('❌ Container app não encontrado');
    return;
  }

  container.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
      max-width: 400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      margin-top: 50px;
    ">
      <!-- Logo -->
      <div style="
        width: 200px;
        height: 200px;
        background: #271F30;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 48px;
        color: white;
        margin-bottom: 20px;
      ">🎵</div>

      <!-- Título -->
      <h1 style="
        margin: 0 0 20px 0;
        font-size: 24px;
        color: #271F30;
      ">Radio Importante</h1>

      <!-- Info da música -->
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="
          font-size: 18px;
          font-weight: bold;
          color: #271F30;
          margin-bottom: 5px;
        ">Take My Time</div>
        <div style="
          font-size: 14px;
          color: #666;
        ">4 Hero feat. Jack Davey</div>
      </div>

      <!-- Controles -->
      <div style="
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 20px;
      ">
        <button id="playBtn" style="
          width: 60px;
          height: 60px;
          border: none;
          border-radius: 50%;
          background: #271F30;
          color: white;
          font-size: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        ">▶️</button>
        
        <button id="nextBtn" style="
          width: 50px;
          height: 50px;
          border: none;
          border-radius: 50%;
          background: #666;
          color: white;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        ">⏭️</button>
      </div>

      <!-- Status -->
      <div id="status" style="
        font-size: 14px;
        color: #666;
      ">Pronto para tocar</div>
    </div>
  `;

  console.log('✅ Interface simples criada');
}

// Detectar plataforma
function detectPlatform(): void {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isNavigatorStandalone = Boolean((window.navigator as { standalone?: boolean }).standalone);
  const isPWA = isStandalone || isNavigatorStandalone;
  
  console.log('📱 Detecção:', {
    userAgent: navigator.userAgent,
    isIOS,
    isStandalone,
    isNavigatorStandalone,
    isPWA,
    isIOSPWA: isIOS && isPWA
  });

  // Mostrar no status
  const status = document.getElementById('status');
  if (status) {
    if (isIOS && isPWA) {
      status.textContent = '✅ iOS PWA detectado!';
      status.style.color = '#155724';
    } else if (isIOS) {
      status.textContent = '⚠️ iOS Safari (não PWA)';
      status.style.color = '#856404';
    } else {
      status.textContent = '🌐 Navegador desktop';
    }
  }
}

// Configurar eventos básicos
function setupEvents(): void {
  const playBtn = document.getElementById('playBtn');
  const nextBtn = document.getElementById('nextBtn');
  const status = document.getElementById('status');

  if (playBtn) {
    playBtn.onclick = () => {
      console.log('🎵 Play clicked');
      if (status) status.textContent = 'Tentando reproduzir...';
      
      // Simular reprodução
      setTimeout(() => {
        if (status) status.textContent = '▶️ Tocando (simulado)';
        if (playBtn) playBtn.textContent = '⏸️';
      }, 1000);
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      console.log('⏭️ Next clicked');
      if (status) status.textContent = 'Próxima música...';
    };
  }

  console.log('✅ Eventos configurados');
}

// Inicialização principal
function init(): void {
  try {
    console.log('🚀 Iniciando app ultra simples...');
    
    // Esperar DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        createSimpleInterface();
        createDebugButton();
        detectPlatform();
        setupEvents();
      });
    } else {
      createSimpleInterface();
      createDebugButton();
      detectPlatform();
      setupEvents();
    }
    
    console.log('✅ App ultra simples inicializado');
    
  } catch (error) {
    console.error('❌ Erro na inicialização ultra simples:', error);
    
    // Fallback extremo
    document.body.innerHTML = `
      <div style="text-align: center; padding: 40px; font-family: Arial;">
        <h1>❌ Erro Fatal</h1>
        <p>Falha crítica na inicialização</p>
        <button onclick="location.reload()" style="
          background: #d32f2f;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
        ">Recarregar</button>
        <br><br>
        <button onclick="window.location.href='/debug.html'" style="
          background: #666;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
        ">🐛 Debug</button>
        <pre style="text-align: left; background: #f5f5f5; padding: 10px; margin-top: 20px;">
${error}
        </pre>
      </div>
    `;
  }
}

// Iniciar
init();
