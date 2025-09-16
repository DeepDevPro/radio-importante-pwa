# 🔧 PLANO DE REFATORAÇÃO ADMIN.HTML - PARTE 2
## MODULARIZAÇÃO JAVASCRIPT (Execução: GPT5 Mini)

---

## 📋 **CONTEXTO DA PARTE 2**

### **Situação Atual:**
- ✅ Parte 1 concluída: CSS modularizado e configurações criadas
- ✅ Estrutura de pastas estabelecida
- 🎯 **Foco agora:** Extrair e modularizar **~864 linhas de JavaScript**

### **Objetivo desta Parte:**
Transformar o JavaScript monolítico em **4 módulos independentes** e testáveis.

---

## 🎯 **ESCOPO DA PARTE 2**

Esta parte cobre:
1. ✅ Extração do sistema de API
2. ✅ Modularização do sistema de Upload  
3. ✅ Criação do gerenciador de músicas
4. ✅ Criação dos helpers de UI

**⏱️ Tempo estimado:** 45-60 minutos

---

## 🌐 **EXTRAÇÃO DO SISTEMA DE API**

### **PASSO 2.1: Criar admin/scripts/api.js**

**Seções originais a extrair:**
- Status do Backend (linhas 631-750)
- Chamadas de API espalhadas pelo código
- Gerenciamento de CORS e timeouts

