# 📋 Plano de Execução — Índice

Este documento foi dividido para facilitar manutenção:
- Parte 1: [PLANO_EXECUCAO-PARTE-1.md](./PLANO_EXECUCAO-PARTE-1.md) (visão atual e operação)
- Parte 2: [PLANO_EXECUCAO-PARTE-2.md](./PLANO_EXECUCAO-PARTE-2.md) (histórico e bases)
- Guia Técnico: [GUIA_TECNICO_DETALHADO.md](./GUIA_TECNICO_DETALHADO.md)
- Deploy Unificado: [DEPLOY-GUIDE-UNIFIED.md](./DEPLOY-GUIDE-UNIFIED.md)
- 🔄 **Rollback**: [ROLLBACK-GUIA-RAPIDO.md](./ROLLBACK-GUIA-RAPIDO.md) ⚡ **Acesso Rápido**

---
## 🔒 Versão Estável Atual

**Tag**: `v2.2.10-stable` (13/10/2025)  
**Commit**: f2867ec  
**🎉 MARCO: Primeira versão entregue ao cliente**

**Branches de Backup**: 
- `backup-main-stable-13out2025`
- `backup-staging-stable-13out2025`

**📖 Instruções de Rollback**: [DEPLOY-GUIDE-UNIFIED.md - Seção Troubleshooting](./DEPLOY-GUIDE-UNIFIED.md#-troubleshooting)

---
## Matriz de Ambientes (Frontend e Backend)

- Backend Staging
  - Branch: staging
  - App (DO): rd-importante-backend-staging
  - URL: https://rd-importante-backend-staging-cudbw.ondigitalocean.app

- Backend Produção
  - Branch: main
  - App (DO): radio-importante-pwa-backend
  - URL: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app

- Frontend Staging
  - Branch: staging
  - Site (DO Static Site): radio-importante-frontend-stagin-6rjzv
  - URL: https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app

- Frontend Produção
  - Branch: main
  - Site: AWS S3 + CloudFront
  - URL: https://radio.importantestudio.com

Consulte a [Parte 1](./PLANO_EXECUCAO-PARTE-1.md) e a [Parte 2](./PLANO_EXECUCAO-PARTE-2.md) para detalhes operacionais e histórico técnico. Veja também o [Guia Técnico](./GUIA_TECNICO_DETALHADO.md) e o [Guia de Deploy](./DEPLOY-GUIDE-UNIFIED.md).