# 🔧 CONFIGURAÇÕES E TEMPLATES PARA STAGING

> **Complemento:** PLANO_COMPLETO_STAGING_IMPLEMENTATION.md  
> **Objetivo:** Templates prontos para uso na implementação  

---

## 📁 **TEMPLATE: deploy-staging.yml**

```yaml
name: Deploy to Staging

on:
  push:
    branches: [ "staging" ]
    paths:
      - "src/**"
      - "public/**"
      - "index.html" 
      - "admin.html"
      - "admin-*.html"
      - "vite.config.ts"
      - "package.json"
      - "package-lock.json"
      - "styles/**"
      - "scripts/**"
  workflow_dispatch:

concurrency:
  group: deploy-staging-${{ github.ref }}
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Deploy to Digital Ocean Staging
        uses: digitalocean/app_action@v1.1.5
        with:
          app_name: radio-importante-frontend-staging
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
          
      - name: Notify Staging Deploy
        run: |
          echo "🚧 Staging deploy completed!"
          echo "URL: https://radio-importante-frontend-staging-[HASH].ondigitalocean.app"
```

---

## 🎨 **TEMPLATE: Staging Visual Indicators**

### **Banner de Staging (CSS)**
```css
/* Adicionar ao style.css principal */
.staging-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(45deg, #ff6b35, #f7931e);
  color: white;
  text-align: center;
  padding: 8px;
  font-weight: bold;
  font-size: 14px;
  z-index: 9999;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  animation: stagingPulse 2s infinite;
}

@keyframes stagingPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

/* Ajustar body para compensar banner */
body.staging {
  padding-top: 40px;
}

.staging-indicator {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #ff6b35;
  color: white;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  z-index: 9998;
}
```

### **JavaScript para Detecção de Staging**
```javascript
// Adicionar ao app.ts ou script principal
function setupStagingIndicators() {
  const isStaging = window.location.hostname.includes('staging') || 
                   window.location.hostname.includes('ondigitalocean.app');
  
  if (isStaging) {
    // Modificar title
    document.title = `[STAGING] ${document.title}`;
    
    // Adicionar classe ao body
    document.body.classList.add('staging');
    
    // Criar banner
    const banner = document.createElement('div');
    banner.className = 'staging-banner';
    banner.innerHTML = '🚧 AMBIENTE DE STAGING - NÃO É PRODUÇÃO 🚧';
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Criar indicador lateral
    const indicator = document.createElement('div');
    indicator.className = 'staging-indicator';
    indicator.innerHTML = 'STAGING';
    document.body.appendChild(indicator);
    
    // Log console
    console.log('%c🚧 STAGING ENVIRONMENT 🚧', 'color: #ff6b35; font-size: 16px; font-weight: bold;');
  }
}

// Executar na inicialização
setupStagingIndicators();
```

---

## ⚙️ **TEMPLATE: API Configuration**

### **src/config/api.ts - Versão Staging**
```typescript
// src/config/api.ts - Enhanced for staging support

export interface ApiConfig {
  baseUrl: string;
  environment: 'development' | 'staging' | 'production';
  endpoints: {
    health: string;
    catalog: string;
    upload: string;
  };
}

// Environment detection
function detectEnvironment(): 'development' | 'staging' | 'production' {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  
  if (hostname.includes('staging') || hostname.includes('ondigitalocean.app')) {
    return 'staging';
  }
  
  return 'production';
}

// Backend URLs por ambiente
const BACKEND_URLS = {
  development: 'http://localhost:8080',
  staging: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app', // Compartilhado por ora
  production: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app'
};

const environment = detectEnvironment();

// API Configuration
const API_CONFIG: ApiConfig = {
  baseUrl: BACKEND_URLS[environment],
  environment,
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

export function getEnvironmentInfo() {
  return {
    environment: API_CONFIG.environment,
    backendUrl: API_CONFIG.baseUrl,
    isStaging: API_CONFIG.environment === 'staging',
    isProduction: API_CONFIG.environment === 'production'
  };
}

// Debug info (só em dev/staging)
if (API_CONFIG.environment !== 'production') {
  console.log('🔧 API Configuration:', API_CONFIG);
  console.log('🌍 Environment:', getEnvironmentInfo());
}
```

