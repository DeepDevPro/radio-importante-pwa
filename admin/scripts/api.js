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

    setupInterceptors() {
        // Interceptor global para log de requisições
    }

    async makeRequest(endpoint, options = {}) {
        const url = `${this.getActiveBackendUrl()}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        const response = await fetch(url, finalOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    async checkBackendStatus() {
        const statusDiv = document.getElementById('backend-status');
        try {
            statusDiv.innerHTML = '🔍 Testando conexões...';
            
            // Testar backend local
            const localResult = await this.checkSingleBackend('local');
            
            // Testar backend production se local falhar
            const productionResult = await this.checkSingleBackend('production');
            
            // Determinar qual usar
            if (localResult.status === 'ok') {
                this.config.currentBackend = this.config.backends.local;
                statusDiv.innerHTML = '✅ Backend Local ativo';
            } else if (productionResult.status === 'ok') {
                this.config.currentBackend = this.config.backends.production;
                statusDiv.innerHTML = '✅ Backend Produção ativo';
            } else {
                statusDiv.innerHTML = '❌ Nenhum backend disponível';
            }
        } catch (error) {
            statusDiv.innerHTML = `❌ Erro ao verificar status: ${error.message}`;
        }
    }

    async checkSingleBackend(type) {
        try {
            const url = type === 'local' ? this.config.backends.local : this.config.backends.production;
            const response = await fetch(`${url}/health`, { 
                method: 'GET',
                timeout: 5000 
            });
            
            if (response.ok) {
                const data = await response.json();
                return { status: 'ok', data };
            } else {
                return { status: 'error', error: response.statusText };
            }
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }

    async getCatalog() {
        return await this.makeRequest('/api/catalog');
    }

    async uploadFiles(formData, onProgress = null) {
        const url = `${this.getActiveBackendUrl()}/api/upload`;
        
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            if (onProgress) {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = (event.loaded / event.total) * 100;
                        onProgress(percentComplete);
                    }
                };
            }
            
            xhr.onload = () => {
                if (xhr.status === 200) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error(`Upload failed: ${xhr.statusText}`));
                }
            };
            
            xhr.onerror = () => reject(new Error('Upload failed'));
            
            xhr.open('POST', url);
            xhr.send(formData);
        });
    }

    async updateTrackMetadata(trackId, metadata) {
        return await this.makeRequest(`/api/tracks/${trackId}/metadata`, {
            method: 'PUT',
            body: JSON.stringify(metadata)
        });
    }

    async deleteTrack(trackId) {
        const response = await this.makeRequest(`/api/delete/${trackId}`, {
            method: 'DELETE'
        });
        return response.success;
    }

    async regenerateCatalog() {
        return await this.makeRequest('/api/regenerate-catalog', {
            method: 'POST'
        });
    }

    hasActiveBackend() {
        return this.config.currentBackend !== null;
    }

    getActiveBackendUrl() {
        return this.config.currentBackend;
    }

    getBackendStatus() {
        return apiState.backendStatus;
    }

    isHealthy() {
        // Adicione lógica de verificação de saúde
        return true;
    }
}

// Instância singleton
export const apiManager = new ApiManager();

// Funções de conveniência
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

if (DEBUG_CONFIG.enabled) {
    console.log('🌐 Sistema de API modularizado carregado');
}
