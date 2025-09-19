# 🚀 PLANO DETALHADO DE MIGRAÇÃO AWS → DIGITAL OCEAN

> **Data:** $(date +%Y-%m-%d)  
> **Projeto:** Radio Importante PWA  
> **Objetivo:** Migração completa de AWS para Digital Ocean para evitar burocracia de compliance  

---

## 📊 **STATUS ATUAL**

### ✅ **JÁ MIGRADO**
- **Backend:** ✅ Funcionando na Digital Ocean
  - URL: `https://radio-importante-pwa-backend-skg2w.ondigitalocean.app`
  - Status: Operacional com upload e API funcionando
  - Environment: Node.js + Docker na App Platform

### 🔄 **PENDENTE DE MIGRAÇÃO**
- **Frontend:** ❌ Ainda no AWS S3 + CloudFront
  - S3 Bucket: `radio-importante-frontend`
  - CloudFront ID: `E7IJOAICB6CUO`
  - Domínio: `radio.importantestudio.com`
  - GitHub Actions: Deploy automático para AWS

---

## 🎯 **ESTRUTURA DA MIGRAÇÃO**

### **FASE 1: PREPARAÇÃO (30 min)**
- [x] Análise de arquivos concluída
- [x] Backup de configurações AWS documentado
- [ ] Criar app frontend na Digital Ocean
- [ ] Configurar GitHub repository connection

### **FASE 2: FRONTEND NA DIGITAL OCEAN (45 min)**
- [ ] Criar Static Site na Digital Ocean App Platform
- [ ] Configurar build do Vite para produção
- [ ] Setup domínio customizado na DO
- [ ] Testar funcionamento básico

### **FASE 3: DOMÍNIO E DNS (30 min)**
- [ ] Configurar domínio na Digital Ocean
- [ ] Atualizar DNS do Route 53 temporariamente
- [ ] Testar acesso com novo setup
- [ ] Validar SSL/HTTPS

### **FASE 4: PIPELINE CI/CD (20 min)**
- [ ] Criar workflow para Digital Ocean
- [ ] Desabilitar workflows AWS
- [ ] Teste de deploy automático
- [ ] Documentar novo processo

### **FASE 5: CLEANUP AWS (15 min)**
- [ ] Backup final dos dados AWS
- [ ] Desabilitar CloudFront distribution
- [ ] Remover S3 bucket
- [ ] Cancelar serviços AWS desnecessários

---

## 📝 **COMANDOS E CONFIGURAÇÕES**

### **1. Criar App Frontend na Digital Ocean**

#### **1.1 Configuração da App Platform**
```yaml
# Configuração do App Frontend
name: radio-importante-frontend
region: nyc1
services:
- name: frontend
  source_dir: /
  github:
    repo: DeepDevPro/radio-importante-pwa
    branch: main
  build_command: npm run build
  output_dir: dist
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  routes:
  - path: /
  static_sites:
  - name: frontend
    source_dir: /
    build_command: npm run build
    output_dir: dist
    index_document: index.html
    error_document: index.html
```

#### **1.2 Environment Variables para Frontend**
```env
# Não são necessárias para frontend estático
# O backend URL já está configurado em src/config/api.ts
```

### **2. Atualizar Build Configuration**

#### **2.1 Verificar vite.config.ts**
```typescript
// Já configurado corretamente para multi-entry:
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
});
```

#### **2.2 Verificar src/config/api.ts**
```typescript
// Já configurado para Digital Ocean:
const API_CONFIG: ApiConfig = {
  baseUrl: isProduction 
    ? 'https://radio-importante-pwa-backend-skg2w.ondigitalocean.app'
    : 'http://localhost:8080'
};
```

### **3. Configurar Domínio Customizado**

#### **3.1 Na Digital Ocean App Platform**
```bash
# Via Dashboard:
# 1. Settings > Domains
# 2. Add Domain: radio.importantestudio.com
# 3. Configure DNS settings (CNAME ou A record)
```

#### **3.2 Configurar DNS (Opção 1: Manter Route 53 temporariamente)**
```bash
# Atualizar Record no Route 53:
# Tipo: CNAME
# Nome: radio
# Valor: [app-url].ondigitalocean.app
```

