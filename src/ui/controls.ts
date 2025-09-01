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
  private state: ControlsState;

  // Callbacks para eventos
  public onPlay: (() => void) | null = null;
  public onPause: (() => void) | null = null;
  public onNext: (() => void) | null = null;

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
          <img src="/icons/logo-black.svg" alt="Radio Importante" class="radio-logo-main" />
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
          <button class="btn btn-play" id="playButton" title="Reproduzir/Pausar">
            <img src="/icons/play.svg" class="play-icon" alt="Play" />
            <img src="/icons/pause.svg" class="pause-icon" style="display: none;" alt="Pause" />
            <span class="loading-spinner" style="display: none;">⏳</span>
          </button>
          <button class="btn btn-next" id="nextButton" title="Próxima">
            <img src="/icons/next.svg" alt="Next" />
          </button>
          <button class="btn btn-info" id="infoButton" title="Informações">
            <img src="/icons/info.svg" alt="Info" />
          </button>
        </div>

        <!-- Container da imagem customizada -->
        <div class="custom-image-container">
          <img src="/img/Leo_R_161_small.webp" alt="Leo R 161" class="custom-image" />
        </div>

        <!-- Info Modal -->
        <div class="info-modal" id="infoModal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Sobre o Radio Importante</h3>
              <button class="close-btn" id="closeModal">×</button>
            </div>
            <div class="modal-body">
              <p>Um player de música web progressivo (PWA) com reprodução contínua.</p>
              <p><strong>Recursos:</strong></p>
              <ul>
                <li>Reprodução em segundo plano</li>
                <li>Controles na tela de bloqueio</li>
                <li>Funciona offline</li>
                <li>Interface responsiva</li>
              </ul>
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

    // Close modal button
    const closeButton = this.container.querySelector('#closeModal') as HTMLButtonElement;
    closeButton.addEventListener('click', () => {
      this.hideInfoModal();
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

    // Click outside modal to close
    this.infoModal.addEventListener('click', (e) => {
      if (e.target === this.infoModal) {
        this.hideInfoModal();
      }
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

  public setLoading(isLoading: boolean): void {
    this.state.isLoading = isLoading;
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
    // Este método pode ser usado para futuras funcionalidades de progresso
    // Por enquanto, vamos apenas atualizar as informações de tempo se necessário
    console.log(`Progress: ${this.formatTime(currentTime)} / ${this.formatTime(duration)}`);
  }

  private updateUI(): void {
    const playIcon = this.playButton.querySelector('.play-icon') as HTMLElement;
    const pauseIcon = this.playButton.querySelector('.pause-icon') as HTMLElement;
    const loadingSpinner = this.playButton.querySelector('.loading-spinner') as HTMLElement;

    // Reset all icons
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'none';
    loadingSpinner.style.display = 'none';

    if (this.state.isLoading) {
      loadingSpinner.style.display = 'inline';
      this.playButton.disabled = true;
    } else if (this.state.isPlaying) {
      pauseIcon.style.display = 'inline';
      this.playButton.disabled = false;
    } else {
      playIcon.style.display = 'inline';
      this.playButton.disabled = false;
    }
  }

  private toggleInfoModal(): void {
    const isVisible = this.infoModal.style.display !== 'none';
    if (isVisible) {
      this.hideInfoModal();
    } else {
      this.showInfoModal();
    }
  }

  private showInfoModal(): void {
    this.infoModal.style.display = 'flex';
  }

  private hideInfoModal(): void {
    this.infoModal.style.display = 'none';
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
