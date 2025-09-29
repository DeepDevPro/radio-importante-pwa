/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="es2015" />

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
        enableEdit: (trackId: string, field: 'title' | 'artist') => void;
        saveEdit: (trackId: string, field: 'title' | 'artist', value: string) => Promise<void>;
        cancelEdit: (trackId: string, field: 'title' | 'artist') => void;
        handleEditKeydown: (event: any, trackId: string, field: 'title' | 'artist', value: string) => void;
    }
}

// Interface para track
interface Track {
    id: string;
    title: string;
    name?: string; // Campo opcional que pode existir na versão local
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
 * Formatar duração em segundos para formato legível
 */
function formatDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

/**
 * Atualizar totalizador de músicas
 */
/**
 * Atualizar totalizador de músicas
 */
function updateTotals(totalTracks: number, totalDuration: number): void {
    const musicTotals = document.getElementById('music-totals');
    if (musicTotals) {
        const formattedDuration = formatDuration(totalDuration);
        musicTotals.innerHTML = `
            📊 <strong>Total:</strong> ${totalTracks} música(s) • 
            ⏱️ <strong>Duração:</strong> ${formattedDuration}
        `;
    }
}

/**
 * Atualizar apenas os totais sem recarregar a lista inteira
 */
async function updateTotalsOnly(): Promise<void> {
    if (!currentBackend) {
        console.error('❌ Backend não disponível para atualizar totais');
        return;
    }

    try {
        const response = await fetch(`${currentBackend}/api/catalog`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const catalog = await response.json(); 
        const tracks = catalog.tracks || [];
        
        // Atualizar apenas o elemento de totais
        const musicTotals = document.getElementById('music-totals');
        if (musicTotals && tracks.length > 0) {
            const totalTracks = tracks.length;
            const totalDuration = tracks.reduce((sum: number, track: Track) => sum + (track.duration || 0), 0);
            const formattedDuration = formatDuration(totalDuration);
            
            musicTotals.innerHTML = `
                📊 <strong>Total:</strong> ${totalTracks} música(s) • 
                ⏱️ <strong>Duração:</strong> ${formattedDuration}
            `;
        }
    } catch (error) {
        console.error('Erro ao atualizar totais:', error);
        // Não mostrar erro ao usuário para não interromper a edição
    }
}

/**
 * Calcular duração do arquivo de áudio
 */
function calculateAudioDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        
        audio.onloadedmetadata = () => {
            resolve(audio.duration);
            (window as any).URL.revokeObjectURL(audio.src);
        };
        
        audio.onerror = () => {
            reject(new Error('Erro ao carregar áudio para cálculo de duração'));
            (window as any).URL.revokeObjectURL(audio.src);
        };
        
        audio.src = (window as any).URL.createObjectURL(file);
    });
}

/**
 * Calcular duração para um arquivo específico no preview
 */
function calculateDurationForFile(file: File, index: number): void {
    const durationElement = document.getElementById(`duration-${index}`);
    
    calculateAudioDuration(file)
        .then((duration: number) => {
            if (durationElement) {
                if (isFinite(duration) && duration > 0) {
                    durationElement.textContent = `⏱️ ${formatDuration(duration)}`;
                    durationElement.style.color = '#28a745';
                    // Armazenar duração no arquivo para usar no upload
                    (file as any).calculatedDuration = Math.round(duration);
                } else {
                    durationElement.textContent = '⚠️ Duração desconhecida';
                    durationElement.style.color = '#dc3545';
                }
            }
        })
        .catch((error: Error) => {
            console.error(`❌ Erro ao calcular duração de ${file.name}:`, error);
            if (durationElement) {
                durationElement.textContent = '❌ Erro ao ler arquivo';
                durationElement.style.color = '#dc3545';
            }
        });
}

/**
 * Habilitar edição inline de um campo
 */
function enableEdit(trackId: string, field: 'title' | 'artist'): void {
    const trackElement = document.getElementById(`track-${trackId}`);
    const container = trackElement?.querySelector(`.${field}-container`) || 
                     trackElement?.querySelector('.music-title-container');
    
    if (!container) return;
    
    const displayElement = container.querySelector('.display-mode') as any;
    const editElement = container.querySelector('.edit-mode') as any;
    
    if (displayElement && editElement) {
        // Esconder display, mostrar input
        displayElement.style.display = 'none';
        editElement.style.display = 'inline';
        editElement.focus();
        editElement.select();
        
        // Marcar elemento como sendo editado
        trackElement!.classList.add('editing');
    }
}

/**
 * Salvar edição inline
 */