#### **3.3 Configurar DNS (Opção 2: Migrar DNS para DO)**
```bash
# 1. Criar DNS Zone na Digital Ocean
# 2. Atualizar nameservers no registrar
# 3. Configurar records necessários
```

### **4. GitHub Actions para Digital Ocean**

#### **4.1 Criar novo workflow: `.github/workflows/deploy-digitalocean.yml`**
```yaml
name: Deploy to Digital Ocean

on:
  push:
    branches: [ "main" ]
    paths:
      - "src/**"
      - "public/**"
      - "index.html"
      - "admin.html"
      - "vite.config.ts"
      - "package.json"
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Deploy to Digital Ocean
        uses: digitalocean/app_action@v1.1.5
        with:
          app_name: radio-importante-frontend
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
```

#### **4.2 Desabilitar workflows AWS**
```bash
# Renomear arquivos:
mv .github/workflows/deploy-frontend.yml .github/workflows/deploy-frontend.yml.disabled
mv .github/workflows/deploy-staging.yml .github/workflows/deploy-staging.yml.disabled
```

### **5. Secrets necessários no GitHub**
```bash
# Adicionar no GitHub Secrets:
DIGITALOCEAN_ACCESS_TOKEN=[token_da_digital_ocean]
```

---

## 🔧 **PASSOS DETALHADOS DE EXECUÇÃO**

### **PASSO 1: Preparar Digital Ocean App (15 min)**

#### **1.1 Acessar Digital Ocean Dashboard**
```bash
# URL: https://cloud.digitalocean.com/apps
# Clicar em "Create App"
```

#### **1.2 Configurar App Frontend**
- **Repository:** `DeepDevPro/radio-importante-pwa`
- **Branch:** `main`
- **Type:** Static Site
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

#### **1.3 Configurar recursos**
- **Instance:** Basic (lowest cost)
- **Region:** NYC1 ou ATL1 (próximo ao backend)

### **PASSO 2: Configurar Build e Deploy (15 min)**

#### **2.1 Testar build local**
```bash
cd /Users/juniordeep/deepdev2/music-player/Ago25PwaCleanTest/mplayer001
npm ci
npm run build
```

#### **2.2 Verificar arquivos gerados**
```bash
ls -la dist/
# Deve conter: index.html, admin.html, assets/
```

#### **2.3 Primeiro deploy na DO**
```bash
# Deploy será automático após criar app
# Monitorar logs no dashboard
```

### **PASSO 3: Configurar Domínio (10 min)**

#### **3.1 Adicionar domínio na Digital Ocean**
```bash
# Dashboard > Apps > radio-importante-frontend > Settings > Domains
# Add Domain: radio.importantestudio.com
```

#### **3.2 Atualizar DNS no Route 53**
```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1D633PJN98FT9 \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "radio.importantestudio.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "[APP-URL].ondigitalocean.app"}]
      }
    }]
  }'
```

### **PASSO 4: Testes de Validação (10 min)**

#### **4.1 Testar frontend**
```bash
# Verificar URLs:
curl -I https://radio.importantestudio.com/
curl -I https://radio.importantestudio.com/admin.html
```

#### **4.2 Testar integração frontend-backend**
```bash
# No navegador, verificar:
# 1. Player principal carrega
# 2. Admin panel carrega
# 3. Upload funciona
# 4. API calls são feitas para DO backend
```

### **PASSO 5: GitHub Actions (10 min)**

#### **5.1 Obter token Digital Ocean**
```bash
# Dashboard > API > Generate New Token
# Escopo: read + write
# Nome: github-actions-radio-importante
```

#### **5.2 Configurar secret no GitHub**
```bash
# GitHub > Settings > Secrets and variables > Actions
# New repository secret:
# Name: DIGITALOCEAN_ACCESS_TOKEN
# Value: [token obtido acima]
```

#### **5.3 Criar workflow**
```bash
# Arquivo: .github/workflows/deploy-digitalocean.yml
# (conteúdo já definido acima)
```

