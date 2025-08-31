// src/ui/feedback.ts - Sistema de feedback e notificações para o usuário

// Declarações de tipos para compatibilidade
declare const document: any;
declare const window: any;
declare const requestAnimationFrame: any;
declare const setTimeout: any;

export interface FeedbackOptions {
  duration?: number; // duração em ms (0 = permanente)
  type?: 'info' | 'success' | 'warning' | 'error';
  showCloseButton?: boolean;
  position?: 'top' | 'bottom';
}

export class FeedbackManager {
  private container!: any; // HTMLDivElement
  private toasts: Map<string, any> = new Map(); // HTMLDivElement
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) return;

    // Criar container para toasts
    this.container = document.createElement('div');
    this.container.id = 'feedback-container';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
      pointer-events: none;
    `;

    // Aguardar DOM estar pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(this.container);
      });
    } else {
      document.body.appendChild(this.container);
    }

    this.isInitialized = true;
    console.log('📢 FeedbackManager inicializado');
  }

  /**
   * Mostra uma notificação toast
   */
  public showToast(message: string, options: FeedbackOptions = {}): string {
    const {
      duration = 4000,
      type = 'info',
      showCloseButton = true,
      position = 'top'
    } = options;

    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const toast = document.createElement('div');
    toast.id = id;
    
    // Estilos do toast
    const typeColors = {
      info: { bg: '#2196F3', icon: '💬' },
      success: { bg: '#4CAF50', icon: '✅' },
      warning: { bg: '#FF9800', icon: '⚠️' },
      error: { bg: '#F44336', icon: '❌' }
    };

    const colors = typeColors[type];
    
    toast.style.cssText = `
      background: ${colors.bg};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      pointer-events: auto;
      opacity: 0;
      transform: translateX(400px);
      transition: all 0.3s ease;
      max-width: 380px;
      word-wrap: break-word;
    `;

    // Conteúdo do toast
    const content = document.createElement('div');
    content.style.cssText = 'flex: 1; display: flex; align-items: center; gap: 8px;';
    content.innerHTML = `
      <span style="font-size: 16px;">${colors.icon}</span>
      <span>${message}</span>
    `;

    toast.appendChild(content);

    // Botão de fechar (opcional)
    if (showCloseButton) {
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '×';
      closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        opacity: 0.8;
        transition: opacity 0.2s ease;
      `;
      closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
      closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.8');
      closeBtn.addEventListener('click', () => this.hideToast(id));
      
      toast.appendChild(closeBtn);
    }

    // Adicionar ao container
    if (position === 'bottom') {
      this.container.appendChild(toast);
    } else {
      this.container.insertBefore(toast, this.container.firstChild);
    }

    this.toasts.set(id, toast);

    // Animação de entrada
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    // Auto-remover após duração especificada
    if (duration > 0) {
      setTimeout(() => this.hideToast(id), duration);
    }

    console.log(`📢 Toast ${type}: ${message}`);
    return id;
  }

  /**
   * Remove um toast específico
   */
  public hideToast(id: string): void {
    const toast = this.toasts.get(id);
    if (!toast) return;

    // Animação de saída
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(400px)';

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      this.toasts.delete(id);
    }, 300);
  }

  /**
   * Remove todos os toasts
   */
  public clearAll(): void {
    this.toasts.forEach((_, id) => this.hideToast(id));
  }

  // === MÉTODOS DE CONVENIÊNCIA ===

  public showInfo(message: string, duration = 4000): string {
    return this.showToast(message, { type: 'info', duration });
  }

  public showSuccess(message: string, duration = 4000): string {
    return this.showToast(message, { type: 'success', duration });
  }

  public showWarning(message: string, duration = 6000): string {
    return this.showToast(message, { type: 'warning', duration });
  }

  public showError(message: string, duration = 8000): string {
    return this.showToast(message, { type: 'error', duration });
  }

  /**
   * Mostra feedback de conexão
   */
  public showConnectionStatus(isOnline: boolean): string {
    if (isOnline) {
      return this.showSuccess('Conexão restaurada', 3000);
    } else {
      return this.showWarning('Conexão perdida - tentando reconectar...', 0); // Permanente até reconectar
    }
  }

  /**
   * Mostra feedback de reconexão
   */
  public showReconnectAttempt(attempt: number, maxAttempts: number): string {
    return this.showInfo(`Tentando reconectar... (${attempt}/${maxAttempts})`, 2000);
  }

  /**
   * Feedback para erros de áudio
   */
  public showAudioError(error: string): string {
    return this.showError(`Erro de áudio: ${error}`, 6000);
  }

  /**
   * Feedback para carregamento
   */
  public showLoading(message = 'Carregando...'): string {
    return this.showInfo(message, 0); // Permanente até ser removido manualmente
  }

  /**
   * Feedback compacto para ações rápidas
   */
  public showQuickFeedback(message: string, type: 'success' | 'error' = 'success'): string {
    const icon = type === 'success' ? '✅' : '❌';
    return this.showToast(`${icon} ${message}`, { 
      type, 
      duration: 2000, 
      showCloseButton: false 
    });
  }
}

// Singleton instance
export const feedback = new FeedbackManager();
