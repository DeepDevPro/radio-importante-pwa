# 🔧 Guia Técnico - Radio Importante PWA

> **Complemento**: PLANO_EXECUCAO.md  
> **Foco**: Detalhes técnicos, troubleshooting e manutenção  
> **Atualizado em**: 27/09/2025 - Sistema Totalmente Funcional (Upload + Player)  
> **Para**: Programador Junior/Amador

---

## 🆕 Atualizações Recentes (27/09/2025) - SISTEMA COMPLETO ✅

### 🎵 Player + Upload 100% Funcionais - Correção Completa URLs 
```bash
STATUS: 🎉 SISTEMA TOTALMENTE OPERACIONAL
COMMITS: 
- 6fab52f: Fix Upload "this.client.send is not a function"
- 7604f81: Fix duplicação filename (backend/app.js) 
- d7cbba5: Add rota /audio/:filename proxy (backend/app.js)
BRANCH: staging (auto-deploy ativado)

PROBLEMAS RESOLVIDOS:
✅ Upload: "this.client.send is not a function" → multer-s3 2.10.0
✅ Player: URLs "/audio/audio/" duplicadas → filename cleanup
✅ Serving: 404 audio files → proxy route backend
✅ Persistence: Files mantidos cross-deploy → DigitalOcean Spaces

RESULTADO FINAL:
✅ Upload Admin: Funcionando → DigitalOcean Spaces  
✅ Player: Tocando música → Streaming direto do Spaces
✅ URLs: Corretas sem duplicação → /audio/arquivo.mp3
✅ Backend: Proxy servindo arquivos → GET /audio/:filename
✅ Persistência: Garantida → Files não perdidos em deploy

ARQUITETURA FINAL:
Upload: Admin → Backend → DigitalOcean Spaces
Catalog: Backend retorna filename limpo  
Serving: Frontend → Backend /audio/:filename → Spaces
Streaming: Direto do Spaces para Player
```

### 🔧 Detalhes Técnicos das Correções (27/09/2025)
```bash
PROBLEMA 1: Upload Error
- Causa: multer-s3 v3.x incompatível com AWS SDK v2
- Fix: Downgrade multer-s3: 3.0.1 → 2.10.0
- Arquivo: backend/package.json
- Status: ✅ Resolvido

PROBLEMA 2: Player URLs Duplicadas  
- Causa: DigitalOcean Spaces retorna file.key = "audio/arquivo.mp3"
- Frontend adiciona "/audio/" → "/audio/audio/arquivo.mp3" 
- Fix: filename cleanup no backend
- Código: file.key.replace(/^audio\//, '')
- Status: ✅ Resolvido

PROBLEMA 3: Backend Serving Files
- Causa: Player precisa acessar arquivos via backend
- Fix: Nova rota GET /audio/:filename 
- Funciona: Proxy do backend para DigitalOcean Spaces
- Status: ✅ Resolvido
```

### ✅ Sistema Completamente Funcional - v2.2.4-stable
```bash
STATUS: 🎉 VERSÃO ESTÁVEL CRIADA
TAG: v2.2.4-stable (main branch)
BRANCH: feature/improvements-v2.3 (desenvolvimento)

FUNCIONALIDADES ESTÁVEIS:
✅ Upload de música via admin panel funcionando
✅ Player tocando músicas corretamente
✅ Backend URLs configurados (DigitalOcean)  
✅ Artwork paths corrigidos (/img/Leo_R_161_small.webp)
✅ Deploy pipeline AWS + DigitalOcean funcionando
✅ Admin panel completo (lista, preview, delete)
✅ Service Worker v7 com cache invalidation
✅ CORS configurado corretamente
✅ Logging detalhado no backend
```

### ✅ CloudFront + Deploy Pipeline
```bash
PROBLEMA: AccessDenied ao criar invalidations
CAUSA: IAM Policy com Resource amarrado ao ARN específico
SOLUÇÃO: Alterado para "Resource": "*"
RESULTADO: Invalidation funcionando em ~2-3 min por deploy
```

### ✅ Vite Build / Admin Panel
```bash
PROBLEMA: admin.html antigo (2.195 bytes) servindo versão quebrada
CAUSA: Vite não configurado para múltiplos entrypoints
SOLUÇÃO: rollupOptions.input adicionou admin.html + novo src/admin.ts
RESULTADO: Admin funcional (upload, health check, tabs, drag & drop)
```

---

## 🔧 **FIX CRÍTICO: Upload "this.client.send is not a function" (22/09/2025)**

### **📋 Solução Implementada - multer-s3 Downgrade**
```bash
PROBLEMA: Error "this.client.send is not a function" no upload
CAUSA: Incompatibilidade multer-s3 3.x + AWS SDK v2
SOLUÇÃO: Downgrade multer-s3: 3.0.1 → 2.10.0
COMMIT: 6fab52f (staging)
RESULTADO: Upload funcionando via curl + admin UI
```

## 🔄 **MIGRAÇÃO DIGITALOCEAN SPACES (21/09/2025)**

### **📋 Problema Técnico Identificado**

#### **Storage Efêmero no DigitalOcean App Platform**
```bash
PROBLEMA:
- Arquivos salvos em /app/public/audio (container local)
- Containers são efêmeros (recriam a cada deploy)
- Resultado: arquivos desaparecem após redeploys

EVIDÊNCIA NOS LOGS:
- Local: "🌊 Using Digital Ocean Spaces: ..."
- Staging: "📁 Upload path: /app/public/audio"
- Conclusão: credenciais DO_SPACES_* não detectadas em produção
```

### **🛠️ Implementação Técnica da Solução**

#### **Arquitetura de Storage Híbrida**
```javascript
// backend/storage-config.js - Detecta ambiente e configura storage

// Spaces (S3-compatible) quando credenciais disponíveis:
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  region: process.env.DO_SPACES_REGION || 'nyc3'
});

// Fallback para storage local quando credenciais não disponíveis
const storage = multerS3({ s3, bucket, acl: 'public-read', ... })
```

#### **URL Generation Strategy**
```javascript
// Prioridade de URLs (compatibilidade máxima):
// 1. file.location (multer-s3 direct URL)
// 2. storageConfig.getFileUrl(key) (manual construction)  
// 3. Local fallback (/audio/filename)

url: file.location || storageConfig.getFileUrl(file.key || file.filename)
```

#### **Logs de Diagnóstico Implementados**
```javascript
// backend/app.js - Startup diagnostics
console.log('🔍 Storage Configuration Diagnostics:');
console.log(`  DO_SPACES_KEY: ${process.env.DO_SPACES_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  DO_SPACES_SECRET: ${process.env.DO_SPACES_SECRET ? 'SET' : 'NOT SET'}`);
console.log(`  DO_SPACES_BUCKET: ${process.env.DO_SPACES_BUCKET || 'NOT SET'}`);

// Decisão de storage baseada em credenciais:
if (process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET) {
  console.log(`🌊 Using Digital Ocean Spaces: ${bucket}.${endpoint}`);
} else {
  console.log(`📁 Upload path: ${uploadPath}`);
}
```

### **⚙️ Configuração Técnica Required**

#### **Environment Variables (DigitalOcean App Platform)**
```bash
# NO COMPONENTE DO BACKEND (não App-Level):
DO_SPACES_ENDPOINT=atl1.digitaloceanspaces.com
DO_SPACES_REGION=atl1
DO_SPACES_BUCKET=radio-importante-audio
DO_SPACES_KEY=<SPACES_ACCESS_KEY>    # NÃO token dop_v1
DO_SPACES_SECRET=<SPACES_SECRET_KEY> # NÃO token dop_v1
```

#### **CORS Configuration (Bucket Settings)**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["Accept-Ranges", "Content-Range", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3000
  }
]
```

#### **Key Technical Decisions**
```bash
✅ AWS SDK v2: Compatível com DigitalOcean Spaces (S3-compatible)
✅ multer-s3: Integração direta do Multer com S3 API
✅ AUTO_CONTENT_TYPE: Detecção automática de MIME type
✅ key pattern: audio/<timestamp>-<sanitized_name>
✅ ACL: public-read (arquivos acessíveis publicamente)
✅ Endpoint pattern: https://<bucket>.<endpoint>/<key>
```

### **🔧 Troubleshooting Checklist**

#### **Se logs mostram "📁 Upload path" ao invés de "🌊 Using Digital Ocean Spaces":**
```bash
1. ✅ Verificar se DO_SPACES_KEY e DO_SPACES_SECRET estão SET
2. ✅ Confirmar que são Spaces Access Keys (não dop_v1 tokens)
3. ✅ Validar se env vars estão no COMPONENTE backend (não só App-Level)
4. ✅ Force Rebuild & Deploy após mudanças
5. ✅ Conferir Runtime Logs após novo timestamp
```

#### **Se upload falha com multer-s3:**
```bash
1. ✅ Verificar credenciais de acesso (chaves válidas)
2. ✅ Confirmar endpoint e região corretos (atl1)
3. ✅ Testar CORS do bucket (GET/HEAD permitidos)
4. ✅ Validar formato da key (audio/<filename>)
5. ✅ Conferir se bucket existe e está acessível
```

---

## 🛠️ **DETALHES TÉCNICOS DA MIGRAÇÃO**

### **Como o Sistema Funciona Agora (Explicação Simples)**

#### **1. Fluxo de Upload Completo**
```bash
PASSO 1: User faz upload pelo frontend
↓
PASSO 2: Frontend envia POST para /api/upload
↓  
PASSO 3: Flexible middleware aceita 'audioFiles' ou 'file'
↓
PASSO 4: Multer salva arquivo em UPLOAD_PATH (/app/public/audio)
↓
PASSO 5: Sistema cria entrada no catálogo
↓
PASSO 6: saveCatalog() salva em CATALOG_PATH (/app/public/data/catalog.json)
↓
PASSO 7: Response com sucesso + dados do track
```

#### **2. Fluxo de Serving de Arquivos**
```bash
PASSO 1: Frontend/User requisita /audio/filename.mp3
↓
PASSO 2: Express middleware express.static procura arquivo
↓
PASSO 3: Arquivo encontrado em audioPath (/app/public/audio)
↓
PASSO 4: Express serve arquivo com headers corretos
↓
PASSO 5: Browser recebe arquivo e pode reproduzir
```

#### **3. Environment Variables (CRÍTICAS)**
```javascript
// Como funciona no código:
const audioPath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'public', 'audio');

