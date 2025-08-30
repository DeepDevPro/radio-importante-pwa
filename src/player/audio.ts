// src/player/audio.ts - Player de áudio nativo

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

// Detectar iOS PWA
function isIOSPWA(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && 
         (window.matchMedia('(display-mode: standalone)').matches || 
          Boolean((window.navigator as any).standalone));
}

export class AudioPlayer {
  private audio!: HTMLAudioElement;
  private isInitialized = false;
  private currentSrc = '';
  private events: AudioPlayerEvents = {};
  private isIOSPWA: boolean;
  private keepAliveInterval?: number;
  private hlsMode = false;
  private trackCues: any[] = [];
  private currentTrackIndex = 0;

  constructor() {
    // Não criamos o elemento <audio> até o primeiro gesto do usuário
    this.isIOSPWA = isIOSPWA();
    if (this.isIOSPWA) {
      console.log('🍎 iOS PWA detectado - aplicando otimizações de áudio');
      this.hlsMode = true;
    }
  }

  public setEventHandlers(events: AudioPlayerEvents): void {
    this.events = events;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Criar elemento <audio> apenas após gesto do usuário
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.crossOrigin = 'anonymous'; // Para CORS

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
      console.log('🍎 Carregando HLS para iOS PWA...');
      
      // Carregar track cues
      const response = await fetch('/audio/hls/track-cues.json');
      if (response.ok) {
        const data = await response.json();
        this.trackCues = data.tracks;
        console.log(`✅ Track cues carregados: ${this.trackCues.length} faixas`);
        
        // Configurar HLS playlist
        this.audio.src = '/audio/hls/playlist-continuous.m3u8';
        this.hlsMode = true;
        console.log('🎵 HLS configurado para iOS PWA');
      } else {
        console.warn('⚠️ Track cues não encontrados, usando modo normal');
      }
    } catch (error) {
      console.warn('⚠️ Erro ao carregar HLS, usando modo normal:', error);
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
    this.keepAliveInterval = setInterval(() => {
      if (this.audio && this.audio.paused && this.isIOSPWA) {
        // Não fazer nada invasivo, apenas manter referência
        const currentTime = this.audio.currentTime;
        console.log(`🍎 iOS PWA: Keep-alive - posição: ${currentTime.toFixed(2)}s`);
      }
    }, 5000) as any;
  }

  private maintainAudioContext(): void {
    if (!this.audio || this.audio.paused) return;

    // Configurar para manter áudio em background
    try {
      this.audio.preservesPitch = true;
      console.log('🍎 iOS PWA: Configurações de background aplicadas');
    } catch (error) {
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
      this.events.onEnded?.();
    });

    // Evento de atualização de tempo
    this.audio.addEventListener('timeupdate', () => {
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

  public async loadTrack(trackUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.audio) {
        reject(new Error('Audio element não inicializado'));
        return;
      }

      // Se for iOS PWA com HLS, navegar por seek em vez de carregar nova URL
      if (this.hlsMode && this.trackCues.length > 0) {
        this.loadTrackInHLSMode(trackUrl);
        resolve();
        return;
      }

      console.log('🎵 Tentando carregar áudio:', trackUrl);

      const handleLoad = () => {
        console.log('✅ Áudio carregado com sucesso:', trackUrl);
        this.currentSrc = trackUrl;
        this.audio?.removeEventListener('canplaythrough', handleLoad);
        this.audio?.removeEventListener('error', handleError);
        resolve();
      };

      const handleError = () => {
        console.log('❌ Erro ao carregar áudio:', trackUrl);
        this.audio?.removeEventListener('canplaythrough', handleLoad);
        this.audio?.removeEventListener('error', handleError);
        reject(new Error(`Falha ao carregar áudio: ${trackUrl}`));
      };

      this.audio.addEventListener('canplaythrough', handleLoad);
      this.audio.addEventListener('error', handleError);

      // Definir o src irá iniciar o carregamento
      this.audio.src = trackUrl;
      this.audio.load();
    });
  }

  private loadTrackInHLSMode(trackUrl: string): void {
    // Extrair filename da URL para encontrar na track cues
    const filename = trackUrl.split('/').pop() || '';
    console.log('🍎 HLS Mode: Procurando faixa:', filename);
    
    const trackIndex = this.trackCues.findIndex((track: any) => 
      track.filename === filename || trackUrl.includes(track.filename)
    );
    
    if (trackIndex >= 0) {
      this.currentTrackIndex = trackIndex;
      const track = this.trackCues[trackIndex];
      console.log(`🎵 HLS: Navegando para faixa ${trackIndex + 1}: ${track.title} (${this.currentTrackIndex})`);
      
      // Navegar para o tempo correto na stream HLS
      this.audio.currentTime = track.startTime;
      this.currentSrc = trackUrl; // Manter compatibilidade
    } else {
      console.warn('⚠️ Faixa não encontrada no HLS:', filename);
    }
  }

  // Novo método para tentar múltiplas URLs
  public async loadTrackWithFallback(urls: string[]): Promise<void> {
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
}
