# 🚧 PLANO COMPLETO DE IMPLEMENTAÇÃO DO STAGING ENVIRONMENT

> **Objetivo:** Criar ambiente de staging na Digital Ocean para testar funcionalidades antes de publicar na produção  
> **Responsável:** GPT Assistant  
> **Data de criação:** 19/09/2025  
> **Estimativa:** 45 minutos  

---

## 📊 **ANÁLISE COMPLETA DA ARQUITETURA ATUAL**

### **Frontend em Produção:**
- **URL:** https://radio.importantestudio.com/
- **Plataforma:** Digital Ocean App Platform
- **App ID:** `1e7d94e3-6bf3-40ec-8a31-501fadfd4edd`
- **Nome:** `radio-importante-frontend`
- **Deploy:** GitHub Actions via `deploy-digitalocean.yml`
- **Branch:** `main` (produção)

### **Backend em Produção:**
- **URL:** https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/
- **Plataforma:** Digital Ocean App Platform
- **Container:** Docker (Node.js 18 Alpine)
- **Deploy:** Automático via GitHub (branch main)

### **Estrutura de Branches Identificada:**
```bash
main        → Produção (ativo no GitHub Actions)
staging     → Branch existente (precisa configuração)
develop     → Não identificada (pode ser criada)
```

### **Arquivos de Configuração Críticos:**
- `vite.config.ts` - Build system e dev server
- `src/config/api.ts` - URLs do backend
- `admin/scripts/config.js` - Configuração admin panel
- `public/scripts/config.js` - Configuração frontend
- `.github/workflows/deploy-digitalocean.yml` - Deploy produção

---

## 🎯 **OBJETIVOS DO STAGING ENVIRONMENT**

### **1. Separação de Ambientes:**
- **Produção:** https://radio.importantestudio.com/
- **Staging:** https://staging.radio.importantestudio.com/ (ou subdomínio similar)

### **2. Fluxo de Deploy:**
```
develop → staging → teste → main → produção
```

### **3. Benefícios:**
- Testar novas funcionalidades sem afetar produção
- Validar uploads e backend integrations
- Testes de performance e compatibility
- CI/CD pipeline completo

---

## 📋 **PLANO DE IMPLEMENTAÇÃO DETALHADO**

### **FASE 1: CONFIGURAÇÃO DO APP STAGING NA DIGITAL OCEAN (15 min)**

#### **TAREFA 1.1: Criar Novo App para Staging**
- [ ] **1.1.1** Acessar Digital Ocean Dashboard
  ```bash
  URL: https://cloud.digitalocean.com/apps
  ```

- [ ] **1.1.2** Criar novo app baseado no existente
  ```yaml
  Nome: radio-importante-frontend-staging
  Repository: DeepDevPro/radio-importante-pwa
  Source Directory: / (raiz)
  Branch: staging
  Auto Deploy: enabled
  ```

- [ ] **1.1.3** Configurar build settings
  ```yaml
  Build Command: npm run build
  Output Directory: dist
  Install Command: npm ci
  ```

- [ ] **1.1.4** Configurar environment variables (se necessário)
  ```yaml
  NODE_ENV: staging
  ```

- [ ] **1.1.5** Documentar App ID do staging
  ```bash
  # Será algo como: radio-importante-frontend-staging
  # App ID: [OBTER-APÓS-CRIAÇÃO]
  ```

#### **TAREFA 1.2: Configurar Domínio Staging**
- [ ] **1.2.1** Configurar subdomínio na Digital Ocean
  ```bash
  # Opções de URL:
  # 1. staging.radio.importantestudio.com
  # 2. staging-radio.importantestudio.com  
  # 3. Use app URL da DO: app-name-hash.ondigitalocean.app
  ```

- [ ] **1.2.2** Configurar DNS (se usar subdomínio)
  ```bash
  # Adicionar CNAME record no provedor DNS:
  # staging.radio.importantestudio.com → app-url.ondigitalocean.app
  ```

---

### **FASE 2: CONFIGURAÇÃO DO BACKEND STAGING (10 min)**

#### **TAREFA 2.1: Decidir Estratégia de Backend**

**OPÇÃO A: Backend Separado (Recomendado)**
- [ ] **2.1.1** Criar app backend staging na Digital Ocean
  ```yaml
  Nome: radio-importante-backend-staging
  Source Directory: backend/
  Branch: staging (ou main)
  ```

**OPÇÃO B: Backend Compartilhado (Mais Simples)**
- [ ] **2.1.2** Usar backend de produção existente
  ```bash
  # Configurar CORS para aceitar staging domain
  # Adicionar staging URL nas configurações
  ```