// Se UPLOAD_PATH está definido no DigitalOcean → usa ele
// Se não está definido → usa caminho local (desenvolvimento)

// Valores em produção (DigitalOcean):
UPLOAD_PATH="/app/public/audio"           // Onde salva uploads
CATALOG_PATH="/app/public/data/catalog.json"  // Onde salva catálogo
PORT="8080"                               // Porta do servidor
NODE_ENV="production"                     // Ambiente
FRONTEND_URL="https://radio.importantestudio.com"  // Para CORS
```

### **Docker Container (Como Funciona)**

#### **Dockerfile Explicado Linha por Linha**
```dockerfile
FROM node:18-alpine
# Pega imagem base com Node.js 18 (versão LTS)
# Alpine = versão Linux pequena e rápida

WORKDIR /app  
# Define /app como diretório de trabalho dentro do container
# Todos os comandos seguintes executam de /app

COPY package*.json ./
# Copia package.json e package-lock.json primeiro
# Por que primeiro? Para cache do Docker - se dependências não mudaram, não reinstala

RUN npm ci
# Instala dependências
# npm ci é mais rápido que npm install para produção

COPY . .
# Copia resto do código para o container
# Feito depois para aproveitar cache das dependências

EXPOSE 8080
# Informa que a aplicação usa porta 8080
# Não abre a porta, só documenta

CMD ["node", "app.js"]
# Comando para iniciar a aplicação quando container roda
```

#### **Como Build e Deploy Funcionam**
```bash
TRIGGER: git push origin main

PROCESSO NO DIGITALOCEAN:
1. DigitalOcean detecta push (GitHub webhook)
2. Clona repositório na branch main  
3. Navega para /backend (source_dir configurado)
4. Executa: docker build -f Dockerfile .
5. Docker executa cada linha do Dockerfile
6. Imagem criada e armazenada no registry DigitalOcean
7. Container antigo é parado
8. Novo container é iniciado com nova imagem
9. Health check verifica se está funcionando
10. Tráfego é direcionado para novo container
11. Container antigo é removido

TEMPO TOTAL: ~2-3 minutos
```

---

## 🚨 **TROUBLESHOOTING E PROBLEMAS COMUNS**

### **Problema: Upload funciona mas arquivo retorna 404**

#### **Diagnóstico**
```bash
SINTOMA: POST /api/upload → 200 OK, mas GET /audio/filename → 404

CAUSAS POSSÍVEIS:
1. Multiple instances (arquivo salvo em instância A, request em B)
2. Static middleware não configurado
3. Environment variable UPLOAD_PATH incorreta
4. Permissions no filesystem

COMO INVESTIGAR:
curl -I https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/audio/filename
- Se 404 → problema de serving
- Se 200 → problema resolvido
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar instance_count
doctl apps spec get f8c358ee-ba7e-4da4-8ffe-065f9554a061 | grep instance_count
- Se > 1 → reduzir para 1 ou implementar storage externo

SOLUÇÃO 2: Verificar static middleware
grep -n "express.static" backend/app.js
- Deve ter: app.use('/audio', express.static(audioPath))

SOLUÇÃO 3: Verificar environment variables
DigitalOcean Dashboard → Settings → Environment Variables
- UPLOAD_PATH deve estar definido
```

### **Problema: Environment variables não estão funcionando**

#### **Diagnóstico**
```bash
SINTOMA: Código usa paths locais em vez de environment variables

COMO VERIFICAR:
1. DigitalOcean Dashboard → Settings → Environment Variables
2. Verificar se UPLOAD_PATH e CATALOG_PATH estão definidos
3. Verificar logs de startup: "Upload path: /app/public/audio"

LOGS DE STARTUP SAUDÁVEIS:
🎵 Radio Importante Backend v2.2.4 running on port 8080
📊 Environment: production  
🔗 Health check: http://localhost:8080/health
📁 Catalog tracks: 0
📁 Upload path: /app/public/audio  ← DEVE MOSTRAR ESTE PATH
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar variáveis no DigitalOcean
- Ir em Settings → Environment Variables
- Confirmar que UPLOAD_PATH=/app/public/audio está presente
- Se não estiver → adicionar e redeploy

SOLUÇÃO 2: Verificar código
grep -n "process.env.UPLOAD_PATH" backend/app.js
- Deve aparecer nas linhas do multer e express.static

SOLUÇÃO 3: Forçar redeploy
doctl apps create-deployment f8c358ee-ba7e-4da4-8ffe-065f9554a061
```

### **Problema: MulterError: Unexpected field**

#### **Diagnóstico**
```bash
SINTOMA: Upload retorna erro "Unexpected field"

CAUSA: Frontend enviando campo diferente do esperado
- Frontend envia: 'file'
- Backend espera: 'audioFiles'
- Ou vice-versa

COMO VERIFICAR:
- Olhar error message: qual field foi enviado vs esperado
- Verificar flexible middleware está ativo
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar flexible middleware
grep -A 20 "flexibleUpload" backend/app.js
- Deve ter lógica para tentar 'audioFiles' depois 'file'

SOLUÇÃO 2: Testar manualmente
curl -X POST -F "audioFiles=@test.mp3" /api/upload  # Tenta audioFiles
curl -X POST -F "file=@test.mp3" /api/upload        # Tenta file

SOLUÇÃO 3: Frontend
- Verificar FormData no frontend usa nome correto
- Preferred: 'audioFiles' (plural)
```

### **Problema: Deploy falha ou app não inicia**

#### **Diagnóstico**
```bash
ONDE VERIFICAR:
DigitalOcean Dashboard → Runtime Logs

ERROS COMUNS:
1. "npm ci failed" → problema com package.json
2. "Port 8080 already in use" → configuração de porta
3. "Cannot find module" → dependência faltando
4. "EACCES permission denied" → problema de filesystem
```

#### **Soluções**
```bash
ERRO: npm ci failed
CAUSA: package-lock.json inconsistente
SOLUÇÃO: 
- Deletar node_modules e package-lock.json local
- npm install localmente
- Commit package-lock.json atualizado

ERRO: Port already in use  
CAUSA: Environment variable PORT incorreta
SOLUÇÃO: Verificar PORT=8080 nas environment variables

ERRO: Cannot find module
CAUSA: Dependência não listada em package.json
SOLUÇÃO: npm install --save nome-da-dependencia

ERRO: Permission denied
CAUSA: Container tentando escrever em local não permitido
SOLUÇÃO: Verificar UPLOAD_PATH e CATALOG_PATH paths
```

---

## 🔧 **TROUBLESHOOTING: Upload "this.client.send is not a function" (22/09/2025)**

### **📋 Problema Técnico Identificado**

#### **Incompatibilidade AWS SDK v2 + multer-s3 v3**
```bash
PROBLEMA:
- Error: "this.client.send is not a function" no upload
- HTTP 400 Bad Request na API /api/upload
- multer-s3 3.x esperando cliente S3 com método .send() (AWS SDK v3)
- Backend usando AWS.S3() do aws-sdk v2 (sem método .send)

