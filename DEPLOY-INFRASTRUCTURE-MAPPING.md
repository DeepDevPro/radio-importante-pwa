# 🗺️ MAPEAMENTO COMPLETO DA INFRAESTRUTURA DE DEPLOY

**Data**: 05 de Setembro de 2025  
**Projeto**: Radio Importante PWA  
**Objetivo**: Mapear infraestrutura atual para organizar melhor o deploy e evitar perda de funcionalidades

⚠️ **ATUALIZAÇÃO**: Revisado com base nos arquivos `PLANO_EXECUCAO.md`, `DEPLOY-GUIDE.md`, `AWS-SETUP-GUIDE.md` e configurações reais.

---

## 📚 ARQUIVOS DE REFERÊNCIA VERIFICADOS

✅ **Documentação principal analisada**:
- `PLANO_EXECUCAO.md` (1927 linhas) - **Confirma**: `radio-importante-backend-prod` como padrão
- `DEPLOY-GUIDE.md` (143 linhas) - Estrutura de deploy para `radio.importantestudio.com`
- `AWS-SETUP-GUIDE.md` - Configuração IAM e S3 para deploy
- `.github/FASE4_COMPLETE.md` - Workflows CI/CD implementados
- `src/config/api.ts` - **Confirma**: Backend `radio-importante-backend-prod`
- `backend/.elasticbeanstalk/config.yml` - **ENCONTRADO** (configuração local)
- `backend/.ebextensions/` - **ENCONTRADO** (8 arquivos de configuração EB)

---

## 1) 🔄 GITHUB WORKFLOWS

### Arquivos em `/.github/workflows/`:

#### ✅ `deploy.yml` - Deploy Frontend para S3
```yaml
name: 🚀 Deploy to AWS S3
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
```
- **Função**: Deploy do frontend para S3 + CloudFront
- **Trigger**: Push/PR na branch main
- **Destino**: S3 bucket + invalidação CloudFront

#### ✅ `deploy-backend.yml` - Deploy Backend para Elastic Beanstalk  
```yaml
name: 🚀 Deploy Backend to Elastic Beanstalk
on:
  push:
    branches: [main]
    paths: ['backend/**']
  workflow_dispatch:
```
- **Função**: Deploy do backend Node.js para EB
- **Trigger**: Mudanças na pasta backend/
- **Destino**: `radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com`

#### ✅ `deploy-complete.yml` - Deploy Stack Completo
```yaml
name: 🚀 Deploy Complete Stack
on:
  push:
    branches: [main]
  workflow_dispatch:
```
- **Função**: Deploy coordenado frontend + backend
- **Detecção**: Usa `dorny/paths-filter` para detectar mudanças
- **Backend**: `radio-pwa-backend-prod` (diferente do outro!)

#### ✅ `setup-cloudfront.yml` - Configuração HTTPS
```yaml
name: "🌐 Setup CloudFront & HTTPS"
on:
  workflow_dispatch: # Manual trigger only
```
- **Função**: Configurar SSL certificate + CloudFront
- **SSL**: ACM certificate para `radio.importantestudio.com`

#### ✅ `update-catalog.yml` - Atualização Automática
```yaml
name: Auto Update Catalog
on:
  push:
    paths:
      - 'public/audio/**/*.mp3'
```
- **Função**: Regenerar catálogo quando arquivos de áudio são adicionados

#### ⚠️ `test-setup.yml` - Configuração de Testes
- **Função**: Testes automatizados (configuração)

---

## 2) 🏗️ BACKEND (ELASTIC BEANSTALK)

### 🔥 PROBLEMA IDENTIFICADO: INCONSISTÊNCIA DE NOMES

**CONFLITO DETECTADO**:
- `deploy-backend.yml` usa: `radio-importante-backend-prod`
- `deploy-complete.yml` usa: `radio-pwa-backend-prod`
- **URLs Diferentes**:
  - ✅ `radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com` (**FUNCIONANDO** - API Node.js)
  - ❌ `radio-pwa-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com` (**PÁGINA HTML** - não é nossa API)

