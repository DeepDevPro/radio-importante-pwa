// src/app.ts - Bootstrap da aplicação Radio Importante

import { Controls } from './ui/controls';
import { AudioPlayer } from './player/audio';
import { StateManager } from './player/state';
import { MediaSessionManager } from './player/mediaSession';
import { DeviceDetection } from './platform/deviceDetection';
import { IPhoneAudioFix } from './platform/iphoneAudioFix';

console.log('🎵 Radio Importante PWA v2.0 iniciando...');

// ===== DETECÇÃO E CONFIGURAÇÃO PWA =====
function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || 
         Boolean((window.navigator as { standalone?: boolean }).standalone);
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Configurações específicas para iOS PWA
function setupIOSPWAOptimizations(): void {
  if (isIOS() && isPWAInstalled()) {
    console.log('🍎 iOS PWA detectado - aplicando otimizações para background audio');
    
    // Adicionar meta tags adicionais para iOS PWA se não existirem
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const metaCapable = document.createElement('meta');
      metaCapable.setAttribute('name', 'apple-mobile-web-app-capable');
      metaCapable.setAttribute('content', 'yes');
      document.head.appendChild(metaCapable);
    }
    
    // Configurar eventos para manter audio ativo
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('📱 App em background - mantendo áudio ativo');
      } else {
        console.log('📱 App em foreground');
      }
    });
    
    // Prevenir pausa não intencional
    document.addEventListener('beforeunload', (e) => {
      // Apenas prevenir se realmente estiver tocando
      const audioEl = document.querySelector('audio') as HTMLAudioElement;
      if (audioEl && !audioEl.paused) {
        e.preventDefault();
        return false;
      }
    });
    
    // Adicionar classe CSS para estilos específicos do PWA
    document.body.classList.add('ios-pwa');
    
    // Log modo de execução
    console.log('📱 Executando como PWA instalado no iOS');
  } else if (isIOS()) {
    console.log('🌐 Executando no Safari iOS');
  } else if (isPWAInstalled()) {
    console.log('📱 PWA instalado (não iOS)');
  } else {
    console.log('🌐 Executando no navegador');
  }
}

class RadioImportanteApp {
  private controls!: Controls;
  private audioPlayer!: AudioPlayer;
  private stateManager!: StateManager;
  private mediaSession!: MediaSessionManager;
  private deviceDetection!: DeviceDetection;
  private iphoneAudioFix!: IPhoneAudioFix;
  private isPlayerInitialized = false;

  constructor() {
    // Aplicar otimizações PWA primeiro
    setupIOSPWAOptimizations();
    
    // Registrar Service Worker
    this.registerServiceWorker();
    
    // Inicializar app
    this.init();
  }

  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        // Adicionar timestamp para forçar cache bust
        const timestamp = Date.now();
        const registration = await navigator.serviceWorker.register(`/sw.js?v=${timestamp}`);
        console.log('✅ Service Worker registrado:', registration.scope);
        console.log('🔄 SW Cache bust timestamp:', timestamp);
        
