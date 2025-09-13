# 🔧 PARTE 2: MIGRAÇÃO DO BACKEND NODE.JS

> **Tempo estimado**: 2-3 horas  
> **Objetivo**: Adaptar backend atual para DigitalOcean App Platform  
> **Estratégia**: Modificações mínimas, manter mesma funcionalidade  

---

## 🎯 **CHECKLIST DESTA PARTE**

- [ ] Adaptações no código do backend
- [ ] Criação do app na DigitalOcean
- [ ] Configuração de variáveis de ambiente
- [ ] Primeiro deploy de teste
- [ ] Validação da migração

---

## 📊 **PASSO 1: ADAPTAÇÕES NO BACKEND (45 min)**

### **1.1 Garantir PORT dinâmico**

📝 **AÇÃO**: Verificar e corrigir configuração de porta

📂 **ARQUIVO**: `backend/app.js`

💻 **COMANDO**:
```bash
cd backend
grep -n "PORT\|port\|listen" app.js
```

✅ **VERIFICAR**: Se já tem `process.env.PORT`, pode pular para 1.2

❌ **SE NÃO TIVER**: Aplicar correção:

📝 **AÇÃO**: Corrigir configuração de PORT

💻 **COMANDO**: Abrir `backend/app.js` e encontrar a linha com `listen`. Exemplo:
```javascript
// ANTES (se estiver assim):
app.listen(8080, () => {
  console.log('Server running on port 8080');
});

// DEPOIS (substituir por):
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

### **1.2 Configurar CORS para produção**

📝 **AÇÃO**: Atualizar configuração CORS para aceitar domínio de produção

📂 **ARQUIVO**: `backend/app.js`

💻 **COMANDO**: Encontrar seção CORS e substituir:

```javascript
// ANTES (se estiver com '*'):
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  // ...
});

// DEPOIS (substituir por):
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://radio.importantestudio.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    process.env.FRONTEND_URL
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
```

---

### **1.3 Corrigir problema do MulterError**

📝 **AÇÃO**: Tornar upload middleware mais flexível

📂 **ARQUIVO**: `backend/app.js`

💻 **COMANDO**: Encontrar configuração do multer e upload:

```javascript
// Procurar por algo como:
// upload.array('audioFiles')
// ou
// upload.single('file')

// SUBSTITUIR por middleware flexível:
const upload = multer({ storage }).any(); // Aceita qualquer field name

app.post('/api/upload', upload, (req, res) => {
  console.log('Upload - Files received:', req.files?.length || 0);
  console.log('Upload - Field names:', req.files?.map(f => f.fieldname) || []);
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ 
      error: 'No files uploaded',
      hint: 'Use field name: audioFiles or file'
    });
  }
  
  // ... resto da lógica de upload continua igual
});
```

---

### **1.4 Corrigir problema do MulterError**

📝 **AÇÃO**: Tornar upload middleware mais flexível

📂 **ARQUIVO**: `backend/app.js`

💻 **COMANDO**: Encontrar configuração do multer e upload:

```javascript
// Procurar por algo como:
// upload.array('audioFiles')
// ou
// upload.single('file')

// SUBSTITUIR por middleware flexível:
const upload = multer({ storage }).any(); // Aceita qualquer field name

app.post('/api/upload', upload, (req, res) => {
  console.log('Upload - Files received:', req.files?.length || 0);
  console.log('Upload - Field names:', req.files?.map(f => f.fieldname) || []);
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ 
      error: 'No files uploaded',
      hint: 'Use field name: audioFiles or file'
    });
  }
  
  // ... resto da lógica de upload continua igual
});
```

---

### **1.5 Corrigir paths e containerização (ATUALIZADO)**

📝 **AÇÃO**: Tornar paths dependentes de `process.cwd()` e suportar `CATALOG_PATH` para compatibilidade com mounts em container

📂 **ARQUIVO**: `backend/app.js`, `backend/Dockerfile`, `backend/.dockerignore`

💻 **COMANDO**:
```bash
# Exemplo de alterações aplicadas pelo assistente:
# - app.js usa process.cwd() para public paths
# - saveCatalog usa process.env.CATALOG_PATH se definido
# - Dockerfile criado com Node 18
# - .dockerignore criado
```

✅ **VERIFICAR**: As mudanças já foram aplicadas no branch `feat/dockerize-backend` e testadas localmente.

### **1.6 Dockerfile e instruções de run**

📝 **AÇÃO**: Adicionar Dockerfile e instruções para rodar localmente com mounts

📂 **ARQUIVO**: `backend/Dockerfile`, `devFiles/DOCKER_RUN_INSTRUCTIONS.md`

💻 **COMANDO**:
```bash
# Build
docker build -t radio-backend:local ./backend

