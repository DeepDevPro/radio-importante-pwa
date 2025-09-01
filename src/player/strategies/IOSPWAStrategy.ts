// src/player/strategies/IOSPWAStrategy.ts - Strategy para iOS PWA com HLS

import { AudioStrategy, AudioStrategyEvents, Track, TrackCue } from './AudioStrategy';
import { TrackCuesLoader } from '../trackCuesLoader';

export class IOSPWAStrategy implements AudioStrategy {
  private audio!: HTMLAudioElement;
  private isInitialized = false;
  private events: AudioStrategyEvents = {};
  private trackCuesLoader: TrackCuesLoader;
  private currentTrackIndex = 0;
  private hlsPlaylistUrl = '/audio/hls/playlist-continuous.m3u8';

  constructor() {
    console.log('🍎 IOSPWAStrategy inicializada - HLS Mode');
    this.trackCuesLoader = TrackCuesLoader.getInstance();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.audio = new Audio();
    this.audio.preload = 'none'; // Para iOS PWA
    this.audio.volume = 1;
    this.setupEventListeners();
    
    // Carregar track cues da playlist HLS
    await this.trackCuesLoader.loadTrackCues();
    
    // Preparar HLS playlist
    await this.prepareHLSPlaylist();
    
    this.isInitialized = true;
    console.log('🍎 IOSPWAStrategy inicializada com HLS');
  }

  async loadPlaylist(tracks: Track[]): Promise<void> {
    console.log(`📂 Playlist carregada com ${tracks.length} faixas`);
  }

  private async prepareHLSPlaylist(): Promise<void> {
    try {
      // Verificar se HLS está disponível
      const response = await fetch(this.hlsPlaylistUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log('✅ HLS playlist encontrada');
        this.audio.src = this.hlsPlaylistUrl;
      } else {
        console.warn('⚠️ HLS playlist não encontrada, usando fallback');
        // Fallback para individual files se HLS não estiver pronto
        await this.setupFallbackMode();
      }
    } catch (error) {
      console.warn('⚠️ Erro ao carregar HLS, usando fallback:', error);
      await this.setupFallbackMode();
    }
  }

  private async setupFallbackMode(): Promise<void> {
    // Fallback para arquivos individuais caso HLS não esteja disponível
    console.log('🔄 Modo fallback ativado - usando arquivos individuais');
    // Por enquanto, manter compatibilidade
  }

  async play(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Player não inicializado');
    }
    
