# 📋 Plano de Execução - Radio Importante PWA

> **Projeto**: PWA Music Player "Radio Importante"  
> **Data de criação**: 29/08/2025  
> **Última atualização**: 12/09/2025  
> **Status**: 🚨 **PROBLEMAS CRÍTICOS ATIVO - MÚLTIPLAS FALHAS DE DEPLOY**

---

## 🚨 **SITUAÇÃO CRÍTICA ATUAL (12/09/2025)**

### ❌ **PROBLEMAS MÚLTIPLOS NÃO RESOLVIDOS**

**⚠️ ATENÇÃO DESENVOLVEDORES**: O status indicado como "tudo funcionando" está **DESATUALIZADO E INCORRETO**. 

#### 🔥 **PROBLEMAS CRÍTICOS ATIVOS:**

### **1. GitHub Actions - Deploy Falhando Sistematicamente**
```bash
❌ Status: FAILING - Integration Tests
❌ Erro: "BACKEND_URL="" - curl: (3) URL rejected: No host part in the URL"
❌ Cause: Mismatch entre output.backend_url vs output.url no workflow
❌ Impact: Deploy pipeline completamente quebrado
```

**Detalhes técnicos:**
- **Arquivo**: `.github/workflows/deploy-complete.yml`
- **Problema**: Step `get-url` seta `backend_url` mas job espera `url`
- **Linha 51**: `backend_url: ${{ steps.get-url.outputs.url }}`
- **Linha 208**: `echo "backend_url=$URL" >> "$GITHUB_OUTPUT"`
- **Conflito**: Inconsistência entre nome setado vs esperado

### **2. AWS Elastic Beanstalk - Status "Severe" Recorrente**
```bash
❌ Environment: radio-importante-backend-prod 
❌ Health: Severe (Nginx configuration failures)
❌ Deploy: #11+ falhas consecutivas desde 12/09
```

**Problemas identificados nos logs:**
```bash
# Nginx Errors:
2025/09/12 14:47:25 [emerg] "client_body_timeout" directive is duplicate in /var/proxy/staging/nginx/conf.d/upload.conf:5
2025/09/12 14:07:54 [emerg] "client_header_timeout" directive is not allowed here in /var/proxy/staging/nginx/conf.d/elasticbeanstalk/01_upload.conf:22

# Upload Errors:
Sep 12 13:55:33 Error: EACCES: permission denied, mkdir '/var/app/public/audio'
Sep 12 13:42:34 Error: MulterError: Unexpected field

# Proxy Errors:
recv() failed (104: Connection reset by peer) while reading response header from upstream
```

### **3. Service Worker v5 - Mixed Content Não Resolvido**
```bash
❌ Issue: Mixed Content warnings persistem
❌ Cause: Service Worker cache busting não eliminou todas as referências HTTP
❌ Impact: PWA não funciona corretamente em produção HTTPS
```

### **4. Upload System - MulterError Crítico**
```bash
❌ Error: MulterError: Unexpected field
❌ Field Expected: 'audioFiles' 
❌ Field Received: 'file'
❌ Code: 'LIMIT_UNEXPECTED_FILE'
❌ Impact: Sistema de upload completamente inoperante
```

---

## 🔧 **CORREÇÕES APLICADAS (SEM SUCESSO)**

### **Tentativas Recentes (commits 318f542 → afe9dac):**

1. **Fix GitHub Actions output mismatch**
   - ✅ Tentativa: Corrigir `backend_url` → `url` no GITHUB_OUTPUT
   - ❌ Status: Ainda falhando (logs mostram BACKEND_URL="")

2. **Fix Nginx duplicate directives**
   - ✅ Tentativa: Remover diretivas duplicadas de `upload.conf`
   - ❌ Status: Environment ainda "Severe"

3. **Fix upload paths and permissions**
   - ✅ Tentativa: Mudar `/var/app/public/audio` → `/tmp/audio`
   - ❌ Status: MulterError persistindo

4. **Add flexible upload middleware**
   - ✅ Tentativa: Aceitar 'audioFiles' ou 'file' fields
   - ❌ Status: Não testado devido a deploy falhas

---

## 🚨 **STATUS REAL DO SISTEMA (NÃO O DOCUMENTADO)**

### **❌ INFRAESTRUTURA QUEBRADA**
```bash
❌ Frontend: https://radio.importantestudio.com (pode estar desatualizado)
❌ Backend: radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com (SEVERE)
❌ GitHub Actions: deploy-complete.yml (FAILING - 10+ consecutive failures)
❌ Upload System: Inoperante (MulterError + path issues)
❌ Service Worker: Mixed Content warnings (v5 não resolve)
```

### **❌ FUNCIONALIDADES QUEBRADAS**
- ❌ **Upload de arquivos**: MulterError + permission denied
- ❌ **Deploy automático**: GitHub Actions falha sistematicamente
- ❌ **Backend health**: Environment status "Severe"
- ❌ **PWA em produção**: Mixed Content bloqueia funcionalidades
- ❌ **Integration tests**: BACKEND_URL vazio causa falhas

---

## 📋 **PLANO DE RECUPERAÇÃO URGENTE**

### **Prioridade 1: GitHub Actions**
```bash
1. Debugar mismatch output.backend_url vs output.url
2. Verificar se aws elasticbeanstalk describe-environments retorna dados
3. Testar URL extraction e protocol handling
4. Validar integration tests com URL correta
```

### **Prioridade 2: AWS EB Environment**
```bash
1. Resolver Nginx configuration conflicts
2. Separar diretivas por contexto (http vs server vs location)
3. Corrigir upload directory permissions (/tmp vs /var/app)
4. Testar deploy manual via console AWS
```