EVIDÊNCIA NOS LOGS:
- ⚠️ [flexibleUpload] Tentativa com campo "audioFiles" falhou: undefined this.client.send is not a function
- package-lock.json continha @aws-sdk/client-s3 3.893.0
- Backend esperando S3 v2 mas multer-s3 puxando v3
```

### **🛠️ Implementação Técnica da Solução**

#### **Downgrade Estratégico para Compatibilidade**
```javascript
// backend/package.json - ANTES (QUEBRADO):
{
  "dependencies": {
    "aws-sdk": "^2.1692.0",      // v2
    "multer-s3": "^3.0.1"        // v3 (incompatível)
  }
}

// backend/package.json - DEPOIS (FUNCIONANDO):
{
  "dependencies": {
    "aws-sdk": "^2.1692.0",      // v2
    "multer-s3": "2.10.0"        // v2 (compatível, sem caret)
  }
}
```

#### **Processo de Correção Aplicado**
```bash
# 1. Diagnóstico (sem alterações)
npm ls aws-sdk multer-s3
grep -n "@aws-sdk/client-s3" package-lock.json

# 2. Correção (backend apenas)
rm -f package-lock.json  # Remove lock conflitante
npm install              # Reinstala com versões corretas

# 3. Validação
npm ls @aws-sdk/client-s3  # Deve retornar vazio
npm ls multer-s3           # Deve mostrar 2.10.0

# 4. Deploy
git add backend/package.json backend/package-lock.json
git commit -m "fix: downgrade multer-s3 to 2.10.0 for AWS SDK v2 compatibility"
git push origin staging
```

#### **Resultado da Correção**
```bash
✅ TESTE CURL (22/09/2025 13:02:38 GMT):
   Request: POST /api/upload (multipart/form-data)
   Response: HTTP 200 {"success":true,"message":"1 arquivo(s) processado(s) com sucesso",...}
   File URL: https://radio-importante-audio.atl1.digitaloceanspaces.com/audio/1758546157494-01_Damn_feat_Kinny.mp3

✅ TESTE ADMIN UI:
   Upload via drag&drop: Funcionando
   Arquivos no Spaces: Visíveis no painel DigitalOcean
   Frontend: Nenhuma alteração necessária

✅ COMPATIBILIDADE MANTIDA:
   AWS SDK v2: aws-sdk@2.1692.0 (mantido)
   multer-s3: 2.10.0 (compatível com v2)
   DigitalOcean Spaces: Funcionando com endpoint atl1
```

#### **Prevenção de Regressões**
```javascript
// package.json - Versão travada (sem caret ^)
"multer-s3": "2.10.0"  // ✅ Impede upgrade automático para 3.x

// Monitoramento de dependências
npm audit                    // Verificar vulnerabilidades
npm ls | grep multer        // Confirmar versões
npm outdated               // Revisar atualizações disponíveis
```

---

## 🛠️ **DETALHES TÉCNICOS DA MIGRAÇÃO**

### **Como o Sistema Funciona Agora (Explicação Simples)**

#### **1. Fluxo de Upload Completo**
```bash
PASSO 1: User faz upload pelo frontend
↓
PASSO 2: Frontend envia POST para /api/upload
↓  
PASSO 3: Flexible middleware aceita 'audioFiles' ou 'file'
↓
PASSO 4: Multer salva arquivo em UPLOAD_PATH (/app/public/audio)
↓
PASSO 5: Sistema cria entrada no catálogo
↓
PASSO 6: saveCatalog() salva em CATALOG_PATH (/app/public/data/catalog.json)
↓
PASSO 7: Response com sucesso + dados do track
```

#### **2. Fluxo de Serving de Arquivos**
```bash
PASSO 1: Frontend/User requisita /audio/filename.mp3
↓
PASSO 2: Express middleware express.static procura arquivo
↓
PASSO 3: Arquivo encontrado em audioPath (/app/public/audio)
↓
PASSO 4: Express serve arquivo com headers corretos
↓
PASSO 5: Browser recebe arquivo e pode reproduzir
```

#### **3. Environment Variables (CRÍTICAS)**
```javascript
// Como funciona no código:
const audioPath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'public', 'audio');

// Se UPLOAD_PATH está definido no DigitalOcean → usa ele
// Se não está definido → usa caminho local (desenvolvimento)

// Valores em produção (DigitalOcean):
UPLOAD_PATH="/app/public/audio"           // Onde salva uploads
CATALOG_PATH="/app/public/data/catalog.json"  // Onde salva catálogo
PORT="8080"                               // Porta do servidor
NODE_ENV="production"                     // Ambiente
FRONTEND_URL="https://radio.importantestudio.com"  // Para CORS
```

### **Docker Container (Como Funciona)**

#### **Dockerfile Explicado Linha por Linha**
```dockerfile
FROM node:18-alpine
# Pega imagem base com Node.js 18 (versão LTS)
# Alpine = versão Linux pequena e rápida

WORKDIR /app  
# Define /app como diretório de trabalho dentro do container
# Todos os comandos seguintes executam de /app

COPY package*.json ./
# Copia package.json e package-lock.json primeiro
# Por que primeiro? Para cache do Docker - se dependências não mudaram, não reinstala

RUN npm ci
# Instala dependências
# npm ci é mais rápido que npm install para produção

COPY . .
# Copia resto do código para o container
# Feito depois para aproveitar cache das dependências

EXPOSE 8080
# Informa que a aplicação usa porta 8080
# Não abre a porta, só documenta

CMD ["node", "app.js"]
# Comando para iniciar a aplicação quando container roda
```

#### **Como Build e Deploy Funcionam**
```bash
TRIGGER: git push origin main

PROCESSO NO DIGITALOCEAN:
1. DigitalOcean detecta push (GitHub webhook)
2. Clona repositório na branch main  
3. Navega para /backend (source_dir configurado)
4. Executa: docker build -f Dockerfile .
5. Docker executa cada linha do Dockerfile
6. Imagem criada e armazenada no registry DigitalOcean
7. Container antigo é parado
8. Novo container é iniciado com nova imagem
9. Health check verifica se está funcionando
10. Tráfego é direcionado para novo container
11. Container antigo é removido

TEMPO TOTAL: ~2-3 minutos
```

---

## 🚨 **TROUBLESHOOTING E PROBLEMAS COMUNS**

### **Problema: Upload funciona mas arquivo retorna 404**

#### **Diagnóstico**
```bash
SINTOMA: POST /api/upload → 200 OK, mas GET /audio/filename → 404

CAUSAS POSSÍVEIS:
1. Multiple instances (arquivo salvo em instância A, request em B)
2. Static middleware não configurado
3. Environment variable UPLOAD_PATH incorreta
4. Permissions no filesystem

COMO INVESTIGAR:
curl -I https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/audio/filename
- Se 404 → problema de serving
- Se 200 → problema resolvido
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar instance_count
doctl apps spec get f8c358ee-ba7e-4da4-8ffe-065f9554a061 | grep instance_count
- Se > 1 → reduzir para 1 ou implementar storage externo

SOLUÇÃO 2: Verificar static middleware
grep -n "express.static" backend/app.js
- Deve ter: app.use('/audio', express.static(audioPath))

SOLUÇÃO 3: Verificar environment variables
DigitalOcean Dashboard → Settings → Environment Variables
- UPLOAD_PATH deve estar definido
```

### **Problema: Environment variables não estão funcionando**

#### **Diagnóstico**
```bash
SINTOMA: Código usa paths locais em vez de environment variables

COMO VERIFICAR:
1. DigitalOcean Dashboard → Settings → Environment Variables
2. Verificar se UPLOAD_PATH e CATALOG_PATH estão definidos
3. Verificar logs de startup: "Upload path: /app/public/audio"

LOGS DE STARTUP SAUDÁVEIS:
🎵 Radio Importante Backend v2.2.4 running on port 8080
📊 Environment: production  
🔗 Health check: http://localhost:8080/health
📁 Catalog tracks: 0
📁 Upload path: /app/public/audio  ← DEVE MOSTRAR ESTE PATH
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar variáveis no DigitalOcean
- Ir em Settings → Environment Variables
- Confirmar que UPLOAD_PATH=/app/public/audio está presente
- Se não estiver → adicionar e redeploy

SOLUÇÃO 2: Verificar código
grep -n "process.env.UPLOAD_PATH" backend/app.js
- Deve aparecer nas linhas do multer e express.static

SOLUÇÃO 3: Forçar redeploy
doctl apps create-deployment f8c358ee-ba7e-4da4-8ffe-065f9554a061
```

### **Problema: MulterError: Unexpected field**

#### **Diagnóstico**
```bash
SINTOMA: Upload retorna erro "Unexpected field"

CAUSA: Frontend enviando campo diferente do esperado
- Frontend envia: 'file'
- Backend espera: 'audioFiles'
- Ou vice-versa

COMO VERIFICAR:
- Olhar error message: qual field foi enviado vs esperado
- Verificar flexible middleware está ativo
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar flexible middleware
grep -A 20 "flexibleUpload" backend/app.js
- Deve ter lógica para tentar 'audioFiles' depois 'file'