# Run (mount public so catalog writes persist on host)
docker run --name radio-backend-local -p 8080:8080 \
  -v $(pwd)/public:/usr/src/public \
  -v $(pwd)/public/audio:/usr/src/app/public/audio \
  -e PORT=8080 \
  -e CATALOG_PATH=/usr/src/public/data/catalog.json \
  -d radio-backend:local
```

✅ **VERIFICAR**: `/health` e `/api/catalog` respondem; uploads persistem em `public/data/catalog.json`.

---

### **1.7 Melhorar logging**

📝 **AÇÃO**: Adicionar logs para debug na DO

📂 **ARQUIVO**: `backend/app.js`

💻 **COMANDO**: Adicionar no início do arquivo, após requires:

```javascript
// Adicionar após os requires:
console.log('🚀 Radio Importante Backend starting...');
console.log('📝 Environment:', process.env.NODE_ENV || 'development');
console.log('🔌 Port:', process.env.PORT || 8080);
console.log('☁️ Platform:', process.platform);
console.log('📅 Start time:', new Date().toISOString());
```

---

### **1.8 Atualizar package.json scripts**

📝 **AÇÃO**: Garantir scripts corretos para DO App Platform

📂 **ARQUIVO**: `backend/package.json`

💻 **COMANDO**: Verificar/atualizar seção scripts:

```json
{
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "echo \"No tests yet\" && exit 0"
  },
  "engines": {
    "node": "18.x",
    "npm": ">=8.0.0"
  }
}
```

---

## 📊 **PASSO 2: TESTAR BACKEND LOCALMENTE (15 min)**

### **2.1 Testar modificações localmente**

📝 **AÇÃO**: Verificar se backend ainda funciona após modificações

💻 **COMANDO**:
```bash
cd backend
npm install
npm start &
sleep 5
```

### **2.2 Testar endpoints principais**

💻 **COMANDO**:
```bash
# Testar health
curl http://localhost:8080/health

# Testar info
curl http://localhost:8080/