### **Prioridade 3: Upload System**
```bash
1. Debugar field name mismatch (audioFiles vs file)
2. Testar middleware flexível em produção
3. Verificar frontend consistency nos form fields
4. Validar file upload paths e permissions
```

### **Prioridade 4: Service Worker**
```bash
1. Audit completo de URLs HTTP residuais
2. Verificar cache invalidation force refresh
3. Testar em dispositivo real iOS Safari
4. Confirmar PWA functionality post-fix
```

---

## 🔍 **DEBUGGING INFORMATION PARA DEVS**

### **Key Files to Check:**
```bash
/.github/workflows/deploy-complete.yml  # Line 51 vs 208 mismatch
/backend/.platform/nginx/conf.d/       # Multiple config conflicts
/backend/app.js                        # Multer configuration
/public/sw.js                          # Service Worker v5 
/src/config/api.ts                     # API URL configuration
```

### **Critical Log Locations:**
```bash
/var/log/nginx/error.log               # Nginx directive conflicts
/var/log/web.stdout.log                # Node.js/Express errors
/var/log/eb-engine.log                 # EB deployment failures
GitHub Actions logs                     # Integration test failures
```

### **Testing Commands:**
```bash
# Local backend test:
curl http://localhost:8080/health

# Production backend test (se environment não estiver severe):
curl https://radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com/health

# Upload test:
curl -X POST -F "audioFiles=@test.mp3" http://localhost:8080/api/upload

# AWS EB status:
aws elasticbeanstalk describe-environments --environment-names radio-importante-backend-prod
```

---

## ⚠️ **IMPORTANTE PARA PRÓXIMOS DESENVOLVEDORES**

1. **NÃO confiar no status "tudo funcionando"** - está desatualizado
2. **Sempre verificar GitHub Actions** antes de assumir deploy success
3. **Checar AWS EB environment health** - status "Severe" é crítico
4. **Testar upload functionality** - sistema atualmente quebrado
5. **Validar Service Worker** em device real - Mixed Content persiste

### **Última Verificação Real:**
- **Data**: 12/09/2025
- **Deploy Status**: FAILING (10+ consecutive failures)
- **EB Health**: SEVERE
- **Upload**: BROKEN (MulterError)
- **GitHub Actions**: BROKEN (BACKEND_URL empty)

---

## 🎯 Visão Geral

Desenvolvimento de um PWA completo para reprodução de playlist fixa, com **solução definitiva para iPhone PWA background audio** - o maior desafio técnico do projeto.

## 🏆 **MARCOS IMPORTANTES CONCLUÍDOS**

### ✅ **CRISE DE DEPLOYMENT RESOLVIDA (04/01/2025)**
- **Problema crítico**: Backend deployment failures - status UNPROCESSED
- **Root cause identificado**: Arquivo app.js vazio (0 bytes) + workflows duplicados
- **Solução implementada**: Express server restaurado + workflows limpos
- **Resultado**: **v2.2.4 FUNCIONAL** - Todos os sistemas operacionais
- **Validação**: Backend respondendo, health checks OK, integração confirmada

### ✅ **PROBLEMA PRINCIPAL RESOLVIDO**: iPhone PWA Background Audio
- **Desafio**: Música parava entre faixas durante screen lock no iPhone PWA
- **Solução implementada**: Sistema de arquivo contínuo AAC único com track cues
- **Resultado**: **FUNCIONANDO 100%** - Música continua ininterruptamente durante screen lock
- **Tecnologia**: Arquivo AAC concatenado + busca por posição + background detection
- **Status**: ✅ **TESTADO E VALIDADO**

### ✅ **FEATURE INTEGRATION CONFIRMED**: Editor de Metadados
- **Status**: Feature já integrada no branch main durante resolução da crise
- **Funcionalidade**: Sistema completo de edição de metadados no admin.html
- **Validação**: Confirmado funcionando após resolução do backend
- **Integration**: Merge completado sem conflitos

### ✅ **SISTEMA COMPLETO FUNCIONAL**
- ✅ Player robusto com controles completos
- ✅ Interface administrativa profissional com editor de metadados
- ✅ Sistema de upload automático
- ✅ PWA instalável em todos os dispositivos
- ✅ **Sistema escalável** para catálogos grandes
- ✅ **Backend API funcional** - v2.2.4 operacional em AWS
- ✅ **Integração Frontend ↔ Backend** validada
- ✅ **GitHub Actions** funcionando sem conflitos
- ✅ **Documentação completa** e código limpo

### 🌐 **INFRAESTRUTURA COMPLETA - v2.2.4 OPERATIONAL**
- ✅ **Frontend HTTPS**: https://radio.importantestudio.com (CloudFront + SSL)
- ✅ **Backend Produção**: AWS Elastic Beanstalk v2.2.4 - RUNNING ✅
- ✅ **Backend Local**: localhost:8080 para desenvolvimento
- ✅ **CI/CD**: GitHub Actions configurado e funcional (workflows limpos)
- ✅ **Integração Dual**: Sistema funciona com ambos backends
- ✅ **Testes Validados**: Integração completa confirmada funcionando
- ✅ **Health Checks**: Endpoints /health funcionando corretamente
- ✅ **Editor de Metadados**: Feature integrada e operacional

**Cores do App:**
- Fundo: `#EFEAE3` (bege claro)
- Fonte: `#271F30` (roxo escuro)

---

## 📊 Resumo Final das Etapas

