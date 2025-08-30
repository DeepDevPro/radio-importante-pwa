// src/admin.ts - Interface de administração simplificada

interface AudioFile {
  filename: string;
  size: number;
  lastModified: number;
  title: string;
  artist: string;
  displayName: string;
}

class AdminManager {
  private audioFiles: AudioFile[] = [];

  constructor() {
    // Aguardar um pouco para garantir que os elementos estejam carregados
    setTimeout(() => {
      this.refreshFileList();
      this.setupEventListeners();
    }, 100);
  }

  private setupEventListeners(): void {
    // Event listeners para upload
    this.setupUploadListeners();
    console.log('🔧 Admin Manager inicializado');
  }

  private setupUploadListeners(): void {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const uploadButton = document.getElementById('upload-btn');

    if (!uploadArea || !fileInput || !uploadButton) {
      console.log('⚠️ Elementos de upload não encontrados, aguardando...');
      return;
    }

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer?.files || []);
      this.handleFileSelection(files);
    });

    // Click to select
    uploadArea.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files || []);
      this.handleFileSelection(files);
    });

    // Upload button
    uploadButton.addEventListener('click', () => {
      this.processSelectedFiles();
    });

    console.log('📤 Event listeners de upload configurados');
  }

  private selectedFiles: File[] = [];

  private handleFileSelection(files: File[]): void {
    console.log(`📁 ${files.length} arquivo(s) selecionado(s)`);
    
    // Filtrar apenas arquivos de áudio
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));
    
    if (audioFiles.length === 0) {
      alert('❌ Nenhum arquivo de áudio válido selecionado!');
      return;
    }

    // Validar nomes dos arquivos
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    audioFiles.forEach(file => {
      if (this.isValidFilename(file.name)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    this.selectedFiles = validFiles;

    if (invalidFiles.length > 0) {
      alert(`❌ Arquivos com nomes inválidos (contêm acentos):\n${invalidFiles.join('\n')}\n\nRenomeie-os sem acentos antes de fazer upload.`);
    }

    if (validFiles.length > 0) {
      this.updateUploadPreview(validFiles);
      document.getElementById('upload-btn')!.style.display = 'block';
    }
  }

  private isValidFilename(filename: string): boolean {
    // Verificar se o nome não contém acentos ou caracteres especiais problemáticos
    const invalidChars = /[áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ\s]/;
    return !invalidChars.test(filename);
  }

  private updateUploadPreview(files: File[]): void {
    const preview = document.getElementById('upload-preview');
    if (!preview) return;

    preview.innerHTML = `
      <h4>� Arquivos prontos para upload:</h4>
      ${files.map(file => `
        <div class="upload-file-item">
          <span class="file-icon">🎵</span>
          <span class="file-name">${file.name}</span>
          <span class="file-size">${this.formatFileSize(file.size)}</span>
        </div>
      `).join('')}
    `;
    preview.style.display = 'block';
  }

  private async processSelectedFiles(): Promise<void> {
    if (this.selectedFiles.length === 0) {
      alert('❌ Nenhum arquivo selecionado para upload!');
      return;
    }

    const uploadBtn = document.getElementById('upload-btn') as HTMLButtonElement;
    const originalText = uploadBtn.textContent;
    uploadBtn.textContent = 'Enviando...';
    uploadBtn.disabled = true;

    try {
      for (let i = 0; i < this.selectedFiles.length; i++) {
        const file = this.selectedFiles[i];
        uploadBtn.textContent = `Enviando ${i + 1}/${this.selectedFiles.length}...`;
        
        await this.uploadFile(file);
        console.log(`✅ Arquivo ${file.name} enviado com sucesso`);
      }

      // Regenerar catálogo automaticamente após upload
      const catalogResult = await this.regenerateCatalog();
      
      // Refresh da lista após upload
      await this.refreshFileList();
      
      const uploadedCount = this.selectedFiles.length;
      
      // Reset do upload
      this.selectedFiles = [];
      document.getElementById('upload-preview')!.style.display = 'none';
      uploadBtn.style.display = 'none';
      
      // Scroll para o topo para mostrar sucesso
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Mensagem mais informativa
      let message = `✅ ${uploadedCount} arquivo(s) enviado(s) com sucesso!`;
      if (catalogResult && catalogResult.preservedTracks !== undefined) {
        message += `\n📋 Músicas existentes: ${catalogResult.preservedTracks} (ordem preservada)`;
        message += `\n🆕 Novas músicas: ${catalogResult.newTracks} (adicionadas no final da lista)`;
      }
      
      alert(message);

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      alert(`❌ Erro no upload: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      uploadBtn.textContent = originalText;
      uploadBtn.disabled = false;
    }
  }

  private async uploadFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1]; // Remove data:audio/...;base64,
          
          const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filename: file.name,
              fileData: base64Data
            })
          });

          const result = await response.json();
          
          if (result.success) {
            resolve();
          } else {
            reject(new Error(result.error || 'Erro no upload'));
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  private async regenerateCatalog(): Promise<any> {
    console.log('🔄 Regenerando catálogo automaticamente...');
    try {
      // Chamar o endpoint para regenerar o catálogo
      const response = await fetch('/api/regenerate-catalog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Catálogo regenerado: ${result.totalTracks} faixas`);
        return result;
      } else {
        throw new Error(result.error || 'Erro ao regenerar catálogo');
      }
    } catch (error) {
      console.error('❌ Erro ao regenerar catálogo:', error);
      throw error;
    }
  }

  public async refreshFileList(): Promise<void> {
    console.log('📁 Carregando lista de arquivos do catálogo atual...');
    try {
      // Carregar o catalog.json atual
      const response = await fetch('/data/catalog.json');
      const catalog = await response.json();
      
      // Converter tracks do catálogo para o formato AudioFile
      this.audioFiles = catalog.tracks.map((track: any) => ({
        filename: track.filename,
        size: Math.floor(Math.random() * 2000000) + 500000, // Tamanho estimado
        lastModified: Date.now() - Math.floor(Math.random() * 86400000),
        artist: track.artist,
        title: track.title,
        displayName: `${track.artist} - ${track.title}`
      }));
      
      console.log(`✅ Carregadas ${this.audioFiles.length} faixas do catálogo`);
      this.renderFileList();
      
    } catch (error) {
      console.error('❌ Erro ao carregar catálogo:', error);
      // Fallback para arquivos de exemplo se não conseguir carregar
      this.audioFiles = this.getExampleFiles();
      this.renderFileList();
    }
  }

  private getExampleFiles(): AudioFile[] {
    // Arquivos de exemplo com nomes limpos e metadados editáveis
    return [
      {
        filename: 'arkist-rendezvous.mp3',
        size: 1235096,
        lastModified: Date.now() - 86400000,
        artist: 'Arkist',
        title: 'Rendezvous',
        displayName: 'Arkist - Rendezvous'
      },
      {
        filename: 'blaze-melodies-lave-remix.mp3',
        size: 1719936,
        lastModified: Date.now() - 172800000,
        artist: 'Blazé',
        title: 'Melôdies & Lãve (DJ Black Remix)',
        displayName: 'Blazé - Melôdies & Lãve (DJ Black Remix)'
      },
      {
        filename: 'ceu-cangote-grooves-sound.mp3',
        size: 4811746,
        lastModified: Date.now() - 259200000,
        artist: 'Céu',
        title: 'Cãngote & Groove\'s Sound (manhã & Café mix)',
        displayName: 'Céu - Cãngote & Groove\'s Sound (manhã & Café mix)'
      },
      {
        filename: 'lecio-sour-drums-mix.mp3',
        size: 1287853,
        lastModified: Date.now() - 345600000,
        artist: 'L\'écio',
        title: 'Sõûr & Drums (DJ Black Mix)',
        displayName: 'L\'écio - Sõûr & Drums (DJ Black Mix)'
      }
    ];
  }

  private renderFileList(): void {
    const musicList = document.getElementById('music-list')!;
    musicList.innerHTML = '';

    // Add total count header
    const totalHeader = document.createElement('div');
    totalHeader.className = 'total-tracks-header';
    totalHeader.innerHTML = `
        <h3>📀 Total de Músicas: ${this.audioFiles.length}</h3>
        <p>Gerencie os metadados de cada faixa abaixo:</p>
    `;
    musicList.appendChild(totalHeader);

    this.audioFiles.forEach((file, index) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.innerHTML = `
        <div class="file-header">
          <span class="track-number">#${(index + 1).toString().padStart(2, '0')}</span>
          <span class="file-name">📄 ${file.filename}</span>
        </div>
        <div class="file-info">
          Tamanho: ${this.formatFileSize(file.size)} | 
          Modificado: ${new Date(file.lastModified).toLocaleDateString('pt-BR')}
        </div>
        <div class="metadata-form">
          <input type="text" placeholder="Artista" value="${file.artist}" 
                 data-index="${index}" data-field="artist">
          <input type="text" placeholder="Título da Música" value="${file.title}" 
                 data-index="${index}" data-field="title">
          <input type="text" placeholder="Nome de Exibição" value="${file.displayName}" 
                 data-index="${index}" data-field="displayName">
          <button class="btn btn-danger" data-index="${index}" data-action="remove">🗑️</button>
        </div>
      `;
      musicList.appendChild(fileItem);
    });

    // Adicionar event listeners para inputs
    const inputs = musicList.querySelectorAll('input[data-index]');
    inputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const index = parseInt(target.dataset.index!);
        const field = target.dataset.field!;
        this.updateFileMetadata(index, field, target.value);
      });
    });

    // Adicionar event listeners para botões
    const buttons = musicList.querySelectorAll('button[data-action="remove"]');
    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const index = parseInt(target.dataset.index!);
        this.removeFile(index);
      });
    });
  }

  public updateFileMetadata(index: number, field: string, value: string): void {
    if (this.audioFiles[index]) {
      const file = this.audioFiles[index];
      if (field === 'artist') file.artist = value;
      else if (field === 'title') file.title = value;
      else if (field === 'displayName') file.displayName = value;
      
      // Preview removido - admin não precisa ver
    }
  }

  public removeFile(index: number): void {
    if (confirm('Tem certeza que deseja remover este arquivo?')) {
      this.audioFiles.splice(index, 1);
      this.renderFileList();
      // Preview removido - admin não precisa ver
    }
  }

  public async saveAllMetadata(): Promise<void> {
    console.log('💾 Salvando metadados diretamente no servidor...');
    
    // Desabilitar botão durante salvamento
    const saveButton = document.querySelector('button[onclick="saveAllMetadata()"]') as HTMLButtonElement;
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Salvando...';
    }
    
    try {
      const catalog = this.generateCatalog();
      const jsonString = JSON.stringify(catalog, null, 2);
      
      console.log('📤 Enviando dados para /api/save-catalog');
      
      // Enviar para endpoint que vai salvar o arquivo
      const response = await fetch('/api/save-catalog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonString
      });
      
      console.log('📥 Resposta recebida:', response.status, response.statusText);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Sucesso:', result);
        
        // Rolar para o topo para mostrar o aviso de sucesso
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Mostrar notificação de sucesso
        this.showSuccessMessage('✅ Metadados salvos com sucesso! O player foi atualizado automaticamente.');
        
        // Aguardar um momento e recarregar para mostrar os novos dados
        setTimeout(() => {
          this.refreshFileList();
        }, 1000);
      } else {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', errorText);
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }
      
    } catch (error) {
      console.error('❌ Erro ao salvar:', error);
      
      // Rolar para o topo mesmo em caso de erro
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Fallback: download manual (como estava antes)
      this.showStatus('error', '⚠️ Salvamento automático falhou. Fazendo download manual...');
      const catalog = this.generateCatalog();
      const jsonString = JSON.stringify(catalog, null, 2);
      
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catalog.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showStatus('success', 'ℹ️ Arquivo baixado! Substitua manualmente: data/catalog.json → Execute: npm run dev');
    } finally {
      // Reabilitar botão
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar Alterações';
      }
    }
  }

  private generateCatalog() {
    const tracks = this.audioFiles.map((file, index) => ({
      id: `track${String(index + 1).padStart(3, '0')}`,
      title: file.title,
      artist: file.artist,
      filename: file.filename, // Nome físico sem acentos
      duration: 240 + Math.floor(Math.random() * 120),
      format: file.filename.split('.').pop()?.toLowerCase() || 'mp3'
    }));

    return {
      version: "1.0.0",
      tracks,
      metadata: {
        totalTracks: tracks.length,
        totalDuration: tracks.reduce((sum, track) => sum + track.duration, 0),
        artwork: "/images/cover.jpg",
        radioName: "Radio Importante"
      }
    };
  }

  // private updateCatalogPreview(): void {
  //   const preview = document.getElementById('catalogPreview');
  //   if (!preview) return;

  //   const catalog = this.generateCatalog();
  //   preview.textContent = JSON.stringify(catalog, null, 2);
  // }

  private showSuccessMessage(message: string): void {
    // Criar ou encontrar elemento de notificação
    let notification = document.getElementById('admin-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'admin-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: none;
      `;
      document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.style.display = 'block';
    
    // Esconder após 4 segundos
    setTimeout(() => {
      notification!.style.display = 'none';
    }, 4000);
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private showStatus(type: 'success' | 'error', message: string): void {
    const status = document.getElementById('uploadStatus');
    if (!status) return;

    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    setTimeout(() => {
      status.style.display = 'none';
    }, 5000);
  }
}

// Instância global
const adminManager = new AdminManager();

// Expor funções globais
(window as any).adminManager = adminManager;
(window as any).saveAllMetadata = () => adminManager.saveAllMetadata();
(window as any).refreshFileList = () => adminManager.refreshFileList();
