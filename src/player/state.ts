// src/player/state.ts - Gerenciamento de estado do player

import { API_CONFIG } from '../config/api';

export interface Track {
  id: string;
  title: string;
  artist: string;
  filename: string;        // Nome original com acentos para exibição
  safeFilename?: string;   // Nome sanitizado para URLs (opcional, será gerado automaticamente)
  duration: number;
  format: string;
}

export interface Catalog {
  version: string;
  tracks: Track[];
  metadata: {
    totalTracks: number;
    totalDuration: number;
    artwork: string;
    radioName: string;
  };
}

export interface PlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTrackIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  error: string | null;
  // Etapa 6: Shuffle e precisão de seek
  shuffleEnabled: boolean;
  shuffleHistory: number[]; // histórico de índices tocados no shuffle
}

export class StateManager {
  private catalog: Catalog | null = null;
  private state: PlayerState;
  private listeners: Array<(state: PlayerState) => void> = [];

  constructor() {
    this.state = {
      isPlaying: false,
      isLoading: false,
      currentTrackIndex: 0,
      currentTime: 0,
      duration: 0,
      volume: 1,
      error: null,
      shuffleEnabled: false,
      shuffleHistory: [],
    };

    // Escutar atualizações do admin via BroadcastChannel
    this.setupCatalogUpdateListeners();
  }