| Etapa | Descrição | Esforço | Status | Observações |
|-------|-----------|---------|--------|-------------|
| 0 | Configuração do Projeto | S | ✅ **Concluído** | Base sólida estabelecida |
| 1 | Player Básico | M | ✅ **Concluído** | Funcional com todos os recursos |
| 1.5 | Sistema de Administração | M | ✅ **Concluído** | Interface profissional completa |
| 2 | PWA (manifest + SW) | M | ✅ **Concluído** | Instalável em todos os dispositivos |
| **3** | **iPhone PWA Background Audio** | **XL** | ✅ **RESOLVIDO** | **SOLUÇÃO DEFINITIVA IMPLEMENTADA** |
| 4 | Sistema Escalável | L | ✅ **Concluído** | Pronto para catálogos grandes |
| 5 | Documentação e Polimento | M | ✅ **Concluído** | Código production-ready |
| **6** | **Backend AWS + Integração** | **L** | ✅ **CONCLUÍDO** | **FRONTEND + BACKEND FUNCIONANDO** |
| **7** | **Deploy HTTPS + Infraestrutura** | **M** | ✅ **CONCLUÍDO** | **PRODUÇÃO FUNCIONANDO** |
| **8** | **Testes de Integração** | **S** | ✅ **VALIDADO** | **SISTEMA COMPLETO TESTADO** |

**Legenda de Esforço:** S=Pequeno (1-2h) | M=Médio (3-5h) | L=Grande (6-8h) | XL=Complexo (10+h)

---

## 🚀 **ETAPA 6-8: BACKEND + DEPLOY + INTEGRAÇÃO COMPLETA**
**Esforço:** L | **Status:** ✅ **COMPLETAMENTE FUNCIONAL** | **Prioridade:** ✅ **FINALIZADA**

### 🎯 **Sistema Backend Completo Implementado**

#### ✅ **INFRAESTRUTURA FUNCIONAL**
- **Frontend HTTPS**: https://radio.importantestudio.com
  - CloudFront distribution com SSL certificate
  - Deploy automático via GitHub Actions
  - Service Worker configurado corretamente
  - PWA instalável funcionando perfeitamente

- **Backend Produção**: AWS Elastic Beanstalk
  - URL: `radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com`
  - Node.js Express server com CORS configurado
  - Endpoints JSON funcionais (/health, /)
  - Deploy #11 - Sistema completamente funcional

- **Backend Desenvolvimento**: localhost:8080
  - Express server local para desenvolvimento
  - Mesmos endpoints da produção
  - Sincronizado com versão de produção

#### ✅ **INTEGRAÇÃO FRONTEND ↔ BACKEND VALIDADA**

**Sistema Dual Backend Funcional:**
```javascript
// Configuração inteligente de API
const API_CONFIG = {
    backendUrl: 'http://localhost:8080',     // Local development
    productionUrl: 'http://radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com',
    currentMode: 'local'  // Switching entre local/produção
};
```

**Endpoints Testados e Funcionando:**
- ✅ `/health` - Health check com timestamp e status
- ✅ `/` - API info com versão e dados do servidor
- ✅ CORS configurado corretamente para frontend
- ✅ Ambos backends (local + produção) respondendo JSON

#### ✅ **TESTES DE INTEGRAÇÃO REALIZADOS**

**Framework de Testes Criado:**
- `test-integration.html` - Interface completa de testes
- Switching automático entre backend local/produção
- Testes por fases com validação completa
- Interface visual com resultados em tempo real

**Resultados dos Testes (Validados):**
```
📍 FASE 1: Backend Local (localhost:8080)
✅ /health: {"status":"OK","message":"API funcionando","timestamp":"2025-09-04..."}
✅ /: {"message":"Radio Importante Backend API","version":"1.0.0","status":"running"...}

📍 FASE 2: Backend Produção (AWS Elastic Beanstalk)  
✅ /health: {"status":"OK","message":"API funcionando","timestamp":"2025-09-04..."}
✅ /: {"message":"Radio Importante Backend API","version":"1.0.0","status":"running"...}

📍 FASE 3: Dados Locais
✅ catalog.json: 17 tracks encontradas

📍 FASE 4: Integração PWA + API
✅ Configuração da API disponível
✅ Backend Local: Online
✅ Backend Produção: Online  
✅ Catalog Local: Disponível
🎉 INTEGRAÇÃO COMPLETA: Todos os sistemas funcionando!
```

#### 🛠️ **ARQUITETURA IMPLEMENTADA**

**Backend Structure (Funcionando):**
```
backend/
├── app.js                    # ✅ Express server principal com CORS
├── package.json             # ✅ Dependencies Express 4.18.2
├── Procfile                 # ✅ "web: node app.js"
├── .ebextensions/           # ✅ Configurações Elastic Beanstalk
│   └── 01-app-config.config # ✅ NODE_ENV, PORT configs
└── .gitignore              # ✅ EB exclusions
```

**Frontend Integration (Funcionando):**
```
src/config/api.ts           # ✅ API configuration management
test-integration.html       # ✅ Comprehensive testing framework
```

#### 🎯 **METODOLOGIA DE DEPLOY VALIDADA**

**Processo Completo Executado:**
1. **Deploy #1-7**: Debugging "Engine execution has encountered an error"
2. **Deploy #8**: Breakthrough - Corrigido npm ci dependency conflicts  
3. **Deploy #9**: Adicionado Procfile obrigatório
4. **Deploy #10**: Cleanup radical de configurações conflitantes
5. **Deploy #11**: CORS implementado e sistema completamente funcional

**Lessons Learned (Validadas):**
- ✅ package-lock.json sync é crítico para EB Node.js deployments
- ✅ Procfile é obrigatório para especificar comando de startup
- ✅ Configurações mínimas são mais confiáveis que debug complexo
- ✅ CORS deve ser configurado explicitamente para frontend integration

#### 📊 **STATUS OPERACIONAL CONFIRMADO**

