/**
 * ===== ORQUESTRADOR PRINCIPAL =====
 */

import { checkBackendStatus } from './api.js';
import { loadMusicList, handleEditKeydown, cancelEdit, saveEdit, editMetadata, deleteTrack } from './music-manager.js';
import { setupUploadHandlers } from './upload.js';

class AdminApp {
    constructor() {
        // Inicialização
    }
    async init() {
        await checkBackendStatus();
        setupUploadHandlers();
        loadMusicList();
    }
}

const adminApp = new AdminApp();

// Expor funções globalmente para uso no HTML
window.adminApp = adminApp;
window.loadMusicList = loadMusicList;
window.handleEditKeydown = handleEditKeydown;
window.cancelEdit = cancelEdit;
window.saveEdit = saveEdit;
window.editMetadata = editMetadata;
window.deleteTrack = deleteTrack;
window.enableEdit = (trackId, field) => {
    const span = document.getElementById(`${field}-${trackId}`);
    const input = document.getElementById(`${field}-input-${trackId}`);
    
    if (span && input) {
        span.style.display = 'none';
        input.style.display = 'inline-block';
        input.focus();
        input.select();
    }
};

window.adminDebug = {
    checkBackendStatus,
    loadMusicList
};

window.addEventListener('load', async () => {
    await adminApp.init();
});

console.log('🎼 Orquestrador principal carregado');

export default adminApp;
