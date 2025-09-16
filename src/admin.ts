/**
 * Admin Panel para Radio Importante PWA
 * Sistema de upload e gerenciamento de músicas
 */

// Tipos globais necessários
declare global {
    interface Window {
        switchTab: (tabName: string) => void;
        uploadFiles: () => Promise<void>;
        clearFiles: () => void;
    }
}

// Configuração do backend
const BACKEND_CONFIG = {
    production: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app',
    local: 'http://localhost:8080'
};

// Estado global do admin
let currentBackend: string | null = null;
let isUploading = false;

/**
 * Inicializa o painel admin
 */
async function initAdmin() {
    console.log('🎵 Admin Panel iniciando...');
    
    // Verifica status dos backends
    await checkBackendStatus();
    
    // Configura event listeners
    setupEventListeners();
    
    console.log('✅ Admin Panel iniciado!');
}

/**
 * Verifica o status dos backends disponíveis
 */
async function checkBackendStatus() {
    const statusDiv = document.getElementById('backend-status');
    if (!statusDiv) {
        console.error('❌ Elemento backend-status não encontrado!');
        return;
    }
    
    try {
        statusDiv.innerHTML = '🔍 Testando conexões...';
        
        // Testa backend de produção primeiro
        const productionStatus = await testBackend(BACKEND_CONFIG.production, 'Produção (DigitalOcean)');
        
        if (productionStatus.success) {
            currentBackend = BACKEND_CONFIG.production;
            statusDiv.innerHTML = `
                ✅ <strong>Backend Ativo:</strong> ${productionStatus.name}<br>
                🌐 <strong>URL:</strong> ${BACKEND_CONFIG.production}<br>
                ⏱️ <strong>Response Time:</strong> ${productionStatus.responseTime}ms<br>
                💚 <strong>Status:</strong> ${productionStatus.data?.status || 'Healthy'}
            `;
        } else {
            // Se produção falhar, tenta local
            const localStatus = await testBackend(BACKEND_CONFIG.local, 'Local (Development)');
            
            if (localStatus.success) {
                currentBackend = BACKEND_CONFIG.local;
                statusDiv.innerHTML = `
                    ✅ <strong>Backend Ativo:</strong> ${localStatus.name}<br>
                    🌐 <strong>URL:</strong> ${BACKEND_CONFIG.local}<br>
                    ⏱️ <strong>Response Time:</strong> ${localStatus.responseTime}ms<br>
                    💚 <strong>Status:</strong> ${localStatus.data?.status || 'Healthy'}
                `;
            } else {
                currentBackend = null;
                statusDiv.innerHTML = `
                    ❌ <strong>Nenhum backend disponível!</strong><br>
                    🚫 Produção: ${productionStatus.error}<br>
                    🚫 Local: ${localStatus.error}
                `;
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        statusDiv.innerHTML = `❌ Erro ao verificar status: ${errorMessage}`;
        console.error('Erro no checkBackendStatus:', error);
    }
}

/**
 * Testa um backend específico
 */
async function testBackend(url: string, name: string) {
    const startTime = Date.now();
    try {
        const response = await fetch(`${url}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
            const data = await response.json();
            return {
                success: true,
                name,
                responseTime,
                data
            };
        } else {
            return {
                success: false,
                name,
                error: `HTTP ${response.status}`
            };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro de conexão';
        return {
            success: false,
            name,
            error: errorMessage
        };
    }
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
    // Upload de arquivos
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    const uploadArea = document.getElementById('upload-area');
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
    }
    
    if (uploadArea) {
        // Drag & Drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.background = '#f0f8ff';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.background = '';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.background = '';
            
            const files = e.dataTransfer?.files;
            if (files && fileInput) {
                fileInput.files = files;
                handleFileSelection();
            }
        });
        
        // Click para selecionar
        uploadArea.addEventListener('click', () => {
            fileInput?.click();
        });
    }
}

/**
 * Manipula seleção de arquivos
 */
function handleFileSelection() {
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    const filePreview = document.getElementById('file-preview');
    const fileList = document.getElementById('file-list');
    
    if (!fileInput?.files?.length) return;
    
    const files = Array.from(fileInput.files);
    
    if (filePreview) filePreview.style.display = 'block';
    
    if (fileList) {
        fileList.innerHTML = files.map(file => `
            <div style="padding: 10px; border: 1px solid #ddd; border-radius: 8px; margin: 5px 0;">
                📁 <strong>${file.name}</strong><br>
                📊 Tamanho: ${(file.size / 1024 / 1024).toFixed(2)} MB<br>
                🎵 Tipo: ${file.type || 'Desconhecido'}
            </div>
        `).join('');
    }
}

/**
 * Faz upload dos arquivos selecionados
 */
async function uploadFiles() {
    if (!currentBackend) {
        window.alert('❌ Nenhum backend disponível! Verifique a conexão.');
        return;
    }
    
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    const uploadStatus = document.getElementById('upload-status');
    const uploadProgress = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const uploadBtn = document.getElementById('upload-btn') as HTMLButtonElement | null;
    
    if (!fileInput?.files?.length) {
        window.alert('Selecione arquivos primeiro!');
        return;
    }
    
    if (isUploading) {
        window.alert('Upload já em andamento!');
        return;
    }
    
    isUploading = true;
    if (uploadBtn) uploadBtn.disabled = true;
    
    try {
        if (uploadStatus) uploadStatus.innerHTML = '📤 Iniciando upload...';
        if (uploadProgress) uploadProgress.style.display = 'block';
        
        const files = Array.from(fileInput.files);
        const formData = new window.FormData();
        
        files.forEach(file => {
            formData.append('audio', file);
        });
        
        // Simula progresso
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            if (progressFill) {
                progressFill.style.width = `${progress}%`;
                progressFill.textContent = `${progress}%`;
            }
            
            if (progress >= 90) {
                clearInterval(progressInterval);
            }
        }, 200);
        
        const response = await fetch(`${currentBackend}/api/upload`, {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        
        if (progressFill) {
            progressFill.style.width = '100%';
            progressFill.textContent = '100%';
        }
        
        const result = await response.json();
        
        if (response.ok) {
            if (uploadStatus) {
                uploadStatus.innerHTML = `
                    ✅ <strong>Upload concluído com sucesso!</strong><br>
                    📁 Arquivos processados: ${result.files?.length || files.length}<br>
                    🎵 Catálogo atualizado automaticamente
                `;
            }
            
            // Limpa seleção
            clearFiles();
        } else {
            throw new Error(result.error || 'Erro no upload');
        }
        
    } catch (error) {
        console.error('Erro no upload:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        if (uploadStatus) {
            uploadStatus.innerHTML = `❌ <strong>Erro no upload:</strong> ${errorMessage}`;
        }
    } finally {
        isUploading = false;
        if (uploadBtn) uploadBtn.disabled = false;
        
        // Esconde progress bar após 3 segundos
        setTimeout(() => {
            if (uploadProgress) uploadProgress.style.display = 'none';
        }, 3000);
    }
}

/**
 * Limpa arquivos selecionados
 */
function clearFiles() {
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    const filePreview = document.getElementById('file-preview');
    
    if (fileInput) fileInput.value = '';
    if (filePreview) filePreview.style.display = 'none';
}

/**
 * Funções globais para o HTML
 */
window.switchTab = function(tabName: string) {
    // Remove active de todas as tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Ativa a tab selecionada
    const activeTab = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    const activeContent = document.getElementById(`${tabName}-tab`);
    
    if (activeTab && activeContent) {
        activeTab.classList.add('active');
        activeTab.setAttribute('aria-selected', 'true');
        activeContent.classList.add('active');
    }
};

window.uploadFiles = uploadFiles;
window.clearFiles = clearFiles;

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
} else {
    initAdmin();
}

export {};
