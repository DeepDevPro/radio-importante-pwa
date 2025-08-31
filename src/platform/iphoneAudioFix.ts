// src/platform/iphoneAudioFix.ts - Correções específicas para iPhone PWA

import { DeviceDetection } from './deviceDetection';

export class IPhoneAudioFix {
  private deviceDetection: DeviceDetection;
  private audioElement?: HTMLAudioElement;
  private isInitialized = false;

  constructor() {
    this.deviceDetection = DeviceDetection.getInstance();
  }

  public shouldApplyFixes(): boolean {
    return this.deviceDetection.isIPhonePWA();
  }

  public async initialize(audioElement: HTMLAudioElement): Promise<void> {
    if (!this.shouldApplyFixes()) {
      console.log('📱 iPhone PWA fixes não necessários neste dispositivo');
      return;
    }

    console.log('🍎 Aplicando correções específicas para iPhone PWA...');
    
    this.audioElement = audioElement;
    
    // Aplicar todas as correções específicas para iPhone
    this.setupAudioElementConfig();
    this.setupUserInteractionUnlock();
    this.setupBackgroundAudioPrevention();
    this.setupIOSSpecificEventHandlers();
    
    this.isInitialized = true;
    console.log('✅ Correções iPhone PWA aplicadas');
  }

  private setupAudioElementConfig(): void {
    if (!this.audioElement) return;

    console.log('🔧 Configurando elemento audio para iPhone PWA...');
    
    // Configurações menos restritivas para iPhone PWA
    this.audioElement.preload = 'metadata'; // Carregar metadata, não none
    this.audioElement.crossOrigin = null; // Null para arquivos locais
    
    // Atributos específicos iOS
    this.audioElement.setAttribute('webkit-playsinline', 'true');
    this.audioElement.setAttribute('playsinline', 'true');
    
    // Desabilitar HLS no iPhone PWA - usar MP3 direto
    this.audioElement.setAttribute('data-disable-hls', 'true');
    
    // Forçar hardware acceleration
    this.audioElement.style.transform = 'translateZ(0)';
    this.audioElement.style.webkitTransform = 'translateZ(0)';
    
    // Configurações adicionais para evitar erro código 4
    this.audioElement.muted = false;
    this.audioElement.volume = 1.0;
    this.audioElement.loop = false;
    
    // Configuração específica PWA: permitir autoplay após interação
    this.audioElement.autoplay = false; // Explicitamente false para PWA
    this.audioElement.controls = false; // Sem controles nativos
    
    console.log('🍎 iPhone PWA: Configurações aplicadas - preload=metadata, crossOrigin=null');
    
    // Event listeners específicos para iPhone
    this.audioElement.addEventListener('loadstart', () => {
      console.log('🍎 iPhone: loadstart');
    });
    
    this.audioElement.addEventListener('error', () => {
      const error = this.audioElement?.error;
      console.error('🍎 iPhone Audio Error:', {
        code: error?.code,
        message: error?.message,
        src: this.audioElement?.src,
        networkState: this.audioElement?.networkState,
        readyState: this.audioElement?.readyState
      });
      
      // Tentar recuperação automática se for erro de rede
      if (error?.code === 4) {
        console.log('🔄 Tentando recuperação automática do erro 4...');
        this.recoverFromNetworkError();
      }
    });
    
    console.log('✅ Elemento audio configurado para iPhone PWA');
  }

  private recoverFromNetworkError(): void {
    if (!this.audioElement) return;
    
    console.log('🔄 Iniciando recuperação de erro de rede...');
    
    // Salvar src atual
    const currentSrc = this.audioElement.src;
    const currentTime = this.audioElement.currentTime;
    
    // Reset do elemento
    this.audioElement.src = '';
    this.audioElement.load();
    
    // Aguardar um pouco e tentar recarregar
    setTimeout(() => {
      if (this.audioElement && currentSrc) {
        console.log('🔄 Recarregando áudio após erro...');
        this.audioElement.src = currentSrc;
        this.audioElement.currentTime = currentTime;
        this.audioElement.load();
      }
    }, 1000);
  }

  public async ensureReadyForPWA(): Promise<void> {
    if (!this.audioElement) {
      throw new Error('Audio element não inicializado');
    }

    console.log('🍎 iPhone PWA: Verificando se áudio está pronto...');
    
    // Verificar estado atual
    const state = {
      src: this.audioElement.src,
      readyState: this.audioElement.readyState,
      networkState: this.audioElement.networkState,
      paused: this.audioElement.paused,
      duration: this.audioElement.duration
    };
    
    console.log('🔍 iPhone PWA: Estado atual do áudio:', state);
    
    // Se não tem src ou não está carregado, aguardar
    if (!this.audioElement.src || this.audioElement.readyState < 2) {
      console.log('📡 iPhone PWA: Aguardando carregamento...');
      
      const audioElement = this.audioElement; // Capturar referência
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout aguardando áudio ficar pronto'));
        }, 15000); // 15 segundos
        
        const checkReady = () => {
          if (audioElement.readyState >= 2) {
            clearTimeout(timeout);
            audioElement.removeEventListener('canplay', checkReady);
            audioElement.removeEventListener('loadeddata', checkReady);
            console.log('✅ iPhone PWA: Áudio pronto para reprodução');
            resolve();
          }
        };
        
        audioElement.addEventListener('canplay', checkReady);
        audioElement.addEventListener('loadeddata', checkReady);
        