  private setupCatalogUpdateListeners(): void {
    try {
      // BroadcastChannel para comunicação entre admin e player
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        const channel = new window.BroadcastChannel('radio-importante-updates');
        channel.onmessage = (event) => {
          if (event.data?.type === 'catalog-updated') {
            console.log('📡 Recebido sinal de atualização do catálogo do admin');
            this.reloadCatalog();
          }
        };
      }

      // Backup: polling localStorage para detectar mudanças
      let lastUpdate = localStorage.getItem('catalog-updated') || '0';
      setInterval(() => {
        const currentUpdate = localStorage.getItem('catalog-updated') || '0';
        if (currentUpdate !== lastUpdate && currentUpdate !== '0') {
          console.log('🔄 Detectada atualização do catálogo via localStorage');
          lastUpdate = currentUpdate;
          this.reloadCatalog();
        }
      }, 2000); // Verifica a cada 2 segundos

    } catch (error) {
      console.warn('⚠️ Erro ao configurar listeners de atualização:', error);
    }
  }

  private async reloadCatalog(): Promise<void> {
    try {
      console.log('🔄 Recarregando catálogo...');
      
      // Tentar API do backend usando configuração centralizada
      let response;
      try {
        response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.catalog}`);
        
        if (response.ok) {
          const apiResult = await response.json();
          this.catalog = apiResult;
          console.log('✅ Catálogo recarregado via API backend');
        } else {
          throw new Error('API não disponível');
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('❌ ERRO: Backend de produção indisponível:', errorMessage);
        console.log('⚠️ Usando arquivo local como fallback');
        
        const timestamp = Date.now();
        response = await fetch(`/data/catalog.json?t=${timestamp}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (response.ok) {
          this.catalog = await response.json();
        }
      }
        
        // Regenerar safeFilenames
        if (this.catalog?.tracks) {
          this.catalog.tracks.forEach(track => {
            track.safeFilename = track.filename; // Usar filename direto (já sanitizado no admin)
          });
        }
        
        console.log(`✅ Catálogo recarregado: ${this.catalog?.tracks?.length || 0} faixas`);
        
        // Notificar listeners sobre a atualização
        this.notifyListeners();
    } catch (error) {
      console.error('❌ Erro ao recarregar catálogo:', error);
    }
  }

  // Função para sanitizar nomes de arquivos (remove acentos e caracteres problemáticos)
  private sanitizeFilename(filename: string): string {
    // Mapa de caracteres acentuados para ASCII
    const accentMap: { [key: string]: string } = {
      'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a', 'å': 'a',
      'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
      'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
      'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
      'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
      'ç': 'c', 'ñ': 'n',
      'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A', 'Å': 'A',
      'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
      'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
      'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
      'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
      'Ç': 'C', 'Ñ': 'N'
    };

    return filename
      // Converter acentos para ASCII
      .replace(/[áàãâäåéèêëíìîïóòõôöúùûüçñÁÀÃÂÄÅÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ]/g, 
        char => accentMap[char] || char)
      // CORREÇÃO: Remover vírgulas e outros caracteres problemáticos
      // Substituir vírgulas por hífen para manter legibilidade
      .replace(/,/g, ' -')
      // Remover outros caracteres problemáticos (manter apenas alfanuméricos, espaços, hífens, pontos e parênteses)
      .replace(/[^a-zA-Z0-9\s\-.()[\]]/g, '')
      // Remover espaços extras e múltiplos hífens
      .replace(/\s+/g, ' ')
      .replace(/-+/g, '-')
      .trim();
  }

  // Nova função para limpeza AGRESSIVA de nomes (para usar na interface admin)
  public static cleanFilenameForUpload(filename: string): string {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, ''); // Remove extensão
    const extension = filename.slice(nameWithoutExt.length); // Pega extensão
    
    const cleaned = nameWithoutExt
      // Converter acentos
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      // Vírgulas vira hífen
      .replace(/,/g, '-')
      // Espaços viram underline (mais seguro para URLs)
      .replace(/\s+/g, '_')
      // Remover caracteres especiais exceto hífen e underscore
      .replace(/[^a-zA-Z0-9\-_]/g, '')
      // Limpar múltiplos separadores
      .replace(/[-_]+/g, '_')
      // Remover separadores do início/fim
      .replace(/^[-_]+|[-_]+$/g, '');
    
    return cleaned + extension;
  }

  // Carrega o catálogo de músicas
  public async loadCatalog(): Promise<Catalog> {
    try {
      console.log('📂 Carregando catálogo via API...');
      
      // Tentar API do backend usando configuração centralizada
      let response;
      try {
        response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.catalog}`);
        
        if (response.ok) {
          const apiResult = await response.json();
          this.catalog = apiResult; // Backend retorna o catálogo diretamente
          console.log('✅ Catálogo carregado via API backend');
        } else {
          throw new Error('API não disponível');
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('❌ ERRO: Backend de produção indisponível:', errorMessage);
        console.log('⚠️ Usando arquivo local como fallback');
        
        response = await fetch('/data/catalog.json');
        if (!response.ok) {
          throw new Error(`Erro ao carregar catálogo: ${response.status}`);
        }
        this.catalog = await response.json();
      }
      
      if (!this.catalog || !this.catalog.tracks || !Array.isArray(this.catalog.tracks)) {
        throw new Error('Catálogo inválido');
      }
      
      // CORREÇÃO: Não sanitizar novamente arquivos já limpos no upload
      // Os arquivos do catálogo já foram sanitizados no admin, usar filename direto
      this.catalog.tracks.forEach(track => {
        if (!track.safeFilename) {
          track.safeFilename = track.filename; // Usar filename original do catálogo
          console.log(`🔧 Usando filename direto: "${track.filename}"`);
        }
      });
      
      console.log(`✅ Catálogo carregado: ${this.catalog.tracks.length} faixas`);
      
      return this.catalog;
    } catch (error) {
      console.error('❌ Erro ao carregar catálogo:', error);
      throw new Error(`Falha ao carregar catálogo: ${error}`);
    }
  }

  // Getter para o catálogo
  public getCatalog(): Catalog | null {
    return this.catalog;
  }

  // Getter para faixa atual
  public getCurrentTrack(): Track | null {
    if (!this.catalog || this.state.currentTrackIndex >= this.catalog.tracks.length) {
      return null;
    }
    return this.catalog.tracks[this.state.currentTrackIndex];
  }

  // Getter para dados de exibição da faixa atual (sempre com nomes originais)
  public getCurrentTrackDisplay(): { title: string; artist: string; filename: string } | null {
    const track = this.getCurrentTrack();
    if (!track) {
      return null;
    }
    
    return {
      title: track.title,
      artist: track.artist,
      filename: track.filename // Nome original com acentos para exibição
    };
  }

  // Getter para URL da faixa atual com fallback
  public getCurrentTrackUrl(): string | null {
    const track = this.getCurrentTrack();
    if (!track) {
      return null;
    }
    
    // Primeiro tentar o nome sanitizado, depois o original
    const filenameForUrl = track.safeFilename || track.filename;
    
    // Aplicar encoding básico apenas para espaços e caracteres especiais restantes
    const sanitizedUrl = `${API_CONFIG.baseUrl}/audio/${filenameForUrl.replace(/ /g, '%20').replace(/&/g, '%26').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/,/g, '%2C')}`;
    
    console.log('🔗 Filename original (exibição):', track.filename);
    console.log('🔗 Filename sanitizado (URL):', filenameForUrl);
    console.log('🔗 Backend baseUrl:', API_CONFIG.baseUrl);
    console.log('🔗 URL final:', sanitizedUrl);
    
    return sanitizedUrl;
  }

  // Método alternativo que retorna múltiplas URLs para tentar
  public getCurrentTrackUrls(): string[] {
    const track = this.getCurrentTrack();
    if (!track) {
      return [];
    }
    
    const urls: string[] = [];
    
    // 1. Tentar nome sanitizado se disponível
    if (track.safeFilename && track.safeFilename !== track.filename) {
      const sanitizedUrl = `${API_CONFIG.baseUrl}/audio/${track.safeFilename.replace(/ /g, '%20').replace(/&/g, '%26').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/,/g, '%2C')}`;
      urls.push(sanitizedUrl);
    }
    
    // 2. Tentar nome original com encoding básico
    const originalUrl = `${API_CONFIG.baseUrl}/audio/${track.filename.replace(/ /g, '%20').replace(/&/g, '%26').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/,/g, '%2C')}`;
    urls.push(originalUrl);
    
    // 3. Tentar nome original sem encoding (último recurso)
    urls.push(`${API_CONFIG.baseUrl}/audio/${track.filename}`);
    
    console.log('🔗 URLs para tentar:', urls);
    return urls;
  }

  // Navegar para próxima faixa
  public nextTrack(): boolean {
    if (!this.catalog) {
      return false;
    }

    const nextIndex = this.state.currentTrackIndex + 1;
    if (nextIndex >= this.catalog.tracks.length) {
      // Volta para o início (loop)
      this.updateState({ currentTrackIndex: 0 });
      return true;
    }

    this.updateState({ currentTrackIndex: nextIndex });
    return true;
  }

  // Navegar para faixa anterior
  public previousTrack(): boolean {
    if (!this.catalog) {
      return false;
    }

    const prevIndex = this.state.currentTrackIndex - 1;
    if (prevIndex < 0) {
      // Vai para a última faixa
      this.updateState({ currentTrackIndex: this.catalog.tracks.length - 1 });
      return true;
    }

    this.updateState({ currentTrackIndex: prevIndex });
    return true;
  }

  // Ir para uma faixa específica
  public goToTrack(index: number): boolean {
    if (!this.catalog || index < 0 || index >= this.catalog.tracks.length) {
      return false;
    }

    this.updateState({ currentTrackIndex: index });
    return true;
  }

  // ==== Etapa 6: Shuffle Automático e Precisão de Seek ====
  
  // Ativar shuffle automaticamente (interno, sem interface)
  private enableShuffleMode(): void {
    if (!this.state.shuffleEnabled) {
      this.updateState({ 
        shuffleEnabled: true,
        shuffleHistory: [this.state.currentTrackIndex]
      });
      console.log(`🔀 Shuffle ATIVADO automaticamente`);
    }
  }

  // Algoritmo Fisher-Yates para escolher próxima faixa aleatória
  private getRandomNextTrack(): number {
    if (!this.catalog) return 0;
    
    const totalTracks = this.catalog.tracks.length;
    if (totalTracks <= 1) return 0;
    
    // Se histórico está cheio (todas as faixas foram tocadas), resetar
    if (this.state.shuffleHistory.length >= totalTracks) {
      this.updateState({ shuffleHistory: [this.state.currentTrackIndex] });
    }
    
    // Criar array de índices disponíveis (não tocados ainda)
    const availableIndexes: number[] = [];
    for (let i = 0; i < totalTracks; i++) {
      if (!this.state.shuffleHistory.includes(i)) {
        availableIndexes.push(i);
      }
    }
    
    // Se não há faixas disponíveis, retornar primeira
    if (availableIndexes.length === 0) {
      return 0;
    }
    
    // Fisher-Yates shuffle simplificado: escolher um índice aleatório
    const randomIndex = Math.floor(Math.random() * availableIndexes.length);
    return availableIndexes[randomIndex];
  }

  // Navegar para próxima faixa - LÓGICA AUTOMÁTICA DE SHUFFLE
  public nextTrackAuto(): boolean {
    if (!this.catalog) {
      return false;
    }

    const currentIndex = this.state.currentTrackIndex;
    const isLastTrack = currentIndex >= this.catalog.tracks.length - 1;
    let nextIndex: number;
    
    if (isLastTrack) {
      // HIPÓTESE 1: Chegou na última faixa - ativar shuffle automaticamente
      this.enableShuffleMode();
      nextIndex = this.getRandomNextTrack();
      
      const newHistory = [...this.state.shuffleHistory, nextIndex];
      this.updateState({ 
        currentTrackIndex: nextIndex,
        shuffleHistory: newHistory
      });
      console.log(`🔀 Auto-shuffle: fim da lista, próxima faixa ${nextIndex} (histórico: ${newHistory.length}/${this.catalog.tracks.length})`);
    } else {
      // Modo sequencial normal
      nextIndex = currentIndex + 1;
      this.updateState({ currentTrackIndex: nextIndex });
      console.log(`▶️  Sequencial: próxima faixa ${nextIndex}`);
    }
    
    return true;
  }

  // Navegar para próxima faixa - ACIONADA PELO USUÁRIO (sempre shuffle após primeira vez)
  public nextTrackManual(): boolean {
    if (!this.catalog) {
      return false;
    }

    // HIPÓTESE 2: Usuário apertou Next - sempre usar shuffle após ativar
    this.enableShuffleMode();
    
    const nextIndex = this.getRandomNextTrack();
    const newHistory = [...this.state.shuffleHistory, nextIndex];
    
    this.updateState({ 
      currentTrackIndex: nextIndex,
      shuffleHistory: newHistory
    });
    
    console.log(`🔀 Manual-shuffle: usuário apertou Next, próxima faixa ${nextIndex} (histórico: ${newHistory.length}/${this.catalog.tracks.length})`);
    return true;
  }

  // Navegar para faixa anterior (considerando shuffle se ativo)
  public previousTrackSmart(): boolean {
    if (!this.catalog) {
      return false;
    }

    let prevIndex: number;
    
    if (this.state.shuffleEnabled && this.state.shuffleHistory.length > 1) {
      // No shuffle, voltar para a faixa anterior do histórico
      const newHistory = [...this.state.shuffleHistory];
      newHistory.pop(); // Remove a faixa atual
      prevIndex = newHistory[newHistory.length - 1]; // Pega a anterior
      this.updateState({ 
        currentTrackIndex: prevIndex,
        shuffleHistory: newHistory
      });
      console.log(`🔀 Shuffle: faixa anterior ${prevIndex} (histórico: ${newHistory.length}/${this.catalog.tracks.length})`);
    } else {
      // Comportamento sequencial normal
      prevIndex = this.state.currentTrackIndex - 1;
      if (prevIndex < 0) {
        prevIndex = this.catalog.tracks.length - 1; // Loop para o final
      }
      this.updateState({ currentTrackIndex: prevIndex });
      console.log(`▶️  Sequencial: faixa anterior ${prevIndex}`);
    }
    
    return true;
  }

  // Atualizar estado
  public updateState(newState: Partial<PlayerState>): void {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState };

    // Log apenas mudanças significativas
    if (oldState.isPlaying !== this.state.isPlaying) {
      console.log(`🎵 Estado: ${this.state.isPlaying ? 'Tocando' : 'Pausado'}`);
    }

    if (oldState.currentTrackIndex !== this.state.currentTrackIndex) {
      const track = this.getCurrentTrack();
      console.log(`📀 Faixa: ${track?.title} - ${track?.artist}`);
    }

    if (oldState.error !== this.state.error && this.state.error) {
      console.error('❌ Erro:', this.state.error);
    }

    // Notificar listeners
    this.notifyListeners();
  }

  // Getter para o estado
  public getState(): PlayerState {
    return { ...this.state };
  }

  // Adicionar listener para mudanças de estado
  public addStateListener(listener: (state: PlayerState) => void): void {
    this.listeners.push(listener);
  }

  // Remover listener
  public removeStateListener(listener: (state: PlayerState) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Notificar todos os listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('❌ Erro no listener de estado:', error);
      }
    });
  }

  // Persistir estado no localStorage
  public saveState(): void {
    try {
      const stateToSave = {
        currentTrackIndex: this.state.currentTrackIndex,
        currentTime: this.state.currentTime,
        volume: this.state.volume,
      };

      localStorage.setItem('radioImportante:playerState', JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('⚠️ Não foi possível salvar estado:', error);
    }
  }

  // Restaurar estado do localStorage
  public loadState(): void {
    try {
      const saved = localStorage.getItem('radioImportante:playerState');
      if (saved) {
        const parsedState = JSON.parse(saved);
        
        // Validar os dados antes de aplicar
        if (typeof parsedState.currentTrackIndex === 'number' && parsedState.currentTrackIndex >= 0) {
          this.state.currentTrackIndex = parsedState.currentTrackIndex;
        }
        
        if (typeof parsedState.currentTime === 'number' && parsedState.currentTime >= 0) {
          this.state.currentTime = parsedState.currentTime;
        }
        
        if (typeof parsedState.volume === 'number' && parsedState.volume >= 0 && parsedState.volume <= 1) {
          this.state.volume = parsedState.volume;
        }

        console.log('✅ Estado restaurado do localStorage');
      }

      // REGRA: Nova sessão sempre ativa shuffle automaticamente
      this.enableShuffleMode();
      console.log('🔀 Shuffle ativado automaticamente em nova sessão');
      
    } catch (error) {
      console.warn('⚠️ Não foi possível carregar estado salvo:', error);
      
      // Mesmo com erro, ativar shuffle em nova sessão
      this.enableShuffleMode();
      console.log('🔀 Shuffle ativado automaticamente em nova sessão (fallback)');
    }
  }

  // Limpar estado salvo
  public clearSavedState(): void {
    try {
      localStorage.removeItem('radioImportante:playerState');
      console.log('🗑️ Estado salvo removido');
    } catch (error) {
      console.warn('⚠️ Erro ao limpar estado salvo:', error);
    }
  }

  // Debug: Imprimir informações do estado
  public debug(): void {
    console.log('🔍 Debug do Estado:', {
      catalog: this.catalog ? `${this.catalog.tracks.length} faixas` : 'não carregado',
      currentTrack: this.getCurrentTrack(),
      state: this.state,
      listeners: this.listeners.length,
    });
  }
}
