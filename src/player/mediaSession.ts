// src/player/mediaSession.ts - Media Session API para controles na lock screen

export interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

// Detectar iOS PWA
function isIOSPWA(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && 
         (window.matchMedia('(display-mode: standalone)').matches || 
          Boolean((window.navigator as any).standalone));
}

export class MediaSessionManager {
  private isSupported: boolean;
  private handlers: MediaSessionHandlers = {};
  private isIOSPWA: boolean;
  private currentMetadata: MediaMetadata | null = null;

  constructor() {
    // Verificar se Media Session API é suportada
    this.isSupported = 'mediaSession' in navigator;
    this.isIOSPWA = isIOSPWA();
    
    if (this.isSupported) {
      console.log('✅ Media Session API suportada');
      if (this.isIOSPWA) {
        console.log('🍎 iOS PWA detectado - configurando Media Session otimizada');
      }
      this.setupActionHandlers();
      this.setupIOSPWAOptimizations();
    } else {
      console.warn('⚠️ Media Session API não suportada neste browser');
    }
  }

  public setHandlers(handlers: MediaSessionHandlers): void {
    this.handlers = handlers;
  }

  private setupIOSPWAOptimizations(): void {
    if (!this.isIOSPWA || !this.isSupported) return;

    // Forçar atualização contínua da Media Session em iOS PWA
    setInterval(() => {
      if (this.currentMetadata && navigator.mediaSession?.metadata) {
        // Re-aplicar metadata a cada 30 segundos para evitar que desapareça
        navigator.mediaSession.metadata = this.currentMetadata;
      }
    }, 30000);

    // Listener para mudanças de visibilidade - crítico para iOS PWA
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.currentMetadata) {
        // Quando o app volta para foreground, restaurar metadata
        setTimeout(() => {
          if (navigator.mediaSession) {
            navigator.mediaSession.metadata = this.currentMetadata;
            console.log('🍎 iOS PWA: Metadata restaurada após retorno para foreground');
          }
        }, 100);
      }
    });
  }

  public updateMetadata(title: string, artist: string, artwork?: string): void {
    if (!this.isSupported) {
      return;
    }

    try {
      const artworkArray = artwork ? [
        { src: artwork, sizes: '96x96', type: 'image/svg+xml' },
        { src: artwork, sizes: '192x192', type: 'image/svg+xml' },
        { src: artwork, sizes: '512x512', type: 'image/svg+xml' },
        // Fallback para PNG para compatibilidade
        { src: '/icons/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
        { src: '/icons/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml' }
      ] : [
        { src: '/icons/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
        { src: '/icons/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml' }
      ];

      this.currentMetadata = new MediaMetadata({
        title,
        artist,
        album: 'Radio Importante',
        artwork: artworkArray,
      });

      navigator.mediaSession!.metadata = this.currentMetadata;

      // Para iOS PWA, forçar uma segunda atualização após delay
      if (this.isIOSPWA) {
        setTimeout(() => {
          if (navigator.mediaSession && this.currentMetadata) {
            navigator.mediaSession.metadata = this.currentMetadata;
            console.log('🍎 iOS PWA: Metadata reforçada');
          }
        }, 500);
      }

      console.log(`🎵 Media Session atualizada: ${title} - ${artist}`);
    } catch (error) {
      console.error('❌ Erro ao atualizar Media Session metadata:', error);
    }
  }

  public setPlaybackState(state: 'playing' | 'paused' | 'none'): void {
    if (!this.isSupported) {
      return;
    }

    try {
      navigator.mediaSession!.playbackState = state;
      console.log(`🎵 Media Session state: ${state}`);
    } catch (error) {
      console.error('❌ Erro ao definir playback state:', error);
    }
  }

  private setupActionHandlers(): void {
    if (!this.isSupported) {
      return;
    }

    try {
      // Play
      navigator.mediaSession!.setActionHandler('play', () => {
        console.log('🎵 Media Session: Play');
        this.handlers.onPlay?.();
      });

      // Pause
      navigator.mediaSession!.setActionHandler('pause', () => {
        console.log('⏸️ Media Session: Pause');
        this.handlers.onPause?.();
      });

      // Next Track
      navigator.mediaSession!.setActionHandler('nexttrack', () => {
        console.log('⏭️ Media Session: Next Track');
        this.handlers.onNext?.();
      });

      // Previous Track (opcional)
      navigator.mediaSession!.setActionHandler('previoustrack', () => {
        console.log('⏮️ Media Session: Previous Track');
        this.handlers.onPrevious?.();
      });

      // Stop (resetar para início)
      navigator.mediaSession!.setActionHandler('stop', () => {
        console.log('⏹️ Media Session: Stop');
        this.handlers.onPause?.();
      });

      console.log('✅ Media Session handlers configurados');
    } catch (error) {
      console.error('❌ Erro ao configurar Media Session handlers:', error);
    }
  }

  public updatePositionState(duration: number, playbackRate: number = 1, position: number = 0): void {
    if (!this.isSupported || !navigator.mediaSession!.setPositionState) {
      return;
    }

    try {
      navigator.mediaSession!.setPositionState({
        duration,
        playbackRate,
        position,
      });
    } catch (error) {
      // Alguns browsers podem não suportar setPositionState
      console.debug('Media Session position state não suportado:', error);
    }
  }

  public clearMetadata(): void {
    if (!this.isSupported) {
      return;
    }

    try {
      navigator.mediaSession!.metadata = null;
      navigator.mediaSession!.playbackState = 'none';
      console.log('🧹 Media Session limpa');
    } catch (error) {
      console.error('❌ Erro ao limpar Media Session:', error);
    }
  }

  public isMediaSessionSupported(): boolean {
    return this.isSupported;
  }

  // Debug: verificar estado atual
  public debug(): void {
    if (!this.isSupported) {
      console.log('🔍 Media Session não suportada');
      return;
    }

    console.log('🔍 Media Session Debug:', {
      supported: this.isSupported,
      playbackState: navigator.mediaSession!.playbackState,
      metadata: navigator.mediaSession!.metadata,
      hasHandlers: Object.keys(this.handlers).length,
    });
  }
}
