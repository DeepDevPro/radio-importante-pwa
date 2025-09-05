// src/config/api.ts - Configuração das URLs da API

export interface ApiConfig {
  baseUrl: string;
  endpoints: {
    health: string;
    catalog: string;
    upload: string;
  };
}

// Detectar se estamos em produção (PWA instalado) ou desenvolvimento
const isProduction = window.location.hostname !== 'localhost' && 
                    window.location.hostname !== '127.0.0.1';

// URLs da API
const API_CONFIG: ApiConfig = {
  baseUrl: isProduction 
    ? 'http://radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com'
    : 'http://localhost:8080', // Backend local na porta 8080
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
