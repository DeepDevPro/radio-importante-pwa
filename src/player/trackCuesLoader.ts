// src/player/trackCuesLoader.ts - Carregador de track cues para iOS PWA

export interface TrackCue {
  id: string;
  title: string;
  artist: string;
  genre: string;
  startTime: number;
  endTime: number;
  duration: number;
  filename: string;
}

export interface TrackCuesData {
  totalDuration: number;
  trackCount: number;
  generatedAt: string;
  tracks: TrackCue[];
}

export class TrackCuesLoader {
  private static instance: TrackCuesLoader;
  private trackCuesData: TrackCuesData | null = null;
  private isLoaded = false;

  private constructor() {}

  public static getInstance(): TrackCuesLoader {
    if (!TrackCuesLoader.instance) {
      TrackCuesLoader.instance = new TrackCuesLoader();
    }
    return TrackCuesLoader.instance;
  }

  public async loadTrackCues(): Promise<TrackCuesData> {
    if (this.isLoaded && this.trackCuesData) {
      return this.trackCuesData;
    }

    try {
      console.log('📋 Carregando track cues para iOS PWA...');
      
      const response = await fetch('/audio/hls/track-cues.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.trackCuesData = await response.json();
      this.isLoaded = true;

      if (this.trackCuesData) {
        console.log(`✅ Track cues carregados: ${this.trackCuesData.trackCount} faixas, ${this.trackCuesData.totalDuration.toFixed(1)}s total`);
        return this.trackCuesData;
      } else {
        throw new Error('Track cues data is null');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar track cues:', error);
      
      // Fallback: gerar track cues básicos
      console.log('🔄 Gerando track cues fallback...');
      return this.generateFallbackTrackCues();
    }
  }

  public findTrackByTime(currentTime: number): TrackCue | null {
    if (!this.trackCuesData) {
      return null;
    }

    return this.trackCuesData.tracks.find(track => 
      currentTime >= track.startTime && currentTime < track.endTime
    ) || null;
  }

  public findTrackById(trackId: string): TrackCue | null {
    if (!this.trackCuesData) {
      return null;
    }

    return this.trackCuesData.tracks.find(track => track.id === trackId) || null;
  }

  public getTrackByIndex(index: number): TrackCue | null {
    if (!this.trackCuesData || index < 0 || index >= this.trackCuesData.tracks.length) {
      return null;
    }

    return this.trackCuesData.tracks[index];
  }

  public getTrackIndex(trackId: string): number {
    if (!this.trackCuesData) {
      return -1;
    }

    return this.trackCuesData.tracks.findIndex(track => track.id === trackId);
  }

  public getAllTracks(): TrackCue[] {
    return this.trackCuesData?.tracks || [];
  }

  public getTotalDuration(): number {
    return this.trackCuesData?.totalDuration || 0;
  }

  public getTrackCount(): number {
    return this.trackCuesData?.trackCount || 0;
  }

  private async generateFallbackTrackCues(): Promise<TrackCuesData> {
    console.log('🔄 Gerando track cues de fallback...');
    
    try {
      // Tentar carregar do catálogo
      const catalogResponse = await fetch('/data/catalog.json');
      if (!catalogResponse.ok) {
        throw new Error('Catálogo não disponível');
      }

      const catalog = await catalogResponse.json();
      const tracks = catalog.tracks || [];

      // Gerar cues básicos (3 minutos por faixa)
      let currentTime = 0;
      const fallbackTracks: TrackCue[] = tracks.map((track: { id: string; title: string; artist: string; genre: string; filename: string }) => {
        const duration = 180; // 3 minutos default
        const trackCue: TrackCue = {
          id: track.id,
          title: track.title,
          artist: track.artist,
          genre: track.genre,
          startTime: currentTime,
          endTime: currentTime + duration,
          duration: duration,
          filename: track.filename
        };
        currentTime += duration;
        return trackCue;
      });

      const fallbackData: TrackCuesData = {
        totalDuration: currentTime,
        trackCount: fallbackTracks.length,
        generatedAt: new Date().toISOString(),
        tracks: fallbackTracks
      };

      this.trackCuesData = fallbackData;
      this.isLoaded = true;

      console.log(`✅ Track cues fallback gerados: ${fallbackTracks.length} faixas`);
      
      return fallbackData;
    } catch (error) {
      console.error('❌ Erro ao gerar fallback:', error);
      
      // Fallback do fallback: dados mínimos
      const emptyData: TrackCuesData = {
        totalDuration: 0,
        trackCount: 0,
        generatedAt: new Date().toISOString(),
        tracks: []
      };

      this.trackCuesData = emptyData;
      this.isLoaded = true;

      return emptyData;
    }
  }

  public reset(): void {
    this.trackCuesData = null;
    this.isLoaded = false;
    console.log('🔄 Track cues cache resetado');
  }
}
