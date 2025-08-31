// src/player/audio-simple.ts - Player de áudio simplificado para teste

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
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isNavigatorStandalone = Boolean((window.navigator as { standalone?: boolean }).standalone);
  const isPWA = isStandalone || isNavigatorStandalone;
  
  console.log('🔍 iOS PWA Detection:', {
    userAgent: navigator.userAgent,
    isIOS,
    isStandalone,
    isNavigatorStandalone,
    isPWA,
    result: isIOS && isPWA
  });
  
  return isIOS && isPWA;
}

export class AudioPlayer {
  private audio!: HTMLAudioElement;
  private isInitialized = false;
  private events: AudioPlayerEvents = {};
  private isIOSPWAMode: boolean;
  public currentTrack: string | null = null;
  
  constructor() {
    this.isIOSPWAMode = isIOSPWA();
    console.log(`🎵 AudioPlayer criado - iOS PWA: ${this.isIOSPWAMode}`);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔄 AudioPlayer já inicializado');
      return;
    }

    try {
      console.log('🚀 Inicializando AudioPlayer...');
      
      // Criar elemento de áudio
      this.audio = new Audio();
      this.audio.preload = 'metadata';
      this.audio.crossOrigin = 'anonymous';
      
      // Configurar eventos
      this.setupEventListeners();
      
      // iOS PWA específico
      if (this.isIOSPWAMode) {
        console.log('🍎 Aplicando configurações iOS PWA');
        (this.audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      }
      
      this.isInitialized = true;
      console.log('✅ AudioPlayer inicializado com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao inicializar AudioPlayer:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    this.audio.addEventListener('play', () => {
      console.log('🎵 Audio play event');
      this.events.onPlay?.();
    });

    this.audio.addEventListener('pause', () => {
      console.log('⏸️ Audio pause event');
      this.events.onPause?.();
    });

    this.audio.addEventListener('ended', () => {
      console.log('⏹️ Audio ended event');
      this.events.onEnded?.();
    });

    this.audio.addEventListener('timeupdate', () => {
      this.events.onTimeUpdate?.(this.audio.currentTime, this.audio.duration);
    });

    this.audio.addEventListener('loadstart', () => {
      console.log('⏳ Audio loadstart event');
      this.events.onLoadStart?.();
    });

    this.audio.addEventListener('canplay', () => {
      console.log('✅ Audio canplay event');
      this.events.onCanPlay?.();
    });

    this.audio.addEventListener('error', () => {
      const error = new Error(`Audio error: ${this.audio.error?.message || 'Unknown error'}`);
      console.error('❌ Audio error event:', error);
      this.events.onError?.(error);
    });

    this.audio.addEventListener('stalled', () => {
      console.log('⚠️ Audio stalled event');
      this.events.onStalled?.();
    });
  }

  setEventHandlers(events: AudioPlayerEvents): void {
    console.log('🎛️ Configurando event handlers...');
    this.events = { ...events };
  }

  async loadTrack(src: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`🔄 Carregando track: ${src}`);
      
      this.audio.src = src;
      this.currentTrack = src;
      
      // Força o carregamento
      this.audio.load();
      
      console.log('✅ Track carregado');
      
    } catch (error) {
      console.error('❌ Erro ao carregar track:', error);
      throw error;
    }
  }

  async play(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('▶️ Tentando reproduzir...');
      
      // iOS PWA precisa de interação do usuário
      if (this.isIOSPWAMode && this.audio.paused) {
        console.log('🍎 iOS PWA - forçando play após interação');
      }
      
      const playPromise = this.audio.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log('✅ Reprodução iniciada');
      }
      
    } catch (error) {
      console.error('❌ Erro ao reproduzir:', error);
      throw error;
    }
  }

  pause(): void {
    if (this.audio && !this.audio.paused) {
      console.log('⏸️ Pausando...');
      this.audio.pause();
    }
  }

  stop(): void {
    if (this.audio) {
      console.log('⏹️ Parando...');
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  get isPlaying(): boolean {
    return this.audio && !this.audio.paused;
  }

  get currentTime(): number {
    return this.audio?.currentTime || 0;
  }

  get duration(): number {
    return this.audio?.duration || 0;
  }

  set volume(value: number) {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, value));
    }
  }

  get volume(): number {
    return this.audio?.volume || 1;
  }
}