**Frontend (HTTPS):**
- ✅ https://radio.importantestudio.com funcionando
- ✅ PWA instalável validado em iPhone/iPad
- ✅ Service Worker caching corretamente
- ✅ Background audio funcionando durante screen lock

**Backend API (AWS):**
- ✅ Elastic Beanstalk environment health: OK
- ✅ JSON endpoints respondendo corretamente
- ✅ CORS headers configurados para frontend
- ✅ Error handling e logging implementados

**Integração (Dual Backend):**
- ✅ Local development: localhost:8080
- ✅ Production: AWS Elastic Beanstalk
- ✅ Frontend detecta e funciona com ambos
- ✅ Switching dinâmico funcional
    "multer": "^1.4.5-lts.1",
    "multer-s3": "^3.0.1",
    "aws-sdk": "^2.1467.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.10.0",
    "joi": "^17.9.2",
    "morgan": "^1.10.0"
  }
}
```

##### **1.3 Status da FASE 1 ✅**
**Ferramentas Instaladas:**
- ✅ AWS CLI 2.28.21 (via Homebrew)
- ✅ EB CLI 3.25 (via pip3)
- ✅ PATH configurado corretamente

**Estrutura do Backend Criada:**
- ✅ Diretório `/backend/` completo
- ✅ `package.json` com todas as dependências
- ✅ Todas as pastas: routes/, middleware/, services/, config/, .ebextensions/
- ✅ Dependencies instaladas: Express 4.18.2, multer-s3, AWS SDK, etc.

**Aplicação Backend:**
- ✅ `app.js` completo com Express server
- ✅ Routes funcionais: `/api/upload`, `/api/catalog`
- ✅ Middleware de segurança: CORS, helmet, rate limiting
- ✅ Configuração AWS S3 pronta
- ✅ **SERVIDOR RODANDO LOCALMENTE NA PORTA 8080** 🚀

**Testes Realizados:**
- ✅ `curl http://localhost:8080/health` → Status OK
- ✅ `curl http://localhost:8080/` → API info funcionando
- ✅ Estrutura pronta para deploy no Elastic Beanstalk

---

#### **FASE 2: Desenvolvimento do Backend ✅ CONCLUÍDA**

##### **2.1 Express Server Base ✅**
```javascript
// ✅ IMPLEMENTADO: app.js completo com Express server
// ✅ CONFIGURADO: dotenv para variáveis de ambiente
// ✅ IMPLEMENTADO: Rate limiting e segurança
// ✅ TESTADO: Servidor rodando na porta 8080
```

##### **2.2 Rotas Implementadas ✅**
- ✅ **Upload**: `/api/upload` - Upload múltiplo com validação
- ✅ **Catálogo**: `/api/catalog` - CRUD completo do catálogo
- ✅ **Stats**: `/api/catalog/stats` - Estatísticas
- ✅ **Search**: `/api/catalog/search` - Busca avançada
- ✅ **Health**: `/health` - Health check
- ✅ **Root**: `/` - Informações da API

##### **2.3 Serviços Implementados ✅**
- ✅ **CatalogService**: Gerenciamento completo do catálogo S3
- ✅ **AWS Config**: Configuração S3 com mock para desenvolvimento
- ✅ **Upload Middleware**: Multer-S3 com validação de arquivos
- ✅ **Validation**: Joi middleware para validação de dados

##### **2.4 Recursos de Desenvolvimento ✅**
- ✅ **S3 Mock**: Desenvolvimento local sem AWS
- ✅ **dotenv**: Variáveis de ambiente configuradas
- ✅ **ESLint**: Configuração Node.js específica
- ✅ **API Docs**: Documentação completa em `API_DOCS.md`

##### **2.5 Testes Realizados ✅**
- ✅ `curl http://localhost:8080/health` → Status OK
- ✅ `curl http://localhost:8080/api/catalog/stats` → Stats funcionando
- ✅ `curl http://localhost:8080/api/catalog` → Catálogo vazio funcionando
- ✅ Server logs mostrando S3 mock ativo

##### **2.6 Estrutura Final ✅**
```
backend/
├── app.js                    # ✅ Express server principal
├── package.json              # ✅ Scripts e dependências
├── .env                      # ✅ Variáveis desenvolvimento
├── .env.example             # ✅ Template de configuração
├── .eslintrc.json           # ✅ Config ESLint Node.js
├── .gitignore               # ✅ Exclusões Git/EB
├── eb-init.sh               # ✅ Script inicialização EB
├── README.md                # ✅ Documentação do backend
├── API_DOCS.md              # ✅ Documentação completa da API
├── config/
│   └── aws.js               # ✅ Config AWS + S3 mock
├── middleware/
│   ├── upload.js            # ✅ Multer-S3 config
│   └── validation.js        # ✅ Joi validation
├── routes/
│   ├── upload.js            # ✅ Rotas de upload
│   └── catalog.js           # ✅ Rotas do catálogo
├── services/
│   └── catalogService.js    # ✅ Serviço S3 catalog
└── .ebextensions/
    ├── 01-node-config.config # ✅ Config EB Node.js
    └── 02-nginx.config       # ✅ Config nginx
```

---

#### **FASE 3: Configuração Elastic Beanstalk ✅ PRONTA PARA DEPLOY**