### **admin/scripts/config.js - Versão Staging**
```javascript
/**
 * ===== CONFIGURAÇÕES ADMIN - STAGING SUPPORT =====
 */

// Environment detection
export const ENVIRONMENT = detectEnvironment();
export const isProduction = ENVIRONMENT === 'production';
export const isStaging = ENVIRONMENT === 'staging';
export const isDevelopment = ENVIRONMENT === 'development';

function detectEnvironment() {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  
  if (hostname.includes('staging') || hostname.includes('ondigitalocean.app')) {
    return 'staging';
  }
  
  return 'production';
}

// Backend URLs por ambiente
const BACKEND_URLS = {
  development: 'http://localhost:8080',
  staging: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app',
  production: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app'
};

// Configurações da API
export const API_CONFIG = {
  backends: BACKEND_URLS,
  backendUrl: BACKEND_URLS[ENVIRONMENT],
  currentBackend: BACKEND_URLS[ENVIRONMENT],
  environment: ENVIRONMENT,
  
  // Upload settings
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedExtensions: ['.mp3', '.wav', '.ogg', '.aac', '.m4a'],
    maxFiles: 10
  },
  
  // Endpoints da API
  endpoints: {
    health: '/health',
    catalog: '/api/catalog',
    upload: '/api/upload',
    delete: '/api/delete',
    updateMetadata: '/api/tracks',
    regenerateCatalog: '/api/regenerate-catalog'
  }
};

// Configurações de UI
export const UI_CONFIG = {
  feedbackDuration: isStaging ? 5000 : 3000, // Mais tempo em staging para debug
  animations: {
    fadeIn: 300,
    slideUp: 250,
    bounce: 200
  },
  
  // Staging-specific UI
  showEnvironmentInfo: !isProduction,
  debugMode: isDevelopment || isStaging
};

// Configurações de debug
export const DEBUG_CONFIG = {
  enabled: !isProduction,
  showNetworkCalls: !isProduction,
  showEnvironmentInfo: !isProduction,
  verboseLogging: isStaging
};

// Estado global da aplicação
export const APP_STATE = {
  currentTab: 'upload',
  selectedFiles: [],
  musicLibrary: [],
  backendStatus: {
    [ENVIRONMENT]: 'unknown'
  },
  ui: {
    loading: false,
    selectedTracks: new Set()
  }
};

// Environment info display
if (DEBUG_CONFIG.enabled) {
  console.log(`🔧 Admin Environment: ${ENVIRONMENT}`);
  console.log(`🔗 Backend URL: ${API_CONFIG.backendUrl}`);
  
  if (isStaging) {
    console.log('%c🚧 STAGING MODE ACTIVE 🚧', 'color: #ff6b35; font-size: 14px; font-weight: bold;');
  }
}

// Função para obter URL do backend baseado no ambiente
export function getBackendUrl() {
  return API_CONFIG.backendUrl;
}

// Função para validar arquivo de upload
export function validateUploadFile(file) {
  const maxSize = API_CONFIG.upload.maxFileSize;
  const allowedExts = API_CONFIG.upload.allowedExtensions;
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  
  if (file.size > maxSize) {
    throw new Error(`Arquivo muito grande. Máximo: ${maxSize / 1024 / 1024}MB`);
  }
  
  if (!allowedExts.includes(ext)) {
    throw new Error(`Formato não suportado. Permitidos: ${allowedExts.join(', ')}`);
  }
  
  return true;
}

// Função para switch de backend (para testes)
export function switchBackend(environment) {
  if (BACKEND_URLS[environment]) {
    API_CONFIG.currentBackend = BACKEND_URLS[environment];
    console.log(`🔄 Backend switched to: ${environment} (${API_CONFIG.currentBackend})`);
  }
}
```

---

## 🔄 **TEMPLATE: Branch Management Scripts**

### **Script: switch-to-staging.sh**
```bash
#!/bin/bash
# Facilita switch para desenvolvimento staging

echo "🚧 Switching to staging environment..."

# Verificar se branch staging existe
if git show-ref --verify --quiet refs/heads/staging; then
  echo "✅ Branch staging exists"
else
  echo "🔄 Creating staging branch from main..."
  git checkout main
  git pull origin main
  git checkout -b staging
  git push -u origin staging
fi

# Switch para staging
git checkout staging
git pull origin staging

echo "✅ Now on staging branch"
echo "🔗 Develop here and push to auto-deploy to staging environment"
echo ""
echo "Commands:"
echo "  npm run dev          # Test locally"
echo "  git push origin staging    # Deploy to staging"
echo "  git checkout main          # Back to production"
```