```javascript
/**
 * ===== SISTEMA DE API =====
 * Centraliza todas as chamadas para o backend
 */

import { API_CONFIG, DEBUG_CONFIG } from './config.js';

// Estado interno do módulo API
const apiState = {
    lastHealthCheck: null,
    backendStatus: {
        local: { status: 'unknown', timestamp: null, data: null },
        production: { status: 'unknown', timestamp: null, data: null }
    }
};

/**
 * Classe principal para gerenciar APIs
 */
export class ApiManager {
    constructor() {
        this.config = API_CONFIG;
        this.setupInterceptors();
    }

    /**
     * Setup de interceptors para todas as requisições
     */
    setupInterceptors() {
        // Interceptor global para log de requisições
        if (DEBUG_CONFIG.showNetworkCalls) {
            console.log('🌐 ApiManager inicializado');
        }
    }

    /**
     * Método genérico para fazer requisições
     */
    async makeRequest(endpoint, options = {}) {
        const url = `${this.getActiveBackendUrl()}${endpoint}`;
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: this.config.timeouts.apiCall
        };

        const requestOptions = { ...defaultOptions, ...options };
        
        // Log da requisição
        if (DEBUG_CONFIG.showNetworkCalls) {
            console.log(`📤 API Request: ${requestOptions.method} ${url}`, requestOptions);
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);

            const response = await fetch(url, {
                ...requestOptions,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (DEBUG_CONFIG.showNetworkCalls) {
                console.log(`📥 API Response: ${response.status} ${url}`, response);
            }

            return response;
        } catch (error) {
            console.error(`❌ API Error: ${endpoint}`, error);
            throw error;
        }
    }

    /**
     * Verificar status de todos os backends
     */
    async checkBackendStatus() {
        const results = {
            local: await this.checkSingleBackend('local'),
            production: await this.checkSingleBackend('production'),
            activeBackend: null,
            environment: this.config.environment.isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'
        };

        // Determinar backend ativo baseado no ambiente
        if (this.config.environment.isProduction && results.production.available) {
            this.config.currentBackend = this.config.productionUrl;
            results.activeBackend = '☁️ Produção (DigitalOcean)';
        } else if (!this.config.environment.isProduction && results.local.available) {
            this.config.currentBackend = this.config.localUrl;
            results.activeBackend = '🏠 Local (localhost:8080)';
        } else {
            this.config.currentBackend = null;
            results.activeBackend = '❌ ERRO: Nenhum backend disponível';
        }

        // Atualizar estado interno
        apiState.lastHealthCheck = Date.now();
        apiState.backendStatus = {
            local: results.local,
            production: results.production
        };

        return results;
    }

    /**
     * Verificar status de um backend específico
     */
    async checkSingleBackend(type) {
        const urls = {
            local: this.config.localUrl,
            production: this.config.productionUrl
        };

        const result = {
            type,
            available: false,
            status: '❌ Offline',
            data: null,
            error: null,
            timestamp: Date.now()
        };

        // Pular teste local em produção
        if (type === 'local' && this.config.environment.isProduction) {
            result.status = '⏭️ Produção (localhost ignorado)';
            return result;
        }

        try {
            const response = await this.makeRequest('/health', {
                timeout: this.config.timeouts.healthCheck
            });

            if (response.ok) {
                const data = await response.json();
                result.available = true;
                result.status = `✅ Online - v${data.version || 'unknown'}`;
                result.data = data;
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            result.error = error.message;
            
            // Tratamento especial para Mixed Content
            if (this.config.environment.isHttps && type === 'local') {
                result.status = '❌ Offline (Mixed Content bloqueado)';
            } else {
                result.status = `❌ Offline (${error.message})`;
            }
        }

        return result;
    }

    /**
     * Buscar catálogo de músicas
     */
    async getCatalog() {
        if (!this.hasActiveBackend()) {
            throw new Error('Nenhum backend disponível para buscar catálogo');
        }

        const response = await this.makeRequest(this.config.endpoints.catalog);
        
        if (!response.ok) {
            throw new Error(`Erro ao buscar catálogo: ${response.statusText}`);
        }

        const data = await response.json();
        return data.tracks || [];
    }

    /**
     * Fazer upload de arquivos
     */
    async uploadFiles(formData, onProgress = null) {
        if (!this.hasActiveBackend()) {
            throw new Error('Nenhum backend disponível para upload');
        }

        const response = await this.makeRequest(this.config.endpoints.upload, {
            method: 'POST',
            body: formData,
            headers: {}, // Remove Content-Type para FormData
            timeout: this.config.timeouts.upload
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro no upload: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Atualizar metadados de uma música
     */
    async updateTrackMetadata(trackId, metadata) {
        if (!this.hasActiveBackend()) {
            throw new Error('Nenhum backend disponível para atualizar metadados');
        }

        const response = await this.makeRequest(`${this.config.endpoints.updateMetadata}/${trackId}/metadata`, {
            method: 'PUT',
            body: JSON.stringify(metadata)
        });

        if (!response.ok) {
            throw new Error(`Erro ao atualizar metadados: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Deletar uma música
     */
    async deleteTrack(trackId) {
        if (!this.hasActiveBackend()) {
            throw new Error('Nenhum backend disponível para deletar música');
        }

        const response = await this.makeRequest(`${this.config.endpoints.delete}/${trackId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`Erro ao deletar música: ${response.statusText}`);
        }

        return response.ok;
    }

    /**
     * Regenerar catálogo
     */
    async regenerateCatalog() {
        if (!this.hasActiveBackend()) {
            throw new Error('Nenhum backend disponível para regenerar catálogo');
        }

        const response = await this.makeRequest(this.config.endpoints.regenerateCatalog, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`Erro ao regenerar catálogo: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Helpers e utilitários
     */
    hasActiveBackend() {
        return this.config.currentBackend !== null;
    }

    getActiveBackendUrl() {
        if (!this.hasActiveBackend()) {
            throw new Error('Nenhum backend ativo configurado');
        }
        return this.config.currentBackend;
    }

    getBackendStatus() {
        return apiState.backendStatus;
    }

    isHealthy() {
        const now = Date.now();
        const lastCheck = apiState.lastHealthCheck;
        const maxAge = 30000; // 30 segundos

        return lastCheck && (now - lastCheck) < maxAge && this.hasActiveBackend();
    }
}

// Instância singleton
export const apiManager = new ApiManager();

// Funções de conveniência para compatibilidade
export async function checkBackendStatus() {
    return await apiManager.checkBackendStatus();
}

export async function getCatalog() {
    return await apiManager.getCatalog();
}

export async function uploadFiles(formData, onProgress) {
    return await apiManager.uploadFiles(formData, onProgress);
}

export async function updateTrackMetadata(trackId, metadata) {
    return await apiManager.updateTrackMetadata(trackId, metadata);
}

export async function deleteTrack(trackId) {
    return await apiManager.deleteTrack(trackId);
}

export async function regenerateCatalog() {
    return await apiManager.regenerateCatalog();
}

// Log de inicialização
if (DEBUG_CONFIG.enabled) {
    console.log('🌐 Sistema de API modularizado carregado');
}
```

---

## 📤 **MODULARIZAÇÃO DO SISTEMA DE UPLOAD**

### **PASSO 2.2: Criar admin/scripts/upload.js**

**Seções originais a extrair:**
- Upload Handlers (linhas 771-920)
- Upload Logic (linhas 921-1020)
- Cálculo de duração (linhas 1421-1465)

```javascript
/**
 * ===== SISTEMA DE UPLOAD =====
 * Gerencia todo o processo de upload de arquivos
 */

import { API_CONFIG, UI_CONFIG, APP_STATE, validateUploadFile } from './config.js';
import { apiManager } from './api.js';
import { showAlert, formatFileSize, formatDuration } from './ui-helpers.js';

/**
 * Classe para gerenciar upload de arquivos
 */
export class UploadManager {
    constructor() {
        this.selectedFiles = [];
        this.uploadArea = null;
        this.fileInput = null;
        this.setupEventListeners();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Aguardar DOM estar pronto
        document.addEventListener('DOMContentLoaded', () => {
            this.uploadArea = document.getElementById('upload-area');
            this.fileInput = document.getElementById('file-input');
            
            if (this.uploadArea && this.fileInput) {
                this.setupDragAndDrop();
                this.setupFileInput();
                this.setupClickHandler();
            }
        });
    }

    /**
     * Configurar drag and drop
     */
    setupDragAndDrop() {
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('drag-over');
        });

        this.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('drag-over');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files);
        });
    }

    /**
     * Configurar input de arquivo
     */
    setupFileInput() {
        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
    }

    /**
     * Configurar clique na área de upload
     */
    setupClickHandler() {
        this.uploadArea.addEventListener('click', (e) => {
            if (e.target === this.uploadArea || e.target.closest('.upload-area')) {
                this.fileInput.click();
            }
        });
    }

    /**
     * Processar arquivos selecionados
     */
    handleFiles(files) {
        const fileArray = Array.from(files);
        const validFiles = [];
        const errors = [];

        // Validar cada arquivo
        fileArray.forEach(file => {
            const validation = validateUploadFile(file);
            if (validation.valid) {
                validFiles.push(file);
            } else {
                errors.push(`${file.name}: ${validation.errors.join(', ')}`);
            }
        });

        // Mostrar erros se houver
        if (errors.length > 0) {
            showAlert('upload-status', `❌ Arquivos inválidos:\n${errors.join('\n')}`, 'error');
        }

        // Verificar limite de arquivos
        if (validFiles.length > API_CONFIG.upload.maxFiles) {
            showAlert('upload-status', `❌ Máximo de ${API_CONFIG.upload.maxFiles} arquivos por vez`, 'error');
            return;
        }

        // Atualizar arquivos selecionados
        this.selectedFiles = validFiles;
        APP_STATE.selectedFiles = this.selectedFiles;
        
        this.displayFiles();
    }

    /**
     * Exibir preview dos arquivos
     */
    async displayFiles() {
        const preview = document.getElementById('file-preview');
        const fileList = document.getElementById('file-list');
        
        if (this.selectedFiles.length === 0) {
            preview.style.display = 'none';
            return;
        }

        preview.style.display = 'block';
        
        // Gerar HTML dos arquivos
        const filesHtml = this.selectedFiles.map((file, index) => `
            <div class="file-item" id="file-item-${index}">
                <span class="file-icon">🎵</span>
                <div class="file-info">
                    <div class="file-name">${this.escapeHtml(file.name)}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                    <div class="file-duration" id="duration-${index}">🔄 Calculando duração...</div>
                </div>
                <button class="btn btn-danger" onclick="uploadManager.removeFile(${index})" style="padding: 6px 12px; font-size: 14px;">
                    ✕
                </button>
            </div>
        `).join('');

        fileList.innerHTML = filesHtml;

        // Calcular duração de cada arquivo
        this.selectedFiles.forEach((file, index) => {
            this.calculateAudioDuration(file, index);
        });
    }

    /**
     * Calcular duração do áudio
     */
    calculateAudioDuration(file, index) {
        const audio = new Audio();
        const url = URL.createObjectURL(file);
        
        audio.preload = 'metadata';
        audio.crossOrigin = 'anonymous';
        
        const cleanup = () => {
            URL.revokeObjectURL(url);
        };

        audio.addEventListener('loadedmetadata', () => {
            const duration = audio.duration;
            const durationElement = document.getElementById(`duration-${index}`);
            
            if (durationElement) {
                if (isFinite(duration) && duration > 0) {
                    durationElement.textContent = `⏱️ ${formatDuration(duration)}`;
                    durationElement.style.color = 'var(--success-color)';
                    
                    // Armazenar duração no arquivo
                    file.calculatedDuration = Math.round(duration);
                    console.log(`✅ Duração calculada para ${file.name}: ${file.calculatedDuration}s`);
                } else {
                    durationElement.textContent = '⚠️ Duração desconhecida';
                    durationElement.style.color = 'var(--danger-color)';
                    file.calculatedDuration = 0;
                }
            }
            cleanup();
        });
        
        audio.addEventListener('error', (error) => {
            console.error(`❌ Erro ao calcular duração de ${file.name}:`, error);
            const durationElement = document.getElementById(`duration-${index}`);
            if (durationElement) {
                durationElement.textContent = '❌ Erro ao ler arquivo';
                durationElement.style.color = 'var(--danger-color)';
            }
            file.calculatedDuration = 0;
            cleanup();
        });
        
        audio.src = url;
    }

    /**
     * Remover arquivo da seleção
     */
    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        APP_STATE.selectedFiles = this.selectedFiles;
        this.displayFiles();
    }

    /**
     * Limpar todos os arquivos
     */
    clearFiles() {
        this.selectedFiles = [];
        APP_STATE.selectedFiles = [];
        this.fileInput.value = '';
        this.displayFiles();
    }

    /**
     * Executar upload dos arquivos
     */
    async uploadFiles() {
        if (this.selectedFiles.length === 0) {
            showAlert('upload-status', UI_CONFIG.messages.noFilesSelected, 'error');
            return;
        }

        if (!apiManager.hasActiveBackend()) {
            const env = API_CONFIG.environment.isProduction ? 'produção' : 'desenvolvimento';
            const backend = API_CONFIG.environment.isProduction ? 'DigitalOcean' : 'local';
            showAlert('upload-status', `❌ ERRO: Backend de ${env} (${backend}) não está disponível. Verifique a conexão e tente novamente.`, 'error');
            return;
        }

        const progressBar = document.getElementById('upload-progress');
        const progressFill = document.getElementById('progress-fill');
        const uploadBtn = document.getElementById('upload-btn');
        
        try {
            // UI de início do upload
            progressBar.style.display = 'block';
            uploadBtn.disabled = true;
            uploadBtn.textContent = '📤 Enviando...';
            APP_STATE.ui.loading = true;

            // Preparar FormData
            const formData = new FormData();
            this.selectedFiles.forEach((file, index) => {
                formData.append('audioFiles', file);
                
                // Enviar duração calculada
                if (file.calculatedDuration) {
                    formData.append(`duration_${index}`, file.calculatedDuration.toString());
                }
            });

            // Simular progresso inicial
            progressFill.style.width = '25%';
            progressFill.textContent = `25% - Preparando upload...`;

            // Fazer upload
            progressFill.style.width = '50%';
            progressFill.textContent = `50% - Enviando ${this.selectedFiles.length} arquivo(s)...`;

            const result = await apiManager.uploadFiles(formData);

            // Upload concluído
            progressFill.style.width = '100%';
            progressFill.textContent = `100% - Upload concluído!`;

            showAlert('upload-status', `✅ Upload concluído! ${this.selectedFiles.length} arquivo(s) enviado(s)`, 'success');
            
            // Limpar seleção
            this.clearFiles();
            
            // Notificar outros módulos
            this.dispatchUploadComplete(result);
            
            // Atualizar lista de músicas após delay
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('musicLibraryUpdate'));
            }, 1000);

        } catch (error) {
            console.error('Erro no upload:', error);
            showAlert('upload-status', `❌ Erro no upload: ${error.message}`, 'error');
        } finally {
            // Resetar UI
            progressBar.style.display = 'none';
            uploadBtn.disabled = false;
            uploadBtn.textContent = '📤 Enviar para Backend';
            APP_STATE.ui.loading = false;
        }
    }

    /**
     * Disparar evento de upload completo
     */
    dispatchUploadComplete(result) {
        window.dispatchEvent(new CustomEvent('uploadComplete', {
            detail: {
                filesUploaded: this.selectedFiles.length,
                result: result
            }
        }));
    }

    /**
     * Utilitário para escapar HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Obter arquivos selecionados
     */
    getSelectedFiles() {
        return this.selectedFiles;
    }

    /**
     * Verificar se há arquivos selecionados
     */
    hasSelectedFiles() {
        return this.selectedFiles.length > 0;
    }
}

