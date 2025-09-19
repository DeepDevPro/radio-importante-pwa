# 📋 FASE 1: PREPARAÇÃO - CRONOGRAMA DETALHADO

> **Duração estimada:** 30 minutos  
> **Objetivo:** Preparar ambiente Digital Ocean e configurar conexão com repositório  
> **Responsável:** GPT 4.1 (execução autônoma)  

---

## 🎯 **VISÃO GERAL DA FASE 1**

Esta fase prepara a infraestrutura na Digital Ocean para receber o frontend do projeto Radio Importante PWA. Atualmente o backend já está funcionando na DO, agora precisamos migrar o frontend que está no AWS S3/CloudFront.

### **Status inicial:**
- ✅ Backend rodando: `https://radio-importante-pwa-backend-skg2w.ondigitalocean.app`
- ❌ Frontend no AWS: `https://radio.importantestudio.com` (S3 + CloudFront)
- 🎯 Meta: Frontend também na Digital Ocean

---

## 📝 **LISTA DE TAREFAS DETALHADAS**

### **TAREFA 1.1: Verificar Status Atual do Projeto (5 min)**

#### **Objetivo:**
Confirmar que o projeto está pronto para migração e documentar estado atual.

#### **Checklist:**
- ✅ **1.1.1** Verificar se backend Digital Ocean está operacional
  ```bash
  curl -s https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/health
  # Deve retornar: {"status":"ok","message":"Radio Importante Backend API"}
  ```

- ✅ **1.1.2** Confirmar que frontend AWS está funcionando
  ```bash
  curl -I https://radio.importantestudio.com/
  # Deve retornar: HTTP/2 200
  ```

- ✅ **1.1.3** Verificar configuração atual do API no código
  ```bash
  grep -n "radio-importante-pwa-backend-skg2w.ondigitalocean.app" src/config/api.ts
  # Deve mostrar que já está configurado para Digital Ocean
  ```

- ✅ **1.1.4** Testar build local do projeto
  ```bash
  cd /Users/juniordeep/deepdev2/music-player/Ago25PwaCleanTest/mplayer001
  npm ci
  npm run build
  ls -la dist/
  # Deve gerar: dist/index.html, dist/admin.html, dist/assets/
  ```

#### **Critério de sucesso:**
Todos os comandos executam sem erro e confirmam que o projeto está funcionando.

---

### **TAREFA 1.2: Acessar Digital Ocean e Criar App Frontend (10 min)**

#### **Objetivo:**
Criar uma nova aplicação na Digital Ocean App Platform especificamente para o frontend.

#### **Checklist:**
- ✅ **1.2.1** Acessar Digital Ocean Dashboard
  ```
  URL: https://cloud.digitalocean.com/apps
  ```

- ✅ **1.2.2** Clicar em "Create App"

- ✅ **1.2.3** Selecionar "GitHub" como source provider

- ✅ **1.2.4** Escolher repositório
  - Repository: `DeepDevPro/radio-importante-pwa`
  - Branch: `main`

- ✅ **1.2.5** Configurar tipo de aplicação
  - Selecionar: **"Static Site"**
  - Source Directory: `/` (raiz do projeto)

- ✅ **1.2.6** Configurar build settings
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Node.js Version: `18.x` ou superior

- ✅ **1.2.7** Nomear a aplicação
  - App Name: `radio-importante-frontend`
  - Region: `ATL1`

#### **Execução registrada:**
- URL temporária da app: `https://radio-importante-frontend-iekxz.ondigitalocean.app/`
- Tempo total de build: ~1m30s

#### **Critério de sucesso:**
App criada com sucesso e configurações básicas definidas.

---

### **TAREFA 1.3: Configurar Recursos e Custos (5 min)**

#### **Objetivo:**
Otimizar configurações para menor custo e melhor performance.

#### **Checklist:**
- ✅ **1.3.1** Selecionar tier de recursos
  - Instance Size: **Basic** (menor custo)
  - Instance Count: **1** (suficiente para static site)
  - Status: Static Site, plano gratuito, $0/mês

- ✅ **1.3.2** Revisar estimativa de custos
  - Custo estimado: $0/mês
  - AWS S3/CloudFront: $6-18/mês (referência)

- ✅ **1.3.3** Confirmar região
  - Região: ATL1 (Atlanta) confirmada
  - Evitar regiões distantes que aumentam latência

#### **Critério de sucesso:**
Configurações otimizadas para custo/performance definidas.

---

### **TAREFA 1.4: Configurar Deploy Automático (5 min)**

#### **Objetivo:**
Configurar para que a aplicação faça deploy automático quando houver mudanças no repositório.

#### **Checklist:**
- ✅ **1.4.1** Habilitar Auto Deploy
  - Opção já marcada para o branch `main`