        // Verificar se há atualizações
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nova versão disponível
                console.log('🔄 Nova versão do app disponível');
                // Podemos mostrar uma notificação para o usuário aqui
              }
            });
          }
        });
      } catch (error) {
        console.log('❌ Falha ao registrar Service Worker:', error);
      }
    } else {
      console.log('⚠️ Service Worker não suportado neste browser');
    }
  }

  private async init(): Promise<void> {
    try {
      const appElement = document.getElementById('app');
      if (!appElement) {
        throw new Error('Elemento #app não encontrado');
      }

      // Mostrar loading
      this.showLoading(appElement);

      // Inicializar componentes
      await this.initializeComponents(appElement);

      // Carregar catálogo
      await this.loadCatalog();

      // Setup da interface
      this.setupUI();

      console.log('✅ Radio Importante inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      this.showError('Erro ao carregar o aplicativo. Tente recarregar a página.');
    }
  }

  private showLoading(container: HTMLElement): void {
    container.innerHTML = `
      <div class="loading">
        <h1>Radio Importante</h1>
        <div class="spinner"></div>
        <p>Carregando playlist...</p>
      </div>
    `;
  }

  private showError(message: string): void {
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <h1 style="color: #271F30; margin-bottom: 20px;">❌ Erro</h1>
          <p style="color: #271F30; margin-bottom: 20px;">${message}</p>
          <button onclick="window.location.reload()" 
                  style="background: #271F30; color: #EFEAE3; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
            Recarregar
          </button>
        </div>
      `;
    }
  }

  private async initializeComponents(container: HTMLElement): Promise<void> {
    // Inicializar detecção de dispositivo
    this.deviceDetection = DeviceDetection.getInstance();
    
    // DEBUG: Log completo da detecção
    const deviceInfo = this.deviceDetection.getDeviceInfo();
    console.log('🔍 DEVICE DETECTION DEBUG:', {
      userAgent: navigator.userAgent,
      detected: deviceInfo,
      isIPhonePWA: this.deviceDetection.isIPhonePWA(),
      isIPhone: this.deviceDetection.isIPhone(),
      isPWA: this.deviceDetection.isPWA()
    });
    this.iphoneAudioFix = new IPhoneAudioFix();
    
    console.log('📱 Device Detection:', this.deviceDetection.getDebugInfo());

    // Inicializar gerenciadores
    this.stateManager = new StateManager();
    this.audioPlayer = new AudioPlayer();
    this.mediaSession = new MediaSessionManager();

    // Aplicar correções específicas para iPhone PWA se necessário
    if (this.iphoneAudioFix.shouldApplyFixes()) {
      console.log('🍎 Aplicando correções específicas para iPhone PWA...');
      const audioElement = this.audioPlayer.getAudioElement();
      if (audioElement) {
        await this.iphoneAudioFix.initialize(audioElement);
      }
    }

    // Inicializar controles
    this.controls = new Controls(container);

    // Restaurar estado salvo
    this.stateManager.loadState();
  }

  private async loadCatalog(): Promise<void> {
    try {
      await this.stateManager.loadCatalog();
      const currentTrack = this.stateManager.getCurrentTrack();
      
      if (currentTrack) {
        this.controls.updateTrackInfo(currentTrack.title, currentTrack.artist);
      }
    } catch (error) {
      throw new Error(`Falha ao carregar catálogo: ${error}`);
    }
  }

  private setupUI(): void {
    // Configurar callbacks dos controles
    this.controls.onPlay = () => this.handlePlay();
    this.controls.onPause = () => this.handlePause();
    this.controls.onNext = () => this.handleNext();
    this.controls.getCurrentTrackInfo = () => {
      const trackDisplay = this.stateManager.getCurrentTrackDisplay();
      return trackDisplay ? { title: trackDisplay.title, artist: trackDisplay.artist } : null;
    };

    // Configurar eventos do player de áudio
    this.audioPlayer.setEventHandlers({
      onPlay: () => this.handleAudioPlay(),
      onPause: () => this.handleAudioPause(),
      onEnded: () => this.handleAudioEnded(),
      onTimeUpdate: (currentTime, duration) => this.handleTimeUpdate(currentTime, duration),
      onLoadStart: () => this.handleLoadStart(),
      onCanPlay: () => this.handleCanPlay(),
      onError: (error) => this.handleAudioError(error),
      onStalled: () => this.handleStalled(),
    });

    // Configurar Media Session
    this.mediaSession.setHandlers({
      onPlay: () => this.handlePlay(),
      onPause: () => this.handlePause(),
      onNext: () => this.handleNext(),
      onPrevious: () => this.handlePrevious(),
    });

    // Listener para mudanças de estado
    this.stateManager.addStateListener((state) => {
      this.controls.updateState({
        isPlaying: state.isPlaying,
        isLoading: state.isLoading,
        currentTrack: this.stateManager.getCurrentTrack()?.title || '',
      });

      // Salvar estado periodicamente
      if (state.isPlaying) {
        this.stateManager.saveState();
      }
    });

    // Habilitar controles
    this.controls.enableControls();

    // Atualizar Media Session com a faixa atual
    const currentTrack = this.stateManager.getCurrentTrack();
    if (currentTrack) {
      this.mediaSession.updateMetadata(currentTrack.title, currentTrack.artist, '/img/Leo_R_161_small.webp');
    }
  }

  private async handlePlay(): Promise<void> {
    try {
      // Log específico para iPhone PWA
      if (this.deviceDetection.isIPhonePWA()) {
        console.log('🍎 iPhone PWA: handlePlay() chamado');
      }

      // Inicializar player na primeira reprodução (após gesto do usuário)
      if (!this.isPlayerInitialized) {
        console.log('🎵 Inicializando player pela primeira vez...');
        await this.audioPlayer.initialize();
        this.isPlayerInitialized = true;
        
        // Para iPhone PWA, aguardar um momento após inicialização
        if (this.deviceDetection.isIPhonePWA()) {
          console.log('🍎 iPhone PWA: Aguardando após inicialização...');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Carregar faixa atual se necessário
      const track = this.stateManager.getCurrentTrack();
      if (!track) {
        throw new Error('Nenhuma faixa disponível');
      }

      console.log('🎵 Tentando reproduzir:', track.filename);
      
      // Só recarregar se for uma faixa diferente da atual
      const currentAudioSrc = this.audioPlayer.getState().src;
      const currentTrackUrl = this.stateManager.getCurrentTrackUrl();
      
      if (this.deviceDetection.isIPhonePWA()) {
        console.log('🍎 iPhone PWA Debug:');
        console.log('  - currentAudioSrc:', currentAudioSrc);
        console.log('  - currentTrackUrl:', currentTrackUrl);
        console.log('  - track.filename:', track.filename);
      }
      
      // Comparar URLs diretamente em vez de usar includes
      const isSameTrack = currentAudioSrc && currentTrackUrl && currentAudioSrc === currentTrackUrl;
      console.log('🔍 Debug - isSameTrack:', isSameTrack);
      
      if (!isSameTrack) {
        console.log('📂 Carregando nova faixa');
        await this.loadAndPlayCurrentTrack();
      } else {
        console.log('▶️ Continuando faixa atual de onde parou');
        const currentTime = this.audioPlayer.getCurrentTime();
        console.log('🔍 Debug - posição atual antes do play:', currentTime);
        
        // Para iPhone PWA, verificar se o áudio está pronto antes de tocar
        if (this.deviceDetection.isIPhonePWA()) {
          console.log('🍎 iPhone PWA: Verificando se áudio está pronto...');
          try {
            await this.iphoneAudioFix.ensureReadyForPWA();
          } catch (error) {
            console.error('⚠️ iPhone PWA: Erro na verificação de áudio:', error);
            // Continuar mesmo com erro de verificação
          }
        }
        
        await this.audioPlayer.play();
        console.log('🔍 Debug - posição atual após o play:', this.audioPlayer.getCurrentTime());
      }
    } catch (error) {
      console.error('❌ Erro ao reproduzir:', error);
      this.stateManager.updateState({ 
        error: `Erro ao reproduzir: ${error}`,
        isLoading: false,
        isPlaying: false
      });
    }
  }

  private handlePause(): void {
    console.log('⏸️ Pausando reprodução');
    this.audioPlayer.pause();
    this.stateManager.updateState({ isPlaying: false });
  }

  private async handleNext(): Promise<void> {
    console.log('⏭️ Avançando para próxima faixa');
    
    const wasPlaying = this.stateManager.getState().isPlaying;
    
    // Parar o áudio atual se estiver tocando
    if (this.audioPlayer.isPlaying()) {
      this.audioPlayer.stop();
    }
    
    this.stateManager.nextTrack();
    const newTrack = this.stateManager.getCurrentTrack();
    
    if (newTrack) {
      console.log(`🎵 Nova faixa: ${newTrack.title} - ${newTrack.artist}`);
      
      this.controls.updateTrackInfo(newTrack.title, newTrack.artist);
      this.mediaSession.updateMetadata(newTrack.title, newTrack.artist, '/img/Leo_R_161_small.webp');
      
      // Se estava tocando, carregar e tocar automaticamente a nova faixa
      if (wasPlaying) {
        await this.loadAndPlayCurrentTrack();
      }
    }
  }

  private async loadAndPlayCurrentTrack(): Promise<void> {
    try {
      const track = this.stateManager.getCurrentTrack();
      if (!track) {
        throw new Error('Nenhuma faixa disponível');
      }

      console.log('🎵 Carregando faixa:', track.filename);
      
      // Para iPhone PWA, usar arquivo contínuo em vez de carregar arquivos individuais
      if (this.deviceDetection.isIPhonePWA()) {
        console.log('🍎 iPhone PWA: Buscando faixa no arquivo contínuo...');
        const seekSuccess = this.audioPlayer.seekToTrackInContinuous(track.id);
        
        if (!seekSuccess) {
          console.warn('⚠️ iPhone PWA: Falha ao buscar no arquivo contínuo, tentando carregamento normal');
          // Fallback para carregamento normal
          const urls = this.stateManager.getCurrentTrackUrls();
          if (urls.length === 0) {
            throw new Error('Nenhuma URL disponível para a faixa');
          }
          await this.audioPlayer.loadTrackWithFallback(urls);
        }
      } else {
        // Dispositivos não-iPhone PWA: usar carregamento normal
        const urls = this.stateManager.getCurrentTrackUrls();
        if (urls.length === 0) {
          throw new Error('Nenhuma URL disponível para a faixa');
        }
        await this.audioPlayer.loadTrackWithFallback(urls);
      }
      
      // Para iPhone PWA, verificar se o áudio está pronto antes de tocar
      if (this.deviceDetection.isIPhonePWA()) {
        console.log('🍎 iPhone PWA: Verificando se áudio carregado está pronto...');
        try {
          await this.iphoneAudioFix.ensureReadyForPWA();
        } catch (error) {
          console.error('⚠️ iPhone PWA: Erro na verificação de áudio carregado:', error);
          // Continuar mesmo com erro de verificação
        }
      }
      
      await this.audioPlayer.play();
      console.log('✅ Faixa carregada e tocando');
      
    } catch (error) {
      console.error('❌ Erro ao carregar faixa:', error);
      this.stateManager.updateState({ 
        error: `Erro: ${error}`,
        isLoading: false,
        isPlaying: false
      });
      
      // Não tentar próxima faixa automaticamente - deixar o usuário decidir
    }
  }

  private async handlePrevious(): Promise<void> {
    this.stateManager.previousTrack();
    const newTrack = this.stateManager.getCurrentTrack();
    
    if (newTrack) {
      this.controls.updateTrackInfo(newTrack.title, newTrack.artist);
      this.mediaSession.updateMetadata(newTrack.title, newTrack.artist, '/img/Leo_R_161_small.webp');
      
      // Se estiver tocando, carregar e reproduzir a nova faixa
      if (this.stateManager.getState().isPlaying) {
        await this.handlePlay();
      }
    }
  }

  private handleAudioPlay(): void {
    this.stateManager.updateState({ isPlaying: true, isLoading: false, error: null });
    this.mediaSession.setPlaybackState('playing');
  }

  private handleAudioPause(): void {
    this.stateManager.updateState({ isPlaying: false, isLoading: false });
    this.mediaSession.setPlaybackState('paused');
  }

  private async handleAudioEnded(): Promise<void> {
    console.log('🔚 Música terminou, avançando para próxima automaticamente');
    
    // Avançar para próxima faixa
    this.stateManager.nextTrack();
    const newTrack = this.stateManager.getCurrentTrack();
    
    if (newTrack) {
      console.log(`🎵 Próxima faixa: ${newTrack.title} - ${newTrack.artist}`);
      
      // Atualizar UI e Media Session
      this.controls.updateTrackInfo(newTrack.title, newTrack.artist);
      this.mediaSession.updateMetadata(newTrack.title, newTrack.artist, '/img/Leo_R_161_small.webp');
      
      // Carregar e tocar automaticamente a próxima faixa
      await this.loadAndPlayCurrentTrack();
    } else {
      // Fim da playlist
      console.log('🏁 Fim da playlist');
      this.stateManager.updateState({ isPlaying: false });
    }
  }

  private handleTimeUpdate(currentTime: number, duration: number): void {
    // Se estamos em background no iOS PWA, fazer apenas o mínimo necessário
    if (isIOS() && isPWAInstalled() && document.hidden) {
      // Durante screen lock, evitar todas as atualizações que possam causar problemas
      return;
    }
    
    this.stateManager.updateState({ currentTime, duration });
    this.controls.updateProgress(currentTime, duration);
    this.mediaSession.updatePositionState(duration, 1, currentTime);
  }

  private handleLoadStart(): void {
    this.stateManager.updateState({ isLoading: true });
  }

  private handleCanPlay(): void {
    this.stateManager.updateState({ isLoading: false });
  }

  private handleAudioError(error: Error): void {
    console.error('❌ Erro no player de áudio:', error);
    
    this.stateManager.updateState({ 
      error: error.message, 
      isPlaying: false, 
      isLoading: false 
    });
    
    this.mediaSession.setPlaybackState('none');
    
    // Não pular automaticamente - deixar usuário decidir
    console.log('⚠️ Erro na reprodução. Use Next para tentar próxima faixa.');
  }

  private handleStalled(): void {
    console.warn('🐌 Conexão lenta detectada');
    // Poderia mostrar um indicador de buffer aqui
  }
}

// Inicializar quando DOM estiver pronto
function startApp(): void {
  new RadioImportanteApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