### **PASSO 6: Cleanup AWS (5 min)**

#### **6.1 Desabilitar CloudFront**
```bash
aws cloudfront get-distribution-config --id E7IJOAICB6CUO > cf-config.json
# Editar: Enabled: false
aws cloudfront update-distribution --id E7IJOAICB6CUO --distribution-config cf-config.json
```

#### **6.2 Esvaziar e remover S3 bucket**
```bash
aws s3 rm s3://radio-importante-frontend --recursive
aws s3 rb s3://radio-importante-frontend
```

---

## 📋 **CHECKLIST DE VALIDAÇÃO**

### **Pré-migração**
- [x] Backend funcionando na Digital Ocean
- [x] Domínio ativo no Route 53
- [x] GitHub Actions atual funcionando
- [x] Backup de configurações AWS documentado

### **Durante migração**
- [ ] App frontend criada na Digital Ocean
- [ ] Build completado sem erros
- [ ] Domínio configurado e SSL ativo
- [ ] DNS atualizado e propagado
- [ ] Frontend carregando corretamente
- [ ] Integração frontend-backend funcionando

### **Pós-migração**
- [ ] Player principal funcionando
- [ ] Admin panel carregando
- [ ] Upload de arquivos funcionando
- [ ] GitHub Actions deployando para DO
- [ ] Workflows AWS desabilitados
- [ ] Recursos AWS removidos

---

## 🚨 **PLANO DE ROLLBACK**

### **Se algo der errado:**

#### **Rollback Imediato (DNS)**
```bash
# Reverter DNS para CloudFront
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1D633PJN98FT9 \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "radio.importantestudio.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "d2qohgpgjz7kez.cloudfront.net"}]
      }
    }]
  }'
```

#### **Rollback Completo**
1. Reativar workflows AWS
2. Reverter DNS para CloudFront
3. Reativar CloudFront distribution
4. Manter S3 bucket ativo
5. Analisar problema na Digital Ocean

---

## 💰 **ESTIMATIVA DE CUSTOS**

### **Digital Ocean (estimativa mensal)**
- **Frontend Static Site:** $3-5/mês
- **Backend App Platform:** $12-25/mês (já ativo)
- **Bandwidth:** Incluído até 1TB
- **Total:** ~$15-30/mês

### **AWS (custos atuais a serem eliminados)**
- **S3:** $1-3/mês
- **CloudFront:** $5-15/mês
- **Route 53:** $0.50/mês (pode manter ou migrar)
- **Total economizado:** $6-18/mês

### **Benefícios da migração:**
- ✅ Menor burocracia de compliance
- ✅ Interface unificada (frontend e backend na mesma plataforma)
- ✅ Custos potencialmente menores
- ✅ Melhor suporte para pequenos projetos

---

## 📚 **DOCUMENTAÇÃO COMPLEMENTAR**

### **Arquivos de referência:**
- `PLANO_EXECUCAO.md` - Status completo atual
- `src/config/api.ts` - Configuração de backend já atualizada
- `vite.config.ts` - Build configuration
- `.github/workflows/deploy-frontend.yml` - Pipeline AWS atual

### **URLs importantes:**
- **Backend atual:** `https://radio-importante-pwa-backend-skg2w.ondigitalocean.app`
- **Frontend atual:** `https://radio.importantestudio.com`
- **Admin atual:** `https://radio.importantestudio.com/admin.html`

### **Próximos passos após migração:**
1. Monitorar performance por 1 semana
2. Configurar backups automáticos na DO
3. Implementar monitoring/alertas
4. Documentar novo processo de deploy
5. Treinar equipe no novo pipeline

---

## ✅ **EXECUÇÃO PRÁTICA**

**Para executar esta migração:**

1. **Execute os comandos na ordem apresentada**
2. **Monitore cada etapa antes de prosseguir**
3. **Tenha o plano de rollback pronto**
4. **Teste tudo antes de remover recursos AWS**

**Tempo estimado total:** 2-3 horas

**Downtime esperado:** < 5 minutos (apenas durante mudança DNS)

---

*Documento criado automaticamente baseado na análise dos arquivos do projeto.*
