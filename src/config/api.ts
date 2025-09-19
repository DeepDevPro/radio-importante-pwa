// src/config/api.ts - Configuração das URLs da API

export interface ApiConfig {
  baseUrl: string;
  endpoints: {
    health: string;
    catalog: string;
    upload: string;
  };
}

// Detectar ambiente: desenvolvimento, staging ou produção
function detectEnvironment(): 'development' | 'staging' | 'production' {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  
  if (hostname.includes('staging') || hostname.includes('stagin')) {
    return 'staging';
  }
  
  return 'production';
}

const environment = detectEnvironment();

// URLs da API por ambiente
const BACKEND_URLS = {
  development: 'http://localhost:8080',
  staging: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app', // Compartilhado inicialmente
  production: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app'
};

const API_CONFIG: ApiConfig = {
  baseUrl: BACKEND_URLS[environment],
  endpoints: {
    health: '/health',
    catalog: '/api/catalog',
    upload: '/api/upload'
  }
};

export { API_CONFIG };

// Helper functions
export function getApiUrl(endpoint: keyof ApiConfig['endpoints']): string {
  return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints[endpoint]}`;
}

export function getEnvironmentInfo() {
  return {
    environment,
    backendUrl: API_CONFIG.baseUrl,
    isStaging: environment === 'staging',
    isProduction: environment === 'production',
    isDevelopment: environment === 'development'
  };
}

export function isApiAvailable(): Promise<boolean> {
  return fetch(getApiUrl('health'))
    .then(response => response.ok)
    .catch(() => false);
}

export function getDataUrl(fileName: string): string {
  // Por enquanto, mantém os dados locais como fallback
  // Futuramente pode ser migrado para API
  return `/data/${fileName}`;
}
