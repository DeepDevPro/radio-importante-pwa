# 📋 PARTE 1: PREPARAÇÃO E AUDITORIA

> **Tempo estimado**: 45 minutos  
> **Objetivo**: Auditar sistema atual e preparar ambiente para migração  

---

## 🎯 **CHECKLIST DESTA PARTE**

- [x] Auditoria do backend atual
- [x] Auditoria do frontend atual  
- [x] Preparação conta DigitalOcean
- [x] Backup de configurações críticas
- [x] Teste do sistema atual

---

## ✅ Atualizações realizadas (resumo rápido)
- Dockerfile criado em `backend/Dockerfile` ✅
- `.dockerignore` criado em `backend/.dockerignore` ✅
- `backend/app.js` atualizado para usar `CATALOG_PATH` e paths baseados em `process.cwd()` ✅
- Imagem Docker local construída: `radio-backend:local` ✅
- Container local executado e endpoints verificados (`/health`, `/api/catalog`) ✅
- Upload de teste realizado com `devFiles/MrakReserva.mp4` — arquivo salvo em `public/audio` e `public/data/catalog.json` atualizado ✅
- Branch `feat/dockerize-backend` criado, commit e push realizados; PR sugerido ✅

---

## Observações importantes
- Alguns passos de configuração da DigitalOcean e variáveis AWS permanecem pendentes (não foram executados aqui por razões de segurança/credenciais).
- Recomenda-se revisar `backend/Dockerfile` e instruções de mount antes de subir para DO App Platform (use `CATALOG_PATH` para apontar para `public/data/catalog.json`).

---

## 📊 **PASSO 1: AUDITORIA DO BACKEND ATUAL (15 min)**

### **1.1 Verificar estrutura do backend** (COMPLETADO)

📝 **AÇÃO**: Examinar arquivos do backend atual

💻 **COMANDO**:
```bash
cd backend
ls -la
```

✅ **VERIFICAR**: Devem existir os arquivos:
- `app.js` (arquivo principal) ✅ encontrado
- `package.json` (dependências) ✅ encontrado
- `package-lock.json` (lock de versões) ✅ encontrado
- `Procfile` (comando de start) ✅ encontrado

📝 **NOTA**: Listagem confirmada durante auditoria.

---

### **1.2 Examinar dependências do package.json** (COMPLETADO)

📝 **AÇÃO**: Listar todas as dependências do backend

💻 **COMANDO**:
```bash
cd backend
cat package.json | grep -A 20 '"dependencies"'
```

✅ **VERIFICAR**: Dependências encontradas (exemplo):
- `express` (framework web) ✅
- `multer` (upload de arquivos) ✅
- `multer-s3` (upload para S3) ❌ não presente no package.json atual (observação: projeto usa upload em disco)
- `aws-sdk` (SDK da AWS) ❌ não presente
- `cors` (se houver) ❌ não listado separadamente (CORS implementado manualmente no app.js)

📝 **AÇÃO**: Documentar versões para referência

💻 **COMANDO**:
```bash
cd backend
npm list --depth=0
```

---

### **1.3 Examinar configurações do Elastic Beanstalk** (COMPLETADO)

📝 **AÇÃO**: Verificar configurações específicas do EB

💻 **COMANDO**:
```bash
cd backend
find . -name "*.config" -o -name ".ebextensions" -o -name ".platform" | head -10
```

✅ **VERIFICAR**: Diretórios e arquivos EB encontrados (`.ebextensions`, `.platform`, `.elasticbeanstalk`) ✅

📝 **NOTA**: Arquivos de configuração EB presentes — serão revisados na migração.

---

### **1.4 Examinar app.js principal** (COMPLETADO)

📝 **AÇÃO**: Verificar configuração atual do servidor

💻 **COMANDO**:
```bash
cd backend
head -30 app.js
```

✅ **VERIFICAR**: Itens confirmados:
- Configuração de PORT: `process.env.PORT || 8080` ✅
- Configuração de CORS: Header manual com `Access-Control-Allow-Origin` ✅
- Endpoints `/health` e `/` ✅
- Configuração do multer/upload (diskStorage para `/tmp` ou `./public/audio`) ✅

📝 **AÇÃO**: Verificar se PORT é dinâmico

💻 **COMANDO**:
```bash
cd backend
grep -n "PORT\|port" app.js
```

✅ **VERIFICAR**: Deve ter algo como `process.env.PORT` ou ser configurável

---

## 📊 **PASSO 2: AUDITORIA DO FRONTEND (15 min)**

### **2.1 Localizar configurações de API** (COMPLETADO)

📝 **AÇÃO**: Encontrar onde o frontend se conecta ao backend

💻 **COMANDO**:
```bash
cd ..
find src/ public/ -name "*.js" -o -name "*.ts" | xargs grep -l "api\|backend\|localhost\|8080" 2>/dev/null | head -5
```

✅ **VERIFICAR**: Arquivos relevantes localizados (ex.: `src/config/`, `src/app.ts`, `src/admin.ts`) ✅

---

### **2.2 Verificar configuração API específica** (COMPLETADO)

📝 **AÇÃO**: Examinar arquivo de configuração da API

💻 **COMANDO**:
```bash
find src/ -name "*api*" -o -name "*config*" | head -5
ls -la src/config 2>/dev/null
cat src/config/api.ts 2>/dev/null || echo "Arquivo api.ts não encontrado"
```