        // Verificar se já está pronto
        checkReady();
      });
    }
    
    console.log('✅ iPhone PWA: Áudio já está pronto');
  }

  private setupUserInteractionUnlock(): void {
    console.log('🔓 Configurando desbloqueio por interação do usuário (iPhone PWA)...');
    
    let isUnlocked = false;
    
    const unlockAudio = async () => {
      if (!this.audioElement || isUnlocked) return;
      
      try {
        console.log('🍎 iPhone PWA: Tentando desbloquear áudio...');
        
        // Criar contexto de áudio se necessário
        const AudioContext = window.AudioContext || (window as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
        if (AudioContext) {
          const audioContext = new AudioContext();
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('🔊 iPhone PWA: AudioContext desbloqueado');
          }
        }
        
        // Configurar src temporário se não houver
        const originalSrc = this.audioElement.src;
        if (!originalSrc) {
          // Usar um audio data URL vazio para teste
          this.audioElement.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAAAAAAAAAAAAAAAAAAAZGF0YQQAAAAAAA==';
        }
        
        // Tentar play/pause para ativar o elemento
        const playPromise = this.audioElement.play();
        if (playPromise) {
          await playPromise;
          this.audioElement.pause();
          this.audioElement.currentTime = 0;
          console.log('🔓 iPhone PWA: Audio element desbloqueado via interação');
          isUnlocked = true;
        }
        
        // Restaurar src original se necessário
        if (!originalSrc) {
          this.audioElement.src = '';
          this.audioElement.load();
        }
      } catch (error) {
        console.log('⚠️ iPhone PWA: Falha no desbloqueio de áudio:', error);
        // Não é crítico, continuar
      }
    };

    // Eventos que podem desbloquear áudio - mais agressivo para PWA
    const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown', 'pointerdown'];
    
    const handleUnlock = () => {
      unlockAudio();
      // Remover listeners após primeiro uso bem sucedido
      if (isUnlocked) {
        unlockEvents.forEach(event => {
          document.removeEventListener(event, handleUnlock, true);
        });
      }
    };

    unlockEvents.forEach(event => {
      document.addEventListener(event, handleUnlock, true);
    });
  }

  private setupBackgroundAudioPrevention(): void {
    console.log('🎵 Configurando prevenção de pausa em background...');
    
    // Prevenir pausa quando app vai para background
    document.addEventListener('visibilitychange', () => {
      if (!this.audioElement) return;
      
      if (document.hidden) {
        console.log('📱 App foi para background - mantendo áudio ativo');
        // Não pausar automaticamente - deixar iOS decidir
      } else {
        console.log('📱 App voltou para foreground');
        // Verificar se precisa reativar
        if (this.audioElement.paused && this.wasPlayingBeforeBackground()) {
          console.log('🔄 Tentando retomar reprodução...');
          this.audioElement.play().catch(e => {
            console.log('⚠️ Não foi possível retomar automaticamente:', e);
          });
        }
      }
    });

    // Prevenir pausa por eventos do sistema
    this.audioElement?.addEventListener('pause', (event) => {
      console.log('⏸️ Evento pause detectado:', event);
      // Log para debug - não prevenir automaticamente
    });
  }

  private setupIOSSpecificEventHandlers(): void {
    if (!this.audioElement) return;

    console.log('📱 Configurando event handlers específicos para iOS...');

    // Handler para erro específico de iPhone PWA
    this.audioElement.addEventListener('error', (event) => {
      const error = this.audioElement?.error;
      console.error('❌ Erro específico iPhone PWA:', {
        code: error?.code,
        message: error?.message,
        event
      });
      
      // Log detalhado para debug
      this.logAudioState('Erro detectado');
    });

    // Handler para stalled (comum em iPhone PWA)
    this.audioElement.addEventListener('stalled', () => {
      console.warn('🐌 Stalled detectado em iPhone PWA');
      this.logAudioState('Stalled');
    });

    // Handler para waiting (buffering)
    this.audioElement.addEventListener('waiting', () => {
      console.log('⏳ Waiting/buffering em iPhone PWA');
      this.logAudioState('Waiting');
    });

    // Handler para canplay
    this.audioElement.addEventListener('canplay', () => {
      console.log('✅ Can play em iPhone PWA');
      this.logAudioState('Can Play');
    });

    // Handler para loadstart
    this.audioElement.addEventListener('loadstart', () => {
      console.log('🚀 Load start em iPhone PWA');
      this.logAudioState('Load Start');
    });
  }

  private wasPlayingBeforeBackground(): boolean {
    // Implementação simples - pode ser melhorada com state management
    return localStorage.getItem('audio-was-playing') === 'true';
  }

  public logAudioState(context: string): void {
    if (!this.audioElement) return;

    const state = {
      context,
      currentTime: this.audioElement.currentTime,
      duration: this.audioElement.duration,
      paused: this.audioElement.paused,
      ended: this.audioElement.ended,
      readyState: this.audioElement.readyState,
      networkState: this.audioElement.networkState,
      error: this.audioElement.error?.code,
      src: this.audioElement.src
    };

    console.log(`🔍 iPhone PWA Audio State [${context}]:`, state);
  }

  public getDebugInfo(): string {
    const deviceInfo = this.deviceDetection.getDebugInfo();
    const audioState = this.audioElement ? {
      initialized: this.isInitialized,
      currentTime: this.audioElement.currentTime,
      duration: this.audioElement.duration,
      paused: this.audioElement.paused,
      readyState: this.audioElement.readyState,
      networkState: this.audioElement.networkState,
      error: this.audioElement.error?.code || 'none'
    } : { status: 'No audio element' };

    return `
${deviceInfo}

🍎 iPhone PWA Audio Fixes:
- Should Apply: ${this.shouldApplyFixes()}
- Initialized: ${this.isInitialized}
- Audio State: ${JSON.stringify(audioState, null, 2)}
    `.trim();
  }
}
