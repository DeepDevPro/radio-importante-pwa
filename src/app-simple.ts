// src/app-simple.ts - Versão simplificada apenas para teste

import { Controls } from './ui/controls-simple';
import { AudioPlayer } from './player/audio-simple';

console.log('🎵 Radio Importante PWA v2.0 iniciando...');

// Interceptar todos os erros
window.addEventListener('error', (e) => {
  console.error('❌ Erro global capturado:', {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    error: e.error
  });
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('❌ Promise rejeitada:', e.reason);
});

// ===== DETECÇÃO E CONFIGURAÇÃO PWA =====
function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || 
         Boolean((window.navigator as { standalone?: boolean }).standalone);
}

function setupIOSPWAOptimizations(): void {
  if (isPWAInstalled()) {
    console.log('🍎 PWA detectado - aplicando otimizações iOS');
    // Otimizações específicas para iOS PWA
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 PWA voltou ao primeiro plano');
      }
    });
  } else {
    console.log('🌐 Executando no navegador');
  }
}

class RadioImportanteApp {
  private controls!: Controls;
  private audioPlayer!: AudioPlayer;
  private isPlayerInitialized = false;

  constructor() {
    console.log('🏗️ Construindo RadioImportanteApp...');
    
    try {
      // Aplicar otimizações PWA primeiro
      setupIOSPWAOptimizations();
      
      // Registrar Service Worker
      this.registerServiceWorker();
      
      // Inicializar app
      this.init();
      
      console.log('✅ Constructor concluído');
    } catch (error) {
      console.error('❌ Erro no constructor:', error);
      this.showError('Erro crítico na inicialização');
    }
  }

  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registrado:', registration.scope);
      } catch (error) {
        console.warn('⚠️ Falha ao registrar Service Worker:', error);
      }
    }
  }

  private async init(): Promise<void> {
    try {
      console.log('🚀 Inicializando Radio Importante...');
      
      // Aguardar DOM estar pronto
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }

      // Encontrar container
      const container = document.getElementById('app');
      if (!container) {
        throw new Error('Container #app não encontrado');
      }

      // Inicializar componentes
      await this.initializeComponents(container);
      
      console.log('✅ Radio Importante inicializado com sucesso');
      
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      this.showError('Erro ao carregar o aplicativo. Tente recarregar a página.', error);
    }
  }

  private async initializeComponents(container: HTMLElement): Promise<void> {
    try {
      console.log('🔧 Inicializando componentes...');
      
      // Inicializar audio player
      console.log('🎵 Criando AudioPlayer...');
      this.audioPlayer = new AudioPlayer();
      console.log('✅ AudioPlayer criado');

      // Inicializar controles
      console.log('🎛️ Criando Controls...');
      this.controls = new Controls(container);
      console.log('✅ Controls criado');
      
      // Definir primeira faixa
      this.controls.updateTrackInfo('Take My Time', '4 Hero feat. Jack Davey');

      // Configurar eventos dos controles
      console.log('⚡ Configurando event handlers...');
      this.controls.onPlay = () => this.handlePlay();
      this.controls.onPause = () => this.handlePause();
      this.controls.onNext = () => this.handleNext();
      console.log('✅ Event handlers configurados');
      
    } catch (error) {
      console.error('❌ Erro ao inicializar componentes:', error);
      throw error;
    }
  }

  private showError(message: string, details?: unknown): void {
    console.error('🚨 Exibindo erro para usuário:', message, details);
    
    const container = document.getElementById('app');
    if (container) {
      container.innerHTML = `
        <div style="
          text-align: center; 
          padding: 20px;
          background: white;
          border-radius: 12px;
          margin: 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        ">
          <h2 style="color: #d32f2f; margin-bottom: 16px;">❌ Erro</h2>
          <p style="margin-bottom: 20px; color: #333;">${message}</p>
          <button onclick="location.reload()" style="
            background: #271F30;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
          ">Recarregar</button>
          <br><br>
          <button onclick="window.location.href='/debug.html'" style="
            background: #666;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">🐛 Debug Console</button>
          <br><br>
          <details style="text-align: left; max-width: 400px; margin: 0 auto;">
            <summary style="cursor: pointer; color: #666;">Detalhes técnicos</summary>
            <pre style="
              background: #f5f5f5;
              padding: 10px;
              border-radius: 4px;
              overflow: auto;
              font-size: 12px;
              margin-top: 10px;
            ">${details ? JSON.stringify(details, null, 2) : 'Nenhum detalhe disponível'}</pre>
          </details>
        </div>
      `;
    }
  }

  private async handlePlay(): Promise<void> {
    try {
      if (!this.isPlayerInitialized) {
        await this.audioPlayer.initialize();
        // Carregar primeira música para teste
        await this.audioPlayer.loadTrack('/audio/4-Hero-take-my-time-(feat.-jack-davey).mp3');
        this.isPlayerInitialized = true;
      }
      
      await this.audioPlayer.play();
    } catch (error) {
      console.error('❌ Erro ao reproduzir:', error);
    }
  }

  private handlePause(): void {
    this.audioPlayer.pause();
  }

  private async handleNext(): Promise<void> {
    // Para teste, apenas reload da mesma música
    try {
      this.audioPlayer.stop();
      await this.audioPlayer.loadTrack('/audio/Belleruche - 13.6.35 (Natural Self Remix).mp3');
      this.controls.updateTrackInfo('13.6.35 (Natural Self Remix)', 'Belleruche');
      await this.audioPlayer.play();
    } catch (error) {
      console.error('❌ Erro ao avançar:', error);
    }
  }
}

// Inicializar app quando DOM estiver pronto
try {
  console.log('🚀 Iniciando RadioImportanteApp...');
  new RadioImportanteApp();
} catch (error) {
  console.error('❌ Erro crítico ao criar app:', error);
  
  // Fallback para mostrar erro
  const container = document.getElementById('app') || document.body;
  container.innerHTML = `
    <div style="text-align: center; padding: 20px; color: red;">
      <h2>❌ Erro Fatal</h2>
      <p>Não foi possível inicializar o aplicativo.</p>
      <button onclick="location.reload()">Recarregar</button>
      <br><br>
      <details>
        <summary>Erro técnico:</summary>
        <pre>${error}</pre>
      </details>
    </div>
  `;
}
