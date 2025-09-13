# 🔧 Guia Técnico - Radio Importante PWA

> **Complemento**: PLANO_EXECUCAO_ATUALIZADO.md  
> **Foco**: Detalhes técnicos, troubleshooting e manutenção  
> **Data**: 13/09/2025  
> **Para**: Programador Junior/Amador

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

## 🔍 **COMANDOS ÚTEIS PARA MANUTENÇÃO**

### **DigitalOcean CLI (doctl)**

#### **Comandos Básicos**
```bash
# Listar apps
doctl apps list

# Ver detalhes do app
doctl apps get f8c358ee-ba7e-4da4-8ffe-065f9554a061

# Ver spec atual
doctl apps spec get f8c358ee-ba7e-4da4-8ffe-065f9554a061

# Forçar novo deploy
doctl apps create-deployment f8c358ee-ba7e-4da4-8ffe-065f9554a061

# Ver logs (se disponível via CLI)
doctl apps logs f8c358ee-ba7e-4da4-8ffe-065f9554a061
```

#### **Comandos de Configuração**
```bash
# Atualizar app com novo spec
doctl apps update f8c358ee-ba7e-4da4-8ffe-065f9554a061 --spec app-spec.yaml

# Ver deployments
doctl apps list-deployments f8c358ee-ba7e-4da4-8ffe-065f9554a061
```

### **Teste e Debug**

#### **Health Checks**
```bash
# Health check básico
curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/health

# Health check com detalhes
curl -v https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/health

# Teste de CORS
curl -H "Origin: https://radio.importantestudio.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/upload
```

#### **Teste de Upload**
```bash
# Upload com audioFiles (preferido)
curl -X POST \
     -F "audioFiles=@devFiles/MrakReserva.mp4" \
     https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/upload

# Upload com file (fallback)
curl -X POST \
     -F "file=@devFiles/MrakReserva.mp4" \
     https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/upload

# Verificar se arquivo está acessível
curl -I https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/audio/MrakReserva.mp4
```

#### **Teste de APIs**
```bash
# Catálogo
curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/catalog

# Catálogo formatado
curl -s https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/catalog | jq .

# Root endpoint  
curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/
```

### **Docker Local (Para Testes)**

#### **Build e Run Local**
```bash
# Build local
cd backend/
docker build -t radio-backend:local .

# Run local
docker run -p 8080:8080 radio-backend:local

# Run com environment variables
docker run -p 8080:8080 \
           -e UPLOAD_PATH=/app/public/audio \
           -e CATALOG_PATH=/app/public/data/catalog.json \
           radio-backend:local

# Run com volume mount (para persistir arquivos)
docker run -p 8080:8080 \
           -v $(pwd)/public:/app/public \
           radio-backend:local
```

#### **Debug do Container**
```bash
# Ver logs do container
docker logs <container-id>

# Entrar no container  
docker exec -it <container-id> /bin/sh

# Verificar arquivos dentro do container
docker exec <container-id> ls -la /app/public/audio

# Verificar environment variables
docker exec <container-id> env | grep UPLOAD_PATH
```

---

## 📝 **CONFIGURAÇÕES IMPORTANTES**

### **app-spec.yaml (Configuração do DigitalOcean)**
```yaml
# Configuração atual (funcional):
name: radio-importante-pwa-backend
region: atl
services:
- dockerfile_path: backend/Dockerfile
  envs:
  - key: PORT
    scope: RUN_AND_BUILD_TIME
    value: "8080"
  - key: NODE_ENV
    scope: RUN_AND_BUILD_TIME
    value: production
  - key: CATALOG_PATH
    scope: RUN_AND_BUILD_TIME
    value: /app/public/data/catalog.json
  - key: FRONTEND_URL
    scope: RUN_AND_BUILD_TIME
    value: https://radio.importantestudio.com
  github:
    branch: main
    deploy_on_push: true
    repo: DeepDevPro/radio-importante-pwa
  http_port: 8080
  instance_count: 1          # IMPORTANTE: 1 para compatibilidade com storage local
  instance_size_slug: apps-s-1vcpu-1gb
  name: radio-importante-pwa-backend
  source_dir: backend
```

### **Environment Variables (Produção)**
```bash
# CRÍTICAS para funcionamento:
UPLOAD_PATH=/app/public/audio
CATALOG_PATH=/app/public/data/catalog.json

# IMPORTANTES para operação:
PORT=8080
NODE_ENV=production
FRONTEND_URL=https://radio.importantestudio.com

# Como configurar:
1. DigitalOcean Dashboard
2. Apps → radio-importante-pwa-backend  
3. Settings → Environment Variables
4. Add Variable ou Edit existente
5. Save → Redeploy automático
```

### **CORS Configuration**
```javascript
// No backend/app.js:
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');           // Permite todos os origins
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);                              // Responde preflight requests
  }
  next();
});

// Para production específica, trocar '*' por:
// res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
```

---

## 🚀 **MELHORIAS FUTURAS DETALHADAS**

### **1. Implementar DigitalOcean Spaces (Storage Externo)**

