# 🔧 CONFIGURAÇÃO DIGITALOCEAN APPS PARA GITHUB ACTIONS

## ❌ Problema Atual
Os workflows de backend estão falhando com:
```
triggering deploy: unable to create-deployment for app: exit status 1
```

## 🔍 Causa do Problema
Os apps do DigitalOcean precisam ser configurados para aceitar deploys via GitHub Actions. Atualmente eles existem mas não têm integração com GitHub configurada.

## ✅ Solução: Configurar Apps no DigitalOcean

### 1. Backend Produção: `radio-importante-pwa-backend-skg2w`

1. **Acessar DigitalOcean Apps Console**
   - URL: https://cloud.digitalocean.com/apps
   - Localizar app: `radio-importante-pwa-backend-skg2w`

2. **Configurar Source (GitHub)**
   - Settings → Source
   - Repository: `DeepDevPro/radio-importante-pwa`
   - Branch: `main`
   - Source Directory: `/server`
   - Autodeploy: `Yes` (ON)

3. **Configurar Build Settings**
   - Build Command: `npm install`
   - Run Command: `node server.js`
   - Environment: `Node.js`

4. **Variáveis de Ambiente** (App Settings → App-Level Environment Variables)
   ```
   NODE_ENV=production
   DO_SPACES_KEY=[sua-chave-produção]
   DO_SPACES_SECRET=[seu-secret-produção]
   DO_SPACES_ENDPOINT=atl1.digitaloceanspaces.com
   DO_SPACES_REGION=atl1
   DO_SPACES_BUCKET=radio-importante-audio
   ```

### 2. Backend Staging: `stingray-app-backend-staging-4wpcx`

1. **Acessar DigitalOcean Apps Console**
   - URL: https://cloud.digitalocean.com/apps
   - Localizar app: `stingray-app-backend-staging-4wpcx`

2. **Configurar Source (GitHub)**
   - Settings → Source
   - Repository: `DeepDevPro/radio-importante-pwa`
   - Branch: `staging`
   - Source Directory: `/server`
   - Autodeploy: `Yes` (ON)

3. **Configurar Build Settings**
   - Build Command: `npm install`
   - Run Command: `node server.js`
   - Environment: `Node.js`

4. **Variáveis de Ambiente** (App Settings → App-Level Environment Variables)
   ```
   NODE_ENV=staging
   DO_SPACES_KEY=DO801CMT2RNWEJ6BD8XY
   DO_SPACES_SECRET=Sm1GteWTsQodjmQ1+fwWtXpP2BMk9IOlFkvk6fZ1rpI
   DO_SPACES_ENDPOINT=atl1.digitaloceanspaces.com
   DO_SPACES_REGION=atl1
   DO_SPACES_BUCKET=radio-importante-audio
   ```

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