# Testar CORS
curl -H "Origin: https://radio.importantestudio.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:8080/api/upload
```

✅ **VERIFICAR**: 
- Health retorna JSON com status
- Info retorna dados do servidor
- CORS retorna headers corretos

### **2.3 Parar servidor local**

💻 **COMANDO**:
```bash
pkill -f "node app.js"
```

❌ **SE ALGUM TESTE FALHOU**: PARAR e corrigir antes de continuar

---

## 📊 **PASSO 3: CRIAR APP NA DIGITALOCEAN (30 min)**

### **3.1 Acessar DigitalOcean App Platform**

📝 **AÇÃO**: Criar novo app na DigitalOcean

✅ **VERIFICAR**: Acessar https://cloud.digitalocean.com/apps

### **3.2 Conectar repositório GitHub**

📝 **AÇÃO**: Configurar conexão com GitHub

📋 **CONFIGURAÇÃO**:
- Repository: `DeepDevPro/radio-importante-pwa`
- Branch: `main`
- Source Directory: `/backend`

### **3.3 Configurar build settings**

📝 **AÇÃO**: Definir configurações de build

📋 **CONFIGURAÇÃO**:
- Build Command: `npm ci`
- Run Command: `npm start`
- Environment: `Node.js 18.x`
- Port: `8080` (auto-detectado)
- Health Check: `/health`

### **3.4 Configurar variáveis de ambiente**

📝 **AÇÃO**: Adicionar variáveis de ambiente necessárias

📋 **VARIÁVEIS** (na seção Environment Variables):
```
NODE_ENV=production
AWS_ACCESS_KEY_ID=[sua_aws_key]
AWS_SECRET_ACCESS_KEY=[sua_aws_secret]
AWS_REGION=us-west-2
S3_BUCKET=radio-importantestudio-com
FRONTEND_URL=https://radio.importantestudio.com
```

⚠️ **IMPORTANTE**: Substituir `[sua_aws_key]` e `[sua_aws_secret]` pelos valores reais

### **3.5 Configurar nome do app**

📝 **AÇÃO**: Definir nome único

📋 **CONFIGURAÇÃO**:
- App Name: `radio-importante-backend`
- Plan: `Basic ($5/month)` para início

---

## 📊 **PASSO 4: PRIMEIRO DEPLOY (20 min)**

### **4.1 Iniciar deploy**

📝 **AÇÃO**: Fazer primeiro deploy do app

✅ **VERIFICAR**: Clicar em "Create App" e aguardar build

### **4.2 Monitorar build**

📝 **AÇÃO**: Acompanhar logs de build em tempo real

✅ **VERIFICAR**: 
- Build deve completar sem erros
- Deploy deve terminar com sucesso
- Health check deve passar

### **4.3 Obter URL do app**

📝 **AÇÃO**: Documentar URL gerada pela DO

💻 **COMANDO**: URL será algo como:
```
https://radio-importante-backend-[hash].ondigitalocean.app
```

📂 **ARQUIVO**: Salvar URL:

💻 **COMANDO**:
```bash
echo "# Nova URL do Backend DO" > backend/URL_DIGITALOCEAN.md
echo "URL: https://radio-importante-backend-[substituir-pelo-hash-real].ondigitalocean.app" >> backend/URL_DIGITALOCEAN.md
echo "Data: $(date)" >> backend/URL_DIGITALOCEAN.md
```

---

## 📊 **PASSO 5: TESTES INICIAIS DO DEPLOY (20 min)**

### **5.1 Testar health endpoint**

📝 **AÇÃO**: Verificar se backend responde na DO

💻 **COMANDO**:
```bash
# Substituir pela URL real da DO
curl https://radio-importante-backend-[hash].ondigitalocean.app/health
```

✅ **VERIFICAR**: Deve retornar JSON com status OK

### **5.2 Testar info endpoint**

💻 **COMANDO**:
```bash
curl https://radio-importante-backend-[hash].ondigitalocean.app/
```

✅ **VERIFICAR**: Deve retornar info do servidor com versão

### **5.3 Testar CORS com frontend**

💻 **COMANDO**:
```bash
curl -H "Origin: https://radio.importantestudio.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://radio-importante-backend-[hash].ondigitalocean.app/api/upload
```

✅ **VERIFICAR**: Deve retornar headers CORS corretos

### **5.4 Verificar logs da aplicação**

📝 **AÇÃO**: Examinar logs no painel da DO

✅ **VERIFICAR**: 
- Logs de startup aparecendo
- Não há erros críticos
- Port binding funcionando

---

## 📊 **PASSO 6: CONFIGURAR DOMÍNIO PERSONALIZADO (Opcional - 10 min)**

### **6.1 Adicionar domínio customizado**

📝 **AÇÃO**: Configurar subdomínio para backend

📋 **CONFIGURAÇÃO**:
- Domain: `api.importantestudio.com` (ou similar)
- SSL: Auto-gerenciado pela DO

### **6.2 Atualizar DNS**

📝 **AÇÃO**: Apontar domínio para DO (se necessário)

⚠️ **NOTA**: Este passo pode ser feito depois, na Parte 3

---

## ✅ **CHECKPOINT - FIM DA PARTE 2**

### **Validações Obrigatórias:**
- [ ] Backend deploya sem erros na DO
- [ ] Health check retorna 200 OK
- [ ] CORS funciona com domínio frontend
- [ ] Logs não mostram erros críticos
- [ ] URL da DO documentada

### **Próximo Passo:**
Se todos os checkpoints foram completados com sucesso:
👉 **Abrir arquivo**: `GUIA_PARTE_03_FRONTEND.md`

### **Se Algum Checkpoint Falhou:**
❌ **PARAR AQUI** e reportar:
- Logs de erro específicos da DO
- Resposta dos endpoints de teste
- Screenshots do painel da DO (se possível)

---

**🔧 NOTA**: O backend agora está rodando na DigitalOcean, mas o frontend ainda aponta para o antigo. Não altere DNS ainda!
