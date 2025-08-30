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
        <!-- Logo/Artwork -->
        <div class="artwork">
          <div class="artwork-placeholder">
            🎵
          </div>
        </div>

        <!-- Header with Title and Admin Button -->
        <div class="header">
          <h1 class="app-title">Radio Importante</h1>
          <button class="admin-btn" id="adminButton" title="Acessar Administração">⚙️</button>
        </div>

        <!-- Track Information -->
        <div class="track-info">
          <div class="track-title" id="trackTitle">Rádio Importante</div>
          <div class="track-artist" id="trackArtist">Selecione uma música</div>
        </div>

        <!-- Main Controls -->
        <div class="controls">
          <button class="control-btn play-btn" id="playButton" title="Reproduzir/Pausar">
            <span class="play-icon">▶️</span>
            <span class="pause-icon" style="display: none;">⏸️</span>
            <span class="loading-spinner" style="display: none;">⏳</span>
          </button>
          <button class="control-btn next-btn" id="nextButton" title="Próxima">⏭️</button>
          <button class="control-btn info-btn" id="infoButton" title="Informações">ℹ️</button>
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

    // Click outside modal to close
    this.infoModal.addEventListener('click', (e) => {
      if (e.target === this.infoModal) {
        this.hideInfoModal();
      }
    });
  }

  public updateTrackInfo(title: string, artist: string = ''): void {
    const trackTitle = this.container.querySelector('#trackTitle') as HTMLElement;
    const trackArtist = this.container.querySelector('#trackArtist') as HTMLElement;
    
    if (trackTitle) trackTitle.textContent = title;
    if (trackArtist) trackArtist.textContent = artist;
    
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