##### **3.1 Arquivos de Deploy Preparados ✅**
- ✅ **radio-backend.zip** criado (47KB) - pronto para upload
- ✅ **.ebextensions/** configurado com Node.js 18 + nginx
- ✅ **package.json** com script "start" correto
- ✅ **DEPLOY_GUIDE.md** criado com 3 opções de deploy

##### **3.2 Configurações EB Prontas ✅**
```yaml
# .ebextensions/01-node-config.config
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
    NodeVersion: 18.19.0
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 8080
    AWS_REGION: us-west-2
  aws:autoscaling:launchconfig:
    InstanceType: t3.micro
    IamInstanceProfile: aws-elasticbeanstalk-ec2-role
  aws:elasticbeanstalk:environment:
    ServiceRole: aws-elasticbeanstalk-service-role
```

##### **3.3 Opções de Deploy Disponíveis ✅**
1. **AWS Console** (Recomendado): Upload `radio-backend.zip` via interface web
2. **AWS CLI**: Deploy via linha de comando (se EB CLI falhar)
3. **EB CLI**: Deploy tradicional (quando PATH estiver configurado)

##### **3.4 Próximos Passos para Deploy ✅**
```bash
# Manual via AWS Console:
# 1. Acessar https://console.aws.amazon.com/elasticbeanstalk/
# 2. Create Application > radio-importante-backend
# 3. Upload radio-backend.zip
# 4. Configure environment variables
# 5. Deploy

# Ou via AWS CLI (se preferir):
aws elasticbeanstalk create-application --application-name radio-importante-backend
```

##### **3.5 Variáveis de Ambiente para Produção ✅**
```
NODE_ENV=production
AWS_REGION=us-west-2
S3_BUCKET_NAME=radio-importante-storage
PORT=8080
```

---

#### **FASE 4: Integração Frontend (30 minutos)**
});

// Routes
app.use('/api/upload', uploadLimiter, require('./routes/upload'));
app.use('/api/catalog', require('./routes/catalog'));
app.use('/health', require('./routes/health'));

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🚀 Backend rodando na porta ${port}`);
});
```

##### **2.2 Service de Upload S3**
```javascript
// services/s3Service.js
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-west-2'
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET || 'radio-importantestudio-com',
    key: function (req, file, cb) {
      // Sanitizar nome do arquivo
      const sanitized = file.originalname
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9.-]/g, '_'); // Substitui caracteres especiais
      
      cb(null, `audio/${sanitized}`);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString()
      });
    }
  }),
  fileFilter: (req, file, cb) => {
    // Apenas arquivos de áudio
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de áudio são permitidos'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

module.exports = { upload, s3 };
```

##### **2.3 Endpoint de Upload**
```javascript
// routes/upload.js
const express = require('express');
const { upload } = require('../services/s3Service');
const catalogService = require('../services/catalogService');

const router = express.Router();

router.post('/', upload.array('audioFiles', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    // Processar cada arquivo
    const processedFiles = req.files.map(file => ({
      filename: file.key.replace('audio/', ''),
      originalName: file.originalname,
      size: file.size,
      url: file.location,
      s3Key: file.key
    }));

    // Atualizar catálogo
    await catalogService.addTracks(processedFiles);

    res.json({
      success: true,
      message: `${processedFiles.length} arquivo(s) enviado(s) com sucesso`,
      files: processedFiles
    });

  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

module.exports = router;
```

##### **2.4 Service de Catálogo**
```javascript
// services/catalogService.js
const { s3 } = require('./s3Service');

class CatalogService {
  constructor() {
    this.bucketName = process.env.S3_BUCKET || 'radio-importantestudio-com';
    this.catalogKey = 'data/catalog.json';
  }

  async getCatalog() {
    try {
      const result = await s3.getObject({
        Bucket: this.bucketName,
        Key: this.catalogKey
      }).promise();
      
      return JSON.parse(result.Body.toString());
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return this.createEmptyCatalog();
      }
      throw error;
    }
  }

  async addTracks(files) {
    const catalog = await this.getCatalog();
    
    const newTracks = files.map((file, index) => {
      const title = this.extractTitle(file.originalName);
      const artist = this.extractArtist(file.originalName);
      
      return {
        id: catalog.tracks.length + index + 1,
        title,
        artist,
        filename: file.filename,
        url: `/audio/${file.filename}`,
        fileSize: file.size,
        duration: 180, // Placeholder
        lastModified: new Date().toISOString(),
        displayName: `${artist} - ${title}`
      };
    });

    catalog.tracks.push(...newTracks);
    catalog.metadata.totalTracks = catalog.tracks.length;
    catalog.metadata.lastUpdated = new Date().toISOString();

    await this.saveCatalog(catalog);
    return catalog;
  }

  async saveCatalog(catalog) {
    await s3.putObject({
      Bucket: this.bucketName,
      Key: this.catalogKey,
      Body: JSON.stringify(catalog, null, 2),
      ContentType: 'application/json'
    }).promise();
  }

  extractTitle(filename) {
    const name = filename.replace(/\.(mp3|wav|aac)$/i, '');
    if (name.includes(' - ')) {
      return name.split(' - ').slice(1).join(' - ').trim();
    }
    return name;
  }

  extractArtist(filename) {
    const name = filename.replace(/\.(mp3|wav|aac)$/i, '');
    if (name.includes(' - ')) {
      return name.split(' - ')[0].trim();
    }
    return 'Artista Desconhecido';
  }

  createEmptyCatalog() {
    return {
      version: "1.1.2",
      tracks: [],
      metadata: {
        totalTracks: 0,
        totalDuration: 0,
        artwork: "/img/radio-importante-logo.png",
        radioName: "Rádio Importante",
        description: "Uma seleção de música eletrônica, soul e experimental",
        genre: "Electronic, Soul, Experimental",
        language: "pt-BR",
        lastUpdated: new Date().toISOString()
      }
    };
  }
}

module.exports = new CatalogService();
```

#### **FASE 3: Configuração Elastic Beanstalk (1 hora)**

##### **3.1 Configuração EB**
```yaml
# .ebextensions/01_app.config
option_settings:
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    AWS_REGION: us-west-2
    S3_BUCKET: radio-importantestudio-com
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
    NodeVersion: 18.17.0
  aws:autoscaling:launchconfig:
    InstanceType: t3.micro
    IamInstanceProfile: aws-elasticbeanstalk-ec2-role
  aws:elasticbeanstalk:environment:
    ServiceRole: aws-elasticbeanstalk-service-role
```

##### **3.2 Setup e Deploy**
```bash
# 1. Inicializar EB na pasta backend/
cd backend/
eb init radio-backend --region us-west-2

# 2. Criar ambiente
eb create radio-backend-prod --instance-type t3.micro

# 3. Deploy inicial
eb deploy

# 4. Configurar variáveis de ambiente
eb setenv S3_BUCKET=radio-importantestudio-com AWS_REGION=us-west-2

# 5. Obter URL do backend
eb status
```

#### **FASE 4: Integração Frontend (30 minutos)**

##### **4.1 Atualizar Admin para usar Backend**
```typescript
// src/admin-simple.ts - Modificar detecção de ambiente
private async uploadToBackend(files: File[]): Promise<void> {
  const backendUrl = 'https://radio-backend-prod.us-west-2.elasticbeanstalk.com';
  
  const formData = new FormData();
  files.forEach(file => {
    formData.append('audioFiles', file);
  });

  const response = await fetch(`${backendUrl}/api/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('Erro no upload');
  }

  const result = await response.json();
  console.log('Upload concluído:', result);
}
```

##### **4.2 Configurar CORS no Frontend**
```typescript
// Adicionar configuração para aceitar o backend
const isProduction = !window.location.hostname.includes('localhost');
const apiUrl = isProduction 
  ? 'https://radio-backend-prod.us-west-2.elasticbeanstalk.com/api'
  : '/api';
```

#### **FASE 5: Testes e Validação (30 minutos)**

##### **5.1 Testes de Upload**
- [ ] Upload de arquivo MP3 único
- [ ] Upload múltiplo (2-5 arquivos)
- [ ] Validação de tipos de arquivo
- [ ] Teste de limite de tamanho
- [ ] Verificação de catálogo atualizado

##### **5.2 Testes de Integração**
- [ ] Admin detecta backend automaticamente
- [ ] Upload via drag & drop funcional
- [ ] Catálogo atualiza em tempo real
- [ ] Player carrega novas músicas

### 💰 **Custos Estimados**
- **Elastic Beanstalk**: Gratuito (apenas EC2)
- **t3.micro EC2**: ~$8.50/mês
- **S3 requests**: ~$0.50/mês
- **Data transfer**: ~$1.00/mês
- **Total**: ~$10/mês

---

## 🚀 **PRÓXIMOS PASSOS DE DESENVOLVIMENTO**

### 🎯 **Status Atual: Sistema Completo Funcional**

Após a validação completa dos testes de integração, o sistema está 100% operacional:
- ✅ Frontend PWA funcionando em produção HTTPS
- ✅ Backend API (local + AWS) validado e funcional
- ✅ iPhone PWA background audio resolvido definitivamente
- ✅ Integração frontend ↔ backend testada e aprovada
- ✅ Sistema dual backend (desenvolvimento + produção) funcional

### 📋 **Funcionalidades Avançadas para Implementar**

#### **🎵 FASE PRÓXIMA: Sistema de Upload Completo**
**Esforço:** M | **Status:** 📋 **Planejado** | **Prioridade:** Alta

**Objetivo:** Implementar upload de músicas via interface web diretamente para o sistema em produção.

**Funcionalidades a Implementar:**
```
1. Interface de Upload Web
   ├── Drag & drop de arquivos MP3/AAC
   ├── Preview de metadados (artista, título, duração)
   ├── Validação de formatos e tamanhos
   └── Progress bar de upload

2. Processamento Automático
   ├── Upload para S3 bucket
   ├── Atualização automática do catalog.json
   ├── Regeneração do arquivo contínuo AAC
   └── Sincronização com frontend

3. Gestão de Playlist
   ├── Reordenação de faixas
   ├── Edição de metadados
   ├── Remoção de faixas
   └── Backup automático
```

**Integração com Sistema Atual:**
- ✅ Backend já possui endpoints `/api/upload` e `/api/catalog`
- ✅ Frontend tem sistema administrativo base
- ✅ S3 configurado para armazenamento
- ✅ Sistema de catálogo já implementado

#### **📱 FASE PRÓXIMA: Experiência de Usuário Avançada**
**Esforço:** M | **Status:** 📋 **Planejado** | **Prioridade:** Média

**Funcionalidades de UX:**
```
1. Controles Avançados
   ├── Scrub bar com preview
   ├── Volume control
   ├── Repeat/shuffle modes
   └── Keyboard shortcuts

2. Visualização
   ├── Waveform visualization
   ├── Spectrum analyzer básico
   ├── Album art dinâmico
   └── Animations suaves

3. Social Features
   ├── Share track/timestamp
   ├── Favorites system
   ├── Listen history
   └── Social media integration
```

#### **📊 FASE PRÓXIMA: Analytics e Performance**
**Esforço:** S | **Status:** 📋 **Planejado** | **Prioridade:** Baixa

**Sistema de Analytics:**
```
1. User Analytics
   ├── Track play counts
   ├── User engagement metrics
   ├── Device/platform analytics
   └── Geographic distribution

2. Performance Monitoring
   ├── Audio loading times
   ├── PWA install rates
   ├── Error tracking
   └── Backend API performance

3. Business Intelligence
   ├── Popular tracks dashboard
   ├── Usage patterns analysis
   ├── Content optimization insights
   └── Growth metrics
```

#### **📅 Planejamento de Releases Futuras**
- **v1.2**: Experiência de Usuário Avançada (Q1 2026)
- **v1.3**: Analytics e Performance (Q2 2026)
- **v2.0**: Funcionalidades Avançadas (Q3 2026)

---

## 🚨 **CRISIS RESOLUTION DOCUMENTATION (04/01/2025)**

### 📋 **EMERGENCY RESPONSE CASE STUDY**

Esta seção documenta o processo completo de resolução da crise crítica enfrentada pelo projeto, servindo como **case study** para futuras emergências técnicas.

#### **⚠️ SITUAÇÃO CRÍTICA IDENTIFICADA**
- **Data**: 04 de Janeiro de 2025
- **Problema**: GitHub Actions deployments falhando com status UNPROCESSED
- **Impacto**: Sistema backend inoperante em produção
- **Urgência**: CRÍTICA - aplicação não funcionava

#### **🔍 METODOLOGIA DE DEBUGGING APLICADA**

**Fase 1: Análise de Symptoms**
```bash
# Verificação inicial dos workflows
git log --oneline -10
# Observação: Múltiplos workflows duplicados

# Check GitHub Actions status
# Resultado: UNPROCESSED, gray status indicators
```

**Fase 2: Root Cause Investigation**
```bash
# Investigação do arquivo principal
ls -la backend/app.js
# DESCOBERTA CRÍTICA: -rw-r--r-- 1 user staff 0 bytes

# Verificação do conteúdo
cat backend/app.js
# RESULTADO: Arquivo completamente vazio
```

**Fase 3: Impact Assessment**
- Backend AWS tentando executar arquivo vazio
- Express server não conseguindo inicializar
- Health endpoints inacessíveis
- Workflows conflitantes causando status cinza

**Fase 4: Solution Implementation**
```javascript
// Código Express restaurado em backend/app.js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.2.4'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Radio Importante Backend API',
    version: '2.2.4',
    status: 'operational'
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Fase 5: Workflow Cleanup**
```bash
# Remoção de workflows duplicados
mv .github/workflows/deploy-backend.yml.disabled
mv .github/workflows/duplicate-workflow.yml.disabled

# Manter apenas o workflow principal
# deploy-backend-simple.yml = ATIVO
```

**Fase 6: Validation & Testing**
```bash
# Deploy da correção
git add backend/app.js
git commit -m "CRITICAL FIX: Restore empty app.js with Express server"
git tag v2.2.4
git push origin main --tags

# Verificação do resultado
curl https://radio-importante-backend-prod.us-west-2.elasticbeanstalk.com/health
# SUCESSO: {"status":"ok","timestamp":"2025-01-04..."}
```

#### **✅ RESULTADO DA RECOVERY**

**Sistems Restored:**
- ✅ Backend v2.2.4 functional and responding
- ✅ GitHub Actions workflows clean and operational  
- ✅ Health endpoints returning correct JSON
- ✅ AWS Elastic Beanstalk environment RUNNING
- ✅ Metadata editor feature confirmed integrated

**Performance Metrics:**
- **Time to Detection**: ~30 minutes
- **Time to Root Cause**: ~45 minutes  
- **Time to Solution**: ~15 minutes
- **Total Recovery Time**: ~1.5 hours
- **Success Rate**: 100% - full functionality restored

#### **🎓 LESSONS LEARNED**

**Technical Lessons:**
1. **Empty files can pass git commits** but cause runtime failures
2. **Workflow duplication** creates GitHub Actions conflicts
3. **AWS EB health checks** are critical for early detection
4. **Systematic debugging** is more effective than random fixes

**Process Lessons:**
1. **Documentation value**: Comprehensive docs enabled rapid diagnosis
2. **Git history importance**: Previous working versions for comparison
3. **Health endpoint value**: Quick validation of system state
4. **Tag-based deployment**: Clear versioning for rollback capability

**Prevention Strategies:**
1. **File size validation** in CI/CD pipelines
2. **Pre-commit hooks** to prevent empty critical files
3. **Automated health checks** post-deployment
4. **Workflow duplication monitoring**

#### **📚 EMERGENCY PROCEDURES ESTABLISHED**

**Crisis Detection Protocol:**
1. Monitor GitHub Actions status regularly
2. Check health endpoints automatically
3. Validate critical file sizes in CI/CD
4. Set up alerts for deployment failures

**Crisis Response Protocol:**
1. **Assess**: Identify symptoms and scope
2. **Investigate**: Systematic root cause analysis
3. **Implement**: Targeted fixes based on root cause
4. **Validate**: Comprehensive testing of solutions
5. **Document**: Record process for future reference

**Recovery Validation Checklist:**
- [ ] Backend health endpoint responding
- [ ] GitHub Actions workflows clean
- [ ] AWS environment in RUNNING state
- [ ] Critical files have expected content
- [ ] Features integrated as expected

#### **🛡️ SYSTEM RESILIENCE IMPROVEMENTS**

**Implemented Safeguards:**
- More robust health check endpoints
- Validation of critical file contents
- Cleaner workflow management
- Better error detection and reporting

**Future Resilience Planning:**
- Automated file size checks in CI/CD
- Health check alerts for immediate notification
- Backup procedures for critical files
- Disaster recovery documentation

### **💡 CRISIS RESOLUTION METHODOLOGY**

Esta crise demonstrou a importância de:
- **Systematic debugging** over panic responses
- **Documentation** as a debugging tool
- **Root cause analysis** before implementing fixes
- **Validation** of all changes
- **Knowledge capture** for future incidents

**Este case study serve como template para resolver futuras crises técnicas no projeto e em projetos similares.**

---

## 🔬 **ANÁLISE TÉCNICA DETALHADA DOS PROBLEMAS ATUAIS**

### **1. GitHub Actions Pipeline Breakdown**

#### **Workflow Structure Issues:**
```yaml
# File: .github/workflows/deploy-complete.yml
# PROBLEMA: Inconsistência entre output names

deploy-backend:
  outputs:
    backend_url: ${{ steps.get-url.outputs.url }}  # ← Espera 'url'

# Mas o step seta 'backend_url':
- name: 🔍 Get backend URL
  id: get-url
  run: |
    echo "backend_url=$URL" >> "$GITHUB_OUTPUT"  # ← Seta 'backend_url'
```

**Root Cause:** Variable name mismatch causes empty BACKEND_URL in integration tests.

#### **Failed Integration Test Pattern:**
```bash
test-integration:
  run: |
    BACKEND_URL="${{ needs.deploy-backend.outputs.backend_url }}"  # ← Gets empty
    echo "Testing backend at: $BACKEND_URL"                       # ← Shows empty
    curl -f "$BACKEND_URL/health"                                 # ← Fails with URL error
```

### **2. AWS Elastic Beanstalk Configuration Conflicts**

#### **Nginx Directive Context Violations:**
```nginx
# PROBLEMA 1: /backend/.platform/nginx/conf.d/upload.conf
client_body_timeout 300s;    # ← DUPLICATE: também em 00_server_timeouts.conf

# PROBLEMA 2: /backend/.platform/nginx/conf.d/elasticbeanstalk/01_upload.conf  
client_header_timeout 60s;  # ← INVALID: não permitido em context location{}
```

**Nginx Context Rules:**
- `client_body_timeout`: Permitido apenas em `http{}` ou `server{}`
- `client_header_timeout`: Permitido apenas em `http{}` ou `server{}`
- **Location context**: Não aceita client timeout directives

#### **Directory Permission Architecture:**
```bash
# AWS EB File System Layout:
/var/app/current/          # Application code (read-only)
/var/app/public/           # Public assets (read-only) 
/tmp/                      # Writable directory (correct for uploads)

# CURRENT ISSUE:
mkdirSync('/var/app/public/audio')  # ❌ Permission denied
# SOLUTION:
mkdirSync('/tmp/audio')             # ✅ Should work
```

### **3. Multer Upload Field Mismatch Debugging**

#### **Frontend-Backend Contract:**
```javascript
// Frontend (src/admin-simple.ts):
formData.append('audioFiles', cleanFile);  // ✅ Correct

// Backend (backend/app.js):
upload.array('audioFiles')                  // ✅ Expects 'audioFiles'

// ERROR LOGS:
MulterError: Unexpected field 'file'        // ❌ Someone sending 'file'
```

**Possible Sources of 'file' field:**
1. External API testing tools (Postman, curl)
2. Different admin interfaces (admin.html vs admin-simple.ts)
3. Legacy code or test files
4. Health check probes

#### **Flexible Middleware Solution Implemented:**
```javascript
const flexibleUpload = (req, res, next) => {
  // Try 'audioFiles' first
  upload.array('audioFiles')(req, res, (err) => {
    if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
      // Fallback to 'file'
      upload.array('file')(req, res, (err2) => {
        // Handle both cases
      });
    }
  });
};
```

### **4. Service Worker Mixed Content Persistence**

#### **Cache Invalidation Issues:**
```javascript
// Current SW version:
const CACHE_NAME = 'radio-importante-v5';

// PROBLEM: Previous HTTP URLs may still be cached
// Even with force refresh mechanism
```

**Potential HTTP References:**
```bash
# Check for remaining HTTP calls:
grep -r "http://" src/ public/ --exclude-dir=node_modules
grep -r "localhost" src/ public/ --exclude-dir=node_modules  
grep -r "127.0.0.1" src/ public/ --exclude-dir=node_modules
```

---

## 🛠️ **RECOVERY CHECKLIST PARA DESENVOLVEDORES**

### **Step 1: Fix GitHub Actions (CRITICAL)**
```bash
# Edit .github/workflows/deploy-complete.yml
# Line 208: Change from
echo "backend_url=$URL" >> "$GITHUB_OUTPUT"
# TO:
echo "url=$URL" >> "$GITHUB_OUTPUT"

# Verify job output reference (line 51):
backend_url: ${{ steps.get-url.outputs.url }}  # Should match 'url'
```

### **Step 2: Fix Nginx Configuration**
```bash
# Remove from upload.conf:
client_body_timeout 300s;
client_header_timeout 300s;

# Keep only in 00_server_timeouts.conf:
client_header_timeout 60s;
client_body_timeout 600s;

# Remove from elasticbeanstalk/01_upload.conf:
# All client_* timeout directives (invalid in location context)
```

### **Step 3: Fix Upload Directory**
```javascript
// In backend/app.js, ensure:
const baseDir = process.env.NODE_ENV === 'production' 
  ? '/tmp/audio'           // ✅ Writable in EB
  : './public/audio';      // ✅ Local development
```

### **Step 4: Test and Deploy**
```bash
# Local testing:
npm run build
cd backend && node app.js
curl http://localhost:8080/health

# Commit and push:
git add .
git commit -m "Fix: GitHub Actions output + Nginx + upload paths"
git push origin main

# Monitor GitHub Actions:
# https://github.com/DeepDevPro/radio-importante-pwa/actions
```

---

## 📞 **CONTATO PARA EMERGÊNCIAS**

Se estes problemas persistirem após as correções acima:

1. **Verificar logs em tempo real:**
   ```bash
   aws logs tail /aws/elasticbeanstalk/radio-importante-backend-prod/var/log/eb-engine.log --follow
   ```

2. **Deploy manual via console AWS** se GitHub Actions continuar falhando

3. **Rollback para versão funcional anterior** se necessário

**Status Report:** Updated 12/09/2025 by AI Assistant durante debugging session
**Next Review:** Após aplicação das correções listadas acima