// Instância singleton
export const uploadManager = new UploadManager();

// Expor globalmente para compatibilidade com HTML
window.uploadManager = uploadManager;

// Funções de conveniência
export function clearFiles() {
    uploadManager.clearFiles();
}

export function uploadFiles() {
    return uploadManager.uploadFiles();
}

export function removeFile(index) {
    uploadManager.removeFile(index);
}

console.log('📤 Sistema de Upload modularizado carregado');
```

---

## 🎵 **CRIAÇÃO DO GERENCIADOR DE MÚSICAS**

### **PASSO 2.3: Criar admin/scripts/music-manager.js**

**Seções originais a extrair:**
- Gerenciar Músicas (linhas 1201-1350)
- Editor de Metadados Inline (linhas 1021-1200)
- Seleção Múltipla (linhas 1351-1420)

```javascript
/**
 * ===== GERENCIADOR DE MÚSICAS =====
 * Gerencia biblioteca, edição e operações em lote
 */

import { API_CONFIG, UI_CONFIG, APP_STATE } from './config.js';
import { apiManager } from './api.js';
import { showAlert, formatDuration } from './ui-helpers.js';

/**
 * Classe para gerenciar biblioteca de músicas
 */
export class MusicManager {
    constructor() {
        this.musicLibrary = [];
        this.selectedTracks = new Set();
        this.editingTrack = null;
        this.setupEventListeners();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Atualizar biblioteca quando houver upload
        window.addEventListener('uploadComplete', () => {
            setTimeout(() => this.loadMusicList(), 1000);
        });

        // Atualizar biblioteca quando solicitado
        window.addEventListener('musicLibraryUpdate', () => {
            this.loadMusicList();
        });
    }

