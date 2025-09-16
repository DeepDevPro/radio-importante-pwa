/**
 * ===== GERENCIADOR DE MÚSICAS =====
 * Gerencia biblioteca, edição e operações em lote
 */

import { API_CONFIG, UI_CONFIG, APP_STATE } from './config.js';
import { apiManager } from './api.js';
import { showAlert, formatDuration } from './ui-helpers.js';

export class MusicManager {
    constructor() {
        this.musicLibrary = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listeners serão configurados quando a lista for renderizada
    }

    async loadMusicList() {
        try {
            const response = await apiManager.getCatalog();
            this.musicLibrary = response.tracks || [];
            this.renderMusicList(this.musicLibrary);
            this.renderTotals(this.musicLibrary);
            return this.musicLibrary;
        } catch (error) {
            console.error('Erro ao carregar lista de músicas:', error);
            showAlert('Erro ao carregar músicas: ' + error.message, 'error');
            return [];
        }
    }

    renderMusicList(tracks) {
        const listContainer = document.getElementById('music-list');
        if (!listContainer) return;

        if (!tracks || tracks.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">📭 Nenhuma música encontrada</div>';
            return;
        }

        listContainer.innerHTML = tracks.map((track, index) => this.renderTrackItem(track, index)).join('');
    }

    renderTrackItem(track, index) {
        return `
            <div class="music-item" data-track-id="${track.id}">
                <div class="track-number">${index + 1}</div>
                <div class="track-info">
                    <div class="track-title-container">
                        <span class="track-title" id="title-${track.id}" onclick="enableEdit('${track.id}', 'title')">${track.title || 'Título não definido'}</span>
                        <input type="text" class="edit-input" id="title-input-${track.id}" style="display: none;" 
                               value="${track.title || ''}" 
                               onblur="cancelEdit('${track.id}', 'title')"
                               onkeydown="handleEditKeydown(event, '${track.id}', 'title', this.value)">
                    </div>
                    <div class="track-artist-container">
                        <span class="track-artist" id="artist-${track.id}" onclick="enableEdit('${track.id}', 'artist')">${track.artist || 'Artista não definido'}</span>
                        <input type="text" class="edit-input" id="artist-input-${track.id}" style="display: none;" 
                               value="${track.artist || ''}" 
                               onblur="cancelEdit('${track.id}', 'artist')"
                               onkeydown="handleEditKeydown(event, '${track.id}', 'artist', this.value)">
                    </div>
                    <div class="track-meta">
                        <span class="filename">📁 ${track.filename}</span>
                        <span class="duration">${formatDuration(track.duration || 0)}</span>
                    </div>
                </div>
                <div class="track-actions">
                    <button class="btn-small" onclick="editMetadata('${track.id}')" title="Editar metadados">✏️</button>
                    <button class="btn-small btn-danger" onclick="deleteTrack('${track.id}')" title="Excluir música">🗑️</button>
                </div>
            </div>
        `;
    }

    renderTotals(tracks) {
        const totalTracks = tracks.length;
        const totalDuration = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
        
        const totalsContainer = document.getElementById('manage-status');
        if (totalsContainer) {
            totalsContainer.innerHTML = `
                <div class="totals-info">
                    📊 Total: ${totalTracks} músicas • ⏱️ ${formatDuration(totalDuration)}
                </div>
            `;
        }
    }

    setupBulkActions(show) {
        // Lógica de ações em lote será implementada depois se necessário
    }

    enableEdit(trackId, field) {
        const span = document.getElementById(`${field}-${trackId}`);
        const input = document.getElementById(`${field}-input-${trackId}`);
        
        if (span && input) {
            span.style.display = 'none';
            input.style.display = 'inline-block';
            input.focus();
            input.select();
        }
    }
}

export const musicManager = new MusicManager();
window.musicManager = musicManager;

export function handleEditKeydown(event, trackId, field, value) {
    if (event.key === 'Enter') {
        event.preventDefault();
        saveEdit(trackId, field, value);
    } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelEdit(trackId, field);
    }
}

export function cancelEdit(trackId, field) {
    const span = document.getElementById(`${field}-${trackId}`);
    const input = document.getElementById(`${field}-input-${trackId}`);
    
    if (span && input) {
        span.style.display = 'inline';
        input.style.display = 'none';
        // Restaurar valor original
        const originalValue = span.textContent;
        input.value = originalValue;
    }
}

export async function saveEdit(trackId, field, value) {
    try {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
            showAlert('O campo não pode estar vazio!', 'error');
            return;
        }

        // Fazer chamada para API
        const metadata = {};
        metadata[field] = trimmedValue;
        
        const result = await apiManager.updateTrackMetadata(trackId, metadata);
        
        if (result.success) {
            // Atualizar UI
            const span = document.getElementById(`${field}-${trackId}`);
            const input = document.getElementById(`${field}-input-${trackId}`);
            
            if (span && input) {
                span.textContent = trimmedValue;
                span.style.display = 'inline';
                input.style.display = 'none';
            }
            
            // Atualizar cache local
            const track = musicManager.musicLibrary.find(t => t.id === trackId);
            if (track) {
                track[field] = trimmedValue;
            }
            
            showAlert(`${field === 'title' ? 'Título' : 'Artista'} atualizado com sucesso!`, 'success');
        } else {
            throw new Error(result.message || 'Erro ao salvar');
        }
    } catch (error) {
        console.error('Erro ao salvar edição:', error);
        showAlert('Erro ao salvar: ' + error.message, 'error');
        cancelEdit(trackId, field);
    }
}

export function editMetadata(trackId) {
    showAlert('Clique diretamente no título ou artista para editar inline!', 'info');
}

export async function loadMusicList() {
    return await musicManager.loadMusicList();
}

export async function deleteTrack(trackId) {
    if (!confirm('Tem certeza que deseja excluir esta música?')) {
        return;
    }
    
    try {
        const result = await apiManager.deleteTrack(trackId);
        if (result) {
            // Remover da UI e cache local
            musicManager.musicLibrary = musicManager.musicLibrary.filter(t => t.id !== trackId);
            musicManager.renderMusicList(musicManager.musicLibrary);
            musicManager.renderTotals(musicManager.musicLibrary);
            showAlert('Música excluída com sucesso!', 'success');
        }
    } catch (error) {
        console.error('Erro ao excluir música:', error);
        showAlert('Erro ao excluir música: ' + error.message, 'error');
    }
}

export async function regenerateCatalog() {
    // ...lógica conforme admin.html...
}

export function setupBulkSelection() {
    // ...lógica conforme admin.html...
}

export function toggleSelectAll() {
    // ...lógica conforme admin.html...
}

export function updateSelectedCount() {
    // ...lógica conforme admin.html...
}

export async function deleteSelectedTracks() {
    // ...lógica conforme admin.html...
}

console.log('🎵 Gerenciador de Músicas modularizado carregado');
