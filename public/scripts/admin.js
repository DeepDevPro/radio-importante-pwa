/**
 * ===== ORQUESTRADOR PRINCIPAL =====
 */

import { checkBackendStatus } from './api.js';
import { loadMusicList } from './music-manager.js';
import { setupUploadHandlers } from './upload.js';

class AdminApp {
    constructor() {
        // Adicione inicialização
    }
    async init() {
        // Adicione lógica de inicialização
    }
}

const adminApp = new AdminApp();

// Inicialização global
window.adminApp = adminApp;
window.adminDebug = {
    checkBackendStatus,
    loadMusicList
};
window.addEventListener('load', async () => {
    await checkBackendStatus();
    setupUploadHandlers();
    loadMusicList();
});
console.log('🎼 Orquestrador principal carregado');

export default adminApp;