#### **Quando Implementar**
```bash
CENÁRIO: Quando precisar de múltiplas instâncias (scaling)
PROBLEMA ATUAL: Com instance_count > 1, arquivos se perdem
SOLUÇÃO: Storage centralizado via Spaces (S3-compatible)
```

#### **Passos de Implementação**
```bash
PASSO 1: Criar DigitalOcean Space
- Dashboard → Spaces → Create Space
- Nome: radio-importante-files  
- Region: same as app (ATL1)
- CDN: Enable para performance

PASSO 2: Configurar Credentials
- Generate API Key com Spaces permissions
- Environment Variables:
  SPACES_KEY=<access_key>
  SPACES_SECRET=<secret_key>
  SPACES_ENDPOINT=https://atl1.digitaloceanspaces.com
  SPACES_BUCKET=radio-importante-files

PASSO 3: Instalar SDK
npm install aws-sdk

PASSO 4: Modificar Upload
// Substituir multer.diskStorage por:
const multerS3 = require('multer-s3');
const spacesEndpoint = new aws.Endpoint(process.env.SPACES_ENDPOINT);
const s3 = new aws.S3({ endpoint: spacesEndpoint });

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.SPACES_BUCKET,
    key: function (req, file, cb) {
      cb(null, 'audio/' + file.originalname)
    }
  })
});

PASSO 5: Modificar Serving  
// Em vez de express.static, redirect para Spaces URL:
app.get('/audio/:filename', (req, res) => {
  const url = `${process.env.SPACES_ENDPOINT}/${process.env.SPACES_BUCKET}/audio/${req.params.filename}`;
  res.redirect(url);
});

PASSO 6: Aumentar instance_count
instance_count: 2  # ou mais
```

### **2. Database para Catálogo**

#### **Quando Implementar**
```bash
CENÁRIO: 
- Catálogo com > 1000 tracks
- Necessidade de search/filter avançado
- Multiple users/playlists
- Backup automático importante
```

#### **Implementação PostgreSQL**
```bash
PASSO 1: Criar Managed Database
- DigitalOcean Dashboard → Databases
- Create → PostgreSQL  
- Size: Basic ($15/mês)
- Region: same as app

PASSO 2: Instalar Dependencies
npm install sequelize pg pg-hstore

PASSO 3: Configurar Connection
// config/database.js
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL);

PASSO 4: Criar Models
// models/Track.js
const Track = sequelize.define('Track', {
  title: DataTypes.STRING,
  artist: DataTypes.STRING,
  filename: DataTypes.STRING,
  duration: DataTypes.INTEGER,
  format: DataTypes.STRING
});

PASSO 5: Migrar Dados
// Script para migrar de JSON para DB
const catalog = JSON.parse(fs.readFileSync('catalog.json'));
for (const track of catalog.tracks) {
  await Track.create(track);
}

PASSO 6: Atualizar APIs
// Em vez de catalog array:
app.get('/api/catalog', async (req, res) => {
  const tracks = await Track.findAll();
  res.json({ tracks, metadata: {...} });
});
```

### **3. Monitoring Avançado**

#### **Implementar Application Performance Monitoring**
```bash
FERRAMENTA: New Relic ou DataDog
BENEFÍCIOS:
- Response time detalhado por endpoint
- Error tracking automático  
- Performance bottlenecks
- User experience monitoring

IMPLEMENTAÇÃO:
npm install newrelic
// Adicionar no início do app.js:
require('newrelic');
```

#### **Implementar Structured Logging**
```bash
FERRAMENTA: Winston
BENEFÍCIOS:
- Logs estruturados (JSON)
- Diferentes níveis (error, warn, info, debug)
- Rotation automática
- Searchable logs

IMPLEMENTAÇÃO:
npm install winston
// logger.js
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

---

## 📋 **CHECKLIST DE MANUTENÇÃO**

### **Checklist Semanal**
```bash
□ Verificar uptime via DigitalOcean Dashboard
□ Verificar logs para errors (Runtime Logs)
□ Testar upload manual: curl -X POST -F "audioFiles=@test.mp3" /api/upload
□ Testar file serving: curl -I /audio/test.mp3
□ Verificar response times via health check
□ Backup do catálogo: curl /api/catalog > backup-$(date).json
```

### **Checklist Mensal**
```bash  
□ Verificar usage metrics (CPU, Memory)
□ Review logs para patterns de error
□ Testar disaster recovery (se backup configurado)
□ Update dependencies se necessário: npm audit
□ Verificar storage usage se usando Spaces
□ Review custos DigitalOcean
```

### **Checklist Anual**
```bash
□ Review Node.js version (atualizar Dockerfile se necessário)
□ Review dependências major version updates
□ Avaliar necessidade de scaling (múltiplas instâncias)
□ Avaliar implementação de features futuras
□ Review security practices
□ Backup completo da aplicação
```

---

*📅 Guia técnico criado em: 13/09/2025 22:30 UTC*  
*🎯 Foco: Troubleshooting e manutenção para programador junior*  
*📚 Referência: PLANO_EXECUCAO_ATUALIZADO.md*
