// src/config/api.ts - Configuração das URLs da API

export interface ApiConfig {
  baseUrl: string;
  endpoints: {
    health: string;
    catalog: string;
    upload: string;
  };
}

// Detectar ambiente: staging ou produção
function detectEnvironment(): 'staging' | 'production' {
  const hostname = window.location.hostname;
  
  if (hostname.includes('staging') || hostname.includes('stagin')) {
    return 'staging';
  }
  
  return 'production';
}

const environment = detectEnvironment();

// URLs da API por ambiente - ENV com fallback
export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }
  
  // Fallback para compatibilidade
  const BACKEND_URLS = {
    staging: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app',
    production: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app'
  };
  return BACKEND_URLS[environment];
};

const API_CONFIG: ApiConfig = {
  baseUrl: getApiBaseUrl(),
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
    isProduction: environment === 'production'
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