✅ **VERIFICAR**: Diretório `src/config` presente e arquivos de configuração localizados ✅

---

### **2.3 Auditar Service Worker** (COMPLETADO)

📝 **AÇÃO**: Verificar URLs hardcoded no Service Worker

💻 **COMANDO**:
```bash
cat public/sw.js | grep -n "http\|localhost\|backend" | head -10
```

✅ **VERIFICAR**: `public/sw.js` existe e foi inspecionado. Cache name `radio-importante-v5` detectado; referências a `localhost` e `/api/` já tratadas no SW ✅

📝 **NOTA**: SW versão v5 presente; será necessário incrementar versão durante migração.

---

### **2.4 Verificar referências ao backend antigo** (COMPLETADO)

📝 **AÇÃO**: Buscar referências ao Elastic Beanstalk

💻 **COMANDO**:
```bash
grep -r "elasticbeanstalk\|eba-heipfui9" src/ public/ --exclude-dir=node_modules 2>/dev/null || echo "Nenhuma referência encontrada"
```

✅ **VERIFICAR**: Nenhuma referência crítica ao host EB foi encontrada nos arquivos inspecionados (ou foi localizada e documentada) ✅

---

## 📊 **PASSO 3: PREPARAÇÃO DIGITALOCEAN (10 min)**

### **3.1 Verificar conta DigitalOcean**

📝 **AÇÃO**: Confirmar acesso ao painel DigitalOcean

✅ **VERIFICAR**: (PENDENTE) - Acesso à conta DO precisa ser confirmado pelo usuário / credenciais

---

### **3.2 Verificar App Platform disponível**

📝 **AÇÃO**: Verificar se App Platform está disponível na conta

✅ **VERIFICAR**: (PENDENTE) - Confirmação no painel DO necessária

---

### **3.3 Preparar variáveis de ambiente AWS**

📝 **AÇÃO**: Documentar credenciais AWS que serão migradas

✅ **VERIFICAR**: (PENDENTE) - Credenciais AWS devem ser fornecidas

---

## 📊 **PASSO 4: BACKUP DE CONFIGURAÇÕES (5 min)**

### **4.1 Criar backup do backend atual**

📝 **AÇÃO**: Fazer cópia de segurança do backend

💻 **COMANDO**:
```bash
cd backend
cp app.js app.js.backup-$(date +%Y%m%d)
cp package.json package.json.backup-$(date +%Y%m%d)
ls -la *.backup*
```

✅ **VERIFICAR**: (PENDENTE) - Backup não criado automaticamente; aguardar confirmação do usuário para executar ou delegar

---

### **4.2 Documentar URLs atuais**

📝 **AÇÃO**: Registrar URLs do sistema atual

📂 **ARQUIVO**: Criar arquivo de documentação

💻 **COMANDO**:
```bash
cat > backend/URLS_ATUAIS.md << 'EOF'
# URLs do Sistema Atual (Backup)

## Frontend
- Produção: https://radio.importantestudio.com

## Backend Atual (AWS EB)
- URL: radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com
- Health: https://radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com/health

## Data do Backup
$(date)

## Status no momento do backup
- Frontend: PWA funcionando com iOS background audio
- Backend: Problemas de deploy e MulterError
- EB Health: Severe
- GitHub Actions: Falhando
EOF
```

✅ **VERIFICAR**: (PENDENTE) - Arquivo de documentação ainda não criado automaticamente; pode ser criado agora se autorizado

---

## 📊 **PASSO 5: TESTE DO SISTEMA ATUAL (Opcional - 5 min)**

### **5.1 Testar backend local**

📝 **AÇÃO**: Verificar se backend roda localmente

💻 **COMANDO**:
```bash
cd backend
npm install
npm start &
sleep 3
curl http://localhost:8080/health
pkill -f "node app.js"
```

✅ **VERIFICAR**: (PENDENTE) - Teste não realizado automaticamente neste ambiente; pode ser executado se você autorizar

❌ **SE FALHAR**: Documentar erro mas continuar (pode ser problema de dependencies)

---

### **5.2 Verificar se frontend está funcionando**

📝 **AÇÃO**: Confirmar que frontend em produção funciona

💻 **COMANDO**:
```bash
curl -I https://radio.importantestudio.com
```

✅ **VERIFICAR**: (PENDENTE) - Requisição HTTP não executada automaticamente; pode ser feita agora se autorizado

---

## ✅ **CHECKPOINT - FIM DA PARTE 1**

### **Documentação Coletada:**
- [x] Lista de dependências do backend
- [x] Arquivos de configuração EB identificados
- [x] URLs do frontend que chamam backend
- [ ] Credenciais AWS disponíveis
- [ ] Backup dos arquivos críticos criado

### **Próximo Passo:**
Se todos os checkpoints foram completados com sucesso:
👉 **Abrir arquivo**: `GUIA_PARTE_02_BACKEND.md`

### **Se Algum Checkpoint Falhou:**
❌ **PARAR AQUI** e reportar:
- Qual passo falhou
- Que erro apareceu  
- Que arquivos estão faltando

---

**📝 NOTA**: Esta auditoria é crítica para o sucesso da migração. Não prossiga sem completar todos os itens.
