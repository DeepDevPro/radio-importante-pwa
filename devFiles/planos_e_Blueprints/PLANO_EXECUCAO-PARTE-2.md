# 📋 Plano de Execução — Parte 2 (Histórico e Bases)

[⟵ Voltar ao Índice](./PLANO_EXECUCAO.md) • [Ir para Parte 1 →](./PLANO_EXECUCAO-PARTE-1.md) • [Guia Técnico](./GUIA_TECNICO_DETALHADO.md) • [Deploy](./DEPLOY-GUIDE-UNIFIED.md)

> Complemento da Parte 1; mantém histórico técnico consolidado sem duplicação.

---
## A) Atualização 08/10/2025 — MVP Background iOS
- Boundary Scheduler + instrumentação (Phase0) em `audio.ts`.
- Elimina parada intermitente em iOS PWA (background ≥300s; transições ≥3).
- Rolling HLS pendente de revalidação pós-estabilização.

## B) Atualização 06/10/2025 — R6 HLS Hardening (Resumo)
- Gate Final aprovado (0 falhas smoke últimas 10; p95 44ms; rollback & janitor ok).
- Geração latest ~4.2s; rolling derivação ~260ms; diagnostics avg ~38ms.
- Debug TTL, automação 24h, gate final, rollback via snapshot.

## C) UX e Admin (Set/Out)
- Edição inline sem reload; preview de duração por HTML5 Audio API.
- Debug/Admin UI visível em staging + gesto secreto iPhone (3 taps admin / 5 debug).
- Proxy backend para servir do DO Spaces e corrigir 404/URLs duplicadas.

## D) Migração DigitalOcean Spaces (21/09/2025)
- Upload persistente em Spaces; catálogo com URLs corretas.
- CORS, content-type automático, persistência pós-deploy.

## E) Pipelines e Workflows
- Frontend Staging: branch `staging` → DO Static Site (URL stagin-6rjzv...).
- Frontend Produção: branch `main` → AWS S3 + CloudFront (radio.importantestudio.com).
- Backend Staging: branch `staging` → DO App (rd-importante-backend-staging).
- Backend Produção: branch `main` → DO App (radio-importante-pwa-backend).

## F) Runbooks e Operação (HLS)
- `scripts/hls-smoke.cjs` (6 estágios), diagnostics, janitor, rollback, cache debug TTL.
- Ver Guia Técnico para detalhes atualizados.

## G) Roadmap Próximo (Pós-R6)
- Persistência de diagnostics (JSON diário), alertas cron, publish atômico (se necessário), snapshots rotativos, UI debug com gráficos.

---
## Anexos
- Parte 1 (estado atual e operação): [PLANO_EXECUCAO-PARTE-1.md](./PLANO_EXECUCAO-PARTE-1.md)
- Guia Técnico: [GUIA_TECNICO_DETALHADO.md](./GUIA_TECNICO_DETALHADO.md)
- Guia Unificado de Deploy: [DEPLOY-GUIDE-UNIFIED.md](./DEPLOY-GUIDE-UNIFIED.md)
