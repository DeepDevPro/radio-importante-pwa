# 📝 CHECKLIST DE IMPLEMENTAÇÃO - STAGING ENVIRONMENT

> **Uso:** Lista de verificação passo a passo para implementar staging  
> **Status:** Pronto para execução  
> **Tempo estimado:** 45 minutos  

---

## 🎯 **PRÉ-REQUISITOS** 

### **Verificações Iniciais:**
- [ ] ✅ FASE 4 concluída com sucesso (GitHub Actions funcionando)
- [ ] ✅ Token Digital Ocean configurado no GitHub
- [ ] ✅ Acesso ao dashboard Digital Ocean
- [ ] ✅ Branch `main` estável e funcionando
- [ ] ✅ Conhecimento das URLs atuais de produção

### **Informações Necessárias:**
```bash
✅ App Produção: radio-importante-frontend (1e7d94e3-6bf3-40ec-8a31-501fadfd4edd)
✅ URL Produção: https://radio.importantestudio.com/
✅ Backend: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/
✅ GitHub Token: DIGITALOCEAN_ACCESS_TOKEN configurado
```

---

## 📋 **FASE 1: PREPARAÇÃO DA INFRAESTRUTURA** (15 min)

### **TAREFA 1.1: Criar App Staging na Digital Ocean**
- [ ] **1.1.1** Acessar [Digital Ocean Apps Dashboard](https://cloud.digitalocean.com/apps)
- [ ] **1.1.2** Clicar em "Create App"
- [ ] **1.1.3** Configurar Source:
  ```yaml
  Source Type: GitHub
  Repository: DeepDevPro/radio-importante-pwa
  Branch: staging (criar se não existir)
  Source Directory: / (raiz)
  ```
- [ ] **1.1.4** Configurar Build Settings:
  ```yaml
  Build Command: npm run build
  Output Directory: dist
  Install Command: npm ci
  ```
- [ ] **1.1.5** Configurar App Details:
  ```yaml
  App Name: radio-importante-frontend-staging
  Region: Same as production
  ```
- [ ] **1.1.6** Deploy app e aguardar conclusão
- [ ] **1.1.7** Documentar App ID: `___________________________`
- [ ] **1.1.8** Documentar URL gerada: `___________________________`

### **TAREFA 1.2: Configurar Branch Staging**
- [ ] **1.2.1** Verificar se branch staging existe:
  ```bash
  git branch -a | grep staging
  ```
- [ ] **1.2.2** Se não existe, criar:
  ```bash
  git checkout main
  git pull origin main
  git checkout -b staging
  git push -u origin staging
  ```
- [ ] **1.2.3** Se existe, atualizar:
  ```bash
  git checkout staging
  git pull origin staging
  git merge main
  git push origin staging
  ```

---

## 📋 **FASE 2: CONFIGURAÇÃO DO FRONTEND** (15 min)

### **TAREFA 2.1: Atualizar Configurações de API**
- [ ] **2.1.1** Modificar `src/config/api.ts`:
  - [ ] Adicionar detecção de ambiente staging
  - [ ] Configurar backend URL para staging
  - [ ] Testar configuração localmente
  
- [ ] **2.1.2** Atualizar `admin/scripts/config.js`:
  - [ ] Adicionar ambiente staging
  - [ ] Configurar backend staging
  - [ ] Atualizar debug settings
  
- [ ] **2.1.3** Atualizar `public/scripts/config.js`:
  - [ ] Espelhar configurações do admin
  - [ ] Verificar consistência

### **TAREFA 2.2: Adicionar Identificação Visual**
- [ ] **2.2.1** Adicionar CSS para banner staging em `src/style.css`
- [ ] **2.2.2** Implementar detecção de staging em `src/app.ts`
- [ ] **2.2.3** Adicionar indicadores visuais
- [ ] **2.2.4** Modificar title para mostrar [STAGING]

### **TAREFA 2.3: Testar Localmente**
- [ ] **2.3.1** Executar `npm run dev`
- [ ] **2.3.2** Verificar se não quebrou produção
- [ ] **2.3.3** Simular ambiente staging (modificar hostname)
- [ ] **2.3.4** Verificar se banners aparecem

---

## 📋 **FASE 3: CONFIGURAÇÃO DO BACKEND** (10 min)

### **TAREFA 3.1: Decidir Estratégia**
- [ ] **Opção A: Backend Compartilhado (Recomendado para início)**
  - [ ] **3.1.1** Manter backend de produção
  - [ ] **3.1.2** Configurar CORS para staging URL
  - [ ] **3.1.3** Testar conexão staging → backend produção
  
- [ ] **Opção B: Backend Separado (Futuro)**
  - [ ] **3.1.1** Criar app backend staging na Digital Ocean
  - [ ] **3.1.2** Configurar environment variables
  - [ ] **3.1.3** Testar deploy backend staging

### **TAREFA 3.2: Atualizar CORS (se Backend Compartilhado)**
- [ ] **3.2.1** Adicionar staging URL ao backend CORS
- [ ] **3.2.2** Verificar se backend aceita subdomínio staging
- [ ] **3.2.3** Testar endpoints desde staging

---

## 📋 **FASE 4: GITHUB ACTIONS** (10 min)

### **TAREFA 4.1: Criar Workflow de Staging**
- [ ] **4.1.1** Criar `.github/workflows/deploy-staging.yml`
- [ ] **4.1.2** Configurar trigger para branch `staging`
- [ ] **4.1.3** Usar mesmo token Digital Ocean
- [ ] **4.1.4** Configurar app name staging
- [ ] **4.1.5** Testar sintaxe YAML

### **TAREFA 4.2: Testar Deploy Staging**
- [ ] **4.2.1** Fazer commit em staging:
  ```bash
  git checkout staging
  echo "# Staging test" >> README.md
  git add README.md
  git commit -m "test: staging deploy"
  git push origin staging
  ```
- [ ] **4.2.2** Verificar GitHub Actions: https://github.com/DeepDevPro/radio-importante-pwa/actions
- [ ] **4.2.3** Aguardar conclusão do deploy
- [ ] **4.2.4** Acessar URL staging e verificar funcionamento

---

## 📋 **FASE 5: TESTES E VALIDAÇÃO** (5 min)

### **TAREFA 5.1: Testes Frontend Staging**
- [ ] **5.1.1** Acessar URL staging: `___________________________`
- [ ] **5.1.2** Verificar banner "STAGING" aparece
- [ ] **5.1.3** Verificar title mostra [STAGING]
- [ ] **5.1.4** Testar player de música funciona
- [ ] **5.1.5** Verificar Service Worker funciona

### **TAREFA 5.2: Testes Admin Panel Staging**
- [ ] **5.2.1** Acessar admin staging: `[URL-STAGING]/admin.html`
- [ ] **5.2.2** Verificar backend status = online
- [ ] **5.2.3** Testar upload de arquivo (small test file)
- [ ] **5.2.4** Verificar lista de músicas carrega
- [ ] **5.2.5** Testar delete do arquivo teste

### **TAREFA 5.3: Testes API Integration**
- [ ] **5.3.1** Health check: `curl [BACKEND-URL]/health`
- [ ] **5.3.2** Catalog endpoint: verificar no browser network tab
- [ ] **5.3.3** Verificar CORS funcionando
- [ ] **5.3.4** Verificar environment variables aplicadas

---

## 📋 **FASE 6: DOCUMENTAÇÃO E FINALIZÇÃO**

### **TAREFA 6.1: Documentar URLs e IDs**
- [ ] **6.1.1** URL Staging: `___________________________`
- [ ] **6.1.2** App ID Staging: `___________________________`
- [ ] **6.1.3** Backend URL: `___________________________`
- [ ] **6.1.4** Atualizar documentação do projeto

### **TAREFA 6.2: Criar Workflow de Desenvolvimento**
- [ ] **6.2.1** Documentar processo: develop → staging → produção
- [ ] **6.2.2** Criar scripts helper (switch-to-staging.sh, promote-to-production.sh)
- [ ] **6.2.3** Testar fluxo completo uma vez

### **TAREFA 6.3: Configurar Branch Protection (Opcional)**
- [ ] **6.3.1** GitHub Settings → Branches
- [ ] **6.3.2** Adicionar rule para branch `staging`
- [ ] **6.3.3** Configurar requirements (opcional para início)

---

## ✅ **CHECKLIST FINAL DE VALIDAÇÃO**

### **Ambiente Staging Funcionando:**
- [ ] ✅ URL staging carrega sem erros
- [ ] ✅ Banner de staging visível e animado
- [ ] ✅ Title mostra [STAGING] prefix
- [ ] ✅ Player de música funciona completamente
- [ ] ✅ Admin panel acessível e funcional
- [ ] ✅ Upload/download de arquivos funciona
- [ ] ✅ Backend connection estabelecida

### **Pipeline CI/CD Staging:**
- [ ] ✅ GitHub Actions deploy-staging.yml executa sem erros
- [ ] ✅ Push para staging triggera deploy automático
- [ ] ✅ Deploy staging completa em ~1-2 minutos
- [ ] ✅ Mudanças aparecem no staging após deploy

### **Separação de Ambientes:**
- [ ] ✅ Produção não afetada por mudanças staging
- [ ] ✅ URLs distintas e claras (staging vs produção)
- [ ] ✅ Identificação visual clara em staging
- [ ] ✅ Backend apropriado conectado

### **Workflow de Desenvolvimento:**
- [ ] ✅ Processo develop → staging → main documentado
- [ ] ✅ Scripts helper criados e testados
- [ ] ✅ Branch staging protegida (se configurado)
- [ ] ✅ Processo de rollback documentado

---

## 🚨 **TROUBLESHOOTING RÁPIDO**

### **Staging não carrega:**
```bash
# Verificar:
1. App existe na Digital Ocean? → Check dashboard
2. Deploy foi executado? → Check GitHub Actions
3. Branch staging tem conteúdo? → git log staging
4. URL correta? → Verificar na Digital Ocean
```

### **Banner staging não aparece:**
```bash
# Debug:
1. console.log(window.location.hostname) → Verificar detecção
2. Verificar CSS foi incluído → Inspect element
3. Verificar JavaScript executou → Console errors
```

### **Backend connection failed:**
```bash
# Debug:
1. curl [BACKEND-URL]/health → Testar direto
2. Check CORS headers → Network tab
3. Verificar URL correta → config.js
```

### **Deploy falha:**
```bash
# Debug GitHub Actions:
1. Acessar Actions tab no GitHub
2. Ver logs do deploy que falhou
3. Verificar app name correto no workflow
4. Verificar token válido
```

---

## 📞 **INFORMAÇÕES DE SUPORTE**

### **URLs Importantes:**
- **Digital Ocean Apps:** https://cloud.digitalocean.com/apps
- **GitHub Actions:** https://github.com/DeepDevPro/radio-importante-pwa/actions
- **Produção:** https://radio.importantestudio.com/
- **Backend:** https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/

### **Comandos de Emergência:**
```bash
# Rollback rápido staging:
git checkout staging
git reset --hard main
git push origin staging --force

# Voltar para produção:
git checkout main

# Debug deploy:
npm run build  # Testar build local
```

---

*Checklist criado em 19/09/2025 - Execução passo a passo do staging environment*