async function saveEdit(trackId: string, field: 'title' | 'artist', value: string): Promise<void> {
    const trackElement = document.getElementById(`track-${trackId}`);
    const container = trackElement?.querySelector(`.${field}-container`) || 
                     trackElement?.querySelector('.music-title-container');
    
    if (!container) return;
    
    const displayElement = container.querySelector('.display-mode') as any;
    const editElement = container.querySelector('.edit-mode') as any;
    
    try {
        // Validações
        if (field === 'title' && !value.trim()) {
            // showAlert('manage-status', 'Título não pode estar vazio', 'error');
            window.alert('Título não pode estar vazio');
            editElement.focus();
            return;
        }

        // Salvar no backend
        if (currentBackend) {
            const response = await fetch(`${currentBackend}/api/tracks/${trackId}/metadata`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    [field]: value
                })
            });

            if (!response.ok) {
                throw new Error(`Erro ao salvar: ${response.statusText}`);
            }
        }

        // Atualizar interface
        displayElement.textContent = value || (field === 'artist' ? 'Artista não definido' : 'Título não definido');

        // Remover marca de edição e alternar visibilidade
        trackElement!.classList.remove('editing');
        displayElement.style.display = 'inline';
        editElement.style.display = 'none';

        // Feedback visual suave sem recarregar a página
        displayElement.style.background = '#d4edda';
        displayElement.style.color = 'white';
        setTimeout(() => {
            displayElement.style.background = '';
            displayElement.style.color = '';
        }, 1500);

        // Atualizar apenas os totais sem recarregar toda a lista
        await updateTotalsOnly();
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        window.alert(`❌ Erro ao salvar: ${errorMessage}`);
        editElement.focus();
    }
}

/**
 * Cancelar edição inline
 */
function cancelEdit(trackId: string, field: 'title' | 'artist'): void {
    const trackElement = document.getElementById(`track-${trackId}`);
    const container = trackElement?.querySelector(`.${field}-container`) || 
                     trackElement?.querySelector('.music-title-container');
    
    if (!container) return;
    
    const displayElement = container.querySelector('.display-mode') as any;
    const editElement = container.querySelector('.edit-mode') as any;
    
    if (displayElement && editElement) {
        // Remover marca de edição
        trackElement!.classList.remove('editing');
        
        // Alternar visibilidade
        displayElement.style.display = 'inline';
        editElement.style.display = 'none';
    }
}

/**
 * Finalizar processo de edição (comum para save e cancel)
 */
function finishEdit(trackElement: Element, displayElement: HTMLElement, editElement: HTMLInputElement): void {
    trackElement.classList.remove('editing');
    displayElement.style.display = 'block';
    editElement.style.display = 'none';
}

/**
 * Lidar com teclas durante edição
 */
function handleEditKeydown(event: any, trackId: string, field: 'title' | 'artist', value: string): void {
    if (event.key === 'Enter') {
        event.preventDefault();
        saveEdit(trackId, field, value);
    } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelEdit(trackId, field);
    }
}

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
    const fileInput = document.getElementById('file-input');
    const fileSelectBtn = document.getElementById('file-select-btn');
    const uploadArea = document.getElementById('upload-area');
    
    // Event listener para o input de arquivos
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
    }
    
    // Event listener para o botão de seleção (sem duplicidade)
    if (fileSelectBtn) {
        fileSelectBtn.addEventListener('click', () => {
            if (fileInput) (fileInput as any).click();
        });
    }
    
    // Upload drag & drop
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => { 
            e.preventDefault(); 
            (uploadArea as any).style.background = '#f0f8ff'; 
        });
        
        uploadArea.addEventListener('dragleave', () => { 
            (uploadArea as any).style.background = ''; 
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            (uploadArea as any).style.background = '';
            const files = (e as any).dataTransfer?.files;
            if (files && fileInput) {
                (fileInput as any).files = files;
                handleFileSelection();
            }
        });
        
        // Clique na área de upload também abre o seletor
        uploadArea.addEventListener('click', (e) => {
            // Evitar trigger duplo se o usuário clicar no botão dentro da área
            if (fileSelectBtn && e.target !== fileSelectBtn && fileInput) {
                (fileInput as any).click();
            }
        });
    }
}

