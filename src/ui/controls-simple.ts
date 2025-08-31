// src/ui/controls-simple.ts - Interface de controles simplificada

export class Controls {
  private container: HTMLElement;
  private isPlaying = false;

  // Callbacks para eventos
  public onPlay: (() => void) | null = null;
  public onPause: (() => void) | null = null;
  public onNext: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.setupEventListeners();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="player-container" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        max-width: 400px;
        margin: 0 auto;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      ">
        <!-- Logo/Artwork -->
        <div class="artwork" style="
          width: 200px;
          height: 200px;
          background: #271F30;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          color: white;
          margin-bottom: 20px;
        ">
          🎵
        </div>

        <!-- Header with Title and Debug Button -->
        <div class="header" style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          margin-bottom: 20px;
        ">
          <h1 style="
            margin: 0;
            font-size: 24px;
            color: #271F30;
          ">Radio Importante</h1>
          <button id="debugButton" style="
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            padding: 8px;
            opacity: 0.7;
            border-radius: 4px;
          " title="Debug Console">🐛</button>
        </div>

        <!-- Track Info -->
        <div class="track-info" style="
          text-align: center;
          margin-bottom: 30px;
        ">
          <div class="track-title" id="trackTitle" style="
            font-size: 18px;
            font-weight: bold;
            color: #271F30;
            margin-bottom: 5px;
          ">All That</div>
          <div class="track-artist" id="trackArtist" style="
            font-size: 14px;
            color: #666;
          ">Lizzy Parks (Natural Self Remix)</div>
        </div>

        <!-- Controls -->
        <div class="controls" style="
          display: flex;
          align-items: center;
          gap: 20px;
        ">
          <button id="playButton" style="
            width: 60px;
            height: 60px;
            border: none;
            border-radius: 50%;
            background: #271F30;
            color: white;
            font-size: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          ">▶️</button>
          
          <button id="nextButton" style="
            width: 50px;
            height: 50px;
            border: none;
            border-radius: 50%;
            background: #666;
            color: white;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          ">⏭️</button>
        </div>

        <!-- Loading indicator -->
        <div id="loadingIndicator" style="
          margin-top: 20px;
          font-size: 14px;
          color: #666;
          display: none;
        ">Carregando...</div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    const playButton = document.getElementById('playButton') as HTMLButtonElement;
    const nextButton = document.getElementById('nextButton') as HTMLButtonElement;
    const debugButton = document.getElementById('debugButton') as HTMLButtonElement;

    if (playButton) {
      playButton.addEventListener('click', () => {
        if (this.isPlaying) {
          this.onPause?.();
        } else {
          this.onPlay?.();
        }
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        this.onNext?.();
      });
    }

    if (debugButton) {
      debugButton.addEventListener('click', () => {
        console.log('🐛 Abrindo debug console...');
        // Navegar para debug dentro do mesmo PWA ao invés de popup
        window.location.href = '/debug.html';
      });
    }
  }

  public setPlaying(playing: boolean): void {
    this.isPlaying = playing;
    const playButton = document.getElementById('playButton');
    if (playButton) {
      playButton.textContent = playing ? '⏸️' : '▶️';
    }
    console.log(`🎵 Estado: ${playing ? 'Tocando' : 'Pausado'}`);
  }

  public setLoading(loading: boolean): void {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = loading ? 'block' : 'none';
    }
    console.log(`⏳ Loading: ${loading}`);
  }

  public updateTrackInfo(title: string, artist: string): void {
    const trackTitle = document.getElementById('trackTitle');
    const trackArtist = document.getElementById('trackArtist');
    
    if (trackTitle) trackTitle.textContent = title;
    if (trackArtist) trackArtist.textContent = artist;
    
    console.log(`🎵 Track atualizado: ${title} - ${artist}`);
  }
}
