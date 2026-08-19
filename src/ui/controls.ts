// src/ui/controls.ts - Interface de controles do player

export interface ControlsState {
  isPlaying: boolean;
  currentTrack: string;
  isLoading: boolean;
}

export class Controls {
  private container: HTMLElement;
  private playButton!: HTMLButtonElement;
  private nextButton!: HTMLButtonElement;
  private infoButton!: HTMLButtonElement;
  // private trackDisplay!: HTMLElement; // Não usado atualmente
  private infoModal!: HTMLElement;
  private modalArtist!: HTMLElement;
  private modalSong!: HTMLElement;
  private state: ControlsState;
  private lastProgressLog = 0; // throttle para logs de progresso

  // Callbacks para eventos
  public onPlay: (() => void) | null = null;
  public onPause: (() => void) | null = null;
  public onNext: (() => void) | null = null;
  public getCurrentTrackInfo: (() => { title: string; artist: string } | null) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.state = {
      isPlaying: false,
      currentTrack: '',
      isLoading: false,
    };

    this.render();
    this.setupEventListeners();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="player-container">
        <!-- Logo da Radio Importante -->
        <div class="artwork">
          <img src="/icons/logo-theern-vertical.png" alt="Radio Importante" class="radio-logo-main" />
        </div>

        <!-- Header with Utility Buttons -->
        <div class="header">
          <div class="utility-buttons">
            <button class="utility-btn debug-btn" id="debugButton" title="Debug Console">🐛</button>
            <button class="utility-btn admin-btn" id="adminButton" title="Administração">⚙️</button>
          </div>
        </div>

        <!-- Track Information -->
        <div class="track-info">
          <div class="track-metadata" id="trackMetadata">Selecione uma música</div>
        </div>

        <!-- Main Controls -->
        <div class="controls">
          <button class="btn btn-next" id="nextButton" title="Próxima">
            <img src="/icons/next.svg" alt="Next" />
          </button>
          <button class="btn btn-play" id="playButton" title="Reproduzir/Pausar">
            <img src="/icons/play.svg" class="play-icon" alt="Play" />
            <img src="/icons/pause.svg" class="pause-icon" style="display: none;" alt="Pause" />
          </button>
          <button class="btn btn-info" id="infoButton" title="Informações">
            <img src="/icons/info.svg" alt="Info" />
          </button>
        </div>

        <!-- Container da imagem customizada -->
        <div class="custom-image-container">
          <img src="/img/leo-r031-2.webp" alt="Radio Importante" class="custom-image" />
        </div>
      </div>

