/**
 * ===== CONFIGURAÇÕES CENTRALIZADAS =====
 */

// Detecção de ambiente aprimorada
function detectEnvironment() {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
    }
    
    if (hostname.includes('staging') || hostname.includes('stagin')) {
        return 'staging';
    }
    
    return 'production';
}

export const ENVIRONMENT = detectEnvironment();
export const isProduction = ENVIRONMENT === 'production';
export const isStaging = ENVIRONMENT === 'staging';
export const isDevelopment = ENVIRONMENT === 'development';

// Configurações da API
export const API_CONFIG = {
    backends: {
        local: 'http://localhost:8080',
        staging: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app', // Compartilhado inicialmente
        production: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app'
    },
    backendUrl: ENVIRONMENT === 'development' ? 'http://localhost:8080' : 
                ENVIRONMENT === 'staging' ? 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app' :
                'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app',
    productionUrl: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app',
    productionUrlBackup: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app',
    currentBackend: null,
    environment: ENVIRONMENT
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
