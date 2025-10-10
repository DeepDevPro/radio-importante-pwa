# 🚀 GUIA DE DEPLOY COM BACKENDS SEPARADOS - Radio Importante PWA

## 📋 Procedimento Padrão para Deploy

### 🚀 Workflow de Melhorias Incrementais (Recomendado)

**Para pequenas melhorias e ajustes de UX:**

```bash
1. 🎯 PLANEJAMENTO
   - Escolher 1 melhoria pequena por vez
   - Exemplo: "Remover checkboxes desnecessários"

2. 🔧 IMPLEMENTAÇÃO
   - Fazer a mudança no código
   - Ir direto para deploy (teste no staging)

3. 📤 DEPLOY
   git add .
   git commit -m "feat: remover checkboxes desnecessários da lista"
   git push origin staging

4. ✅ VALIDAÇÃO
   - Aguardar deploy automático (~2 min)
   - Testar no staging: https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app/admin.html
   - Se OK → próxima melhoria
   - Se problema → git revert [commit-hash]

5. 🔄 REPETIR
   - Uma melhoria por commit
   - Sempre testar antes da próxima
```

**Vantagens do Workflow Incremental:**
- ✅ Feedback rápido (2 min vs teste local + deploy)
- ✅ Staging sempre funcional (mudanças pequenas)
- ✅ Rollback fácil com git revert
- ✅ Histórico limpo (1 feature = 1 commit)

### 🎯 Deploy Staging Tradicional
```bash
# Para mudanças maiores que precisam de teste local primeiro:

# 1. Adicionar alterações
git add .

# 2. Commit com mensagem descritiva
git commit -m "feat: descrição da alteração"

# 3. Push para staging (dispara deploy automático)
git push origin staging

# 4. Aguardar deploy automático (2-5 minutos)
# GitHub Actions: https://github.com/DeepDevPro/radio-importante-pwa/actions
# DigitalOcean Apps: https://cloud.digitalocean.com/apps
```

### 🎯 Deploy Produção (Após aprovação)
```bash
# 1. Merge staging para main
git checkout main
git merge staging

# 2. Push para produção (dispara deploy automático)
git push origin main

# 3. Aguardar deploy automático (2-5 minutos)
```

## 🔧 Workflows Automáticos

### Backend Staging
- **Trigger**: Push na branch `staging` com alterações em `server/**`
- **Destino**: DigitalOcean App (rd-importante-backend-staging)
- **URL**: https://rd-importante-backend-staging-cudbw.ondigitalocean.app
- **Comportamento**: Frontend staging consome este backend exclusivamente
- **Arquivo**: `.github/workflows/deploy-backend-staging.yml` (ativo)

### Backend Produção
- **Trigger**: Push na branch `main` com alterações em `server/**`
- **Destino**: DigitalOcean App (radio-importante-pwa-backend)
- **URL**: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app
- **Comportamento**: Frontend produção consome este backend exclusivamente
- **Arquivo**: `.github/workflows/deploy-backend-production.yml` (ativo)

### Frontend Staging
- **Trigger**: Push na branch `staging` com alterações em `src/**`
- **Destino**: DigitalOcean Static Site
- **URL**: https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app
- **Arquivo**: `.github/workflows/deploy-staging-digital-ocean.yml`

### Frontend Produção
- **Trigger**: Push na branch `main` com alterações em `src/**`
- **Destino**: DigitalOcean Static Site
- **URL**: https://radio.importantestudio.com
- **Arquivo**: `.github/workflows/deploy-digitalocean.yml`

## 🎵 Funcionalidades HLS

### Endpoints Ativos
- **Latest Playlist**: `/api/hls/generate-hls` (mode: latest)
- **Rolling Playlist**: `/api/hls/generate-hls` (mode: rolling)
- **Diagnostics**: `/api/hls/latest/diagnostics` e `/api/hls/rolling/diagnostics`

### Armazenamento
- **Segments**: DigitalOcean Spaces (`radio-importante-audio`)
- **URL Base**: https://radio-importante-audio.atl1.digitaloceanspaces.com/generated/hls/

## 🔍 Verificação de Deploy

### 1. Verificar GitHub Actions
```bash
# Verificar se workflow rodou com sucesso
# https://github.com/DeepDevPro/radio-importante-pwa/actions
```

### 2. Testar Endpoints
```bash
# Backend Staging Health Check
curl https://rd-importante-backend-staging-cudbw.ondigitalocean.app/health

# Backend Produção Health Check  
curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/health

# HLS Status Staging
curl https://rd-importante-backend-staging.ondigitalocean.app/api/hls/latest/diagnostics

# HLS Status Produção
curl https://radio-importante-pwa-backend.ondigitalocean.app/api/hls/latest/diagnostics

# Verificar CORS para frontend staging
curl -H "Origin: https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app" https://rd-importante-backend-staging-cudbw.ondigitalocean.app/health

# Verificar CORS para frontend produção
curl -H "Origin: https://radio.importantestudio.com" https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/health
```

