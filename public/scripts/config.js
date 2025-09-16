/**
 * ===== CONFIGURAÇÕES CENTRALIZADAS =====
 */

// Detecção de ambiente
export const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const isHttps = window.location.protocol === 'https:';

// Configurações da API
export const API_CONFIG = {
    backendUrl: isProduction ? 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app' : 'http://localhost:8080',
    productionUrl: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app',
    productionUrlBackup: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app',
    currentBackend: null
};

// Configurações de UI
export const UI_CONFIG = {
    // Tempos de feedback
    feedbackDuration: 3000
};

// Configurações de debug
export const DEBUG_CONFIG = {
    enabled: !isProduction,
    showNetworkCalls: true
};

// Estado global da aplicação
export const APP_STATE = {
    currentTab: 'upload'
};

// Função para obter URL do backend baseado no ambiente
export function getBackendUrl() {
    return API_CONFIG.currentBackend;
}

// Função para validar arquivo de upload
export function validateUploadFile(file) {
    // Adicione validação de arquivo aqui
    return true;
}