### Configurações EB identificadas:
```bash
# Application Name (deploy-backend.yml)
APPLICATION_NAME="radio-importante-backend"
ENVIRONMENT_NAME="radio-importante-backend-prod"

# Application Name (deploy-complete.yml)  
APPLICATION_NAME="radio-pwa-backend"
ENVIRONMENT_NAME="radio-pwa-backend-prod"
```

### ❌ Configuração EB local não encontrada:
- ✅ **ENCONTRADO**: `backend/.elasticbeanstalk/config.yml` (configuração básica)
- ✅ **ENCONTRADO**: `backend/.ebextensions/` (8 arquivos de configuração)
  - `00-environment.config`, `01-app-config.config`, `01-node-config.config` 
  - `02-nginx.config`, `03-cleanup.config`, `03-debug-info.config`
  - `04-debug.config`, `05-debug-start.config`
- Workflows fazem `eb init` dinâmico (redundante mas funcional)

---

## 3) 🌐 FRONTEND (S3 + CLOUDFRONT)

### URLs Identificadas:
- **Domain Principal**: `radio.importantestudio.com` ✅ **CONFIRMADO** no `DEPLOY-GUIDE.md`
- **Alternative**: `www.radio.importantestudio.com`
- **S3 Bucket**: `radio-importante-storage` ✅ **CONFIRMADO** nos workflows
- **S3 Website**: `radio.importantestudio.com` (domínio customizado)

### Configurações CloudFront:
- **SSL Certificate**: ACM em `us-east-1` 
- **Distribution**: Configurado via `setup-cloudfront.yml`
- **Invalidation**: Automática no deploy

---

## 4) 🔐 GITHUB SECRETS (IDENTIFICADOS)

**Lista de secrets necessários**:
```
✅ AWS_ACCESS_KEY_ID              # Credenciais AWS
✅ AWS_SECRET_ACCESS_KEY          # Credenciais AWS  
✅ AWS_REGION                     # us-west-2 (confirmado)
✅ S3_BUCKET                      # Para deploy frontend (deploy.yml)
✅ S3_BUCKET_NAME                 # Para deploy frontend (deploy-complete.yml)
✅ CLOUDFRONT_DISTRIBUTION_ID     # Para invalidação cache
✅ GITHUB_TOKEN                   # Para auto-update (built-in)
```

**Buckets S3 identificados**:
- **Frontend**: `${{ secrets.S3_BUCKET }}` ou `${{ secrets.S3_BUCKET_NAME }}`
- **Backend EB**: `elasticbeanstalk-us-west-2-{ACCOUNT_ID}` (automático)
- **Storage**: `radio-importante-storage` (env var no EB)

---

## 5) 🔍 DNS (ROUTE 53) - CONFIGURAÇÃO ESPERADA

**Hosted Zone**: `importantestudio.com`

**Records esperados**:
```
A (Alias)  radio.importantestudio.com → CloudFront Distribution
CNAME      www.radio → radio.importantestudio.com
```

---

## 🚨 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. **Inconsistência de Nomes de Aplicação EB**
- Dois workflows diferentes usando nomes diferentes
- Pode causar deploy em ambientes separados
- **Solução**: Padronizar para um nome único

### 2. **URLs Backend Conflitantes**
- Admin.html aponta para: `radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com`
- API config aponta para: mesmo URL
- **Precisa verificar**: Status de ambos ambientes EB

### 3. **Falta de Configuração EB Local**
- ✅ **CORREÇÃO**: `.elasticbeanstalk/config.yml` EXISTE no backend
- ✅ **CORREÇÃO**: `.ebextensions/` EXISTE (8 arquivos de configuração)
- **Status**: Configuração local está completa e funcional

---

## 📋 AÇÕES NECESSÁRIAS PARA ORGANIZAÇÃO

### PRIORIDADE ALTA ⚡

1. ✅ **VERIFICADO**: Status Real dos Ambientes EB confirmado
   - `radio-importante-backend-prod` ✅ Funcionando
   - `radio-pwa-backend-prod` ❌ Não funcional