function handleFileSelection() {
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    const filePreview = document.getElementById('file-preview');
    const fileListDiv = document.getElementById('file-list');
    if (!fileInput?.files || fileInput.files.length === 0) return;
    const files = Array.from(fileInput.files);
    if (filePreview) filePreview.style.display = 'block';
    if (fileListDiv) {
        fileListDiv.innerHTML = files.map((file: File, index: number) => `
            <div style="padding:10px;border:1px solid #ddd;border-radius:8px;margin:5px 0;">
                📁 <strong>${file.name}</strong><br>
                📊 Tamanho: ${(file.size / 1024 / 1024).toFixed(2)} MB<br>
                🎵 Tipo: ${file.type || 'Desconhecido'}<br>
                ⏱️ <span id="duration-${index}">🔄 Calculando duração...</span>
            </div>
        `).join('');
        
        // Calcular duração de cada arquivo
        files.forEach((file: File, index: number) => {
            calculateDurationForFile(file, index);
        });
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
        const files = Array.from(fileInput.files) as any[];
        const formData = new window.FormData();
        files.forEach((file: any, index: number) => {
            formData.append('audioFiles', file);
            // Enviar duração calculada junto com o arquivo
            if (file.calculatedDuration) {
                formData.append(`duration_${index}`, file.calculatedDuration.toString());
            }
        });
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
            if (uploadStatus) uploadStatus.innerHTML = `✅ <strong>Upload concluído!</strong><br>📁 Arquivos processados: ${(result.tracks?.length) || files.length}<br>🔄 Gerando arquivo contínuo para iPhone PWA...`;
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
        
        // Calcular totais
        const totalTracks = tracks.length;
        const totalDuration = tracks.reduce((sum: number, track: Track) => sum + (track.duration || 0), 0);
        updateTotals(totalTracks, totalDuration);
        
        musicList.innerHTML = tracks.map((track: Track, index: number) => `
            <div class="music-item" id="track-${track.id}" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px 0; background: #f9f9f9; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                    <div style="background: #667eea; color: white; padding: 8px 12px; border-radius: 50%; font-weight: bold; min-width: 35px; text-align: center;">
                        ${index + 1}
                    </div>
                    <div style="flex: 1; min-width: 250px;">
                        <div class="music-title-container">
                            <div class="music-title display-mode" onclick="enableEdit('${track.id}', 'title')" 
                                 style="font-weight: bold; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 4px; border: 1px solid transparent; transition: all 0.2s ease;"
                                 title="Clique para editar">
                                ${track.title || track.name || 'Título não definido'}
                            </div>
                            <input type="text" class="music-title edit-mode" value="${((track.title || track.name) || '').replace(/"/g, '&quot;')}" 
                                   style="display: none; font-weight: bold; font-size: 18px; width: 100%; min-width: 300px; padding: 4px 8px; border: 2px solid #667eea; border-radius: 4px; outline: none; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);"
                                   onblur="saveEdit('${track.id}', 'title', this.value)" 
                                   onkeydown="handleEditKeydown(event, '${track.id}', 'title', this.value)">
                        </div>
                        <div class="music-meta">
                            <span class="artist-container">
                                <span class="display-mode" onclick="enableEdit('${track.id}', 'artist')" 
                                     style="cursor: pointer; padding: 2px 4px; border-radius: 4px; border: 1px solid transparent; transition: all 0.2s ease;"
                                     title="Clique para editar artista">
                                    ${track.artist || 'Artista não definido'}
                                </span>
                                <input type="text" class="edit-mode" value="${(track.artist || '').replace(/"/g, '&quot;')}" 
                                       style="display: none; min-width: 200px; max-width: 300px; padding: 4px 8px; border: 2px solid #667eea; border-radius: 4px; outline: none; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);"
                                       onblur="saveEdit('${track.id}', 'artist', this.value)" 
                                       onkeydown="handleEditKeydown(event, '${track.id}', 'artist', this.value)">
                            </span>
                            •
                            <span class="duration-display" title="Duração calculada automaticamente">
                                ${formatDuration(track.duration || 0)}
                            </span>
                            • 
                            ${track.filename || 'Arquivo não identificado'}
                        </div>
                        <div style="color: #888; font-size: 12px;">
                            📁 ${track.filename} • 
                            ⏱️ <span class="duration-display">${formatDuration(track.duration || 0)}</span> • 
                            🎼 ${track.format || 'N/A'}
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button onclick="deleteTrack('${track.id}', '${track.filename}')" 
                                style="padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; transition: all 0.2s ease; filter: brightness(1.2);"
                                title="Deletar música">
                            🗑️
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
        window.alert('❌ Erro ao reproduzir áudio. Verifique se o arquivo existe.');
    });
}

/**
 * Deletar track
 */
async function deleteTrack(trackId: string, filename: string) {
    if (!currentBackend) return;
    
    if (!window.confirm(`⚠️ Tem certeza que deseja deletar "${filename}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${currentBackend}/api/delete/${trackId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            window.alert('✅ Música deletada com sucesso!');
            loadMusicList(); // Recarregar lista
        } else {
            const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Erro ao deletar música:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        window.alert(`❌ Erro ao deletar música: ${errorMessage}`);
    }
}

/**
 * Editar track (placeholder)
 */
function editTrack(trackId: string) {
    window.alert(`🚧 Funcionalidade de edição em desenvolvimento.\n\nTrack ID: ${trackId}`);
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
window.enableEdit = enableEdit;
window.saveEdit = saveEdit;
window.cancelEdit = cancelEdit;
window.handleEditKeydown = handleEditKeydown;

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initAdmin); } else { initAdmin(); }

export {};
