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
  // Novo: aviso pré-fim (para futuras otimizações de pré-carregamento)
  onPreEnd?: (remainingSeconds: number) => void;
  // Novo: mudança de faixa no modo contínuo
  onTrackChange?: (trackCue: TrackCue) => void;
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
  // Novo: controle de boundary / avanço em background
  private backgroundBoundaryThreshold = 3; // segundos antes do fim para acionar avanço
  private backgroundAdvanceTriggered = false;
  private lastBackgroundUpdateTs = 0;
  // ==== Fase 0 Instrumentação Background (somente métricas / logs) ====
  private lastTimeUpdateTs = 0; // timestamp (ms) do último timeupdate efetivo
  private lastTimeUpdatePosition = 0; // posição (s) no último timeupdate
  private backgroundMaxGapMs = 0; // maior gap observado entre timeupdates em background
  private backgroundSuspensionDetections = 0; // contagens de suspeitas de suspensão
  private backgroundMonitorInterval?: number; // interval id
  private lastSuspensionLogTs = 0; // evitar log spam
  private manualSeekInProgress = false; // Flag para controlar seek manual
  private recoveryAttemptCount = 0; // (futuro) tentativas – ainda não usado
  private recoverySuccessCount = 0; // (futuro) sucessos – ainda não usado
  // ==== Fim Instrumentação ====

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
    // Iniciar monitor leve (Fase 0) – apenas logs
    this.startBackgroundMonitor();
  }

  private setupBackgroundDetection(): void {
    document.addEventListener('visibilitychange', () => {
      this.isBackground = document.hidden;
      if (this.isIOSPWA) {
        if (this.isBackground) {
          console.log('🍎 iOS PWA: Entrando em background - pausando updates pesados');
          this.backgroundAdvanceTriggered = false; // reset para nova faixa
        } else {
          console.log('🍎 iOS PWA: Voltando para foreground - retomando updates');
          this.backgroundAdvanceTriggered = false;
        }
      }
    });
  }

  private startBackgroundMonitor(): void {
    if (this.backgroundMonitorInterval) return;
    this.backgroundMonitorInterval = window.setInterval(() => {
      if (!this.isIOSPWA) return;
      if (!this.isBackground) return;
      if (!this.isPlaying()) return;
      const now = (typeof window !== 'undefined' && window.performance && typeof window.performance.now === 'function')
        ? window.performance.now()
        : Date.now();
      if (this.lastTimeUpdateTs === 0) return; // ainda não temos referência
      const gap = now - this.lastTimeUpdateTs;
      if (gap > this.backgroundMaxGapMs) {
        this.backgroundMaxGapMs = gap;
      }
      if (gap > 8000) {
        if (now - this.lastSuspensionLogTs > 30000) {
          this.lastSuspensionLogTs = now;
          this.backgroundSuspensionDetections++;
          const el: HTMLAudioElement = this.audio;
          const readyState = (el as HTMLAudioElement).readyState; // 0-4
          const networkState = (el as HTMLAudioElement).networkState; // 0-3
          const paused = el.paused;
          const current = el.currentTime;
          const deltaPos = (current - this.lastTimeUpdatePosition).toFixed(3);
          console.warn('[BG_STALL_DETECT]', {
            gapMs: Math.round(gap),
            backgroundMaxGapMs: Math.round(this.backgroundMaxGapMs),
            suspensions: this.backgroundSuspensionDetections,
            readyState,
            networkState,
            paused,
            currentTime: current.toFixed(3),
            deltaSinceLastUpdate: deltaPos,
            recoveryAttemptCount: this.recoveryAttemptCount,
            recoverySuccessCount: this.recoverySuccessCount
          });
        }
      }
    }, 5000);
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
      
      // Kill switch: verificar se contínuo está desabilitado
      const killSwitchQuery = window.location.search.includes('mp3c=off');
      const killSwitchLocal = localStorage.getItem('iospwaContinuous') === 'off';
      
      if (killSwitchQuery || killSwitchLocal) {
        console.log('🛑 Kill switch ativo - retornando ao comportamento anterior');
        if (killSwitchQuery) console.log('  → Ativado via ?mp3c=off');
        if (killSwitchLocal) console.log('  → Ativado via localStorage');
        this.hlsMode = false;
        return;
      }
      
      // Usar API_CONFIG para determinar backend correto (staging ou produção)
      const { API_CONFIG } = await import('../config/api.js');
      const backendUrl = API_CONFIG.baseUrl;
      
      console.log(`🌐 Usando backend: ${backendUrl}`);
      
      // Fetch track cues das novas rotas /audio/continuous/*
      const response = await fetch(`${backendUrl}/audio/continuous/track-cues.json`);
      if (response.ok) {
        const data = await response.json();
        this.trackCues = data.tracks;
        console.log(`✅ Track cues carregados: ${this.trackCues.length} faixas`);
        
        // Configurar arquivo único MP3 contínuo das novas rotas (CRÍTICO: iPhone PWA só funciona com MP3)
        this.audio.src = `${backendUrl}/audio/continuous/radio-importante-continuous.mp3`;
        this.hlsMode = true;
        console.log('🎵 Stream contínua MP3 configurada para iOS PWA via /audio/continuous/*');
      } else {
        console.warn('⚠️ Track cues não encontrados nas rotas /audio/continuous/*, usando modo normal');
      }
    } catch (error) {
      console.warn('⚠️ Falha ao carregar track cues das rotas contínuas, usando modo normal:', error);
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
      const current = this.audio.currentTime || 0;
      const duration = this.audio.duration || 0;

      // Atualizar métricas de instrumentação
      const nowTs = (typeof window !== 'undefined' && window.performance && window.performance.now) ? window.performance.now() : Date.now();
      this.lastTimeUpdateTs = nowTs;
      this.lastTimeUpdatePosition = current;

      // Boundary detection mesmo em background (iOS throttling tolera callbacks curtos)
      if (this.isIOSPWA && duration > 0) {
        const remaining = duration - current;

        // Em background: limitar frequência de processamento completo (a cada ~2s)
        if (this.isBackground) {
          const now = (typeof window !== 'undefined' && window.performance && window.performance.now) ? window.performance.now() : Date.now();
          if (now - this.lastBackgroundUpdateTs < 1900) {
            // Apenas checar boundary crítico mesmo que throttle
            if (!this.backgroundAdvanceTriggered && remaining > 0 && remaining <= this.backgroundBoundaryThreshold) {
              this.handleBackgroundAdvance(remaining);
            }
            return; // ignorar updates não críticos
          }
          this.lastBackgroundUpdateTs = now;
        }

        if (!this.backgroundAdvanceTriggered && remaining > 0 && remaining <= this.backgroundBoundaryThreshold) {
          this.handleBackgroundAdvance(remaining);
        }
      }

      // Detectar mudança de faixa no modo contínuo do iOS PWA
      if (this.hlsMode && this.trackCues.length > 0) {
        this.detectTrackChangeInContinuous(current);
      }

      // Antes retornava totalmente em background — agora fazemos update leve
      if (!(this.isIOSPWA && this.isBackground)) {
        this.events.onTimeUpdate?.(current, duration);
      } else {
        // Update degradado (posição aproximada) para manter mínimo estado
        if (current > 0 && duration > 0) {
          this.events.onTimeUpdate?.(current, duration);
        }
      }
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
    if (this.deviceDetection.isIPhonePWA() && this.hlsMode && this.audio.src.includes('radio-importante-continuous')) {
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

  // Método para buscar faixa específica no arquivo contínuo (iPhone PWA) - Etapa 6: Precisão melhorada
  public seekToTrackInContinuous(trackId: string): boolean {
    if (!this.deviceDetection.isIPhonePWA() || !this.hlsMode || this.trackCues.length === 0) {
      return false;
    }

    const trackCue = this.trackCues.find(cue => cue.id === trackId);
    if (!trackCue) {
      console.warn(`⚠️ Track cue não encontrado para ID: ${trackId}`);
      return false;
    }

    // Ativar flag de seek manual para evitar conflitos com detecção automática
    this.manualSeekInProgress = true;

    // Etapa 6: Aplicar guard band de 40ms para evitar cliques
    const guardBandMs = 40;
    const guardBandSeconds = guardBandMs / 1000;
    const targetTime = Math.max(0, trackCue.startTime + guardBandSeconds);
    
    console.log(`🎯 iPhone PWA: Seek manual para faixa ${trackCue.title} na posição ${targetTime.toFixed(3)}s (com guard band +${guardBandMs}ms)`);
    
    // Aplicar micro fade-in para suavizar transição
    const originalVolume = this.audio.volume;
    this.audio.volume = 0.3; // Reduzir volume temporariamente
    
    this.audio.currentTime = targetTime;
    this.currentTrackIndex = this.trackCues.findIndex(cue => cue.id === trackId);
    
    // Forçar atualização imediata dos metadados
    this.events.onTrackChange?.(trackCue);
    
    // Restaurar volume e desativar flag após um delay
    setTimeout(() => {
      if (this.audio && !this.audio.paused) {
        this.audio.volume = originalVolume;
        console.log(`🔊 Volume restaurado após seek para ${trackCue.title}`);
      }
      // Desativar flag após seek completar
      this.manualSeekInProgress = false;
    }, 200);
    
    return true;
  }

  // Detectar mudança de faixa baseada no currentTime vs trackCues
  private detectTrackChangeInContinuous(currentTime: number): void {
    if (!this.hlsMode || this.trackCues.length === 0 || this.manualSeekInProgress) {
      return; // Não detectar mudanças durante seek manual
    }

    // Encontrar a faixa atual baseada no currentTime
    const currentTrackCue = this.trackCues.find(cue => 
      currentTime >= cue.startTime && currentTime < cue.endTime
    );

    if (currentTrackCue) {
      const newTrackIndex = this.trackCues.findIndex(cue => cue.id === currentTrackCue.id);
      
      // Se mudou de faixa, notificar
      if (newTrackIndex !== this.currentTrackIndex && newTrackIndex >= 0) {
        const oldIndex = this.currentTrackIndex;
        this.currentTrackIndex = newTrackIndex;
        
        console.log(`🎵 Mudança de faixa detectada automaticamente: ${currentTrackCue.title} - ${currentTrackCue.artist} (${oldIndex} → ${newTrackIndex})`);
        
        // Notificar mudança de faixa via eventos
        this.events.onTrackChange?.(currentTrackCue);
      }
    }
  }  // Etapa 6: Seek por índice de cue (para uso com shuffle)
  public seekToTrackInContinuousByIndex(cueIndex: number): boolean {
    if (!this.deviceDetection.isIPhonePWA() || !this.hlsMode || this.trackCues.length === 0) {
      return false;
    }

    if (cueIndex < 0 || cueIndex >= this.trackCues.length) {
      console.warn(`⚠️ Índice de cue inválido: ${cueIndex}`);
      return false;
    }

    const trackCue = this.trackCues[cueIndex];
    return this.seekToTrackInContinuous(trackCue.id);
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

  // Etapa 6: Métodos públicos para verificação de estado
  public isInHLSMode(): boolean {
    return this.hlsMode;
  }

  public isDeviceIPhonePWA(): boolean {
    return this.deviceDetection.isIPhonePWA();
  }

  public hasContinuousAudio(): boolean {
    return this.hlsMode && this.audio && this.audio.src.includes('radio-importante-continuous');
  }

  // Etapa 6: Métodos públicos para verificação de estado
  public isInContinuousMode(): boolean {
    return this.deviceDetection.isIPhonePWA() && this.hlsMode;
  }

  public hasTrackCues(): boolean {
    return this.trackCues.length > 0;
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

    if (this.backgroundMonitorInterval) {
      clearInterval(this.backgroundMonitorInterval);
      this.backgroundMonitorInterval = undefined;
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

  private handleBackgroundAdvance(remaining: number): void {
    this.backgroundAdvanceTriggered = true;
    console.log(`⏭️  BG Boundary detectado (restam ~${remaining.toFixed(2)}s) - preparando avanço`);
    this.events.onPreEnd?.(remaining);

    // Estratégia simples: disparar onEnded antecipado para iniciar próxima faixa
    // (iOS permite autoplay contínuo enquanto ainda há áudio ativo)
    setTimeout(() => {
      // Se ainda não terminou naturalmente e player segue ativo
      if (this.audio && !this.audio.ended) {
        console.log('⏭️  BG Advance: disparando onEnded antecipado (pré-fim)');
        this.events.onEnded?.();
      }
    }, Math.max(remaining * 1000 - 300, 0)); // tenta alinhar ~300ms antes do fim real
  }
}