#### **TAREFA 2.2: Configurar URLs no Backend**
- [ ] **2.2.1** Atualizar CORS no backend para staging
  ```javascript
  // Em backend/app.js:
  const allowedOrigins = [
    'https://radio.importantestudio.com',           // Produção
    'https://staging.radio.importantestudio.com',  // Staging
    'https://[staging-app-url].ondigitalocean.app', // Staging DO
    'http://localhost:5173'                         // Desenvolvimento
  ];
  ```

---

### **FASE 3: CONFIGURAÇÃO DO FRONTEND STAGING (15 min)**

#### **TAREFA 3.1: Atualizar Configurações de API**

- [ ] **3.1.1** Modificar `src/config/api.ts`
  ```typescript
  // Detectar ambiente staging
  const isProduction = window.location.hostname !== 'localhost' && 
                      window.location.hostname !== '127.0.0.1';
  const isStaging = window.location.hostname.includes('staging') ||
                   window.location.hostname.includes('ondigitalocean.app');

  const API_CONFIG: ApiConfig = {
    baseUrl: isStaging 
      ? 'https://radio-importante-backend-staging-[HASH].ondigitalocean.app'  // ou backend compartilhado
      : isProduction 
        ? 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app'
        : 'http://localhost:8080',
    endpoints: {
      health: '/health',
      catalog: '/api/catalog',
      upload: '/api/upload'
    }
  };
  ```

- [ ] **3.1.2** Atualizar `admin/scripts/config.js`
  ```javascript
  export const API_CONFIG = {
    backends: {
      local: 'http://localhost:8080',
      staging: 'https://radio-importante-backend-staging-[HASH].ondigitalocean.app',
      production: 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app'
    },
    // Auto-detectar ambiente
    backendUrl: getEnvironmentBackend(),
    // ...resto da configuração
  };

  function getEnvironmentBackend() {
    if (window.location.hostname === 'localhost') return API_CONFIG.backends.local;
    if (window.location.hostname.includes('staging')) return API_CONFIG.backends.staging;
    return API_CONFIG.backends.production;
  }
  ```

- [ ] **3.1.3** Atualizar `public/scripts/config.js` (mesmo padrão)

#### **TAREFA 3.2: Configurar Identificação Visual Staging**

- [ ] **3.2.1** Adicionar banner de staging
  ```css
  /* Em staging, adicionar banner visual */
  .staging-banner {
    background: #ff6b35;
    color: white;
    text-align: center;
    padding: 5px;
    font-weight: bold;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
  }
  ```

- [ ] **3.2.2** Modificar title e metadata para staging
  ```javascript
  // Detectar staging e modificar title
  if (window.location.hostname.includes('staging')) {
    document.title = '[STAGING] Radio Importante';
    // Adicionar banner de staging
  }
  ```

---

### **FASE 4: GITHUB ACTIONS PARA STAGING (15 min)**

#### **TAREFA 4.1: Criar Workflow de Deploy Staging**

- [ ] **4.1.1** Criar `.github/workflows/deploy-staging.yml`
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
      steps:
        - name: Checkout
          uses: actions/checkout@v4
          
        - name: Deploy to Digital Ocean Staging
          uses: digitalocean/app_action@v1.1.5
          with:
            app_name: radio-importante-frontend-staging
            token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
  ```

#### **TAREFA 4.2: Configurar Secrets (se necessário)**
- [ ] **4.2.1** Verificar se token DO já está configurado
  ```bash
  # GitHub Settings → Secrets → Actions
  # DIGITALOCEAN_ACCESS_TOKEN - ✅ já existe
  ```

#### **TAREFA 4.3: Configurar Branch Protection**
- [ ] **4.3.1** Configurar staging branch
  ```bash
  # GitHub Settings → Branches → Add rule
  # Branch name: staging
  # Require pull request reviews: false (para desenvolvimento rápido)
  # Require status checks: optional
  ```

---

## 🔄 **WORKFLOW DE DESENVOLVIMENTO PROPOSTO**

### **Fluxo Normal de Desenvolvimento:**
```bash
1. Criar feature branch: git checkout -b feature/nova-funcionalidade
2. Desenvolver localmente: npm run dev
3. Teste local: http://localhost:5173
4. Commit e push: git push origin feature/nova-funcionalidade
5. Merge para staging: git checkout staging && git merge feature/nova-funcionalidade
6. Push staging: git push origin staging
7. Deploy automático para staging
8. Teste em staging: https://staging.radio.importantestudio.com
9. Se OK, merge para main: git checkout main && git merge staging
10. Deploy automático para produção
```

### **Comandos de Referência:**
```bash
# Verificar status de deploys
curl -I https://staging.radio.importantestudio.com/
curl -I https://radio.importantestudio.com/

# Alternar entre ambientes
git checkout staging    # Desenvolver/testar
git checkout main       # Produção estável

