// src/player/audio-smart.ts - Player inteligente para diferentes estratégias de áudio

import { DeviceDetection } from '../platform/deviceDetection';
import { TrackCue } from './trackCuesLoader';

export interface SmartAudioPlayerEvents {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onTrackChange?: (trackId: string) => void;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
  onError?: (error: Error) => void;
  onBuffering?: (isBuffering: boolean) => void;
}

export class SmartAudioPlayer {
  private audio!: HTMLAudioElement;
  private isInitialized = false;
  private events: SmartAudioPlayerEvents = {};
  private deviceDetection: DeviceDetection;
  private trackCues: TrackCue[] = [];
  private currentTrackIndex = 0;
  private isBackground = false;
  private playbackMode: 'continuous' | 'segmented' | 'normal' = 'normal';
  private preloadQueue: HTMLAudioElement[] = [];
  private currentSegmentIndex = 0;

  constructor() {
    this.deviceDetection = DeviceDetection.getInstance();
  }

  public setEventHandlers(events: SmartAudioPlayerEvents): void {
    this.events = events;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🎵 Inicializando SmartAudioPlayer...');

    // Criar elemento audio/video baseado no dispositivo
    if (this.deviceDetection.isIPhonePWA()) {
      console.log('📱 iPhone PWA: Usando elemento <video>');
      this.audio = document.createElement('video') as any;
      this.audio.setAttribute('playsinline', 'true');
    } else {
      this.audio = document.createElement('audio');
    }

    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';

    // Detectar e carregar estratégia apropriada
    await this.detectAndLoadStrategy();

    this.setupEventListeners();
    this.setupBackgroundDetection();
    this.isInitialized = true;

    console.log('✅ SmartAudioPlayer inicializado');
  }

  private async detectAndLoadStrategy(): Promise<void> {
    try {
      // Tentar carregar track cues inteligente
      const response = await fetch('/audio/hls-smart/track-cues-smart.json');
      if (response.ok) {
        const data = await response.json();
        this.trackCues = data.tracks;
        this.playbackMode = data.mode; // 'continuous' ou 'segmented'
        
        console.log(`🧠 Modo inteligente detectado: ${this.playbackMode}`);
        console.log(`📋 Track cues carregados: ${this.trackCues.length} faixas`);
        
        if (this.playbackMode === 'continuous') {
          await this.setupContinuousMode();
        } else if (this.playbackMode === 'segmented') {
          await this.setupSegmentedMode();
        }
      } else {
        console.log('⚠️ Track cues inteligente não encontrado, usando modo normal');
        this.playbackMode = 'normal';
      }
    } catch (error) {
      console.warn('⚠️ Erro ao detectar estratégia, usando modo normal:', error);
      this.playbackMode = 'normal';
    }
  }

  private async setupContinuousMode(): Promise<void> {
    console.log('🎵 Configurando modo contínuo...');
    this.audio.src = '/audio/hls-smart/radio-importante-continuous.aac';
  }

  private async setupSegmentedMode(): Promise<void> {
    console.log('🎬 Configurando modo segmentado...');
    
    if (this.deviceDetection.isIPhonePWA()) {
      // Para iPhone PWA, usar HLS playlist
      this.audio.src = '/audio/hls-smart/playlist-smart.m3u8';
    } else {
      // Para outros dispositivos, carregar primeiro segmento
      await this.loadSegment(0);
    }
  }

  private async loadSegment(index: number): Promise<void> {
    if (index >= this.trackCues.length) return;

    const track = this.trackCues[index];
    const segmentUrl = `/audio/hls-smart/${track.filename.replace(/\.[^/.]+$/, '.aac')}`;
    
    console.log(`🎵 Carregando segmento ${index}: ${track.title}`);
    this.audio.src = segmentUrl;
    this.currentSegmentIndex = index;
    
    // Preload próximos segmentos
    this.preloadNextSegments(index);
  }

