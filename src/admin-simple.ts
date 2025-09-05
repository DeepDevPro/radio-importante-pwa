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
      this.checkEnvironmentAndSetup();
      this.refreshFileList();
      this.setupEventListeners();
    }, 100);
  }

  private checkEnvironmentAndSetup(): void {
    // Remover detecção de produção - agora temos backend funcional
    console.log('🌐 Sistema de upload habilitado para desenvolvimento e produção');
  }

  private setupProductionMode(): void {
    const uploadSection = document.querySelector('.section h2');
    if (uploadSection?.textContent?.includes('Upload')) {
      const section = uploadSection.parentElement;
      if (section) {
        // Adicionar aviso de produção
        const productionAlert = document.createElement('div');
        productionAlert.style.cssText = `
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 15px;
          margin: 15px 0;
          color: #856404;
        `;
        productionAlert.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">⚠️</span>
            <div>
              <strong>Modo Produção Detectado</strong><br>
              Upload direto não disponível. Use o 
              <a href="/admin-upload.html" style="color: #007AFF; text-decoration: none; font-weight: bold;">
                📤 Sistema de Upload Avançado
              </a>
              para instruções detalhadas.
            </div>
          </div>
        `;
        
        // Inserir depois do h2
        uploadSection.insertAdjacentElement('afterend', productionAlert);
        
        // Desabilitar área de upload
        const uploadArea = document.getElementById('upload-area');
        if (uploadArea) {
          uploadArea.style.opacity = '0.5';
          uploadArea.style.pointerEvents = 'none';
          uploadArea.innerHTML = `
            <div style="color: #666;">
              📁 Upload direto não disponível em produção<br>
              <a href="/admin-upload.html" style="color: #007AFF;">Use o Sistema de Upload Avançado</a>
            </div>
          `;
        }
      }
    }
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

    // Aceitar todos os arquivos de áudio - a limpeza de nomes será feita automaticamente no upload
    this.selectedFiles = audioFiles;

    if (audioFiles.length > 0) {
      this.updateUploadPreview(audioFiles);
      document.getElementById('upload-btn')!.style.display = 'block';
    }
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
      uploadBtn.textContent = 'Atualizando catálogo...';
      const catalogResult = await this.regenerateCatalog();
      
      // Refresh da lista após upload  
      uploadBtn.textContent = 'Atualizando lista...';
      await this.refreshFileList();
      
      const uploadedCount = this.selectedFiles.length;
      
      // Reset do upload
      this.selectedFiles = [];
      document.getElementById('upload-preview')!.style.display = 'none';
      uploadBtn.style.display = 'none';
      
      // Scroll para o topo para mostrar sucesso
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Mensagem mais informativa incluindo total atual
      let message = `✅ ${uploadedCount} arquivo(s) enviado(s) com sucesso!`;
      message += `\n🎵 Total de músicas agora: ${this.audioFiles.length}`;
      if (catalogResult && catalogResult.preservedTracks !== undefined) {
        message += `\n📋 Existentes: ${catalogResult.preservedTracks} | 🆕 Novas: ${catalogResult.newTracks}`;
      }
      message += `\n🔄 Lista atualizada automaticamente!`;
      
      alert(message);

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      alert(`❌ Erro no upload: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      uploadBtn.textContent = originalText;
      uploadBtn.disabled = false;
    }
  }

  private showUploadStatus(message: string, type: 'success' | 'error' | 'info'): void {
    const statusDiv = document.getElementById('upload-status');
    if (!statusDiv) return;

    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    // Auto-hide após 5 segundos
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }

  private async uploadFile(file: File): Promise<void> {
    // Usar a configuração de API centralizada
    const { getApiUrl } = await import('./config/api.js');
    const backendUrl = getApiUrl('upload').replace('/api/upload', ''); // Extrair baseUrl
    
    console.log(`🌐 Usando backend: ${backendUrl}`);
    console.log(`📁 Enviando arquivo: ${file.name} (${this.formatFileSize(file.size)})`);

    // Aplicar limpeza de nome de arquivo antes do upload
    const cleanFilename = this.cleanFilenameForUpload(file.name);
    console.log(`🧹 Limpando nome: "${file.name}" → "${cleanFilename}"`);

    // Criar FormData para upload real de arquivo
    const formData = new FormData();
    
    // Criar um novo arquivo com nome limpo
    const cleanFile = new File([file], cleanFilename, { type: file.type });
    formData.append('audioFiles', cleanFile);

    try {
      const response = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        body: formData // Enviar FormData, não JSON
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Upload realizado com sucesso:`, result);
        this.showUploadStatus(
          `✅ ${cleanFilename} enviado! Total: ${result.catalog?.totalTracks || 'N/A'} faixas`,
          'success'
        );
        
        // Forçar refresh da lista após upload bem-sucedido
        setTimeout(() => {
          this.refreshFileList();
        }, 1000);
        
      } else {
        throw new Error(result.error || 'Erro no upload');
      }
    } catch (error) {
      console.error('❌ Erro no upload:', error);
      this.showUploadStatus(`❌ Erro no upload de ${cleanFilename}: ${error}`, 'error');
      throw error;
    }
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
      // Carregar o catalog.json atual com cache-busting para garantir dados atualizados
      const response = await fetch(`/data/catalog.json?t=${Date.now()}`);
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
      
      console.log(`✅ Carregadas ${this.audioFiles.length} faixas do catálogo (atualização automática)`);
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
          <button class="btn btn-success btn-sm" data-index="${index}" data-action="save" title="Salvar alterações desta música">💾</button>
          <button class="btn btn-danger btn-sm" data-index="${index}" data-action="remove" title="Remover arquivo">🗑️</button>
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
    const removeButtons = musicList.querySelectorAll('button[data-action="remove"]');
    removeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const index = parseInt(target.dataset.index!);
        this.removeFile(index);
      });
    });

    // Adicionar event listeners para botões de save
    const saveButtons = musicList.querySelectorAll('button[data-action="save"]');
    saveButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const index = parseInt(target.dataset.index!);
        this.saveTrackMetadata(index);
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

  public async saveTrackMetadata(index: number): Promise<void> {
    console.log(`💾 Salvando metadados da faixa ${index}...`);
    
    const file = this.audioFiles[index];
    if (!file) {
      console.error('❌ Arquivo não encontrado no índice:', index);
      return;
    }

    // Coletar dados atuais dos inputs
    const inputs = document.querySelectorAll(`input[data-index="${index}"]`);
    inputs.forEach(input => {
      const field = (input as HTMLInputElement).dataset.field;
      const value = (input as HTMLInputElement).value;
      if (field && value !== undefined) {
        this.updateFileMetadata(index, field, value);
      }
    });

    try {
      // Gerar catálogo atualizado
      const catalog = this.generateCatalog();
      const jsonString = JSON.stringify(catalog, null, 2);
      
      console.log(`📤 Salvando faixa "${file.title}" por "${file.artist}"`);
      
      // Detectar se estamos em produção (S3) ou desenvolvimento (Vite)
      const isProduction = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
      
      if (isProduction) {
        // Em produção: salvar apenas no localStorage e mostrar aviso
        localStorage.setItem('radio-importante-catalog', jsonString);
        console.log('⚠️ Modo Produção: Catalog salvo no localStorage. Upload de arquivos não disponível.');
        
        // Mostrar mensagem ao usuário
        window.alert('⚠️ MODO PRODUÇÃO\n\nO admin está funcionando em modo somente leitura.\nOs arquivos foram processados mas não podem ser enviados para o servidor.\n\nCatalog salvo localmente.');
        
        this.showSuccessMessage(`✅ Faixa "${file.title}" processada (modo produção)`);
        this.refreshFileList();
        return;
      }
      
      // Em desenvolvimento: usar API normal
      const response = await fetch('/api/save-catalog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonString
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Faixa salva:', result);
        
        // FORÇA O PLAYER A RECARREGAR O CATÁLOGO (cache-busting)
        try {
          // Envia sinal para todas as abas do player atualizarem
          const timestamp = Date.now();
          
          // Força reload do catálogo no player via broadcast
          if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('radio-importante-updates');
            channel.postMessage({
              type: 'catalog-updated',
              timestamp: timestamp,
              updatedTrack: { index, title: file.title, artist: file.artist }
            });
            channel.close();
            console.log('📡 Sinal enviado para atualizar player');
          }
          
          // Backup: forçar reload via localStorage
          localStorage.setItem('catalog-updated', timestamp.toString());
          
        } catch (error) {
          console.warn('⚠️ Erro ao notificar player:', error);
        }
        
        // Feedback visual temporário
        const saveButton = document.querySelector(`button[data-index="${index}"][data-action="save"]`) as HTMLButtonElement;
        if (saveButton) {
          const originalText = saveButton.innerHTML;
          saveButton.innerHTML = '✅';
          saveButton.disabled = true;
          setTimeout(() => {
            saveButton.innerHTML = originalText;
            saveButton.disabled = false;
          }, 2000);
        }
        
        this.showSuccessMessage(`✅ "${file.title}" salva com sucesso!`);
        
        // ATUALIZAR OS DADOS DO ADMIN após salvar com sucesso
        setTimeout(async () => {
          console.log('🔄 Recarregando dados do admin para mostrar alterações...');
          await this.refreshFileList();
          console.log('✅ Admin atualizado com dados salvos');
        }, 500); // Aguardar meio segundo para garantir que o arquivo foi escrito
        
      } else {
        throw new Error(`Erro ${response.status}: ${await response.text()}`);
      }
      
    } catch (error) {
      console.error('❌ Erro ao salvar faixa:', error);
      this.showStatus('error', `❌ Erro ao salvar "${file.title}": ${error}`);
    }
  }

  public async removeFile(index: number): Promise<void> {
    if (confirm('Tem certeza que deseja remover este arquivo?')) {
      try {
        const file = this.audioFiles[index];
        
        // Usar a configuração de API centralizada
        const { getApiUrl } = await import('./config/api.js');
        const backendUrl = getApiUrl('upload').replace('/api/upload', ''); // Extrair baseUrl
        
        // Encontrar o trackId correspondente - assumindo que o filename é único
        const catalogResponse = await fetch(`${backendUrl}/api/catalog`);
        const catalogResult = await catalogResponse.json();
        
        if (catalogResult.success && catalogResult.catalog) {
          const track = catalogResult.catalog.tracks.find((t: any) => t.filename === file.filename);
          
          if (track) {
            // Deletar via API
            const deleteResponse = await fetch(`${backendUrl}/api/delete/${track.id}`, {
              method: 'DELETE'
            });
            
            const deleteResult = await deleteResponse.json();
            
            if (deleteResult.success) {
              console.log(`✅ Arquivo removido: ${deleteResult.deletedTrack.title}`);
              
              // Remover da lista local
              this.audioFiles.splice(index, 1);
              this.renderFileList();
              
              this.showUploadStatus(
                `🗑️ "${deleteResult.deletedTrack.title}" removido com sucesso! Total: ${deleteResult.totalTracks} faixas`,
                'success'
              );
              
              // Forçar refresh da lista após exclusão
              setTimeout(() => {
                this.refreshFileList();
              }, 1000);
              
            } else {
              throw new Error(deleteResult.error || 'Erro ao deletar arquivo');
            }
          } else {
            throw new Error('Arquivo não encontrado no catálogo');
          }
        } else {
          throw new Error('Não foi possível carregar o catálogo');
        }
        
      } catch (error) {
        console.error('❌ Erro ao remover arquivo:', error);
        this.showUploadStatus(
          `❌ Erro ao remover arquivo: ${error}`,
          'error'
        );
      }
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
        
        // Aguardar um momento e só regenerar o catálogo sem recarregar a lista
        // CORREÇÃO: Não recarregar a lista para preservar as alterações do usuário
        setTimeout(() => {
          // Só indicar que foi salvo, sem recarregar
          console.log('✅ Catálogo salvo, preservando alterações na interface');
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

  // Método para limpar nomes de arquivos no upload
  private cleanFilenameForUpload(filename: string): string {
    // Remover acentos e caracteres especiais, mantendo apenas letras, números, pontos, hífens e underscores
    return filename
      // Normalizar acentos para forma decomposta e remover caracteres diacríticos
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Substituir espaços por underscores
      .replace(/\s+/g, '_')
      // Remover caracteres especiais problemáticos (vírgulas, aspas, parênteses, +, etc.)
      .replace(/[,'"()[\]{}+&%$#@!]/g, '')
      // Substituir múltiplos hífens/underscores por um único
      .replace(/[-_]{2,}/g, '_')
      // Garantir que não comece ou termine com hífen/underscore
      .replace(/^[-_]+|[-_]+$/g, '')
      // Converter para lowercase para consistência
      .toLowerCase();
  }
}

// Instância global
const adminManager = new AdminManager();

// Expor funções globais
(window as any).adminManager = adminManager;
(window as any).saveAllMetadata = () => adminManager.saveAllMetadata();
(window as any).refreshFileList = () => adminManager.refreshFileList();