# Debug problemas
# Staging: https://[staging-app].ondigitalocean.app
# Produção: https://radio.importantestudio.com
```

---

## 🧪 **TESTES E VALIDAÇÃO**

### **CHECKLIST DE TESTES STAGING:**

#### **Frontend:**
- [ ] **URL staging carrega corretamente**
- [ ] **Banner de staging visível**  
- [ ] **Player de música funciona**
- [ ] **Service Worker atualiza**
- [ ] **PWA pode ser instalada**

#### **Admin Panel:**
- [ ] **Login/acesso ao admin**
- [ ] **Upload de arquivos funciona**
- [ ] **Lista de músicas carrega**
- [ ] **Backend correto conectado**
- [ ] **Delete de arquivos funciona**

#### **API Integration:**
- [ ] **Health check responde**
- [ ] **Catalog endpoint funciona**
- [ ] **Upload endpoint funciona**
- [ ] **CORS configurado corretamente**
- [ ] **Environment variables aplicadas**

#### **Deploy Pipeline:**
- [ ] **GitHub Actions executam sem erro**
- [ ] **Build completa com sucesso**
- [ ] **Deploy automático funciona**
- [ ] **Rollback é possível**

---

## 🚨 **TROUBLESHOOTING STAGING**

### **Problema: Staging não carrega**
```bash
# Verificar:
1. App foi criado na Digital Ocean? ✓
2. Branch staging existe? ✓
3. GitHub Actions executaram? ✓
4. DNS configurado (se usando subdomínio)? ✓

# Debug:
curl -I https://[staging-app-url].ondigitalocean.app/
```

### **Problema: Backend connection failed**
```bash
# Verificar:
1. Backend URL correta em config.js? ✓
2. CORS configurado para staging domain? ✓
3. Backend staging está rodando? ✓

# Debug:
curl https://[backend-staging-url]/health
```

### **Problema: Deploy falha**
```bash
# Verificar:
1. Token Digital Ocean válido? ✓
2. App name correto no workflow? ✓
3. Build script funciona localmente? ✓

# Debug workflow:
https://github.com/DeepDevPro/radio-importante-pwa/actions
```

### **Problema: Confusão entre ambientes**
```bash
# Verificar:
1. Banner staging visível? ✓
2. Title mostra [STAGING]? ✓
3. URL correta no browser? ✓

# Adicionar mais indicators visuais se necessário
```

---

## 📝 **DOCUMENTAÇÃO PÓS-IMPLEMENTAÇÃO**

### **URLs dos Ambientes:**
```bash
DESENVOLVIMENTO: http://localhost:5173
STAGING: https://staging.radio.importantestudio.com
PRODUÇÃO: https://radio.importantestudio.com
```

### **App IDs Digital Ocean:**
```bash
PRODUÇÃO: 1e7d94e3-6bf3-40ec-8a31-501fadfd4edd
STAGING: [OBTER-APÓS-CRIAÇÃO]
```

### **Backend URLs:**
```bash
PRODUÇÃO: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app
STAGING: [DEFINIR-ESTRATÉGIA]
```

### **GitHub Actions:**
```bash
PRODUÇÃO: .github/workflows/deploy-digitalocean.yml (main branch)
STAGING: .github/workflows/deploy-staging.yml (staging branch)
```

---

## ✅ **CRITÉRIOS DE CONCLUSÃO**

### **Para considerar implementação completa:**

- [ ] ✅ App staging criado na Digital Ocean
- [ ] ✅ GitHub Actions deploy-staging.yml funcionando
- [ ] ✅ Branch staging configurada e protegida
- [ ] ✅ Frontend staging acessível e funcional
- [ ] ✅ Backend staging conectado (ou compartilhado)
- [ ] ✅ Admin panel staging funcional
- [ ] ✅ Identificação visual clara (staging vs produção)
- [ ] ✅ Workflow de desenvolvimento documentado
- [ ] ✅ Testes de deploy staging → produção validados

### **Entregáveis:**
1. **Ambiente staging 100% funcional**
2. **Pipeline CI/CD staging automatizado**
3. **Documentação do workflow atualizada**
4. **Testes de integração validados**
5. **Processo de rollback documentado**

---

## 🎯 **PRÓXIMOS PASSOS APÓS STAGING**

### **Melhorias Futuras:**
- [ ] **Database staging separada** (se/quando implementar)
- [ ] **SSL certificate para subdomínio staging**
- [ ] **Monitoring e logs separados**
- [ ] **Performance testing automatizado**
- [ ] **Visual regression testing**

### **Integração com Desenvolvimento:**
- [ ] **Feature flags** para testar funcionalidades
- [ ] **A/B testing** infrastructure
- [ ] **Automated testing** suite
- [ ] **Code review** process refinement

---

*Plano criado em 19/09/2025 - Baseado na análise completa da arquitetura atual*