  private preloadNextSegments(currentIndex: number): void {
    // Limpar preloads anteriores
    this.preloadQueue.forEach(audio => audio.remove());
    this.preloadQueue = [];

    // Preload próximos 2 segmentos
    for (let i = 1; i <= 2; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < this.trackCues.length) {
        const nextTrack = this.trackCues[nextIndex];
        const nextUrl = `/audio/hls-smart/${nextTrack.filename.replace(/\.[^/.]+$/, '.aac')}`;
        
        const preloadAudio = document.createElement('audio');
        preloadAudio.crossOrigin = 'anonymous';
        preloadAudio.preload = 'auto';
        preloadAudio.src = nextUrl;
        
        this.preloadQueue.push(preloadAudio);
        console.log(`🔄 Preload: ${nextTrack.title}`);
      }
    }
  }

  private setupEventListeners(): void {
    this.audio.addEventListener('loadstart', () => {
      console.log('⏳ Carregamento iniciado');
      this.events.onLoadStart?.();
    });

    this.audio.addEventListener('canplay', () => {
      console.log('✅ Pronto para tocar');
      this.events.onCanPlay?.();
    });

    this.audio.addEventListener('play', () => {
      console.log('▶️ Reprodução iniciada');
      this.events.onPlay?.();
    });

    this.audio.addEventListener('pause', () => {
      console.log('⏸️ Reprodução pausada');
      this.events.onPause?.();
    });

    this.audio.addEventListener('ended', () => {
      console.log('🔚 Reprodução finalizada');
      this.handleAudioEnded();
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.isBackground) {
        this.handleTimeUpdate();
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.error('❌ Erro de áudio:', e);
      this.events.onError?.(new Error(`Erro de áudio: ${this.audio.error?.message || 'desconhecido'}`));
    });

    this.audio.addEventListener('waiting', () => {
      console.log('⏳ Buffering...');
      this.events.onBuffering?.(true);
    });

    this.audio.addEventListener('canplaythrough', () => {
      console.log('🚀 Buffer completo');
      this.events.onBuffering?.(false);
    });
  }

  private setupBackgroundDetection(): void {
    document.addEventListener('visibilitychange', () => {
      this.isBackground = document.hidden;
      console.log(`🔄 App ${this.isBackground ? 'background' : 'foreground'}`);
    });
  }

  private handleTimeUpdate(): void {
    const currentTime = this.audio.currentTime;
    const duration = this.audio.duration || 0;
    
    // Detectar mudança de faixa no modo contínuo
    if (this.playbackMode === 'continuous') {
      this.detectTrackChangeInContinuous(currentTime);
    }
    
    this.events.onTimeUpdate?.(currentTime, duration);
  }

  private detectTrackChangeInContinuous(currentTime: number): void {
    const newTrackIndex = this.trackCues.findIndex(cue => 
      currentTime >= cue.startTime && currentTime < cue.endTime
    );
    
    if (newTrackIndex !== -1 && newTrackIndex !== this.currentTrackIndex) {
      this.currentTrackIndex = newTrackIndex;
      const currentTrack = this.trackCues[newTrackIndex];
      console.log(`🎵 Nova faixa detectada: ${currentTrack.title}`);
      this.events.onTrackChange?.(currentTrack.id);
    }
  }

  private async handleAudioEnded(): Promise<void> {
    if (this.playbackMode === 'segmented' && !this.deviceDetection.isIPhonePWA()) {
      // Carregar próximo segmento
      const nextIndex = this.currentSegmentIndex + 1;
      if (nextIndex < this.trackCues.length) {
        await this.loadSegment(nextIndex);
        await this.play();
        return;
      }
    }
    
    this.events.onEnded?.();
  }

  public async playTrack(trackId: string): Promise<void> {
    const trackIndex = this.trackCues.findIndex(cue => cue.id === trackId);
    if (trackIndex === -1) {
      throw new Error(`Faixa não encontrada: ${trackId}`);
    }

    if (this.playbackMode === 'continuous') {
      // Buscar posição no arquivo contínuo
      const track = this.trackCues[trackIndex];
      console.log(`🎯 Buscando faixa no arquivo contínuo: ${track.title} (${track.startTime}s)`);
      this.audio.currentTime = track.startTime;
      this.currentTrackIndex = trackIndex;
    } else if (this.playbackMode === 'segmented' && !this.deviceDetection.isIPhonePWA()) {
      // Carregar segmento específico
      await this.loadSegment(trackIndex);
    } else if (this.playbackMode === 'normal') {
      // Modo normal - carregar arquivo individual
      const track = this.trackCues[trackIndex];
      this.audio.src = `/audio/${track.filename}`;
      this.currentTrackIndex = trackIndex;
    }

    await this.play();
  }

  public async play(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Player não inicializado');
    }

    try {
      await this.audio.play();
    } catch (error) {
      console.error('❌ Erro ao reproduzir:', error);
      throw error;
    }
  }

  public pause(): void {
    if (this.isInitialized) {
      this.audio.pause();
    }
  }

  public getCurrentTime(): number {
    return this.isInitialized ? this.audio.currentTime : 0;
  }

  public getDuration(): number {
    return this.isInitialized ? this.audio.duration || 0 : 0;
  }

  public getCurrentTrack(): TrackCue | null {
    return this.trackCues[this.currentTrackIndex] || null;
  }

  public getPlaybackMode(): string {
    return this.playbackMode;
  }

  public getStatus() {
    return {
      isInitialized: this.isInitialized,
      playbackMode: this.playbackMode,
      currentTrackIndex: this.currentTrackIndex,
      totalTracks: this.trackCues.length,
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      isBackground: this.isBackground
    };
  }
}