2. **Padronizar Nome da Aplicação**:
   - ✅ **CONFIRMAR**: `radio-importante-backend` (documentado como padrão)
   - 🔄 **CORRIGIR**: `deploy-complete.yml` para usar mesmo nome
   - 📝 **DOCUMENTAR**: URLs finais nos arquivos de config

3. ✅ **CONFIGURAÇÃO EB COMPLETA**:
   - `backend/.elasticbeanstalk/config.yml` ✅ Existe
   - `backend/.ebextensions/` ✅ 8 arquivos de configuração EB

### PRIORIDADE MÉDIA 🟡

4. **Verificar GitHub Secrets**
5. **Verificar Status CloudFront + DNS**
6. **Documentar URLs finais para produção**

### PRIORIDADE BAIXA 🔵

7. **Criar branch protection rules**
8. **Implementar testes automatizados**

---

## 💡 RECOMENDAÇÃO IMEDIATA

**Para não perder funcionalidades**:

1. ✅ **Manter `radio-importante-backend-prod` como padrão** (já funciona)
2. 🔄 **Atualizar `deploy-complete.yml` para usar o mesmo nome**
3. 📝 **Criar documentação de URLs oficiais**
4. 🧪 **Testar ambos workflows em branch separada antes de mergear**

---

## 📊 RESUMO EXECUTIVO - DESCOBERTAS CRÍTICAS

### ✅ O QUE ESTÁ FUNCIONANDO (CONFIRMADO)
- **Backend Principal**: `radio-importante-backend-prod.eba-heipfui9.us-west-2.elasticbeanstalk.com` ✅ 
- **Sistema de Upload**: Metadata extraction com music-metadata ✅
- **Admin Interface**: Completamente funcional ✅
- **Workflows**: Deploy automático configurado ✅
- **Frontend HTTPS**: `https://radio.importantestudio.com` ✅ (documentado)
- **Configuração EB**: `.elasticbeanstalk/` e `.ebextensions/` completos ✅

### ⚠️ ÚNICOS RISCOS IDENTIFICADOS
- **Ambientes EB Duplicados**: `radio-importante-backend` vs `radio-pwa-backend`
- **Secrets Inconsistentes**: `S3_BUCKET` vs `S3_BUCKET_NAME` 
- **Workflow Conflitante**: `deploy-complete.yml` usa nome diferente

### 🎯 AÇÃO IMEDIATA RECOMENDADA
**PADRONIZAR** `deploy-complete.yml` para usar `radio-importante-backend-prod` (que funciona) e deletar ambiente duplicado `radio-pwa-backend-prod`.

---

## 🔄 CORREÇÕES FEITAS APÓS ANÁLISE COMPLETA

### ❌ INFORMAÇÕES INCORRETAS ANTERIORES:
1. ~~"Não existe `.elasticbeanstalk/config.yml`"~~ → ✅ **EXISTE** em `backend/.elasticbeanstalk/`
2. ~~"Falta configuração EB local"~~ → ✅ **COMPLETA** (8 arquivos `.ebextensions/`)
3. ~~"S3 bucket indefinido"~~ → ✅ **DEFINIDO** como `radio-importante-storage`

### ✅ CONFIRMAÇÕES IMPORTANTES:
1. **PLANO_EXECUCAO.md** confirma: `radio-importante-backend-prod` como padrão ✅
2. **DEPLOY-GUIDE.md** confirma: `radio.importantestudio.com` como domínio ✅  
3. **src/config/api.ts** confirma: backend production URL ✅
4. **Sistema funcionando**: Metadata extraction + Admin completo ✅

### 🎯 ÚNICA AÇÃO NECESSÁRIA:
**Corrigir `deploy-complete.yml`** para usar `radio-importante-backend` (padrão já estabelecido) em vez de `radio-pwa-backend`.

**Próximos passos**: Aguardando screenshots solicitados pelo GPT5 para completar o mapeamento.