SOLUÇÃO 2: Testar manualmente
curl -X POST -F "audioFiles=@test.mp3" /api/upload  # Tenta audioFiles
curl -X POST -F "file=@test.mp3" /api/upload        # Tenta file

SOLUÇÃO 3: Frontend
- Verificar FormData no frontend usa nome correto
- Preferred: 'audioFiles' (plural)
```

### **Problema: Deploy falha ou app não inicia**

#### **Diagnóstico**
```bash
ONDE VERIFICAR:
DigitalOcean Dashboard → Runtime Logs

ERROS COMUNS:
1. "npm ci failed" → problema com package.json
2. "Port 8080 already in use" → configuração de porta
3. "Cannot find module" → dependência faltando
4. "EACCES permission denied" → problema de filesystem
```

#### **Soluções**
```bash
ERRO: npm ci failed
CAUSA: package-lock.json inconsistente
SOLUÇÃO: 
- Deletar node_modules e package-lock.json local
- npm install localmente
- Commit package-lock.json atualizado

ERRO: Port already in use  
CAUSA: Environment variable PORT incorreta
SOLUÇÃO: Verificar PORT=8080 nas environment variables

ERRO: Cannot find module
CAUSA: Dependência não listada em package.json
SOLUÇÃO: npm install --save nome-da-dependencia

ERRO: Permission denied
CAUSA: Container tentando escrever em local não permitido
SOLUÇÃO: Verificar UPLOAD_PATH e CATALOG_PATH paths
```

---

## 🔧 **TROUBLESHOOTING: Upload "this.client.send is not a function" (22/09/2025)**

### **📋 Problema Técnico Identificado**

#### **Incompatibilidade AWS SDK v2 + multer-s3 v3**
```bash
PROBLEMA:
- Error: "this.client.send is not a function" no upload
- HTTP 400 Bad Request na API /api/upload
- multer-s3 3.x esperando cliente S3 com método .send() (AWS SDK v3)
- Backend usando AWS.S3() do aws-sdk v2 (sem método .send)

EVIDÊNCIA NOS LOGS:
- ⚠️ [flexibleUpload] Tentativa com campo "audioFiles" falhou: undefined this.client.send is not a function
- package-lock.json continha @aws-sdk/client-s3 3.893.0
- Backend esperando S3 v2 mas multer-s3 puxando v3
```

### **🛠️ Implementação Técnica da Solução**

#### **Downgrade Estratégico para Compatibilidade**
```javascript
// backend/package.json - ANTES (QUEBRADO):
{
  "dependencies": {
    "aws-sdk": "^2.1692.0",      // v2
    "multer-s3": "^3.0.1"        // v3 (incompatível)
  }
}

// backend/package.json - DEPOIS (FUNCIONANDO):
{
  "dependencies": {
    "aws-sdk": "^2.1692.0",      // v2
    "multer-s3": "2.10.0"        // v2 (compatível, sem caret)
  }
}
```

#### **Processo de Correção Aplicado**
```bash
# 1. Diagnóstico (sem alterações)
npm ls aws-sdk multer-s3
grep -n "@aws-sdk/client-s3" package-lock.json

# 2. Correção (backend apenas)
rm -f package-lock.json  # Remove lock conflitante
npm install              # Reinstala com versões corretas

# 3. Validação
npm ls @aws-sdk/client-s3  # Deve retornar vazio
npm ls multer-s3           # Deve mostrar 2.10.0

# 4. Deploy
git add backend/package.json backend/package-lock.json
git commit -m "fix: downgrade multer-s3 to 2.10.0 for AWS SDK v2 compatibility"
git push origin staging
```

#### **Resultado da Correção**
```bash
✅ TESTE CURL (22/09/2025 13:02:38 GMT):
   Request: POST /api/upload (multipart/form-data)
   Response: HTTP 200 {"success":true,"message":"1 arquivo(s) processado(s) com sucesso",...}
   File URL: https://radio-importante-audio.atl1.digitaloceanspaces.com/audio/1758546157494-01_Damn_feat_Kinny.mp3

✅ TESTE ADMIN UI:
   Upload via drag&drop: Funcionando
   Arquivos no Spaces: Visíveis no painel DigitalOcean
   Frontend: Nenhuma alteração necessária

✅ COMPATIBILIDADE MANTIDA:
   AWS SDK v2: aws-sdk@2.1692.0 (mantido)
   multer-s3: 2.10.0 (compatível com v2)
   DigitalOcean Spaces: Funcionando com endpoint atl1
```

#### **Prevenção de Regressões**
```javascript
// package.json - Versão travada (sem caret ^)
"multer-s3": "2.10.0"  // ✅ Impede upgrade automático para 3.x

// Monitoramento de dependências
npm audit                    // Verificar vulnerabilidades
npm ls | grep multer        // Confirmar versões
npm outdated               // Revisar atualizações disponíveis
```

---

## 🛠️ **DETALHES TÉCNICOS DA MIGRAÇÃO**

### **Como o Sistema Funciona Agora (Explicação Simples)**

#### **1. Fluxo de Upload Completo**
```bash
PASSO 1: User faz upload pelo frontend
↓
PASSO 2: Frontend envia POST para /api/upload
↓  
PASSO 3: Flexible middleware aceita 'audioFiles' ou 'file'
↓
PASSO 4: Multer salva arquivo em UPLOAD_PATH (/app/public/audio)
↓
PASSO 5: Sistema cria entrada no catálogo
↓
PASSO 6: saveCatalog() salva em CATALOG_PATH (/app/public/data/catalog.json)
↓
PASSO 7: Response com sucesso + dados do track
```

#### **2. Fluxo de Serving de Arquivos**
```bash
PASSO 1: Frontend/User requisita /audio/filename.mp3
↓
PASSO 2: Express middleware express.static procura arquivo
↓
PASSO 3: Arquivo encontrado em audioPath (/app/public/audio)
↓
PASSO 4: Express serve arquivo com headers corretos
↓
PASSO 5: Browser recebe arquivo e pode reproduzir
```

#### **3. Environment Variables (CRÍTICAS)**
```javascript
// Como funciona no código:
const audioPath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'public', 'audio');

// Se UPLOAD_PATH está definido no DigitalOcean → usa ele
// Se não está definido → usa caminho local (desenvolvimento)

// Valores em produção (DigitalOcean):
UPLOAD_PATH="/app/public/audio"           // Onde salva uploads
CATALOG_PATH="/app/public/data/catalog.json"  // Onde salva catálogo
PORT="8080"                               // Porta do servidor
NODE_ENV="production"                     // Ambiente
FRONTEND_URL="https://radio.importantestudio.com"  // Para CORS
```

### **Docker Container (Como Funciona)**

#### **Dockerfile Explicado Linha por Linha**
```dockerfile
FROM node:18-alpine
# Pega imagem base com Node.js 18 (versão LTS)
# Alpine = versão Linux pequena e rápida

WORKDIR /app  
# Define /app como diretório de trabalho dentro do container
# Todos os comandos seguintes executam de /app

COPY package*.json ./
# Copia package.json e package-lock.json primeiro
# Por que primeiro? Para cache do Docker - se dependências não mudaram, não reinstala

RUN npm ci
# Instala dependências
# npm ci é mais rápido que npm install para produção

COPY . .
# Copia resto do código para o container
# Feito depois para aproveitar cache das dependências

EXPOSE 8080
# Informa que a aplicação usa porta 8080
# Não abre a porta, só documenta

CMD ["node", "app.js"]
# Comando para iniciar a aplicação quando container roda
```

#### **Como Build e Deploy Funcionam**
```bash
TRIGGER: git push origin main

PROCESSO NO DIGITALOCEAN:
1. DigitalOcean detecta push (GitHub webhook)
2. Clona repositório na branch main  
3. Navega para /backend (source_dir configurado)
4. Executa: docker build -f Dockerfile .
5. Docker executa cada linha do Dockerfile
6. Imagem criada e armazenada no registry DigitalOcean
7. Container antigo é parado
8. Novo container é iniciado com nova imagem
9. Health check verifica se está funcionando
10. Tráfego é direcionado para novo container
11. Container antigo é removido

TEMPO TOTAL: ~2-3 minutos
```

---

## 🚨 **TROUBLESHOOTING E PROBLEMAS COMUNS**

### **Problema: Upload funciona mas arquivo retorna 404**

#### **Diagnóstico**
```bash
SINTOMA: POST /api/upload → 200 OK, mas GET /audio/filename → 404

CAUSAS POSSÍVEIS:
1. Multiple instances (arquivo salvo em instância A, request em B)
2. Static middleware não configurado
3. Environment variable UPLOAD_PATH incorreta
4. Permissions no filesystem

