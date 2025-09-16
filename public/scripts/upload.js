/**
 * ===== SISTEMA DE UPLOAD =====
 * Gerencia todo o processo de upload de arquivos
 */

import { API_CONFIG, UI_CONFIG, APP_STATE, validateUploadFile } from './config.js';
import { apiManager } from './api.js';
import { showAlert, formatFileSize, formatDuration } from './ui-helpers.js';

export class UploadManager {
    constructor() {
        this.selectedFiles = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Adicione listeners de DOM
    }

    setupDragAndDrop() {
        // Adicione lógica de drag and drop
    }

    setupFileInput() {
        // Adicione lógica de input de arquivo
    }

    setupClickHandler() {
        // Adicione lógica de clique
    }

    handleFiles(files) {
        // Adicione lógica de processamento
        this.displayFiles();
    }

    async displayFiles() {
        // Adicione lógica de preview
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.displayFiles();
    }

    clearFiles() {
        this.selectedFiles = [];
        this.displayFiles();
    }

    async uploadFiles() {
        // Adicione lógica de upload
    }

    dispatchUploadComplete(result) {
        window.dispatchEvent(new CustomEvent('uploadComplete', { detail: result }));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getSelectedFiles() {
        return this.selectedFiles;
    }

    hasSelectedFiles() {
        return this.selectedFiles.length > 0;
    }
}

export const uploadManager = new UploadManager();
window.uploadManager = uploadManager;

export function removeFile(index) {
    window.selectedFiles.splice(index, 1);
    displayFiles();
}

export function clearFiles() {
    window.selectedFiles = [];
    document.getElementById('file-input').value = '';
    displayFiles();
}

export async function uploadFiles() {
    // ...lógica conforme admin.html...
}

export function calculateAudioDuration(file, index) {
    // ...lógica conforme admin.html...
}

export function setupUploadHandlers() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
}

export function handleFiles(files) {
    window.selectedFiles = Array.from(files).filter(file =>
        file.type.startsWith('audio/') ||
        file.name.toLowerCase().match(/\.(mp3|wav|ogg|aac)$/)
    );
    displayFiles();
}

export function displayFiles() {
    const preview = document.getElementById('file-preview');
    const fileList = document.getElementById('file-list');
    if (!window.selectedFiles || window.selectedFiles.length === 0) {
        preview.style.display = 'none';
        return;
    }
    preview.style.display = 'block';
    fileList.innerHTML = window.selectedFiles.map((file, index) => `
        <div class="file-item" id="file-item-${index}">
            <span class="file-icon">🎵</span>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <button class="btn btn-danger" onclick="removeFile(${index})">🗑️</button>
        </div>
    `).join('');
}

console.log('📤 Sistema de Upload modularizado carregado');