### 3. Testar Frontend
```bash
# Staging
curl -I https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app

# Produção
curl -I https://radio.importantestudio.com
```

## 🚨 Troubleshooting

### Deploy Falhou
1. Verificar logs no GitHub Actions
2. Verificar configuração no DigitalOcean Apps
3. Verificar variáveis de ambiente
4. Re-executar deploy manualmente

### Rollback Rápido
```bash
# Reverter para commit anterior
git revert HEAD
git push origin staging  # ou main
```

### Rollback de Experimentos/Projetos Grandes
```bash
# 1. Criar branch de backup ANTES de começar experimento
git checkout staging
git checkout -b backup-staging-pre-[nome-do-projeto]
git push origin backup-staging-pre-[nome-do-projeto]

# 2. Rollback por commits específicos (preferido)
git checkout staging
git revert <commit-hash-1> <commit-hash-2>  # múltiplos commits
git push origin staging

# 3. Rollback completo para estado anterior (drástico)
git checkout staging
git reset --hard backup-staging-pre-[nome-do-projeto]
git push origin staging --force

# 4. Verificar histórico para rollback seletivo
git log --oneline -10  # ver últimos 10 commits
git revert <commit-específico>  # reverter só o que deu problema
```

**Estratégia para Projetos Multi-Etapas:**
- Cada etapa = 1 commit com prefixo claro (ex: "feat(mp3): etapa 2 - gerar cues")
- Rollback etapa por etapa se necessário
- Manter branch de backup até projeto 100% estável

### Logs de Produção
- **GitHub Actions**: https://github.com/DeepDevPro/radio-importante-pwa/actions
- **DigitalOcean Apps**: https://cloud.digitalocean.com/apps
- **DigitalOcean Spaces**: https://cloud.digitalocean.com/spaces

## 📝 Variáveis de Ambiente Necessárias

### Backend Staging (DigitalOcean Apps)
```
NODE_ENV=staging
DO_SPACES_KEY=<chave-digital-ocean-staging>
DO_SPACES_SECRET=<secret-digital-ocean-staging>
DO_SPACES_ENDPOINT=atl1.digitaloceanspaces.com
DO_SPACES_REGION=atl1
DO_SPACES_BUCKET=radio-importante-audio
```

### Backend Produção (DigitalOcean Apps)
```
NODE_ENV=production
DO_SPACES_KEY=<chave-digital-ocean-producao>
DO_SPACES_SECRET=<secret-digital-ocean-producao>
DO_SPACES_ENDPOINT=atl1.digitaloceanspaces.com
DO_SPACES_REGION=atl1
DO_SPACES_BUCKET=radio-importante-audio
```

### Secrets GitHub
```
DIGITALOCEAN_ACCESS_TOKEN=<token-digital-ocean>
```

## 🎯 Checklist de Deploy

### Antes do Deploy
- [ ] Código revisado
- [ ] Commit com mensagem clara
- [ ] Branch staging atualizada
- [ ] **Para projetos grandes**: Branch de backup criada

### Durante o Deploy
- [ ] GitHub Actions executando
- [ ] DigitalOcean Apps rebuilding
- [ ] Logs sem erros críticos

### Após o Deploy
- [ ] Health check OK
- [ ] Funcionalidades testadas
- [ ] Performance verificada
- [ ] iPhone/Safari testado (se aplicável)
- [ ] **Para experimentos**: Evidências documentadas para rollback se necessário

## 🔧 Comandos Úteis de Debug

### Verificar Estado do Deploy
```bash
# Status atual dos deployments
git log --oneline -5

# Verificar diferenças entre branches
git diff staging main --name-only

# Ver últimas GitHub Actions
# https://github.com/DeepDevPro/radio-importante-pwa/actions
```

### Testes Rápidos Pós-Deploy
```bash
# Health checks básicos
curl -I https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app
curl https://rd-importante-backend-staging-cudbw.ondigitalocean.app/health
curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/health

# Verificar headers específicos (Range, CORS, etc)
curl -H "Range: bytes=0-1023" -I [URL-DO-ARQUIVO]
curl -H "Origin: https://radio.importantestudio.com" -I [URL-COM-CORS]
```

---
**Última atualização**: 10/10/2025
**Versão**: v2.3 (Correção dos nomes corretos dos apps DigitalOcean após troubleshooting)
````