    /**
     * Carregar lista de músicas
     */
    async loadMusicList() {
        const musicList = document.getElementById('music-list');
        const statusDiv = document.getElementById('manage-status');
        const totalsDiv = document.getElementById('music-totals');
        
        try {
            // UI de carregamento
            if (musicList) musicList.innerHTML = '<div style="text-align: center; padding: 20px;">🔄 Carregando músicas...</div>';
            if (totalsDiv) totalsDiv.innerHTML = '🔄 Calculando totais...';
            
            // Buscar dados do backend
            let tracks = [];
            if (apiManager.hasActiveBackend()) {
                try {
                    tracks = await apiManager.getCatalog();
                } catch (e) {
                    console.error('Erro ao carregar do backend:', e);
                    showAlert('manage-status', '❌ Erro ao carregar músicas do backend', 'error');
                }
            } else {
                const env = API_CONFIG.environment.isProduction ? 'produção' : 'desenvolvimento';
                showAlert('manage-status', `❌ Backend de ${env} não disponível. Não é possível carregar lista de músicas.`, 'error');
            }
            
            // Atualizar estado
            this.musicLibrary = tracks;
            APP_STATE.musicLibrary = tracks;
            
            // Renderizar interface
            this.renderMusicList(tracks);
            this.renderTotals(tracks);
            this.setupBulkActions(tracks.length > 0);
            
            if (tracks.length === 0 && apiManager.hasActiveBackend()) {
                showAlert('manage-status', 'ℹ️ Nenhuma música encontrada no catálogo', 'info');
            } else if (tracks.length > 0) {
                showAlert('manage-status', `✅ ${tracks.length} música(s) carregada(s)`, 'success');
            }

        } catch (error) {
            console.error('Erro ao carregar lista:', error);
            if (musicList) musicList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger-color);">❌ Erro ao carregar músicas</div>';
            if (totalsDiv) totalsDiv.innerHTML = '❌ Erro ao calcular totais';
            showAlert('manage-status', `❌ Erro: ${error.message}`, 'error');
        }
    }

    /**
     * Renderizar lista de músicas
     */
    renderMusicList(tracks) {
        const musicList = document.getElementById('music-list');
        if (!musicList) return;

        if (tracks.length === 0) {
            musicList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--gray-600);">📭 Nenhuma música encontrada</div>';
            return;
        }

        const tracksHtml = tracks.map((track, index) => this.renderTrackItem(track, index)).join('');
        musicList.innerHTML = tracksHtml;
    }

    /**
     * Renderizar item individual de música
     */
    renderTrackItem(track, index) {
        const title = this.escapeHtml(track.title || track.name || 'Sem título');
        const artist = this.escapeHtml(track.artist || '');
        const filename = this.escapeHtml(track.filename || 'Arquivo não identificado');
        const duration = track.duration ? formatDuration(track.duration) : 'Duração desconhecida';

        return `
            <div class="music-item" id="track-${track.id}">
                <div style="background: var(--primary-color); color: white; padding: 8px 12px; border-radius: 50%; font-weight: bold; margin-right: 15px; min-width: 35px; text-align: center;">
                    ${index + 1}
                </div>
                <div class="music-info" style="flex: 1;">
                    <div class="music-title-container">
                        <div class="music-title display-mode" onclick="musicManager.enableEdit('${track.id}', 'title')" title="Clique para editar">
                            ${title}
                        </div>
                        <input type="text" class="music-title edit-mode" value="${title}" 
                               onblur="musicManager.saveEdit('${track.id}', 'title', this.value)" 
                               onkeydown="musicManager.handleEditKeydown(event, '${track.id}', 'title', this.value)" 
                               style="display: none;">
                    </div>
                    <div class="music-meta">
                        <span class="artist-container">
                            <span class="display-mode" onclick="musicManager.enableEdit('${track.id}', 'artist')" title="Clique para editar artista">
                                ${artist || 'Artista não definido'}
                            </span>
                            <input type="text" class="edit-mode" value="${artist}" 
                                   onblur="musicManager.saveEdit('${track.id}', 'artist', this.value)" 
                                   onkeydown="musicManager.handleEditKeydown(event, '${track.id}', 'artist', this.value)" 
                                   style="display: none;">
                        </span>
                        •
                        <span class="duration-display" title="Duração calculada automaticamente">
                            ${duration}
                        </span>
                        • 
                        ${filename}
                    </div>
                </div>
                <div class="music-actions">
                    <input type="checkbox" class="music-checkbox" data-track-id="${track.id}" style="margin-right: 10px; transform: scale(1.2);">
                    <button class="btn btn-danger" onclick="musicManager.deleteTrack('${track.id}')" style="padding: 8px 12px;" title="Deletar música">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar totais
     */
    renderTotals(tracks) {
        const totalsDiv = document.getElementById('music-totals');
        if (!totalsDiv) return;

        const totalTracks = tracks.length;
        const totalDuration = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);

        totalsDiv.innerHTML = `📊 <strong>Total:</strong> ${totalTracks} música${totalTracks !== 1 ? 's' : ''} • ${formatDuration(totalDuration)} de duração`;
    }

    /**
     * Configurar ações em lote
     */
    setupBulkActions(show) {
        const bulkActions = document.getElementById('bulk-actions');
        if (!bulkActions) return;

        if (show) {
            bulkActions.style.display = 'block';
            this.setupBulkSelection();
        } else {
            bulkActions.style.display = 'none';
        }
    }

    /**
     * Configurar seleção em lote
     */
    setupBulkSelection() {
        const checkboxes = document.querySelectorAll('.music-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateSelectedCount());
        });
        this.updateSelectedCount();
    }

    /**
     * Habilitar edição inline
     */
    enableEdit(trackId, field) {
        const trackElement = document.getElementById(`track-${trackId}`);
        if (!trackElement) return;

        const container = trackElement.querySelector(`.${field}-container`) || 
                         trackElement.querySelector('.music-title-container');
        
        if (!container) return;
        
        const displayElement = container.querySelector('.display-mode');
        const editElement = container.querySelector('.edit-mode');
        
        if (displayElement && editElement) {
            // Cancelar edição anterior se houver
            if (this.editingTrack && this.editingTrack !== trackId) {
                this.cancelEdit(this.editingTrack.trackId, this.editingTrack.field);
            }

            // Marcar como editando
            trackElement.classList.add('editing');
            this.editingTrack = { trackId, field };
            
            // Alternar visibilidade
            displayElement.style.display = 'none';
            editElement.style.display = 'inline-block';
            
            // Focar e selecionar
            editElement.focus();
            editElement.select();
        }
    }

    /**
     * Lidar com teclas durante edição
     */
    handleEditKeydown(event, trackId, field, value) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.saveEdit(trackId, field, value);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelEdit(trackId, field);
        }
    }

    /**
     * Cancelar edição
     */
    cancelEdit(trackId, field) {
        const trackElement = document.getElementById(`track-${trackId}`);
        if (!trackElement) return;

        const container = trackElement.querySelector(`.${field}-container`) || 
                         trackElement.querySelector('.music-title-container');
        
        if (!container) return;
        
        const displayElement = container.querySelector('.display-mode');
        const editElement = container.querySelector('.edit-mode');
        
        if (displayElement && editElement) {
            // Remover marca de edição
            trackElement.classList.remove('editing');
            this.editingTrack = null;
            
            // Alternar visibilidade
            displayElement.style.display = 'inline';
            editElement.style.display = 'none';
        }
    }

    /**
     * Salvar edição
     */
    async saveEdit(trackId, field, value) {
        const trackElement = document.getElementById(`track-${trackId}`);
        if (!trackElement) return;

        const container = trackElement.querySelector(`.${field}-container`) || 
                         trackElement.querySelector('.music-title-container');
        
        if (!container) return;
        
        const displayElement = container.querySelector('.display-mode');
        const editElement = container.querySelector('.edit-mode');
        
        try {
            // Validações
            if (field === 'title' && !value.trim()) {
                showAlert('manage-status', 'Título não pode estar vazio', 'error');
                editElement.focus();
                return;
            }

            // Salvar no backend
            if (apiManager.hasActiveBackend()) {
                await apiManager.updateTrackMetadata(trackId, {
                    [field]: value
                });
            }

            // Atualizar interface
            const displayValue = value || (field === 'artist' ? 'Artista não definido' : 'Sem título');
            displayElement.textContent = displayValue;

            // Finalizar edição
            trackElement.classList.remove('editing');
            this.editingTrack = null;
            displayElement.style.display = 'inline';
            editElement.style.display = 'none';

            // Feedback visual
            displayElement.style.background = 'var(--success-color)';
            displayElement.style.color = 'white';
            setTimeout(() => {
                displayElement.style.background = '';
                displayElement.style.color = '';
            }, 1000);

            // Recarregar dados para manter consistência
            setTimeout(() => this.loadMusicList(), 500);

        } catch (error) {
            console.error('Erro ao salvar:', error);
            showAlert('manage-status', `❌ Erro ao salvar: ${error.message}`, 'error');
            editElement.focus();
        }
    }

    /**
     * Deletar música individual
     */
    async deleteTrack(trackId) {
        if (!confirm('Tem certeza que deseja deletar esta música?')) {
            return;
        }

        try {
            await apiManager.deleteTrack(trackId);
            showAlert('manage-status', '✅ Música deletada com sucesso', 'success');
            this.loadMusicList();
        } catch (error) {
            console.error('Erro ao deletar:', error);
            showAlert('manage-status', `❌ Erro ao deletar: ${error.message}`, 'error');
        }
    }

    /**
     * Atualizar contagem de selecionados
     */
    updateSelectedCount() {
        const checkboxes = document.querySelectorAll('.music-checkbox');
        const selectedCheckboxes = document.querySelectorAll('.music-checkbox:checked');
        const selectedCount = selectedCheckboxes.length;
        
        // Atualizar texto
        const countElement = document.getElementById('selected-count');
        if (countElement) {
            countElement.textContent = `${selectedCount} música${selectedCount !== 1 ? 's' : ''} selecionada${selectedCount !== 1 ? 's' : ''}`;
        }

        // Atualizar botão de deletar
        const deleteButton = document.getElementById('delete-selected');
        if (deleteButton) {
            deleteButton.disabled = selectedCount === 0;
        }
        
        // Atualizar checkbox "Selecionar Todas"
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            if (selectedCount === 0) {
                selectAllCheckbox.indeterminate = false;
                selectAllCheckbox.checked = false;
            } else if (selectedCount === checkboxes.length) {
                selectAllCheckbox.indeterminate = false;
                selectAllCheckbox.checked = true;
            } else {
                selectAllCheckbox.indeterminate = true;
            }
        }

        // Atualizar estado
        this.selectedTracks.clear();
        selectedCheckboxes.forEach(checkbox => {
            this.selectedTracks.add(checkbox.dataset.trackId);
        });
        APP_STATE.ui.selectedTracks = this.selectedTracks;
    }

    /**
     * Selecionar/deselecionar todas
     */
    toggleSelectAll() {
        const selectAllCheckbox = document.getElementById('select-all');
        const checkboxes = document.querySelectorAll('.music-checkbox');
        
        if (selectAllCheckbox && checkboxes) {
            checkboxes.forEach(checkbox => {
                checkbox.checked = selectAllCheckbox.checked;
            });
            this.updateSelectedCount();
        }
    }

    /**
     * Deletar músicas selecionadas
     */
    async deleteSelectedTracks() {
        const selectedCount = this.selectedTracks.size;
        
        if (selectedCount === 0) {
            showAlert('manage-status', 'Nenhuma música selecionada', 'error');
            return;
        }
        
        if (!confirm(`Tem certeza que deseja deletar ${selectedCount} música${selectedCount !== 1 ? 's' : ''}?`)) {
            return;
        }

        try {
            const trackIds = Array.from(this.selectedTracks);
            let deletedCount = 0;
            
            showAlert('manage-status', `🔄 Deletando ${selectedCount} música${selectedCount !== 1 ? 's' : ''}...`, 'info');
            
            // Deletar em sequência para evitar sobrecarga
            for (const trackId of trackIds) {
                try {
                    await apiManager.deleteTrack(trackId);
                    deletedCount++;
                } catch (error) {
                    console.error(`Erro ao deletar ${trackId}:`, error);
                }
            }
            
            if (deletedCount > 0) {
                showAlert('manage-status', `✅ ${deletedCount} música${deletedCount !== 1 ? 's' : ''} deletada${deletedCount !== 1 ? 's' : ''} com sucesso`, 'success');
                this.loadMusicList();
            } else {
                throw new Error('Nenhuma música foi deletada');
            }
            
        } catch (error) {
            console.error('Erro ao deletar músicas:', error);
            showAlert('manage-status', `❌ Erro ao deletar músicas: ${error.message}`, 'error');
        }
    }

    /**
     * Regenerar catálogo
     */
    async regenerateCatalog() {
        try {
            showAlert('manage-status', '🔄 Regenerando catálogo...', 'info');
            await apiManager.regenerateCatalog();
            showAlert('manage-status', '✅ Catálogo regenerado com sucesso', 'success');
            setTimeout(() => this.loadMusicList(), 1000);
        } catch (error) {
            console.error('Erro na regeneração:', error);
            showAlert('manage-status', `❌ Erro: ${error.message}`, 'error');
        }
    }

    /**
     * Utilitários
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getMusicLibrary() {
        return this.musicLibrary;
    }

    getSelectedTracks() {
        return Array.from(this.selectedTracks);
    }
}

// Instância singleton
export const musicManager = new MusicManager();

// Expor globalmente para compatibilidade
window.musicManager = musicManager;

// Funções de conveniência
export function loadMusicList() {
    return musicManager.loadMusicList();
}

export function deleteTrack(trackId) {
    return musicManager.deleteTrack(trackId);
}

export function toggleSelectAll() {
    return musicManager.toggleSelectAll();
}

export function deleteSelectedTracks() {
    return musicManager.deleteSelectedTracks();
}

export function regenerateCatalog() {
    return musicManager.regenerateCatalog();
}

console.log('🎵 Gerenciador de Músicas modularizado carregado');
```

---

## ✅ **CHECKLIST DA PARTE 2**

Antes de prosseguir para a Parte 3, verifique:

- [ ] ✅ Arquivo `admin/scripts/api.js` criado com sistema completo de API
- [ ] ✅ Arquivo `admin/scripts/upload.js` criado com sistema de upload
- [ ] ✅ Arquivo `admin/scripts/music-manager.js` criado com gerenciamento
- [ ] ✅ Todas as funções principais extraídas do admin.html original
- [ ] ✅ Event listeners e interações preservadas
- [ ] ✅ Estado global sendo gerenciado corretamente
- [ ] ✅ Sistema de módulos ES6 implementado

---

## 🚀 **PRÓXIMOS PASSOS**

Após completar a Parte 2, execute a **PARTE 3** que cobrirá:
1. Criação dos helpers de UI (`admin/scripts/ui-helpers.js`)
2. Criação do orquestrador principal (`admin/scripts/admin.js`)
3. Criação do novo HTML limpo (`admin/index.html`)
4. Testes de integração e validação

**⏱️ Tempo estimado total da Parte 2:** 45-60 minutos
