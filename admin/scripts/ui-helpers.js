/**
 * ===== HELPERS DE INTERFACE =====
 * Funções utilitárias para UI e formatação
 */

import { UI_CONFIG } from './config.js';

export function showAlert(message, type = 'info') {
    // Criar container de notificações se não existir
    let container = document.getElementById('notifications-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notifications-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    }

    // Criar alerta
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.style.cssText = `
        padding: 15px;
        margin-bottom: 10px;
        border-radius: 8px;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
        border-left: 4px solid ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
        animation: slideIn 0.3s ease;
    `;
    alertDiv.textContent = message;

    container.appendChild(alertDiv);

    // Remover após alguns segundos
    setTimeout(() => {
        alertDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 300);
    }, UI_CONFIG.feedbackDuration);
}

export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatDurationLong(seconds) {
    // Adicione lógica de formatação longa
    return '0 segundos';
}

export class TabManager {
    constructor() {
        this.currentTab = 'upload';
        this.setupTabListeners();
    }
    setupTabListeners() {
        // Adicione listeners de tabs
    }
    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.querySelector(`button[onclick="switchTab('${tabName}')"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }
    getCurrentTab() {
        return this.currentTab;
    }
}

export const tabManager = new TabManager();

export const DOMUtils = {
    exists(selector) {
        // Adicione lógica de verificação
        return false;
    },
    waitForElement(selector, timeout = 5000) {
        // Adicione lógica de espera
        return Promise.resolve(null);
    },
    escapeHtml(text) {
        // Adicione lógica de escape
        return text;
    },
    createElement(tag, attributes = {}, content = '') {
        // Adicione lógica de criação
        return null;
    }
};

export const PerformanceUtils = {
    debounce(func, delay) {
        // Adicione lógica de debounce
    },
    throttle(func, delay) {
        // Adicione lógica de throttle
    },
    measureTime(label, func) {
        // Adicione lógica de medição
        return func();
    }
};

export const ValidationUtils = {
    // Adicione utilitários de validação
};

export const StorageUtils = {
    // Adicione utilitários de storage
};

export class NotificationManager {
    constructor() {
        // Adicione lógica de notificações
    }
}

export const notifications = new NotificationManager();

window.showAlert = showAlert;
window.switchTab = (tabName) => tabManager.switchTab(tabName);
window.formatFileSize = formatFileSize;
window.formatDuration = formatDuration;

console.log('🛠️ UI Helpers carregados');