### **Script: promote-to-production.sh**
```bash
#!/bin/bash
# Promove mudanças de staging para produção

echo "🚀 Promoting staging to production..."

# Verificar se estamos em staging
current_branch=$(git branch --show-current)
if [ "$current_branch" != "staging" ]; then
  echo "❌ Must be on staging branch to promote"
  echo "Run: git checkout staging"
  exit 1
fi

# Verificar se há mudanças não commitadas
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ There are uncommitted changes"
  echo "Please commit or stash changes first"
  exit 1
fi

# Push latest staging
echo "📤 Pushing latest staging changes..."
git push origin staging

# Switch para main e merge
echo "🔄 Switching to main and merging..."
git checkout main
git pull origin main
git merge staging

# Push para produção
echo "🚀 Deploying to production..."
git push origin main

echo "✅ Promotion complete!"
echo "🌐 Production: https://radio.importantestudio.com/"
echo "🚧 Staging: https://staging.radio.importantestudio.com/"
```

---

## 📊 **TEMPLATE: Environment Status Page**

### **debug-environment.html**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Environment Status - Radio Importante</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .env-card { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
    .env-production { border-left: 5px solid #28a745; }
    .env-staging { border-left: 5px solid #ffc107; }
    .env-development { border-left: 5px solid #17a2b8; }
    .status-ok { color: #28a745; }
    .status-error { color: #dc3545; }
    .status-pending { color: #ffc107; }
  </style>
</head>
<body>
  <h1>🔍 Environment Status</h1>
  
  <div class="env-card env-production">
    <h3>🌐 Production</h3>
    <p><strong>URL:</strong> <a href="https://radio.importantestudio.com/" target="_blank">https://radio.importantestudio.com/</a></p>
    <p><strong>Status:</strong> <span id="prod-status" class="status-pending">Checking...</span></p>
    <p><strong>Backend:</strong> <span id="prod-backend" class="status-pending">Checking...</span></p>
    <p><strong>Last Deploy:</strong> <span id="prod-deploy">Unknown</span></p>
  </div>
  
  <div class="env-card env-staging">
    <h3>🚧 Staging</h3>
    <p><strong>URL:</strong> <a href="https://staging.radio.importantestudio.com/" target="_blank">https://staging.radio.importantestudio.com/</a></p>
    <p><strong>Status:</strong> <span id="staging-status" class="status-pending">Checking...</span></p>
    <p><strong>Backend:</strong> <span id="staging-backend" class="status-pending">Checking...</span></p>
    <p><strong>Last Deploy:</strong> <span id="staging-deploy">Unknown</span></p>
  </div>
  
  <div class="env-card env-development">
    <h3>💻 Development</h3>
    <p><strong>URL:</strong> <a href="http://localhost:5173/" target="_blank">http://localhost:5173/</a></p>
    <p><strong>Status:</strong> <span id="dev-status" class="status-pending">Checking...</span></p>
    <p><strong>Backend:</strong> <span id="dev-backend" class="status-pending">Checking...</span></p>
  </div>

  <script>
    // Check environment status
    async function checkEnvironment(name, frontendUrl, backendUrl) {
      try {
        // Check frontend
        const frontendResponse = await fetch(frontendUrl, { mode: 'no-cors' });
        document.getElementById(`${name}-status`).innerHTML = '<span class="status-ok">✅ Online</span>';
      } catch (e) {
        document.getElementById(`${name}-status`).innerHTML = '<span class="status-error">❌ Offline</span>';
      }
      
      try {
        // Check backend
        const backendResponse = await fetch(`${backendUrl}/health`);
        if (backendResponse.ok) {
          const data = await backendResponse.json();
          document.getElementById(`${name}-backend`).innerHTML = `<span class="status-ok">✅ ${data.status}</span>`;
        } else {
          document.getElementById(`${name}-backend`).innerHTML = '<span class="status-error">❌ Error</span>';
        }
      } catch (e) {
        document.getElementById(`${name}-backend`).innerHTML = '<span class="status-error">❌ Offline</span>';
      }
    }

    // Run checks
    checkEnvironment('prod', 'https://radio.importantestudio.com/', 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app');
    checkEnvironment('staging', 'https://staging.radio.importantestudio.com/', 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app');
    checkEnvironment('dev', 'http://localhost:5173/', 'http://localhost:8080');
  </script>
</body>
</html>
```

---

*Templates criados em 19/09/2025 - Prontos para implementação do staging environment*
