// Frontend Integration Patch - Radio Importante Backend
// Adicionar ao src/admin-simple.ts

// 1. No início da classe AdminManager, adicionar propriedade para backend URL:
private backendUrl: string = '';

// 2. No método checkEnvironmentAndSetup(), adicionar detecção de backend:
private checkEnvironmentAndSetup(): void {
  const isProduction = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
  
  // Detectar backend URL
  this.backendUrl = isProduction 
    ? 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app'
    : 'http://localhost:8080';
  
  if (isProduction) {
    this.setupProductionMode();
  }
  
  // Testar conectividade com backend
  this.testBackendConnectivity();
}

// 3. Adicionar método para testar conectividade:
private async testBackendConnectivity(): Promise<void> {
  try {
    console.log(`🔍 Testando conectividade com backend: ${this.backendUrl}`);
    const response = await fetch(`${this.backendUrl}/health`);
    
    if (response.ok) {
      const health = await response.json();
      console.log('✅ Backend conectado:', health);
      this.showMessage('✅ Backend conectado e funcionando!', 'success');
      this.enableBackendFeatures();
    } else {
      throw new Error(`Backend retornou status ${response.status}`);
    }
  } catch (error) {
    console.warn('⚠️ Backend não disponível, usando modo local:', error);
    this.showMessage('⚠️ Backend não disponível - usando modo local', 'warning');
    this.disableBackendFeatures();
  }
}

// 4. Adicionar métodos para habilitar/desabilitar recursos do backend:
private enableBackendFeatures(): void {
  // Mostrar opções de upload para backend
  const uploadSection = document.getElementById('upload-section');
  if (uploadSection) {
    uploadSection.style.display = 'block';
  }
  
  // Adicionar indicador de backend ativo
  const statusElement = document.getElementById('backend-status');
  if (statusElement) {
    statusElement.textContent = '🚀 Backend Ativo';
    statusElement.className = 'backend-online';
  }
}

private disableBackendFeatures(): void {
  // Esconder opções de upload
  const uploadSection = document.getElementById('upload-section');
  if (uploadSection) {
    uploadSection.style.display = 'none';
  }
  
  // Mostrar modo local
  const statusElement = document.getElementById('backend-status');
  if (statusElement) {
    statusElement.textContent = '📁 Modo Local';
    statusElement.className = 'backend-offline';
  }
}

// 5. Adicionar método de upload para backend:
private async uploadToBackend(files: File[]): Promise<void> {
  try {
    this.showMessage('📤 Uploading files to backend...', 'info');
    
    const formData = new FormData();
    files.forEach(file => {
      formData.append('audioFiles', file);
    });

    const response = await fetch(`${this.backendUrl}/api/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const result = await response.json();
    console.log('Upload success:', result);
    
    if (result.success) {
      this.showMessage(`✅ ${result.uploaded.length} arquivo(s) enviado(s) com sucesso!`, 'success');
      
      // Atualizar catálogo local se necessário
      await this.refreshCatalogFromBackend();
    } else {
      throw new Error(result.error || 'Upload failed');
    }

  } catch (error) {
    console.error('Upload error:', error);
    this.showMessage(`❌ Erro no upload: ${error.message}`, 'error');
  }
}

// 6. Adicionar método para atualizar catálogo do backend:
private async refreshCatalogFromBackend(): Promise<void> {
  try {
    const response = await fetch(`${this.backendUrl}/api/catalog`);
    if (response.ok) {
      const data = await response.json();
      console.log('📚 Catálogo atualizado do backend:', data.catalog);
      
      // Converter para formato local se necessário
      this.audioFiles = data.catalog.tracks.map(track => ({
        filename: track.fileName,
        size: track.size || 0,
        lastModified: new Date(track.addedAt).getTime(),
        title: track.title,
        artist: track.artist,
        displayName: `${track.artist} - ${track.title}`
      }));
      
      this.refreshFileList();
    }
  } catch (error) {
    console.warn('Erro ao atualizar catálogo do backend:', error);
  }
}

// 7. Modificar método handleFiles para usar backend quando disponível:
private async handleFiles(files: FileList): Promise<void> {
  const fileArray = Array.from(files);
  const audioFiles = fileArray.filter(file => file.type.startsWith('audio/'));
  
  if (audioFiles.length === 0) {
    this.showMessage('❌ Nenhum arquivo de áudio encontrado', 'error');
    return;
  }

  // Se backend está disponível, usar upload do backend
  if (this.backendUrl && this.backendUrl !== 'http://localhost:8080' || await this.isBackendAvailable()) {
    await this.uploadToBackend(audioFiles);
  } else {
    // Usar upload local tradicional
    await this.uploadLocal(audioFiles);
  }
}

// 8. Adicionar método para verificar se backend está disponível:
private async isBackendAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${this.backendUrl}/health`, { 
      method: 'GET',
      cache: 'no-cache'
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 9. Renomear método existente para uploadLocal:
private async uploadLocal(audioFiles: File[]): Promise<void> {
  // ... código existente de upload local ...
}

/* 
CSS para adicionar ao final do index.html:

<style>
.backend-online {
  color: #28a745;
  font-weight: bold;
}

.backend-offline {
  color: #ffc107;
  font-weight: bold;
}

#upload-section {
  margin: 20px 0;
  padding: 15px;
  border: 2px dashed #ddd;
  border-radius: 8px;
  text-align: center;
}

#backend-status {
  padding: 8px 12px;
  border-radius: 4px;
  margin: 10px 0;
  display: inline-block;
}
</style>

HTML para adicionar no admin.html:

<div id="backend-status">🔍 Verificando backend...</div>
<div id="upload-section" style="display: none;">
  <h3>Upload via Backend</h3>
  <p>Arrastar arquivos aqui ou usar seletor de arquivos</p>
</div>

*/