      <!-- Info Modal (fora do player-container para não afetar layout) -->
      <div class="info-modal" id="infoModal" style="display: none;">
        <div class="modal-content">
          <div class="modal-body">
            <p class="modal-description">Você está ouvindo a Rádio Importante. Todas músicas aqui são extraídas direto de vinis de época. Nosso objetivo é levar o mundo dos discos pra você. Uma curadoria com total liberdade de gêneros e época, a única regra é que seja provinda de um disco de vinyl.</p>
            <div class="modal-track-info">
              <p class="modal-artist" id="modalArtist">Artista</p>
              <p class="modal-song" id="modalSong">Nome da Música</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Capturar referências dos elementos
    this.playButton = this.container.querySelector('#playButton') as HTMLButtonElement;
    this.nextButton = this.container.querySelector('#nextButton') as HTMLButtonElement;
    this.infoButton = this.container.querySelector('#infoButton') as HTMLButtonElement;
    // this.trackDisplay = this.container.querySelector('#trackTitle') as HTMLElement;
    this.infoModal = this.container.querySelector('#infoModal') as HTMLElement;
    this.modalArtist = this.container.querySelector('#modalArtist') as HTMLElement;
    this.modalSong = this.container.querySelector('#modalSong') as HTMLElement;
  }

  private setupEventListeners(): void {
    // Play/Pause button
    this.playButton.addEventListener('click', () => {
      if (this.state.isPlaying) {
        this.onPause?.();
      } else {
        this.onPlay?.();
      }
    });

    // Next button
    this.nextButton.addEventListener('click', () => {
      this.onNext?.();
    });

    // Info button
    this.infoButton.addEventListener('click', () => {
      this.toggleInfoModal();
    });

    // Admin button
    const adminButton = this.container.querySelector('#adminButton') as HTMLButtonElement;
    adminButton.addEventListener('click', () => {
      window.open('/admin.html', '_blank');
    });

    // Debug button
    const debugButton = this.container.querySelector('#debugButton') as HTMLButtonElement;
    debugButton.addEventListener('click', () => {
      window.open('/debug.html', '_blank');
    });

    // Click anywhere on modal to close (including content)
    this.infoModal.addEventListener('click', () => {
      this.hideInfoModal();
    });
  }

  public updateTrackInfo(title: string, artist: string = ''): void {
    const trackMetadata = this.container.querySelector('#trackMetadata') as HTMLElement;
    
    if (trackMetadata) {
      if (artist && title) {
        // Formato: Artista "Título da Música"
        trackMetadata.textContent = `${artist} "${title}"`;
      } else if (title) {
        trackMetadata.textContent = `"${title}"`;
      } else {
        trackMetadata.textContent = 'Selecione uma música';
      }
    }
    
    this.state.currentTrack = title;
  }

  public setPlaying(isPlaying: boolean): void {
    this.state.isPlaying = isPlaying;
    this.updateUI();
  }

  public enableControls(): void {
    this.playButton.disabled = false;
    this.nextButton.disabled = false;
  }

  public disableControls(): void {
    this.playButton.disabled = true;
    this.nextButton.disabled = true;
  }

  public updateState(state: Partial<ControlsState>): void {
    Object.assign(this.state, state);
    this.updateUI();
  }

  public updateProgress(currentTime: number, duration: number): void {
    // Reduzir ruído no console: logar somente se debug habilitado ou como heartbeat esporádico
    const debug = (typeof window !== 'undefined') && (
      window.location.search.includes('debug=on') || localStorage.getItem('ri_continuous_debug') === 'on'
    );
    const now = (typeof window !== 'undefined' && window.performance && typeof window.performance.now === 'function')
      ? window.performance.now()
      : Date.now();

    // Throttle: 1s no modo debug, 15s no modo normal
    const interval = debug ? 1000 : 15000;
    if (now - this.lastProgressLog < interval) return;
    this.lastProgressLog = now;

    if (debug) {
      console.log(`[progress] ${this.formatTime(currentTime)} / ${this.formatTime(duration)}`);
    } else {
      // Heartbeat compacto
      console.log('▶️ playing…');
    }
  }

  private updateUI(): void {
    const playIcon = this.playButton.querySelector('.play-icon') as HTMLElement;
    const pauseIcon = this.playButton.querySelector('.pause-icon') as HTMLElement;

    // Reset all icons
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'none';

    if (this.state.isPlaying) {
      pauseIcon.style.display = 'inline';
      this.playButton.disabled = false;
    } else {
      playIcon.style.display = 'inline';
      this.playButton.disabled = false;
    }
  }

  private toggleInfoModal(): void {
    if (this.infoModal.style.display === 'flex') {
      this.hideInfoModal();
    } else {
      this.showInfoModal();
    }
  }

  private showInfoModal(): void {
    // Atualizar informações da música atual
    if (this.getCurrentTrackInfo) {
      const trackInfo = this.getCurrentTrackInfo();
      if (trackInfo) {
        this.updateModalTrackInfo(trackInfo.artist, trackInfo.title);
      } else {
        this.updateModalTrackInfo('Rádio Importante', 'Aguardando música...');
      }
    } else {
      this.updateModalTrackInfo('Rádio Importante', 'Música em reprodução');
    }
    
    this.infoModal.style.display = 'flex';
  }

  private hideInfoModal(): void {
    this.infoModal.style.display = 'none';
  }

  public updateModalTrackInfo(artist: string, song: string): void {
    this.modalArtist.textContent = artist;
    this.modalSong.textContent = song;
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
