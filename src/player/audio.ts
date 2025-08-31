// src/player/audio.ts - Player de áudio nativo

import { DeviceDetection } from '../platform/deviceDetection';
import { TrackCue } from './trackCuesLoader';

export interface AudioPlayerEvents {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
  onError?: (error: Error) => void;
  onStalled?: () => void;
}

// Detectar iOS PWA - mantido para compatibilidade
function isIOSPWA(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && 
         (window.matchMedia('(display-mode: standalone)').matches || 
          Boolean((window.navigator as { standalone?: boolean }).standalone));
}

export class AudioPlayer {
  private audio!: HTMLAudioElement;
  private isInitialized = false;
  private currentSrc = '';
  private events: AudioPlayerEvents = {};
  private isIOSPWA: boolean;
  private deviceDetection: DeviceDetection;
  private keepAliveInterval?: number;
  private hlsMode = false;
  private trackCues: TrackCue[] = [];
  private currentTrackIndex = 0;
  private isBackground = false; // Controlar updates durante screen lock

  constructor() {
    // Usar nova detecção de dispositivo
    this.deviceDetection = DeviceDetection.getInstance();
    
    // Não criamos o elemento <audio> até o primeiro gesto do usuário
    this.isIOSPWA = isIOSPWA(); // Mantido para compatibilidade
    
    // Estratégia específica baseada no dispositivo
    if (this.deviceDetection.isIPhonePWA()) {
      console.log('🍎 iPhone PWA detectado - HABILITANDO HLS com elemento <video>');
      this.hlsMode = true; // Habilitar HLS para iPhone com video element
    } else if (this.deviceDetection.isIPadPWA()) {
      console.log('🍎 iPad PWA detectado - mantendo HLS');
      this.hlsMode = true; // Manter HLS para iPad
    } else if (this.isIOSPWA) {
      console.log('🍎 iOS PWA genérico detectado - aplicando otimizações');
      this.hlsMode = true;
    }

    // Configurar listener para detectar background/foreground
    this.setupBackgroundDetection();
  }

  private setupBackgroundDetection(): void {
    document.addEventListener('visibilitychange', () => {
      this.isBackground = document.hidden;
      if (this.isIOSPWA) {
        if (this.isBackground) {
          console.log('🍎 iOS PWA: Entrando em background - pausando updates');
        } else {
          console.log('🍎 iOS PWA: Voltando para foreground - retomando updates');
        }
      }
    });
  }

  public setEventHandlers(events: AudioPlayerEvents): void {
    this.events = events;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Criar elemento de mídia baseado no dispositivo e modo
    if (this.deviceDetection.isIPhonePWA() && this.hlsMode) {
      console.log('🍎 iPhone PWA + HLS: Criando elemento <video> para compatibilidade');
      const videoElement = document.createElement('video');
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.style.display = 'none'; // Esconder o vídeo, só queremos o áudio
      videoElement.preload = 'metadata';
      videoElement.crossOrigin = 'anonymous';
      this.audio = videoElement as HTMLAudioElement; // Compatibilidade de interface
    } else {
      console.log('📱 Criando elemento <audio> padrão');
      this.audio = new Audio();
      this.audio.preload = 'metadata';
      this.audio.crossOrigin = 'anonymous';
    }

    // Otimizações específicas para iOS PWA
    if (this.isIOSPWA) {
      this.setupIOSPWAOptimizations();
      await this.loadHLSForIOSPWA();
    }

    this.setupEventListeners();
    this.isInitialized = true;

    console.log('✅ AudioPlayer inicializado');
  }

  private async loadHLSForIOSPWA(): Promise<void> {
    try {
      console.log('🍎 Carregando stream contínua para iOS PWA...');
      
      // Carregar track cues
      const response = await fetch('/audio/hls/track-cues.json');
      if (response.ok) {
        const data = await response.json();
        this.trackCues = data.tracks;
        console.log(`✅ Track cues carregados: ${this.trackCues.length} faixas`);
        
        // Configurar arquivo único AAC (mais confiável que HLS)
        this.audio.src = '/audio/radio-importante-continuous.aac';
        this.hlsMode = true;
        console.log('🎵 Stream contínua AAC configurada para iOS PWA');
      } else {
        console.warn('⚠️ Track cues não encontrados, usando modo normal');
      }
    } catch {
      console.warn('⚠️ Falha ao carregar track cues, usando modo normal');
    }
  }

