// src/net/reconnect.ts - Sistema de reconexão automática de rede

export interface ReconnectEvents {
  onReconnecting?: () => void;
  onReconnected?: () => void;
  onOffline?: () => void;
  onOnline?: () => void;
  onError?: (error: Error) => void;
}

export class NetworkReconnection {
  private isOnline = navigator.onLine;
  private events: ReconnectEvents = {};
  private retryCount = 0;
  private maxRetries = 5;
  private baseDelay = 1000; // 1 segundo
  private currentDelay = this.baseDelay;
  private retryTimeout?: number;
  private pingUrl = '/data/catalog.json'; // Arquivo que sempre existe
  
  constructor(events: ReconnectEvents = {}) {
    this.events = events;
    this.setupEventListeners();
    console.log('🌐 NetworkReconnection inicializado');
  }

  private setupEventListeners(): void {
    // Eventos nativos de rede
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Verificação periódica de conectividade
    setInterval(() => {
      this.checkConnectivity();
    }, 30000); // Verifica a cada 30 segundos
  }

  private handleOnline(): void {
    console.log('🌐 Evento: Conexão detectada');
    this.isOnline = true;
    this.retryCount = 0;
    this.currentDelay = this.baseDelay;
    
    // Verificar se realmente está conectado
    this.verifyConnection();
    
    this.events.onOnline?.();
  }

  private handleOffline(): void {
    console.log('🌐 Evento: Desconexão detectada');
    this.isOnline = false;
    this.events.onOffline?.();
    
    // Iniciar tentativas de reconexão
    this.startReconnectionAttempts();
  }

  private async verifyConnection(): Promise<boolean> {
    try {
      // Promise com timeout manual
      const fetchPromise = fetch(this.pingUrl, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      const isConnected = response.ok;
      
      if (isConnected && !this.isOnline) {
        console.log('✅ Conexão restaurada verificada');
        this.isOnline = true;
        this.retryCount = 0;
        this.currentDelay = this.baseDelay;
        this.events.onReconnected?.();
      } else if (!isConnected && this.isOnline) {
        console.log('❌ Conexão perdida verificada');
        this.isOnline = false;
        this.startReconnectionAttempts();
      }
      
      return isConnected;
    } catch (error) {
      console.warn('⚠️ Erro na verificação de conexão:', error);
      
      if (this.isOnline) {
        this.isOnline = false;
        this.startReconnectionAttempts();
      }
      
      return false;
    }
  }

  private startReconnectionAttempts(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    if (this.retryCount >= this.maxRetries) {
      console.log('❌ Máximo de tentativas de reconexão atingido');
      this.events.onError?.(new Error('Não foi possível reconectar após múltiplas tentativas'));
      return;
    }

    console.log(`🔄 Tentativa de reconexão ${this.retryCount + 1}/${this.maxRetries} em ${this.currentDelay}ms`);
    this.events.onReconnecting?.();

    this.retryTimeout = window.setTimeout(async () => {
      this.retryCount++;
      
      const isConnected = await this.verifyConnection();
      
      if (!isConnected) {
        // Backoff exponencial: dobrar o delay a cada tentativa
        this.currentDelay = Math.min(this.currentDelay * 2, 30000); // Max 30 segundos
        this.startReconnectionAttempts();
      }
    }, this.currentDelay);
  }

  private async checkConnectivity(): Promise<void> {
    // Verificação silenciosa para detectar mudanças na conectividade
    const wasOnline = this.isOnline;
    const isCurrentlyOnline = await this.verifyConnection();
    
    if (wasOnline !== isCurrentlyOnline) {
      console.log(`🌐 Status de rede mudou: ${wasOnline ? 'online' : 'offline'} → ${isCurrentlyOnline ? 'online' : 'offline'}`);
    }
  }

  // === API PÚBLICA ===

  /**
   * Verifica se está online
   */
  public isConnected(): boolean {
    return this.isOnline;
  }

  /**
   * Força uma verificação de conexão
   */
  public async checkConnection(): Promise<boolean> {
    return await this.verifyConnection();
  }

  /**
   * Redefine o contador de tentativas (útil após sucesso manual)
   */
  public resetRetryCount(): void {
    this.retryCount = 0;
    this.currentDelay = this.baseDelay;
    console.log('🔄 Contador de reconexão resetado');
  }

  /**
   * Para as tentativas de reconexão
   */
  public stopReconnection(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = undefined;
    }
    console.log('⏹️ Tentativas de reconexão interrompidas');
  }

  /**
   * Atualiza os event handlers
   */
  public setEventHandlers(events: ReconnectEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Cleanup ao destruir
   */
  public destroy(): void {
    this.stopReconnection();
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    console.log('🌐 NetworkReconnection destruído');
  }
}

// Singleton instance
export const networkReconnection = new NetworkReconnection();
