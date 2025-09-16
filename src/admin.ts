/// <reference lib="dom" />

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
        loadMusicList: () => Promise<void>;
        playPreview: (filename: string) => void;
        deleteTrack: (trackId: string, filename: string) => Promise<void>;
        editTrack: (trackId: string) => void;
    }
}

// Interface para track
interface Track {
    id: string;
    title: string;
    artist: string;
    filename: string;
    duration: number;
    format: string;
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
    await checkBackendStatus();
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
    const fileInput = document.getElementById('file-input') as any;
    const uploadArea = document.getElementById('upload-area');
    if (fileInput) fileInput.addEventListener('change', handleFileSelection);
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.background = '#f0f8ff'; });
        uploadArea.addEventListener('dragleave', () => { uploadArea.style.background = ''; });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.background = '';
            const files = e.dataTransfer?.files;
            if (files && fileInput) {
                // Converter FileList para DataTransfer manualmente não é necessário: apenas mostrar preview
                fileInput.files = files as unknown as FileList; // fallback cast
                handleFileSelection();
            }
        });
        uploadArea.addEventListener('click', () => fileInput?.click());
    }
}

function handleFileSelection() {
    const fileInput = document.getElementById('file-input') as any;
    const filePreview = document.getElementById('file-preview');
    const fileListDiv = document.getElementById('file-list');
    if (!fileInput?.files || fileInput.files.length === 0) return;
    const files = Array.from(fileInput.files as any[]);
    if (filePreview) filePreview.style.display = 'block';
    if (fileListDiv) {
        fileListDiv.innerHTML = files.map((file: any) => `
            <div style="padding:10px;border:1px solid #ddd;border-radius:8px;margin:5px 0;">
                📁 <strong>${file.name}</strong><br>
                📊 Tamanho: ${(file.size / 1024 / 1024).toFixed(2)} MB<br>
                🎵 Tipo: ${file.type || 'Desconhecido'}
            </div>
        `).join('');
    }
}

async function uploadFiles() {
    if (!currentBackend) { window.alert('❌ Nenhum backend disponível! Verifique a conexão.'); return; }
    const fileInput = document.getElementById('file-input') as any;
    const uploadStatus = document.getElementById('upload-status');
    const uploadProgress = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const uploadBtn = document.getElementById('upload-btn') as any;
    if (!fileInput?.files || fileInput.files.length === 0) { window.alert('Selecione arquivos primeiro!'); return; }
    if (isUploading) { window.alert('Upload já em andamento!'); return; }
    isUploading = true; if (uploadBtn) uploadBtn.disabled = true;
    try {
        if (uploadStatus) uploadStatus.innerHTML = '📤 Iniciando upload...';
        if (uploadProgress) uploadProgress.style.display = 'block';
        const files = Array.from(fileInput.files as any[]);
        const formData = new window.FormData();
        files.forEach((file: any) => formData.append('audioFiles', file)); // campo correto
        let progress = 0;
        const interval = setInterval(() => {
            progress = Math.min(progress + 10, 90);
            if (progressFill) { progressFill.style.width = progress + '%'; progressFill.textContent = progress + '%'; }
            if (progress >= 90) clearInterval(interval);
        }, 200);
        const response = await fetch(`${currentBackend}/api/upload`, { method: 'POST', body: formData });
        clearInterval(interval);
        if (progressFill) { progressFill.style.width = '100%'; progressFill.textContent = '100%'; }
        let result: any = {}; // resposta pode variar
        try { result = await response.json(); } catch (e) { console.warn('Resposta não JSON', e); }
        if (response.ok && result.success) {
            if (uploadStatus) uploadStatus.innerHTML = `✅ <strong>Upload concluído!</strong><br>📁 Arquivos processados: ${(result.tracks?.length) || files.length}`;
            clearFiles();
        } else {
            const msg = result.message || result.error || `HTTP ${response.status}`;
            console.error('Detalhe do erro upload:', result);
            throw new Error(msg);
        }
    } catch (err) {
        console.error('Erro no upload:', err);
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        if (uploadStatus) uploadStatus.innerHTML = `❌ <strong>Erro no upload:</strong> ${msg}`;
    } finally {
        isUploading = false; if (uploadBtn) uploadBtn.disabled = false;
        setTimeout(() => { if (uploadProgress) uploadProgress.style.display = 'none'; }, 3000);
    }
}

function clearFiles() {
    const fileInput = document.getElementById('file-input') as any;
    const filePreview = document.getElementById('file-preview');
    if (fileInput) fileInput.value = '';
    if (filePreview) filePreview.style.display = 'none';
}

/**
 * Carrega e exibe a lista de músicas
 */