COMO INVESTIGAR:
curl -I https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/audio/filename
- Se 404 → problema de serving
- Se 200 → problema resolvido
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar instance_count
doctl apps spec get f8c358ee-ba7e-4da4-8ffe-065f9554a061 | grep instance_count
- Se > 1 → reduzir para 1 ou implementar storage externo

SOLUÇÃO 2: Verificar static middleware
grep -n "express.static" backend/app.js
- Deve ter: app.use('/audio', express.static(audioPath))

SOLUÇÃO 3: Verificar environment variables
DigitalOcean Dashboard → Settings → Environment Variables
- UPLOAD_PATH deve estar definido
```

### **Problema: Environment variables não estão funcionando**

#### **Diagnóstico**
```bash
SINTOMA: Código usa paths locais em vez de environment variables

COMO VERIFICAR:
1. DigitalOcean Dashboard → Settings → Environment Variables
2. Verificar se UPLOAD_PATH e CATALOG_PATH estão definidos
3. Verificar logs de startup: "Upload path: /app/public/audio"

LOGS DE STARTUP SAUDÁVEIS:
🎵 Radio Importante Backend v2.2.4 running on port 8080
📊 Environment: production  
🔗 Health check: http://localhost:8080/health
📁 Catalog tracks: 0
📁 Upload path: /app/public/audio  ← DEVE MOSTRAR ESTE PATH
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar variáveis no DigitalOcean
- Ir em Settings → Environment Variables
- Confirmar que UPLOAD_PATH=/app/public/audio está presente
- Se não estiver → adicionar e redeploy

SOLUÇÃO 2: Verificar código
grep -n "process.env.UPLOAD_PATH" backend/app.js
- Deve aparecer nas linhas do multer e express.static

SOLUÇÃO 3: Forçar redeploy
doctl apps create-deployment f8c358ee-ba7e-4da4-8ffe-065f9554a061
```

### **Problema: MulterError: Unexpected field**

#### **Diagnóstico**
```bash
SINTOMA: Upload retorna erro "Unexpected field"

CAUSA: Frontend enviando campo diferente do esperado
- Frontend envia: 'file'
- Backend espera: 'audioFiles'
- Ou vice-versa

COMO VERIFICAR:
- Olhar error message: qual field foi enviado vs esperado
- Verificar flexible middleware está ativo
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar flexible middleware
grep -A 20 "flexibleUpload" backend/app.js
- Deve ter lógica para tentar 'audioFiles' depois 'file'

SOLUÇÃO 2: Testar manualmente
curl -X POST -F "audioFiles=@test.mp3" /api/upload  # Tenta audioFiles
curl -X POST -F "file=@test.mp3" /api/upload        # Tenta file

SOLUÇÃO 3: Frontend
- Verificar FormData no frontend usa nome correto
- Preferred: 'audioFiles' (plural)
```

### **Problema: Deploy falha ou app não inicia**

#### **Diagnóstico**
```bash
ONDE VERIFICAR:
DigitalOcean Dashboard → Runtime Logs

ERROS COMUNS:
1. "npm ci failed" → problema com package.json
2. "Port 8080 already in use" → configuração de porta
3. "Cannot find module" → dependência faltando
4. "EACCES permission denied" → problema de filesystem
```

#### **Soluções**
```bash
ERRO: npm ci failed
CAUSA: package-lock.json inconsistente
SOLUÇÃO: 
- Deletar node_modules e package-lock.json local
- npm install localmente
- Commit package-lock.json atualizado

ERRO: Port already in use  
CAUSA: Environment variable PORT incorreta
SOLUÇÃO: Verificar PORT=8080 nas environment variables

ERRO: Cannot find module
CAUSA: Dependência não listada em package.json
SOLUÇÃO: npm install --save nome-da-dependencia

ERRO: Permission denied
CAUSA: Container tentando escrever em local não permitido
SOLUÇÃO: Verificar UPLOAD_PATH e CATALOG_PATH paths
```

---

## 🔧 **TROUBLESHOOTING: Upload "this.client.send is not a function" (22/09/2025)**

### **📋 Problema Técnico Identificado**

#### **Incompatibilidade AWS SDK v2 + multer-s3 v3**
```bash
PROBLEMA:
- Error: "this.client.send is not a function" no upload
- HTTP 400 Bad Request na API /api/upload
- multer-s3 3.x esperando cliente S3 com método .send() (AWS SDK v3)
- Backend usando AWS.S3() do aws-sdk v2 (sem método .send)

EVIDÊNCIA NOS LOGS:
- ⚠️ [flexibleUpload] Tentativa com campo "audioFiles" falhou: undefined this.client.send is not a function
- package-lock.json continha @aws-sdk/client-s3 3.893.0
- Backend esperando S3 v2 mas multer-s3 puxando v3
```

### **🛠️ Implementação Técnica da Solução**

#### **Downgrade Estratégico para Compatibilidade**
```javascript
// backend/package.json - ANTES (QUEBRADO):
{
  "dependencies": {
    "aws-sdk": "^2.1692.0",      // v2
    "multer-s3": "^3.0.1"        // v3 (incompatível)
  }
}

// backend/package.json - DEPOIS (FUNCIONANDO):
{
  "dependencies": {
    "aws-sdk": "^2.1692.0",      // v2
    "multer-s3": "2.10.0"        // v2 (compatível, sem caret)
  }
}
```

#### **Processo de Correção Aplicado**
```bash
# 1. Diagnóstico (sem alterações)
npm ls aws-sdk multer-s3
grep -n "@aws-sdk/client-s3" package-lock.json

# 2. Correção (backend apenas)
rm -f package-lock.json  # Remove lock conflitante
npm install              # Reinstala com versões corretas

# 3. Validação
npm ls @aws-sdk/client-s3  # Deve retornar vazio
npm ls multer-s3           # Deve mostrar 2.10.0

# 4. Deploy
git add backend/package.json backend/package-lock.json
git commit -m "fix: downgrade multer-s3 to 2.10.0 for AWS SDK v2 compatibility"
git push origin staging
```

#### **Resultado da Correção**
```bash
✅ TESTE CURL (22/09/2025 13:02:38 GMT):
   Request: POST /api/upload (multipart/form-data)
   Response: HTTP 200 {"success":true,"message":"1 arquivo(s) processado(s) com sucesso",...}
   File URL: https://radio-importante-audio.atl1.digitaloceanspaces.com/audio/1758546157494-01_Damn_feat_Kinny.mp3

✅ TESTE ADMIN UI:
   Upload via drag&drop: Funcionando
   Arquivos no Spaces: Visíveis no painel DigitalOcean
   Frontend: Nenhuma alteração necessária

✅ COMPATIBILIDADE MANTIDA:
   AWS SDK v2: aws-sdk@2.1692.0 (mantido)
   multer-s3: 2.10.0 (compatível com v2)
   DigitalOcean Spaces: Funcionando com endpoint atl1
```

#### **Prevenção de Regressões**
```javascript
// package.json - Versão travada (sem caret ^)
"multer-s3": "2.10.0"  // ✅ Impede upgrade automático para 3.x

// Monitoramento de dependências
npm audit                    // Verificar vulnerabilidades
npm ls | grep multer        // Confirmar versões
npm outdated               // Revisar atualizações disponíveis
```

---

## 🛠️ **DETALHES TÉCNICOS DA MIGRAÇÃO**

### **Como o Sistema Funciona Agora (Explicação Simples)**

#### **1. Fluxo de Upload Completo**
```bash
PASSO 1: User faz upload pelo frontend
↓
PASSO 2: Frontend envia POST para /api/upload
↓  
PASSO 3: Flexible middleware aceita 'audioFiles' ou 'file'
↓
PASSO 4: Multer salva arquivo em UPLOAD_PATH (/app/public/audio)
↓
PASSO 5: Sistema cria entrada no catálogo
↓
PASSO 6: saveCatalog() salva em CATALOG_PATH (/app/public/data/catalog.json)
↓
PASSO 7: Response com sucesso + dados do track
```

#### **2. Fluxo de Serving de Arquivos**
```bash
PASSO 1: Frontend/User requisita /audio/filename.mp3
↓
PASSO 2: Express middleware express.static procura arquivo
↓
PASSO 3: Arquivo encontrado em audioPath (/app/public/audio)
↓
PASSO 4: Express serve arquivo com headers corretos
↓
PASSO 5: Browser recebe arquivo e pode reproduzir
```

#### **3. Environment Variables (CRÍTICAS)**
```javascript
// Como funciona no código:
const audioPath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'public', 'audio');

// Se UPLOAD_PATH está definido no DigitalOcean → usa ele
// Se não está definido → usa caminho local (desenvolvimento)

