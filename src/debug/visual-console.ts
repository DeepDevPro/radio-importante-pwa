// src/debug/visual-console.ts - Console visual para debug em dispositivos móveis

class VisualConsole {
  private container!: HTMLElement;
  private isVisible = false;
  private logs: Array<{type: string, message: string, timestamp: Date}> = [];

  constructor() {
    this.createContainer();
    this.interceptConsole();
  }

  private createContainer(): void {
    // Criar container flutuante para logs
    this.container = document.createElement('div');
    this.container.id = 'visual-console';
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      max-height: 300px;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 8px;
      z-index: 10000;
      overflow-y: auto;
      display: none;
      border: 2px solid #333;
    `;

    // Botão para mostrar/esconder console
    const toggleButton = document.createElement('button');
    toggleButton.innerHTML = '🐛';
    toggleButton.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 50px;
      height: 50px;
      background: #ff4444;
      color: white;
      border: none;
      border-radius: 50%;
      font-size: 20px;
      z-index: 10001;
      cursor: pointer;
    `;

    toggleButton.addEventListener('click', () => this.toggle());

    document.body.appendChild(this.container);
    document.body.appendChild(toggleButton);
  }

  private interceptConsole(): void {
    // Interceptar console.log, console.error, etc.
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      originalLog.apply(console, args);
      this.addLog('log', args.join(' '));
    };

    console.error = (...args) => {
      originalError.apply(console, args);
      this.addLog('error', args.join(' '));
    };

    console.warn = (...args) => {
      originalWarn.apply(console, args);
      this.addLog('warn', args.join(' '));
    };
  }

  private addLog(type: string, message: string): void {
    const log = {
      type,
      message,
      timestamp: new Date()
    };

    this.logs.push(log);
    
    // Manter apenas os últimos 50 logs
    if (this.logs.length > 50) {
      this.logs.shift();
    }

    this.updateDisplay();
  }

  private updateDisplay(): void {
    if (!this.isVisible) return;

    const html = this.logs.map(log => {
      const time = log.timestamp.toLocaleTimeString();
      const color = this.getLogColor(log.type);
      
      return `<div style="color: ${color}; margin-bottom: 5px;">
        [${time}] ${log.type.toUpperCase()}: ${log.message}
      </div>`;
    }).join('');

    this.container.innerHTML = html;
    this.container.scrollTop = this.container.scrollHeight;
  }

  private getLogColor(type: string): string {
    switch (type) {
      case 'error': return '#ff4444';
      case 'warn': return '#ffaa00';
      case 'log': return '#00ff00';
      default: return '#ffffff';
    }
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.container.style.display = this.isVisible ? 'block' : 'none';
    
    if (this.isVisible) {
      this.updateDisplay();
    }
  }

  public clear(): void {
    this.logs = [];
    this.updateDisplay();
  }
}

// Exportar instância única
export const visualConsole = new VisualConsole();
