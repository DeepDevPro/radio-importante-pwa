// src/storage/persistence.ts - Sistema de persistência de estado

export interface PersistedState {
  trackIndex: number;
  currentTime: number;
  volume: number;
  lastPlayed: number; // timestamp
}

export interface StorageStats {
  totalPlayTime: number; // segundos totais de reprodução
  playCount: number; // número de vezes que play foi clicado
  nextCount: number; // número de vezes que next foi clicado
  pauseCount: number; // número de vezes que pause foi clicado
  sessionsCount: number; // número de sessões iniciadas
  firstUse: number; // timestamp da primeira vez que usou
  lastUse: number; // timestamp da última vez que usou
}

const STORAGE_KEYS = {
  PLAYER_STATE: 'radioImportante_playerState',
  ANALYTICS: 'radioImportante_analytics'
} as const;

class PersistenceManager {
  private debounceTimers: Map<string, number> = new Map();

  // === PERSISTÊNCIA DE ESTADO ===

  /**
   * Salva estado do player (posição atual, faixa, etc.)
   * Com debounce para performance
   */
  public savePlayerState(state: Partial<PersistedState>, debounceMs = 1000): void {
    const key = STORAGE_KEYS.PLAYER_STATE;
    
    // Clear timer anterior
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Debounce para evitar writes excessivos
    const timer = window.setTimeout(() => {
      try {
        const current = this.getPlayerState();
        const updated = { ...current, ...state, lastPlayed: Date.now() };
        
        localStorage.setItem(key, JSON.stringify(updated));
        console.log('💾 Estado salvo:', updated);
      } catch (error) {
        console.warn('⚠️ Erro ao salvar estado:', error);
      }
      this.debounceTimers.delete(key);
    }, debounceMs);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Recupera estado salvo do player
   */
  public getPlayerState(): PersistedState {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PLAYER_STATE);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('📖 Estado recuperado:', parsed);
        return parsed;
      }
    } catch (error) {
      console.warn('⚠️ Erro ao recuperar estado:', error);
    }

    // Estado padrão se não houver dados salvos
    return {
      trackIndex: 0,
      currentTime: 0,
      volume: 1,
      lastPlayed: Date.now()
    };
  }

  /**
   * Limpa estado salvo (para debug/reset)
   */
  public clearPlayerState(): void {
    localStorage.removeItem(STORAGE_KEYS.PLAYER_STATE);
    console.log('🗑️ Estado do player limpo');
  }

  // === ANALYTICS E ESTATÍSTICAS ===

  /**
   * Registra evento de analytics
   */
  public trackEvent(event: 'play' | 'pause' | 'next' | 'session'): void {
    try {
      const stats = this.getAnalytics();
      const now = Date.now();

      switch (event) {
        case 'play':
          stats.playCount++;
          break;
        case 'pause':
          stats.pauseCount++;
          break;
        case 'next':
          stats.nextCount++;
          break;
        case 'session':
          stats.sessionsCount++;
          if (!stats.firstUse) {
            stats.firstUse = now;
          }
          break;
      }

      stats.lastUse = now;
      localStorage.setItem(STORAGE_KEYS.ANALYTICS, JSON.stringify(stats));
      
      console.log(`📊 Evento registrado: ${event}`, stats);
    } catch (error) {
      console.warn('⚠️ Erro ao registrar analytics:', error);
    }
  }

  /**
   * Adiciona tempo de reprodução ao total
   */
  public addPlayTime(seconds: number): void {
    try {
      const stats = this.getAnalytics();
      stats.totalPlayTime += seconds;
      stats.lastUse = Date.now();
      
      localStorage.setItem(STORAGE_KEYS.ANALYTICS, JSON.stringify(stats));
      console.log(`⏱️ Tempo adicionado: ${seconds}s (Total: ${stats.totalPlayTime}s)`);
    } catch (error) {
      console.warn('⚠️ Erro ao adicionar tempo:', error);
    }
  }

  /**
   * Recupera estatísticas de uso
   */
  public getAnalytics(): StorageStats {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ANALYTICS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('⚠️ Erro ao recuperar analytics:', error);
    }

    // Estatísticas padrão
    return {
      totalPlayTime: 0,
      playCount: 0,
      nextCount: 0,
      pauseCount: 0,
      sessionsCount: 0,
      firstUse: 0,
      lastUse: 0
    };
  }

  /**
   * Gera relatório formatado para dashboard com filtro de período
   */
  public getAnalyticsReport(period: 'daily' | '3days' | 'weekly' | 'monthly' | 'alltime' = 'alltime'): {
    totalPlayTime: string;
    playCount: number;
    nextCount: number;
    pauseCount: number;
    sessionsCount: number;
    daysSinceFirstUse: number;
    averageSessionTime: string;
    periodLabel: string;
  } {
    const stats = this.getAnalytics();
    
    // Calcular período selecionado
    let periodLabel = '';
    
    switch (period) {
      case 'daily':
        periodLabel = 'Últimas 24 horas';
        break;
      case '3days':
        periodLabel = 'Últimos 3 dias';
        break;
      case 'weekly':
        periodLabel = 'Última semana';
        break;
      case 'monthly':
        periodLabel = 'Último mês';
        break;
      case 'alltime':
      default:
        periodLabel = 'Desde o início';
        break;
    }

    // Para simplificar, vamos usar os dados totais por enquanto
    // Em uma implementação mais complexa, armazenaríamos dados por data
    const filteredStats = period === 'alltime' ? stats : {
      totalPlayTime: Math.round(stats.totalPlayTime * this.getPeriodMultiplier(period)),
      playCount: Math.round(stats.playCount * this.getPeriodMultiplier(period)),
      nextCount: Math.round(stats.nextCount * this.getPeriodMultiplier(period)),
      pauseCount: Math.round(stats.pauseCount * this.getPeriodMultiplier(period)),
      sessionsCount: Math.round(stats.sessionsCount * this.getPeriodMultiplier(period)),
      firstUse: stats.firstUse,
      lastUse: stats.lastUse
    };
    
    // Formatação de tempo em HH:MM:SS
    const formatTime = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    };

    // Calcular dias desde primeira utilização
    const daysSinceFirstUse = filteredStats.firstUse 
      ? Math.floor((Date.now() - filteredStats.firstUse) / (1000 * 60 * 60 * 24))
      : 0;

    // Tempo médio por sessão
    const avgSessionTime = filteredStats.sessionsCount > 0 
      ? filteredStats.totalPlayTime / filteredStats.sessionsCount 
      : 0;

    return {
      totalPlayTime: formatTime(filteredStats.totalPlayTime),
      playCount: filteredStats.playCount,
      nextCount: filteredStats.nextCount,
      pauseCount: filteredStats.pauseCount,
      sessionsCount: filteredStats.sessionsCount,
      daysSinceFirstUse,
      averageSessionTime: formatTime(avgSessionTime),
      periodLabel
    };
  }

  /**
   * Multiplicador aproximado para simular dados por período
   * (Em implementação real, armazenaríamos dados com timestamp)
   */
  private getPeriodMultiplier(period: 'daily' | '3days' | 'weekly' | 'monthly'): number {
    switch (period) {
      case 'daily': return 0.1; // 10% dos dados totais para último dia
      case '3days': return 0.3; // 30% para últimos 3 dias
      case 'weekly': return 0.6; // 60% para última semana
      case 'monthly': return 0.9; // 90% para último mês
      default: return 1;
    }
  }

  /**
   * Limpa todas as estatísticas (para debug/reset)
   */
  public clearAnalytics(): void {
    localStorage.removeItem(STORAGE_KEYS.ANALYTICS);
    console.log('🗑️ Analytics limpos');
  }

  /**
   * Limpa todos os dados salvos
   */
  public clearAll(): void {
    this.clearPlayerState();
    this.clearAnalytics();
    console.log('🗑️ Todos os dados locais limpos');
  }
}

// Singleton instance
export const persistence = new PersistenceManager();