// Valores em produção (DigitalOcean):
UPLOAD_PATH="/app/public/audio"           // Onde salva uploads
CATALOG_PATH="/app/public/data/catalog.json"  // Onde salva catálogo
PORT="8080"                               // Porta do servidor
NODE_ENV="production"                     // Ambiente
FRONTEND_URL="https://radio.importantestudio.com"  // Para CORS
```

### **Docker Container (Como Funciona)**

#### **Dockerfile Explicado Linha por Linha**
```dockerfile
FROM node:18-alpine
# Pega imagem base com Node.js 18 (versão LTS)
# Alpine = versão Linux pequena e rápida

WORKDIR /app  
# Define /app como diretório de trabalho dentro do container
# Todos os comandos seguintes executam de /app

COPY package*.json ./
# Copia package.json e package-lock.json primeiro
# Por que primeiro? Para cache do Docker - se dependências não mudaram, não reinstala

RUN npm ci
# Instala dependências
# npm ci é mais rápido que npm install para produção

COPY . .
# Copia resto do código para o container
# Feito depois para aproveitar cache das dependências

EXPOSE 8080
# Informa que a aplicação usa porta 8080
# Não abre a porta, só documenta

CMD ["node", "app.js"]
# Comando para iniciar a aplicação quando container roda
```

#### **Como Build e Deploy Funcionam**
```bash
TRIGGER: git push origin main

PROCESSO NO DIGITALOCEAN:
1. DigitalOcean detecta push (GitHub webhook)
2. Clona repositório na branch main  
3. Navega para /backend (source_dir configurado)
4. Executa: docker build -f Dockerfile .
5. Docker executa cada linha do Dockerfile
6. Imagem criada e armazenada no registry DigitalOcean
7. Container antigo é parado
8. Novo container é iniciado com nova imagem
9. Health check verifica se está funcionando
10. Tráfego é direcionado para novo container
11. Container antigo é removido

TEMPO TOTAL: ~2-3 minutos
```

---

## 🚨 **TROUBLESHOOTING E PROBLEMAS COMUNS**

### **Problema: Upload funciona mas arquivo retorna 404**

#### **Diagnóstico**
```bash
SINTOMA: POST /api/upload → 200 OK, mas GET /audio/filename → 404

CAUSAS POSSÍVEIS:
1. Multiple instances (arquivo salvo em instância A, request em B)
2. Static middleware não configurado
3. Environment variable UPLOAD_PATH incorreta
4. Permissions no filesystem

COMO INVESTIGAR:
curl -I https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/audio/filename
- Se 404 → problema de serving
- Se 200 → problema resolvido
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar instance_count
doctl apps spec get f8c358ee-ba7e-4da4-8ffe-065f9554a061 | grep instance_count
- Se > 1 → reduzir para 1 ou implementar storage externo

SOLUÇÃO 2: Verificar static middleware
grep -n "express.static" backend/app.js
- Deve ter: app.use('/audio', express.static(audioPath))

SOLUÇÃO 3: Verificar environment variables
DigitalOcean Dashboard → Settings → Environment Variables
- UPLOAD_PATH deve estar definido
```

### **Problema: Environment variables não estão funcionando**

#### **Diagnóstico**
```bash
SINTOMA: Código usa paths locais em vez de environment variables

COMO VERIFICAR:
1. DigitalOcean Dashboard → Settings → Environment Variables
2. Verificar se UPLOAD_PATH e CATALOG_PATH estão definidos
3. Verificar logs de startup: "Upload path: /app/public/audio"

LOGS DE STARTUP SAUDÁVEIS:
🎵 Radio Importante Backend v2.2.4 running on port 8080
📊 Environment: production  
🔗 Health check: http://localhost:8080/health
📁 Catalog tracks: 0
📁 Upload path: /app/public/audio  ← DEVE MOSTRAR ESTE PATH
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar variáveis no DigitalOcean
- Ir em Settings → Environment Variables
- Confirmar que UPLOAD_PATH=/app/public/audio está presente
- Se não estiver → adicionar e redeploy

SOLUÇÃO 2: Verificar código
grep -n "process.env.UPLOAD_PATH" backend/app.js
- Deve aparecer nas linhas do multer e express.static

SOLUÇÃO 3: Forçar redeploy
doctl apps create-deployment f8c358ee-ba7e-4da4-8ffe-065f9554a061
```

### **Problema: MulterError: Unexpected field**

#### **Diagnóstico**
```bash
SINTOMA: Upload retorna erro "Unexpected field"

CAUSA: Frontend enviando campo diferente do esperado
- Frontend envia: 'file'
- Backend espera: 'audioFiles'
- Ou vice-versa

COMO VERIFICAR:
- Olhar error message: qual field foi enviado vs esperado
- Verificar flexible middleware está ativo
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar flexible middleware
grep -A 20 "flexibleUpload" backend/app.js
- Deve ter lógica para tentar 'audioFiles' depois 'file'

SOLUÇÃO 2: Testar manualmente
curl -X POST -F "audioFiles=@test.mp3" /api/upload  # Tenta audioFiles
curl -X POST -F "file=@test.mp3" /api/upload        # Tenta file

SOLUÇÃO 3: Frontend
- Verificar FormData no frontend usa nome correto
- Preferred: 'audioFiles' (plural)
```

### **Problema: Deploy falha ou app não inicia**

#### **Diagnóstico**
```bash
ONDE VERIFICAR:
DigitalOcean Dashboard → Runtime Logs

ERROS COMUNS:
1. "npm ci failed" → problema com package.json
2. "Port 8080 already in use" → configuração de porta
3. "Cannot find module" → dependência faltando
4. "EACCES permission denied" → problema de filesystem
```

#### **Soluções**
```bash
ERRO: npm ci failed
CAUSA: package-lock.json inconsistente
SOLUÇÃO: 
- Deletar node_modules e package-lock.json local
- npm install localmente
- Commit package-lock.json atualizado

ERRO: Port already in use  
CAUSA: Environment variable PORT incorreta
SOLUÇÃO: Verificar PORT=8080 nas environment variables

ERRO: Cannot find module
CAUSA: Dependência não listada em package.json
SOLUÇÃO: npm install --save nome-da-dependencia

ERRO: Permission denied
CAUSA: Container tentando escrever em local não permitido
SOLUÇÃO: Verificar UPLOAD_PATH e CATALOG_PATH paths
```

---

## 🔧 **TROUBLESHOOTING: Upload "this.client.send is not a function" (22/09/2025)**

### **📋 Problema Técnico Identificado**

#### **Incompatibilidade AWS SDK v2 + multer-s3 v3**
```bash
PROBLEMA:
- Error: "this.client.send is not a function" no upload
- HTTP 400 Bad Request na API /api/upload
- multer-s3 3.x esperando cliente S3 com método .send() (AWS SDK v3)
- Backend usando AWS.S3() do aws-sdk v2 (sem método .send)

EVIDÊNCIA NOS LOGS:
- ⚠️ [flexibleUpload] Tentativa com campo "audioFiles" falhou: undefined this.client.send is not a function
- package-lock.json continha @aws-sdk/client-s3 3.893.0
- Backend esperando S3 v2 mas multer-s3 puxando v3
```

### **🛠️ Implementação Técnica da Solução**

#### **Downgrade Estratégico para Compatibilidade**
```javascript
// backend/package.json - ANTES (QUEBRADO):
{
  "dependencies": {
    "aws-sdk": "^2.1692.0",      // v2
    "multer-s3": "^3.0.1"        // v3 (incompatível)
  }
}

// backend/package.json - DEPOIS (FUNCIONANDO):
{
  "dependencies": {
    "aws-sdk": "^2.1692.0",      // v2
    "multer-s3": "2.10.0"        // v2 (compatível, sem caret)
  }
}
```

#### **Processo de Correção Aplicado**
```bash
# 1. Diagnóstico (sem alterações)
npm ls aws-sdk multer-s3
grep -n "@aws-sdk/client-s3" package-lock.json

# 2. Correção (backend apenas)
rm -f package-lock.json  # Remove lock conflitante
npm install              # Reinstala com versões corretas

# 3. Validação
npm ls @aws-sdk/client-s3  # Deve retornar vazio
npm ls multer-s3           # Deve mostrar 2.10.0

# 4. Deploy
git add backend/package.json backend/package-lock.json
git commit -m "fix: downgrade multer-s3 to 2.10.0 for AWS SDK v2 compatibility"
git push origin staging
```

#### **Resultado da Correção**
```bash
✅ TESTE CURL (22/09/2025 13:02:38 GMT):
   Request: POST /api/upload (multipart/form-data)
   Response: HTTP 200 {"success":true,"message":"1 arquivo(s) processado(s) com sucesso",...}
   File URL: https://radio-importante-audio.atl1.digitaloceanspaces.com/audio/1758546157494-01_Damn_feat_Kinny.mp3

✅ TESTE ADMIN UI:
   Upload via drag&drop: Funcionando
   Arquivos no Spaces: Visíveis no painel DigitalOcean
   Frontend: Nenhuma alteração necessária

