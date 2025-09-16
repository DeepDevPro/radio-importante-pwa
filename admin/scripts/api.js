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
        // Adicione lógica de requisição aqui
    }

    async checkBackendStatus() {
        const statusDiv = document.getElementById('backend-status');
        try {
            statusDiv.innerHTML = '🔍 Testando conexões...';
            // ...lógica de verificação de backends conforme admin.html...
        } catch (error) {
            statusDiv.innerHTML = `❌ Erro ao verificar status: ${error.message}`;
        }
    }

    async checkSingleBackend(type) {
        // Adicione lógica de verificação individual
        return {};
    }

    async getCatalog() {
        // Adicione lógica para buscar catálogo
        return [];
    }

    async uploadFiles(formData, onProgress = null) {
        // Adicione lógica de upload
        return {};
    }

    async updateTrackMetadata(trackId, metadata) {
        // Adicione lógica de atualização
        return {};
    }

    async deleteTrack(trackId) {
        // Adicione lógica de exclusão
        return true;
    }

    async regenerateCatalog() {
        // Adicione lógica de regeneração
        return {};
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