  private setupIOSPWAOptimizations(): void {
    if (!this.isIOSPWA) return;

    // Configurações específicas para iOS PWA
    this.audio.loop = false;
    this.audio.muted = false;
    this.audio.volume = 1.0;

    // Manter áudio "vivo" em iOS PWA
    this.audio.addEventListener('pause', () => {
      if (this.isIOSPWA) {
        console.log('🍎 iOS PWA: Áudio pausado - configurando keep-alive');
        this.setupKeepAlive();
      }
    });

    this.audio.addEventListener('play', () => {
      if (this.isIOSPWA && this.keepAliveInterval) {
        console.log('🍎 iOS PWA: Áudio reproduzindo - removendo keep-alive');
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = undefined;
      }
    });

    // Listener para mudanças de visibilidade
    document.addEventListener('visibilitychange', () => {
      if (this.isIOSPWA) {
        if (document.hidden) {
          console.log('🍎 iOS PWA: App em background');
          this.maintainAudioContext();
        } else {
          console.log('🍎 iOS PWA: App em foreground');
          this.restoreAudioContext();
        }
      }
    });
  }

  private setupKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    // Manter contexto de áudio ativo
    this.keepAliveInterval = window.setInterval(() => {
      if (this.audio && !this.audio.paused) {
        // Manter conexão viva
        console.log('🔄 Keep alive - audio ativo');
      }
    }, 5000);
  }

  private maintainAudioContext(): void {
    if (!this.audio || this.audio.paused) return;

    // Configurar para manter áudio em background
    try {
      this.audio.preservesPitch = true;
      console.log('🍎 iOS PWA: Configurações de background aplicadas');
    } catch {
      console.log('⚠️ iOS PWA: Algumas configurações não suportadas');
    }
  }

  private restoreAudioContext(): void {
    if (!this.audio) return;

    // Restaurar estado quando volta para foreground
    setTimeout(() => {
      if (this.audio && !this.audio.paused) {
        console.log('🍎 iOS PWA: Contexto de áudio restaurado');
      }
    }, 100);
  }

  private setupEventListeners(): void {
    // Evento de reprodução iniciada
    this.audio.addEventListener('play', () => {
      console.log('🎵 Reprodução iniciada');
      this.events.onPlay?.();
    });

    // Evento de pausa
    this.audio.addEventListener('pause', () => {
      console.log('⏸️ Reprodução pausada');
      this.events.onPause?.();
    });

    // Evento de fim da música
    this.audio.addEventListener('ended', () => {
      console.log('🔚 Música terminou');
      
      // Para iPhone PWA com HLS, adicionar delay para permitir transição automática
      if (this.deviceDetection.isIPhonePWA() && this.hlsMode) {
        console.log('🍎 iPhone PWA HLS: Aguardando transição automática...');
        setTimeout(() => {
          // Só disparar evento se realmente terminou e não continuou automaticamente
          if (this.audio && this.audio.ended) {
            console.log('🍎 iPhone PWA HLS: Confirmando fim da playlist');
            this.events.onEnded?.();
          }
        }, 1000); // 1 segundo para permitir transição HLS
      } else {
        this.events.onEnded?.();
      }
    });

    // Evento de atualização de tempo
    this.audio.addEventListener('timeupdate', () => {
      // No iOS PWA, não fazer updates durante background/screen lock
      if (this.isIOSPWA && this.isBackground) {
        return; // Ignorar timeupdate durante screen lock
      }
      this.events.onTimeUpdate?.(this.audio.currentTime, this.audio.duration || 0);
    });

    // Evento de início de carregamento
    this.audio.addEventListener('loadstart', () => {
      console.log('📡 Carregamento iniciado');
      this.events.onLoadStart?.();
    });

    // Evento quando pode começar a tocar
    this.audio.addEventListener('canplay', () => {
      console.log('✅ Pronto para tocar');
      this.events.onCanPlay?.();
    });

    // Evento de erro
    this.audio.addEventListener('error', () => {
      const error = new Error(`Erro no player: ${this.audio.error?.message || 'Desconhecido'}`);
      console.error('❌ Erro no player:', error);
      this.events.onError?.(error);
    });

    // Evento de buffer vazio (conexão lenta)
    this.audio.addEventListener('stalled', () => {
      console.warn('🐌 Buffer vazio (conexão lenta)');
      this.events.onStalled?.();
    });

    // Evento de espera por dados
    this.audio.addEventListener('waiting', () => {
      console.log('⏳ Aguardando dados...');
    });

    // Evento quando dados suficientes estão carregados
    this.audio.addEventListener('canplaythrough', () => {
      console.log('🚀 Dados suficientes carregados');
    });
  }

  public async loadTrack(url: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Player não inicializado');
    }

    console.log('� Carregando URL:', url);
    
    // Log específico para iPhone PWA com video element
    if (this.deviceDetection.isIPhonePWA() && this.hlsMode) {
      console.log('� iPhone PWA: Usando elemento <video> para HLS:', {
        tagName: this.audio.tagName,
        playsinline: this.audio.getAttribute('playsinline'),
        crossOrigin: this.audio.crossOrigin,
        preload: this.audio.preload
      });
    }

    this.currentSrc = url;
    this.audio.src = url;
    this.audio.load();
  }

  // Novo método para tentar múltiplas URLs
  public async loadTrackWithFallback(urls: string[]): Promise<void> {
    // Para iPhone PWA com arquivo contínuo, não recarregar o arquivo
    if (this.deviceDetection.isIPhonePWA() && this.hlsMode && this.audio.src.includes('radio-importante-continuous.aac')) {
      console.log('🍎 iPhone PWA: Arquivo contínuo já carregado, não recarregando');
      return;
    }
    
    let lastError: Error | null = null;
    
    for (const url of urls) {
      try {
        await this.loadTrack(url);
        console.log('✅ Sucesso com URL:', url);
        return; // Sucesso! Sair da função
      } catch (error) {
        console.log('❌ Falhou URL:', url, error);
        lastError = error as Error;
        // Continuar para próxima URL
      }
    }
    
    // Se chegou aqui, todas as URLs falharam
    throw lastError || new Error('Todas as URLs falharam');
  }

  // Método para buscar faixa específica no arquivo contínuo (iPhone PWA)
  public seekToTrackInContinuous(trackId: string): boolean {
    if (!this.deviceDetection.isIPhonePWA() || !this.hlsMode || this.trackCues.length === 0) {
      return false;
    }

    const trackCue = this.trackCues.find(cue => cue.id === trackId);
    if (!trackCue) {
      console.warn(`⚠️ Track cue não encontrado para ID: ${trackId}`);
      return false;
    }

    console.log(`🎯 iPhone PWA: Buscando faixa ${trackCue.title} na posição ${trackCue.startTime}s`);
    this.audio.currentTime = trackCue.startTime;
    this.currentTrackIndex = this.trackCues.findIndex(cue => cue.id === trackId);
    
    return true;
  }

  public async play(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Player não inicializado');
    }

    try {
      // O método play() retorna uma Promise no HTML5
      await this.audio.play();
    } catch (error) {
      console.error('❌ Erro ao tentar reproduzir:', error);
      throw new Error(`Não foi possível reproduzir: ${error}`);
    }
  }

  public pause(): void {
    if (!this.isInitialized) {
      return;
    }

    this.audio.pause();
  }

  public stop(): void {
    if (!this.isInitialized) {
      return;
    }

    this.audio.pause();
    this.audio.currentTime = 0;
  }

  public setVolume(volume: number): void {
    if (!this.isInitialized) {
      return;
    }

    // Volume entre 0 e 1
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  public seek(time: number): void {
    if (!this.isInitialized) {
      return;
    }

    this.audio.currentTime = time;
  }

  public getCurrentTime(): number {
    return this.isInitialized ? this.audio.currentTime : 0;
  }

  public getDuration(): number {
    return this.isInitialized ? (this.audio.duration || 0) : 0;
  }

  public isPlaying(): boolean {
    return this.isInitialized ? !this.audio.paused : false;
  }

  public getState(): {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    src: string;
  } {
    return {
      isPlaying: this.isPlaying(),
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      volume: this.isInitialized ? this.audio.volume : 1,
      src: this.currentSrc,
    };
  }

  public getAudioElement(): HTMLAudioElement | null {
    return this.isInitialized ? this.audio : null;
  }

  public destroy(): void {
    if (this.isInitialized) {
      this.audio.pause();
      this.audio.src = '';
      this.audio.load(); // Reset do elemento
      this.isInitialized = false;
      this.currentSrc = '';
      console.log('🗑️ AudioPlayer destruído');
    }
  }

  /**
   * Método específico para iPhone PWA - tenta habilitar HLS para continuidade
   */
  private async tryEnableHLSForIPhone(): Promise<boolean> {
    try {
      console.log('🍎 iPhone: Tentando habilitar HLS para continuidade...');
      
      // PRIMEIRO: Aplicar configurações de áudio específicas para iPhone
      this.audio.preload = 'metadata'; // Usar metadata em vez de auto inicialmente
      this.audio.crossOrigin = null; // Remover crossOrigin para HLS local
      this.audio.loop = false;
      
      // Limpar qualquer src anterior
      this.audio.src = '';
      this.audio.load();
      
      // Aguardar um momento para elemento resetar
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verificar se HLS está disponível
      const response = await fetch('/audio/hls/playlist-simple.m3u8', { method: 'HEAD' });
      if (!response.ok) {
        console.warn('🍎 iPhone: HLS playlist não encontrada - Status:', response.status);
        return false;
      }

      // Carregar track cues
      const cuesResponse = await fetch('/audio/hls/track-cues.json');
      if (cuesResponse.ok) {
        const data = await cuesResponse.json();
        this.trackCues = data.tracks;
        console.log(`🍎 iPhone: Track cues carregados: ${this.trackCues.length} faixas`);
        
        // Configurar HLS playlist com configurações específicas para iPhone
        this.audio.src = '/audio/hls/playlist-simple.m3u8';
        this.hlsMode = true;
        
        // Carregar e aguardar
        this.audio.load();
        
        console.log('🍎 iPhone: HLS configurado, aguardando carregamento...');
        
        // Aguardar metadata carregar antes de declarar sucesso
        return new Promise((resolve) => {
          const onLoadedMetadata = () => {
            console.log('🍎 iPhone: HLS metadata carregada com sucesso');
            this.audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            this.audio.removeEventListener('error', onError);
            this.audio.preload = 'auto'; // Agora pode usar auto
            resolve(true);
          };
          
          const onError = () => {
            const error = this.audio.error;
            console.error('🍎 iPhone: Erro ao carregar HLS:', {
              errorCode: error?.code,
              errorMessage: error?.message
            });
            this.audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            this.audio.removeEventListener('error', onError);
            this.hlsMode = false;
            resolve(false);
          };
          
          this.audio.addEventListener('loadedmetadata', onLoadedMetadata);
          this.audio.addEventListener('error', onError);
          
          // Timeout de segurança
          setTimeout(() => {
            this.audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            this.audio.removeEventListener('error', onError);
            if (!this.hlsMode) {
              console.warn('🍎 iPhone: Timeout ao carregar HLS');
              resolve(false);
            }
          }, 5000);
        });
        
      } else {
        console.warn('🍎 iPhone: Track cues não encontrados - Status:', cuesResponse.status);
        return false;
      }
    } catch (error) {
      console.warn('🍎 iPhone: Erro ao habilitar HLS:', error);
      return false;
    }
  }

  /**
   * Fallback para iPhone PWA quando HLS falha - carrega MP3 direto
   */
  private async loadDirectMP3ForIPhone(trackUrl: string): Promise<void> {
    console.log('🍎 iPhone: Fallback MP3 direto:', trackUrl);
    
    return new Promise((resolve, reject) => {
      if (!this.audio) {
        reject(new Error('Audio element não inicializado'));
        return;
      }

      // Resetar configurações para MP3
      this.hlsMode = false;
      this.audio.preload = 'none'; // Para iPhone PWA usar none
      this.audio.crossOrigin = null;
      
      const handleLoad = () => {
        console.log('✅ iPhone: MP3 fallback carregado com sucesso:', trackUrl);
        this.currentSrc = trackUrl;
        this.audio?.removeEventListener('canplaythrough', handleLoad);
        this.audio?.removeEventListener('error', handleError);
        resolve();
      };

      const handleError = () => {
        const error = this.audio?.error;
        console.error('❌ iPhone: Erro no fallback MP3:', {
          url: trackUrl,
          errorCode: error?.code,
          errorMessage: error?.message
        });
        this.audio?.removeEventListener('canplaythrough', handleLoad);
        this.audio?.removeEventListener('error', handleError);
        reject(new Error(`Fallback MP3 falhou no iPhone: ${trackUrl} (código: ${error?.code})`));
      };

      this.audio.addEventListener('canplaythrough', handleLoad);
      this.audio.addEventListener('error', handleError);
      this.audio.src = trackUrl;
      this.audio.load();
    });
  }
}
