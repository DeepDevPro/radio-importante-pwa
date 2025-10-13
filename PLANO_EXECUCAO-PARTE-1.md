# 📋 Plano de Execução — Parte 1 (Visão Atual e Operação)

[⟵ Voltar ao Índice](./PLANO_EXECUCAO.md) • [Ir para Parte 2 →](./PLANO_EXECUCAO-PARTE-2.md) • [Guia Técnico](./GUIA_TECNICO_DETALHADO.md) • [Deploy](./DEPLOY-GUIDE-UNIFIED.md)

> Projeto: PWA Music Player "Radio Importante"
> Última atualização: 13/10/2025 — Docker+ffmpeg em produção; MP3 contínuo operacional
> Status: ✅ Staging e Produção sincronizados (Dockerfile + ffmpeg + continuous MP3)

---
## 0) Resumo Executivo (13/10/2025)
- ✅ Removido erro "ffmpeg não encontrado" com Dockerfile padronizado (Node 18 bookworm-slim + ffmpeg)
- ✅ Staging validado (Android PWA real) e Produção com smoke tests aprovados
- ✅ Geração do MP3 contínuo + cues JSON via Spaces e proxy backend
- ✅ Workflows: staging→staging, main→produção (conforme DEPLOY-GUIDE-UNIFIED.md)

---
## 1) Matriz de Ambientes (Frontend e Backend)

- Backend Staging
  - Branch: staging
  - App (DO): rd-importante-backend-staging
  - URL: https://rd-importante-backend-staging-cudbw.ondigitalocean.app
  - Build: Dockerfile (server/Dockerfile)
  - Workflow: .github/workflows/deploy-backend-staging.yml (ou equivalente consolidado)

- Backend Produção
  - Branch: main
  - App (DO): radio-importante-pwa-backend
  - URL: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app
  - Build: Dockerfile (server/Dockerfile)
  - Workflow: .github/workflows/deploy-backend-production.yml

- Frontend Staging
  - Branch: staging
  - Site (DO Static Site): radio-importante-frontend-stagin-6rjzv
  - URL: https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app
  - Workflow: .github/workflows/deploy-staging-digital-ocean.yml

- Frontend Produção
  - Branch: main
  - Site: AWS S3 + CloudFront
  - URL: https://radio.importantestudio.com
  - Workflow: .github/workflows/deploy-digitalocean.yml (ou pipeline AWS equivalente indicado no repositório)

Notas:
- App Platform injeta PORT; servidor lê process.env.PORT.
- ffmpeg/ffprobe instalado no container via apt-get.

---
## 2) Mudanças Implementadas
- Dockerfile criado em `server/Dockerfile` e `.dockerignore` em `server/.dockerignore`
- App Platform ajustado para Build & Run from Dockerfile (staging e produção)
- ffmpeg/ffprobe instalados via `apt-get install -y --no-install-recommends ffmpeg`
- Endpoints contínuo: `GET /api/continuous/status`, `POST /api/continuous/rebuild`, proxies `/audio/continuous/*`
- Geradores: `scripts/generate-audio-remote.js` e `server/scripts/generate-audio-remote.js`

---
## 3) Smoke Tests (Produção) — Resultado Real
- `GET /health` → 200 OK (environment: "production")
- `GET /api/continuous/status` → sem erro ffmpeg; script localizado
- `POST /api/continuous/rebuild` → success; `lastExitCode: 0`
- Artefatos válidos: 8 tracks, 362.21s; MP3 ~4.34MB com cache 3600s

---
## 4) Operação Diária (Checklist Rápido)
```bash
curl -s https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/health | jq '.environment'
curl -s https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/continuous/status | jq '.'
curl -s -X POST https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/continuous/rebuild
sleep 12 && curl -s https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/continuous/status | jq '.lastExitCode,.lastSuccessAt'
curl -s https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/audio/continuous/track-cues.json | jq '.trackCount,.totalDuration'
curl -I https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/audio/continuous/radio-importante-continuous.mp3
```

---
## 5) Próximos Passos Curtos
- [ ] Persistir registro diário simples do status contínuo (append JSON)
- [ ] Avaliar HEALTHCHECK no Dockerfile
- [ ] Opcional: rodar como `USER node` no container
- [ ] Retomar validação Rolling HLS (ver Guia Técnico)

---
## 6) Referências
- Guia Unificado de Deploy: `DEPLOY-GUIDE-UNIFIED.md`
- Guia Técnico Detalhado: `GUIA_TECNICO_DETALHADO.md`
- Plano — Parte 2 (histórico e bases): `PLANO_EXECUCAO-PARTE-2.md`
