# 🔧 CONFIGURAÇÃO DIGITALOCEAN APPS PARA GITHUB ACTIONS

## ❌ Problema Atual
Os workflows de backend estão falhando com:
```
triggering deploy: unable to create-deployment for app: exit status 1
```

## 🔍 Causa do Problema
**INCONSISTÊNCIA DE NOMES DETECTADA:**

### App Staging:
- **URL Real**: `https://stingray-app-backend-staging-4wpcx.ondigitalocean.app/` ✅ (funciona)
- **App Spec Name**: `radio-importante-backend-staging` ❌ (inconsistente)
- **GitHub Actions**: `stingray-app-backend-staging-4wpcx` ✅ (correto)

### Configuração Atual (Spec):
```yaml
name: radio-importante-backend-staging  # ❌ INCONSISTENTE
services:
- name: radio-importante-backend-staging  # ❌ INCONSISTENTE
  github:
    branch: staging                        # ✅ CORRETO
    deploy_on_push: true                  # ✅ CORRETO (Autodeploy ON)
    repo: DeepDevPro/radio-importante-pwa # ✅ CORRETO
  source_dir: /server                     # ✅ CORRETO
```

## ✅ Solução: Corrigir Inconsistência de Nomes

### OPÇÃO 1: Renomear App no DigitalOcean (Recomendado)
1. **Acessar DigitalOcean Apps Console**
   - URL: https://cloud.digitalocean.com/apps
   - Localizar app: `stingray-app-backend-staging-4wpcx`

2. **Renomear App e Service**
   - Settings → General → App Info
   - Alterar nome para: `radio-importante-backend-staging`
   - Na seção Services, renomear service para: `radio-importante-backend-staging`
   - Isso fará com que a URL mude para: `https://radio-importante-backend-staging-xxxxx.ondigitalocean.app/`

3. **Atualizar Workflows**
   - Alterar `app_name` nos workflows para: `radio-importante-backend-staging`
   - Atualizar URLs nos documentos

### OPÇÃO 2: Atualizar App Spec (Alternativa)
1. **Manter nomes atuais**
2. **Atualizar App Spec para match**:
   ```yaml
   name: stingray-app-backend-staging-4wpcx
   services:
   - name: stingray-app-backend-staging-4wpcx
   ```

### Backend Staging: Configuração Atual ✅
- ✅ Source: Repository `DeepDevPro/radio-importante-pwa`, branch `staging`
- ✅ Source Directory: `/server`  
- ✅ Autodeploy: **ON** (`deploy_on_push: true`)
- ❌ **Nome inconsistente** (principal problema)

## 🔑 Verificar Token de Acesso

### Permissões Necessárias para DIGITALOCEAN_ACCESS_TOKEN
No DigitalOcean API → Tokens:
- ✅ Read (para listar apps)
- ✅ Write (para fazer deploys)
- ✅ Apps (specifically for app deployments)

### Como Verificar/Criar Token
1. Acessar: https://cloud.digitalocean.com/account/api/tokens
2. Verificar se token atual tem permissões de Apps
3. Se necessário, criar novo token com escopo completo

## 🧪 Teste Manual
Após configuração, teste manualmente:

```bash
# Fazer alteração simples no servidor
echo "// teste config $(date)" >> server/server.js

# Commit e push para staging
git add server/server.js
git commit -m "test: configuração apps digitalocean"
git push origin staging

# Verificar GitHub Actions
# https://github.com/DeepDevPro/radio-importante-pwa/actions
```

## 📋 Checklist de Configuração

### Backend Produção (`radio-importante-pwa-backend-skg2w`)
- [ ] Source configurado para branch `main`
- [ ] Source Directory apontando para `/server`
- [ ] Autodeploy habilitado
- [ ] Variáveis de ambiente configuradas
- [ ] Build/Run commands corretos

### Backend Staging (`stingray-app-backend-staging-4wpcx`)
- [ ] Source configurado para branch `staging`
- [ ] Source Directory apontando para `/server`
- [ ] Autodeploy habilitado
- [ ] Variáveis de ambiente configuradas
- [ ] Build/Run commands corretos

### GitHub Repository
- [ ] DIGITALOCEAN_ACCESS_TOKEN com permissões corretas
- [ ] Apps existem e são acessíveis pelo token

## 🎯 Resultado Esperado
Após configuração:
- ✅ Push para `staging` → Deploy automático do backend staging
- ✅ Push para `main` → Deploy automático do backend produção
- ✅ GitHub Actions com status verde
- ✅ Endpoints funcionando normalmente

## 🚨 Observações Importantes

1. **Source Directory**: Certifique-se de que está configurado como `/server` e não `/`
2. **Branches**: Staging deve apontar para `staging`, Produção para `main`
3. **Autodeploy**: DEVE estar habilitado para GitHub Actions funcionarem
4. **Variáveis**: Use as credenciais específicas para cada ambiente

---
**Data**: 09/10/2025
**Status**: Aguardando configuração manual no DigitalOcean