✅ COMPATIBILIDADE MANTIDA:
   AWS SDK v2: aws-sdk@2.1692.0 (mantido)
   multer-s3: 2.10.0 (compatível com v2)
   DigitalOcean Spaces: Funcionando com endpoint atl1
```

#### **Prevenção de Regressões**
```javascript
// package.json - Versão travada (sem caret ^)
"multer-s3": "2.10.0"  // ✅ Impede upgrade automático para 3.x

// Monitoramento de dependências
npm audit                    // Verificar vulnerabilidades
npm ls | grep multer        // Confirmar versões
npm outdated               // Revisar atualizações disponíveis
```

---

## 🛠️ **DETALHES TÉCNICOS DA MIGRAÇÃO**

### **Como o Sistema Funciona Agora (Explicação Simples)**

#### **1. Fluxo de Upload Completo**
```bash
PASSO 1: User faz upload pelo frontend
↓
PASSO 2: Frontend envia POST para /api/upload
↓  
PASSO 3: Flexible middleware aceita 'audioFiles' ou 'file'
↓
PASSO 4: Multer salva arquivo em UPLOAD_PATH (/app/public/audio)
↓
PASSO 5: Sistema cria entrada no catálogo
↓
PASSO 6: saveCatalog() salva em CATALOG_PATH (/app/public/data/catalog.json)
↓
PASSO 7: Response com sucesso + dados do track
```

#### **2. Fluxo de Serving de Arquivos**
```bash
PASSO 1: Frontend/User requisita /audio/filename.mp3
↓
PASSO 2: Express middleware express.static procura arquivo
↓
PASSO 3: Arquivo encontrado em audioPath (/app/public/audio)
↓
PASSO 4: Express serve arquivo com headers corretos
↓
PASSO 5: Browser recebe arquivo e pode reproduzir
```

#### **3. Environment Variables (CRÍTICAS)**
```javascript
// Como funciona no código:
const audioPath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'public', 'audio');

// Se UPLOAD_PATH está definido no DigitalOcean → usa ele
// Se não está definido → usa caminho local (desenvolvimento)

// Valores em produção (DigitalOcean):
UPLOAD_PATH="/app/public/audio"           // Onde salva uploads
CATALOG_PATH="/app/public/data/catalog.json"  // Onde salva catálogo
PORT="8080"                               // Porta do servidor
NODE_ENV="production"                     // Ambiente
FRONTEND_URL="https://radio.importantestudio.com"  // Para CORS
```

### **Docker Container (Como Funciona)**

#### **Dockerfile Explicado Linha por Linha**
```dockerfile
FROM node:18-alpine
# Pega imagem base com Node.js 18 (versão LTS)
# Alpine = versão Linux pequena e rápida

WORKDIR /app  
# Define /app como diretório de trabalho dentro do container
# Todos os comandos seguintes executam de /app

COPY package*.json ./
# Copia package.json e package-lock.json primeiro
# Por que primeiro? Para cache do Docker - se dependências não mudaram, não reinstala

RUN npm ci
# Instala dependências
# npm ci é mais rápido que npm install para produção

COPY . .
# Copia resto do código para o container
# Feito depois para aproveitar cache das dependências

EXPOSE 8080
# Informa que a aplicação usa porta 8080
# Não abre a porta, só documenta

CMD ["node", "app.js"]
# Comando para iniciar a aplicação quando container roda
```

#### **Como Build e Deploy Funcionam**
```bash
TRIGGER: git push origin main

PROCESSO NO DIGITALOCEAN:
1. DigitalOcean detecta push (GitHub webhook)
2. Clona repositório na branch main  
3. Navega para /backend (source_dir configurado)
4. Executa: docker build -f Dockerfile .
5. Docker executa cada linha do Dockerfile
6. Imagem criada e armazenada no registry DigitalOcean
7. Container antigo é parado
8. Novo container é iniciado com nova imagem
9. Health check verifica se está funcionando
10. Tráfego é direcionado para novo container
11. Container antigo é removido

TEMPO TOTAL: ~2-3 minutos
```

---

## 🚨 **TROUBLESHOOTING E PROBLEMAS COMUNS**

### **Problema: Upload funciona mas arquivo retorna 404**

#### **Diagnóstico**
```bash
SINTOMA: POST /api/upload → 200 OK, mas GET /audio/filename → 404

CAUSAS POSSÍVEIS:
1. Multiple instances (arquivo salvo em instância A, request em B)
2. Static middleware não configurado
3. Environment variable UPLOAD_PATH incorreta
4. Permissions no filesystem

COMO INVESTIGAR:
curl -I https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/audio/filename
- Se 404 → problema de serving
- Se 200 → problema resolvido
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar instance_count
doctl apps spec get f8c358ee-ba7e-4da4-8ffe-065f9554a061 | grep instance_count
- Se > 1 → reduzir para 1 ou implementar storage externo

SOLUÇÃO 2: Verificar static middleware
grep -n "express.static" backend/app.js
- Deve ter: app.use('/audio', express.static(audioPath))

SOLUÇÃO 3: Verificar environment variables
DigitalOcean Dashboard → Settings → Environment Variables
- UPLOAD_PATH deve estar definido
```

### **Problema: Environment variables não estão funcionando**

#### **Diagnóstico**
```bash
SINTOMA: Código usa paths locais em vez de environment variables

COMO VERIFICAR:
1. DigitalOcean Dashboard → Settings → Environment Variables
2. Verificar se UPLOAD_PATH e CATALOG_PATH estão definidos
3. Verificar logs de startup: "Upload path: /app/public/audio"

LOGS DE STARTUP SAUDÁVEIS:
🎵 Radio Importante Backend v2.2.4 running on port 8080
📊 Environment: production  
🔗 Health check: http://localhost:8080/health
📁 Catalog tracks: 0
📁 Upload path: /app/public/audio  ← DEVE MOSTRAR ESTE PATH
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar variáveis no DigitalOcean
- Ir em Settings → Environment Variables
- Confirmar que UPLOAD_PATH=/app/public/audio está presente
- Se não estiver → adicionar e redeploy

SOLUÇÃO 2: Verificar código
grep -n "process.env.UPLOAD_PATH" backend/app.js
- Deve aparecer nas linhas do multer e express.static

SOLUÇÃO 3: Forçar redeploy
doctl apps create-deployment f8c358ee-ba7e-4da4-8ffe-065f9554a061
```

### **Problema: MulterError: Unexpected field**

#### **Diagnóstico**
```bash
SINTOMA: Upload retorna erro "Unexpected field"

CAUSA: Frontend enviando campo diferente do esperado
- Frontend envia: 'file'
- Backend espera: 'audioFiles'
- Ou vice-versa

COMO VERIFICAR:
- Olhar error message: qual field foi enviado vs esperado
- Verificar flexible middleware está ativo
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar flexible middleware
grep -A 20 "flexibleUpload" backend/app.js
- Deve ter lógica para tentar 'audioFiles' depois 'file'

SOLUÇÃO 2: Testar manualmente
curl -X POST -F "audioFiles=@test.mp3" /api/upload  # Tenta audioFiles
curl -X POST -F "file=@test.mp3" /api/upload        # Tenta file

SOLUÇÃO 3: Frontend
- Verificar FormData no frontend usa nome correto
- Preferred: 'audioFiles' (plural)
```

### **Problema: Deploy falha ou app não inicia**

#### **Diagnóstico**
```bash
ONDE VERIFICAR:
DigitalOcean Dashboard → Runtime Logs

ERROS COMUNS:
1. "npm ci failed" → problema com package.json
2. "Port 8080 already in use" → configuração de porta
3. "Cannot find module" → dependência faltando
4. "EACCES permission denied" → problema de filesystem
```

#### **Soluções**
```bash
ERRO: npm ci failed
CAUSA: package-lock.json inconsistente
SOLUÇÃO: 
- Deletar node_modules e package-lock.json local
- npm install localmente
- Commit package-lock.json atualizado

ERRO: Port already in use  
CAUSA: Environment variable PORT incorreta
SOLUÇÃO: Verificar PORT=8080 nas environment variables

ERRO: Cannot find module
CAUSA: Dependência não listada em package.json
SOLUÇÃO: npm install --save nome-da-dependencia

ERRO: Permission denied
CAUSA: Container tentando escrever em local não permitido
SOLUÇÃO: Verificar UPLOAD_PATH e CATALOG_PATH paths
```

---

## 🔧 **TROUBLESHOOTING: Upload "this.client.send is not a function" (22/09/2025)**

### **📋 Problema Técnico Identificado**

#### **Incompatibilidade AWS SDK v2 + multer-s3 v3**
```bash
PROBLEMA:
- Error: "this.client.send is not a function" no upload
- HTTP 400 Bad Request na API /api/upload
- multer-s3 3.x esperando cliente S3 com método .send() (AWS SDK v3)
- Backend usando AWS.S3() do aws-sdk v2 (sem método .send)