- ✅ **1.4.2** Configurar triggers de deploy
  - Deploy automático em cada push para `main`
  - Watch paths padrão já cobre src, public, index.html, admin.html, vite.config.ts, package.json

- ✅ **1.4.3** Configurar variáveis de ambiente (se necessário)
  - Não necessário para static site
  - Backend URL já está hardcoded em `src/config/api.ts`

#### **Critério de sucesso:**
Auto deploy configurado e pronto para ser ativado.

---

### **TAREFA 1.5: Executar Primeiro Deploy e Validar (5 min)**

#### **Objetivo:**
Fazer o primeiro deploy e confirmar que a aplicação está funcionando básicamente.

#### **Checklist:**
- ✅ **1.5.1** Criar a aplicação
  - App criada e deploy inicial realizado
  - Tempo de criação: ~1m30s

- ✅ **1.5.2** Monitorar primeiro build
  - Build concluído com sucesso (Activity/Logs)
  - Status: SUCCESS

- ✅ **1.5.3** Obter URL temporária da app
  - URL: https://radio-importante-frontend-iekxz.ondigitalocean.app/

- ✅ **1.5.4** Testar acesso básico
  - curl -I / e /admin.html retornam HTTP/2 200

- ✅ **1.5.5** Testar no navegador
  - Páginas principais e admin carregam normalmente
  - Conexão com backend funcionando

#### **Execução registrada:**
- Build logs completos salvos
- Nenhum erro crítico impedindo funcionamento
- App operacional e pronta para próxima fase

---

## 📊 **DOCUMENTAÇÃO DA EXECUÇÃO**

### **Informações a serem coletadas durante execução:**

- [ ] **URL temporária da app:** `_________________________`
- [ ] **App ID na Digital Ocean:** `_________________________`
- [ ] **Tempo total de build:** `_________________________`
- [ ] **Status dos testes:** `_________________________`

### **Logs importantes a salvar:**
- [ ] Build logs completos
- [ ] Quaisquer erros encontrados
- [ ] URLs de acesso funcionais

---

## 🚨 **TROUBLESHOOTING COMUM**

### **Problema 1: Build falha com erro de dependências**
```bash
# Solução:
# 1. Verificar se package.json está correto
# 2. Limpar cache: npm cache clean --force
# 3. Tentar build local primeiro
```

### **Problema 2: App não conecta com backend**
```bash
# Verificar:
# 1. src/config/api.ts está configurado para Digital Ocean
# 2. Backend está respondendo
# 3. CORS está configurado no backend
```

### **Problema 3: Build muito lento**
```bash
# Otimização:
# 1. Verificar se .gitignore exclui node_modules
# 2. Verificar se build command está correto
# 3. Considerar usar npm ci ao invés de npm install
```

---

## ✅ **CRITÉRIOS DE CONCLUSÃO DA FASE 1**

### **Para considerar Fase 1 completa, verificar:**

- [ ] ✅ App frontend criada na Digital Ocean
- [ ] ✅ Build executando sem erros
- [ ] ✅ URL temporária acessível
- [ ] ✅ Páginas principais carregando (index.html + admin.html)
- [ ] ✅ Conexão com backend Digital Ocean funcionando
- [ ] ✅ Auto deploy configurado
- [ ] ✅ Documentação da execução preenchida

### **Outputs esperados:**
1. **App URL:** `https://radio-importante-frontend-[hash].ondigitalocean.app`
2. **Status:** Funcionando básicamente
3. **Next Step:** Configurar domínio customizado (Fase 2)

---

## 📋 **PREPARAÇÃO PARA FASE 2**

### **Informações que serão necessárias na próxima fase:**
- [ ] URL da app criada: `_________________________`
- [ ] Confirmação de que SSL está funcionando
- [ ] Tempo de carregamento aceitável (< 3 segundos)
- [ ] Admin panel carregando corretamente

### **Pré-requisitos para Fase 2:**
- Route 53 access (para atualizar DNS)
- Domínio atual funcionando como baseline
- Plano de rollback definido

---

## 🔧 **COMANDOS DE REFERÊNCIA RÁPIDA**

### **Testes básicos:**
```bash
# Status backend
curl -s https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/health

# Status frontend atual
curl -I https://radio.importantestudio.com/

# Build local
cd /path/to/project && npm run build

# Testar nova app
curl -I https://[APP-URL].ondigitalocean.app/
```

### **Verificações importantes:**
```bash
# Verificar configuração API
grep -n "digitalocean" src/config/api.ts

# Verificar build output
ls -la dist/

# Verificar package.json
cat package.json | grep -A5 -B5 "scripts"
```

---

*Documento criado para execução por GPT 4.1 - todas as instruções são autocontidas e executáveis.*