async function loadMusicList() {
    if (!currentBackend) {
        console.error('❌ Backend não disponível para carregar lista de músicas');
        return;
    }

    const musicList = document.getElementById('music-list');
    const musicTotals = document.getElementById('music-totals');
    
    if (!musicList) return;

    try {
        musicList.innerHTML = '🔄 Carregando músicas...';
        
        const response = await fetch(`${currentBackend}/api/catalog`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const catalog = await response.json();
        const tracks = catalog.tracks || [];
        
        if (musicTotals) {
            musicTotals.innerHTML = `
                📊 <strong>Total:</strong> ${tracks.length} música(s) • 
                ⏱️ <strong>Duração:</strong> ${Math.round(catalog.metadata?.totalDuration || 0)}s
            `;
        }
        
        if (tracks.length === 0) {
            musicList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    🎵 <strong>Nenhuma música encontrada</strong><br>
                    <span style="font-size: 14px;">Faça upload de arquivos na aba "Upload"</span>
                </div>
            `;
            return;
        }
        
        musicList.innerHTML = tracks.map((track: Track) => `
            <div class="music-item" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px 0; background: #f9f9f9;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="flex: 1; min-width: 250px;">
                        <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">
                            🎵 ${track.title || 'Título não definido'}
                        </div>
                        <div style="color: #666; font-size: 14px; margin-bottom: 5px;">
                            👤 ${track.artist || 'Artista não definido'}
                        </div>
                        <div style="color: #888; font-size: 12px;">
                            📁 ${track.filename} • 
                            ⏱️ ${track.duration || 0}s • 
                            🎼 ${track.format || 'N/A'}
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button onclick="playPreview('${track.filename}')" 
                                style="padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            ▶️ Preview
                        </button>
                        <button onclick="editTrack('${track.id}')" 
                                style="padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            ✏️ Editar
                        </button>
                        <button onclick="deleteTrack('${track.id}', '${track.filename}')" 
                                style="padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            🗑️ Deletar
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar lista de músicas:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        if (musicList) {
            musicList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545;">
                    ❌ <strong>Erro ao carregar músicas:</strong> ${errorMessage}<br>
                    <button onclick="loadMusicList()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        🔄 Tentar Novamente
                    </button>
                </div>
            `;
        }
    }
}

/**
 * Preview de áudio
 */
function playPreview(filename: string) {
    if (!currentBackend) return;
    
    const audioUrl = `${currentBackend}/audio/${encodeURIComponent(filename)}`;
    
    // Remove preview anterior se existir
    const existingAudio = document.getElementById('preview-audio') as HTMLAudioElement;
    if (existingAudio) {
        existingAudio.pause();
        existingAudio.remove();
    }
    
    // Cria novo elemento de áudio
    const audio = document.createElement('audio');
    audio.id = 'preview-audio';
    audio.controls = true;
    audio.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; background: white; border: 2px solid #007bff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);';
    audio.src = audioUrl;
    
    document.body.appendChild(audio);
    
    // Auto-remove após 30 segundos
    setTimeout(() => {
        if (audio.parentNode) {
            audio.remove();
        }
    }, 30000);
    
    audio.play().catch(err => {
        console.error('Erro ao reproduzir preview:', err);
        alert('❌ Erro ao reproduzir áudio. Verifique se o arquivo existe.');
    });
}

/**
 * Deletar track
 */
async function deleteTrack(trackId: string, filename: string) {
    if (!currentBackend) return;
    
    if (!confirm(`⚠️ Tem certeza que deseja deletar "${filename}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${currentBackend}/api/delete/${trackId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✅ Música deletada com sucesso!');
            loadMusicList(); // Recarregar lista
        } else {
            const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Erro ao deletar música:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        alert(`❌ Erro ao deletar música: ${errorMessage}`);
    }
}

/**
 * Editar track (placeholder)
 */
function editTrack(trackId: string) {
    alert(`🚧 Funcionalidade de edição em desenvolvimento.\n\nTrack ID: ${trackId}`);
}

/**
 * Funções globais para o HTML
 */
window.switchTab = function(tabName: string) {
    // Remove active de todas as tabs
    document.querySelectorAll('.tab').forEach(tab => { tab.classList.remove('active'); tab.setAttribute('aria-selected', 'false'); });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    // Ativa a tab selecionada
    const activeTab = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    const activeContent = document.getElementById(`${tabName}-tab`);
    if (activeTab && activeContent) { 
        activeTab.classList.add('active'); 
        activeTab.setAttribute('aria-selected', 'true'); 
        activeContent.classList.add('active');
        
        // Se mudou para a tab de gerenciar, carrega lista de músicas
        if (tabName === 'manage') {
            loadMusicList();
        }
    }
};

window.uploadFiles = uploadFiles;
window.clearFiles = clearFiles;
window.loadMusicList = loadMusicList;
window.playPreview = playPreview;
window.deleteTrack = deleteTrack;
window.editTrack = editTrack;

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initAdmin); } else { initAdmin(); }

export {};