EVIDÊNCIA NOS LOGS:
- ⚠️ [flexibleUpload] Tentativa com campo "audioFiles" falhou: undefined this.client.send is not a function
- package-lock.json continha @aws-sdk/client-s3 3.893.0
- Backend esperando S3 v2 mas multer-s3 puxando v3
```

### **🛠️ Implementação Técnica da Solução**

#### **Downgrade Estratégico para Compatibilidade**
```javascript
// backend/package.json - ANTES (QUEBRADO):
{
  "dependencies": {
    "aws-sdk": "^2.1692.0",      // v2
    "multer-s3": "^3.0.1"        // v3 (incompatível)
  }
}

// backend/package.json - DEPOIS (FUNCIONANDO):
{
  "dependencies": {
    "aws-sdk": "^2.1692.0",      // v2
    "multer-s3": "2.10.0"        // v2 (compatível, sem caret)
  }
}
```

#### **Processo de Correção Aplicado**
```bash
# 1. Diagnóstico (sem alterações)
npm ls aws-sdk multer-s3
grep -n "@aws-sdk/client-s3" package-lock.json

# 2. Correção (backend apenas)
rm -f package-lock.json  # Remove lock conflitante
npm install              # Reinstala com versões corretas

# 3. Validação
npm ls @aws-sdk/client-s3  # Deve retornar vazio
npm ls multer-s3           # Deve mostrar 2.10.0

# 4. Deploy
git add backend/package.json backend/package-lock.json
git commit -m "fix: downgrade multer-s3 to 2.10.0 for AWS SDK v2 compatibility"
git push origin staging
```

#### **Resultado da Correção**
```bash
✅ TESTE CURL (22/09/2025 13:02:38 GMT):
   Request: POST /api/upload (multipart/form-data)
   Response: HTTP 200 {"success":true,"message":"1 arquivo(s) processado(s) com sucesso",...}
   File URL: https://radio-importante-audio.atl1.digitaloceanspaces.com/audio/1758546157494-01_Damn_feat_Kinny.mp3

✅ TESTE ADMIN UI:
   Upload via drag&drop: Funcionando
   Arquivos no Spaces: Visíveis no painel DigitalOcean
   Frontend: Nenhuma alteração necessária

✅ COMPATIBILIDADE MANTIDA:
   AWS SDK v2: aws-sdk@2.1692.0 (mantido)
   multer-s3: 2.10.0 (compatível com v2)
   DigitalOcean Spaces: Funcionando com endpoint atl1
```

#### **Prevenção de Regressões**
```javascript
// package.json - Versão travada (sem caret ^)
"multer-s3": "2.10.0"  // ✅ Impede upgrade automático para 3.x

// Monitoramento de dependências
npm audit                    // Verificar vulnerabilidades
npm ls | grep multer        // Confirmar versões
npm outdated               // Revisar atualizações disponíveis
```

---

## 🛠️ **DETALHES TÉCNICOS DA MIGRAÇÃO**

### **Como o Sistema Funciona Agora (Explicação Simples)**

#### **1. Fluxo de Upload Completo**
```bash
PASSO 1: User faz upload pelo frontend
↓
PASSO 2: Frontend envia POST para /api/upload
↓  
PASSO 3: Flexible middleware aceita 'audioFiles' ou 'file'
↓
PASSO 4: Multer salva arquivo em UPLOAD_PATH (/app/public/audio)
↓
PASSO 5: Sistema cria entrada no catálogo
↓
PASSO 6: saveCatalog() salva em CATALOG_PATH (/app/public/data/catalog.json)
↓
PASSO 7: Response com sucesso + dados do track
```

#### **2. Fluxo de Serving de Arquivos**
```bash
PASSO 1: Frontend/User requisita /audio/filename.mp3
↓
PASSO 2: Express middleware express.static procura arquivo
↓
PASSO 3: Arquivo encontrado em audioPath (/app/public/audio)
↓
PASSO 4: Express serve arquivo com headers corretos
↓
PASSO 5: Browser recebe arquivo e pode reproduzir
```

#### **3. Environment Variables (CRÍTICAS)**
```javascript
// Como funciona no código:
const audioPath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'public', 'audio');

// Se UPLOAD_PATH está definido no DigitalOcean → usa ele
// Se não está definido → usa caminho local (desenvolvimento)

// Valores em produção (DigitalOcean):
UPLOAD_PATH="/app/public/audio"           // Onde salva uploads
CATALOG_PATH="/app/public/data/catalog.json"  // Onde salva catálogo
PORT="8080"                               // Porta do servidor
NODE_ENV="production"                     // Ambiente
FRONTEND_URL="https://radio.importantestudio.com"  // Para CORS
```

### **Docker Container (Como Funciona)**

#### **Dockerfile Explicado Linha por Linha**
```dockerfile
FROM node:18-alpine
# Pega imagem base com Node.js 18 (versão LTS)
# Alpine = versão Linux pequena e rápida

WORKDIR /app  
# Define /app como diretório de trabalho dentro do container
# Todos os comandos seguintes executam de /app

COPY package*.json ./
# Copia package.json e package-lock.json primeiro
# Por que primeiro? Para cache do Docker - se dependências não mudaram, não reinstala

RUN npm ci
# Instala dependências
# npm ci é mais rápido que npm install para produção

COPY . .
# Copia resto do código para o container
# Feito depois para aproveitar cache das dependências

EXPOSE 8080
# Informa que a aplicação usa porta 8080
# Não abre a porta, só documenta

CMD ["node", "app.js"]
# Comando para iniciar a aplicação quando container roda
```

#### **Como Build e Deploy Funcionam**
```bash
TRIGGER: git push origin main

PROCESSO NO DIGITALOCEAN:
1. DigitalOcean detecta push (GitHub webhook)
2. Clona repositório na branch main  
3. Navega para /backend (source_dir configurado)
4. Executa: docker build -f Dockerfile .
5. Docker executa cada linha do Dockerfile
6. Imagem criada e armazenada no registry DigitalOcean
7. Container antigo é parado
8. Novo container é iniciado com nova imagem
9. Health check verifica se está funcionando
10. Tráfego é direcionado para novo container
11. Container antigo é removido

TEMPO TOTAL: ~2-3 minutos
```

---

## 🚨 **TROUBLESHOOTING E PROBLEMAS COMUNS**

### **Problema: Upload funciona mas arquivo retorna 404**

#### **Diagnóstico**
```bash
SINTOMA: POST /api/upload → 200 OK, mas GET /audio/filename → 404

CAUSAS POSSÍVEIS:
1. Multiple instances (arquivo salvo em instância A, request em B)
2. Static middleware não configurado
3. Environment variable UPLOAD_PATH incorreta
4. Permissions no filesystem

COMO INVESTIGAR:
curl -I https://radio-importante-pwa-backend-skg2w.ondigitaloceanspaces.com/audio/filename
- Se 404 → problema de serving
- Se 200 → problema resolvido
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar instance_count
doctl apps spec get f8c358ee-ba7e-4da4-8ffe-065f9554a061 | grep instance_count
- Se > 1 → reduzir para 1 ou implementar storage externo

SOLUÇÃO 2: Verificar static middleware
grep -n "express.static" backend/app.js
- Deve ter: app.use('/audio', express.static(audioPath))

SOLUÇÃO 3: Verificar environment variables
DigitalOcean Dashboard → Settings → Environment Variables
- UPLOAD_PATH deve estar definido
```

### **Problema: Environment variables não estão funcionando**

#### **Diagnóstico**
```bash
SINTOMA: Código usa paths locais em vez de environment variables

COMO VERIFICAR:
1. DigitalOcean Dashboard → Settings → Environment Variables
2. Verificar se UPLOAD_PATH e CATALOG_PATH estão definidos
3. Verificar logs de startup: "Upload path: /app/public/audio"

LOGS DE STARTUP SAUDÁVEIS:
🎵 Radio Importante Backend v2.2.4 running on port 8080
📊 Environment: production  
🔗 Health check: http://localhost:8080/health
📁 Catalog tracks: 0
📁 Upload path: /app/public/audio  ← DEVE MOSTRAR ESTE PATH
```

#### **Soluções**
```bash
SOLUÇÃO 1: Verificar variáveis no DigitalOcean
- Ir em Settings → Environment Variables
- Confirmar que UPLOAD_PATH=/app/public/audio está presente
- Se não estiver → adicionar e redeploy

SOLUÇÃO 2: Verificar código
grep -n "process.env.UPLOAD_PATH" backend/app.js
- Deve aparecer nas linhas do multer e express.static

SOLUÇÃO 3: Forçar redeploy
doctl apps create-deployment f8c358ee-ba7e-4da4-8ffe-065f9554a061
```

###