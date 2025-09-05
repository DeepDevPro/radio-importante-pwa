# 🚨 AÇÃO IMEDIATA: CORRIGIR AMBIENTES DUPLICADOS

## PROBLEMA DETECTADO
Temos 2 ambientes Elastic Beanstalk:
- ✅ `radio-importante-backend-prod` (FUNCIONANDO)
- ❌ `radio-pwa-backend-prod` (NÃO FUNCIONANDO)

## SOLUÇÃO: PADRONIZAR PARA UM AMBIENTE

### PASSO 1: Corrigir deploy-complete.yml

```bash
# Substituir todas as ocorrências de "radio-pwa-backend" por "radio-importante-backend"
```

### PASSO 2: Deletar ambiente que não funciona

```bash
# Deletar radio-pwa-backend-prod (se existir)
aws elasticbeanstalk terminate-environment \
  --environment-name radio-pwa-backend-prod \
  --region us-west-2

# Deletar aplicação radio-pwa-backend (se existir)
aws elasticbeanstalk delete-application \
  --application-name radio-pwa-backend \
  --region us-west-2
```

### PASSO 3: Criar .elasticbeanstalk/config.yml

```yaml
branch-defaults:
  main:
    environment: radio-importante-backend-prod
global:
  application_name: radio-importante-backend
  default_region: us-west-2
  platform_name: null
  platform_version: null
  profile: null
  repository: null
  sc: git
  workspace_type: Application
```

**EXECUTE ESTAS CORREÇÕES PARA EVITAR CONFLITOS DE DEPLOY!**