    try {
      await this.audio.play();
      this.events.onPlay?.();
    } catch (error) {
      console.error('Erro ao reproduzir:', error);
      this.events.onError?.(error as Error);
    }
  }

  pause(): void {
    if (this.audio) {
      this.audio.pause();
      this.events.onPause?.();
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.events.onPause?.();
    }
  }

  async next(): Promise<void> {
    const trackCues = this.trackCuesLoader.getAllTracks();
    if (this.currentTrackIndex < trackCues.length - 1) {
      this.currentTrackIndex++;
      const nextTrack = trackCues[this.currentTrackIndex];
      console.log(`⏭️ Próxima faixa: ${nextTrack.title}`);
      await this.playTrackAtIndex(this.currentTrackIndex);
    } else {
      console.log('🔄 Fim da playlist, voltando ao início');
      await this.playTrackAtIndex(0);
    }
  }

  async previous(): Promise<void> {
    const trackCues = this.trackCuesLoader.getAllTracks();
    if (this.currentTrackIndex > 0) {
      this.currentTrackIndex--;
      const prevTrack = trackCues[this.currentTrackIndex];
      console.log(`⏮️ Faixa anterior: ${prevTrack.title}`);
      await this.playTrackAtIndex(this.currentTrackIndex);
    } else {
      console.log('🔄 Início da playlist, indo para o final');
      await this.playTrackAtIndex(trackCues.length - 1);
    }
  }

  seekTo(time: number): void {
    if (this.audio) {
      this.audio.currentTime = time;
    }
  }

  isPlaying(): boolean {
    return this.audio ? !this.audio.paused : false;
  }

  getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  getDuration(): number {
    return this.audio?.duration || 0;
  }

  getCurrentTrack(): TrackCue | null {
    const trackCues = this.trackCuesLoader.getAllTracks();
    return trackCues[this.currentTrackIndex] || null;
  }

  getCurrentTrackIndex(): number {
    return this.currentTrackIndex;
  }

  setEventHandlers(events: AudioStrategyEvents): void {
    this.events = events;
  }

  getStrategyName(): string {
    return 'IOSPWAStrategy';
  }

  private async playTrackAtIndex(index: number): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Player não inicializado');
    }

    const trackCues = this.trackCuesLoader.getAllTracks();
    if (index < 0 || index >= trackCues.length) {
      throw new Error(`Índice de faixa inválido: ${index}`);
    }

    this.currentTrackIndex = index;
    const trackCue = trackCues[index];
    
    console.log(`🎵 Tocando faixa ${index + 1}: ${trackCue.title}`);
    
    // Navegar para o tempo correto na stream HLS
    this.audio.currentTime = trackCue.startTime;
    
    try {
      await this.audio.play();
      this.events.onTrackChange?.(trackCue);
      this.events.onPlay?.();
    } catch (error) {
      console.error('Erro ao tocar:', error);
      this.events.onError?.(error as Error);
    }
  }

  private setupEventListeners(): void {
    if (!this.audio) return;

    this.audio.addEventListener('loadstart', this.onLoadStart);
    this.audio.addEventListener('canplay', this.onCanPlay);
    this.audio.addEventListener('play', this.onPlay);
    this.audio.addEventListener('pause', this.onPause);
    this.audio.addEventListener('ended', this.onEnded);
    this.audio.addEventListener('timeupdate', this.onTimeUpdate);
    this.audio.addEventListener('error', this.onError);
    this.audio.addEventListener('stalled', this.onStalled);
  }

  private onLoadStart = (): void => {
    console.log('🔄 Carregando áudio...');
    this.events.onLoadStart?.();
  };

  private onCanPlay = (): void => {
    console.log('✅ Áudio pronto para reprodução');
    this.events.onCanPlay?.();
  };

  private onPlay = (): void => {
    console.log('▶️ Reprodução iniciada');
    this.events.onPlay?.();
  };

  private onPause = (): void => {
    console.log('⏸️ Reprodução pausada');
    this.events.onPause?.();
  };

  private onEnded = (): void => {
    console.log('🏁 Reprodução finalizada');
    this.events.onEnded?.();
    // Auto next track
    this.next();
  };

  private onTimeUpdate = (): void => {
    if (!this.audio) return;
    
    // Detectar mudança de faixa baseada no tempo atual
    const currentTime = this.audio.currentTime;
    const duration = this.audio.duration;
    const trackCues = this.trackCuesLoader.getAllTracks();
    
    for (let i = 0; i < trackCues.length; i++) {
      const cue = trackCues[i];
      if (currentTime >= cue.startTime && currentTime < cue.endTime) {
        if (i !== this.currentTrackIndex) {
          console.log(`🎵 Faixa detectada por tempo: ${cue.title}`);
          this.currentTrackIndex = i;
          this.events.onTrackChange?.(cue);
        }
        break;
      }
    }
    
    this.events.onTimeUpdate?.(currentTime, duration);
  };

  private onError = (event: Event): void => {
    const target = event.target as HTMLAudioElement;
    const error = target.error;
    console.error('❌ Erro no player:', error);
    this.events.onError?.(new Error(error?.message || 'Erro desconhecido no player'));
  };

  private onStalled = (): void => {
    console.warn('⚠️ Reprodução travada');
    this.events.onStalled?.();
  };
}
