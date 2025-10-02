# ✅ CHECKLIST DE TAREFAS – HLS (VOD + Rotativo) com fallback MP3

Data: 29/09/2025
Status: Guia passo a passo para executar o plano com segurança
Referências obrigatórias: `PLANO_EXECUCAO.md`, `GUIA_TECNICO_DETALHADO.md`, `PLANO-SINCRONIZAR-COM-SPACES.md`

Diretriz central:
- NÃO modificar a estratégia IOSPWAStrategy existente (/src/player/strategies/IOSPWAStrategy.ts). Usá-la somente como fallback.
- Seguir o workflow: pequenas mudanças, testar em staging, manter estabilidade.
- Se alguma tarefa exigir algo novo/complexo fora dos padrões dos guias, PAUSAR e solicitar aprovação antes.

Legenda: [ ] pendente, [x] concluído, [!] checkpoint de validação, [STOP] requer aprovação.

---

## 🔄 Atualização 02/10/2025
- [x] F1 (backend) concluído: `/api/sync-catalog?full=true` com `music-metadata` (ESM import dinâmico), limite 20 faixas/execução, retorno com `durationComputed` e `metadataFilled`.
- [x] F1 (frontend) concluído: botão "Sincronizar com Spaces (Completo)" no `admin.html`, desabilita durante execução, mostra resumo e atualiza lista/totais.
- [x] Correção de rota: Admin agora chama o backend diretamente (URL fixa do DO App Platform) para evitar 405 em staging.
- [ ] Pendência: `data/metadata-cache.json` (cache incremental) – será tratado em F1.1.
- [x] IOSPWAStrategy confirmada e mantida IMUTÁVEL (somente fallback).

---

## 0) Preparação e Disciplina de Deploy

- [x] Confirmar que staging está estável e documentado nos guias principais
- [x] Criar branch dedicada para a fase atual (ex.: `feature/sync-spaces-f1`)
- [x] Garantir acesso ao Admin/Debug UI conforme `GUIA_TECNICO_DETALHADO.md` (botões/gesto iPhone)
- [x] Confirmar estratégia IOSPWAStrategy ATUAL (/src/player/strategies/IOSPWAStrategy.ts). Não alterar, apenas usar como fallback
- [x] Verificar CORS e Content-Type no Spaces (m3u8, ts e/ou m4s) – sem mudanças ainda, apenas checagem inicial
- [!] Abrir checklist em paralelo durante a execução e ir marcando itens

---

## F0 – Estrutura de Pastas/Arquivos no Spaces (verificação)

- [x] Validar existência das pastas lógicas (prefixos): `audio/`, `data/`, `generated/`, `generated/mixes/`, `generated/status/`, `generated/hls/`
- [x] Checar `data/catalog.json` (poderá ser criado/atualizado pelo sync)
- [x] Planejar (sem criar ainda) arquivos: `data/metadata-cache.json`, `generated/status/sync-status.json`
- [x] Confirmar MIME types suportados pelo Spaces/CDN:
  - [x] `.json` → `application/json`
  - [x] `.m3u8` → `application/vnd.apple.mpegurl`
  - [x] `.ts` → `video/MP2T` (ou `.m4s` → `video/iso.segment`)
  - [x] `.mp3` → `audio/mpeg`
- [x] Documentar no time os caminhos canônicos (sem criar placeholders vazios agora)
- [!] Aceite F0: Estrutura compreendida e validada; `audio/` e `data/` existem, `generated/*` será criado em F2

---

## F0.1 – Estratégia IOSPWAStrategy EXISTENTE (verificação, IMUTÁVEL)

- [x] Verificar existência de `/src/player/strategies/IOSPWAStrategy.ts`
- [x] Confirmar que gera áudio contínuo via concatenação para iPhone PWA
- [x] Testar funcionamento atual dessa estratégia (sem alterações de código)
- [x] Anotar que NÃO haverá mudanças neste arquivo/estratégia
- [!] Aceite F0.1: Estratégia IOSPWAStrategy validada e congelada (somente uso como fallback)

---

## F1 – Backend: Enriquecimento de Metadados (dur/ID3) + Cache JSON

- [x] [STOP] Aprovação: adicionar dependência leve `music-metadata` (backend)
- [x] Implementar parâmetro `full=true` em `POST /api/sync-catalog` (mantendo comportamento atual quando `full=false`)
- [x] Ler `.mp3` via stream do Spaces (sem download completo) e preencher somente onde faltar: `duration`, `title`, `artist`
- [x] Persistir `data/catalog.json` no Spaces como hoje (sem regressões)
- [ ] Criar/atualizar `data/metadata-cache.json` com deltas para evitar retrabalho
- [x] Limitar a N faixas por execução (ex.: 20) e tempo (ex.: 25s). Logar com prefixos (SYNC, META)
- [x] Deploy para staging
- [x] Teste manual: acionar `POST /api/sync-catalog?full=true` e validar JSON de retorno (contagens e mensagens)
- [!] Aceite F1: catálogo salvo no Spaces; campos faltantes enriquecidos; sem regressões no sync básico

Nota: `metadata-cache.json` ficará para uma subfase F1.1 (sem impacto no fluxo atual).

---

## F1 – Frontend (Admin): Botão "Sincronizar" simples

- [x] Adicionar botão único na aba "Gerenciar Biblioteca Musical" (UI já existente) – sem redesenhar
- [x] Ao clicar: `POST /api/sync-catalog?full=true`; desabilitar durante processamento; texto "Sincronizando…"
- [x] Ao concluir: mostrar resumo (alert/console), recarregar lista e atualizar totais
- [x] Garantir implementação no caminho de build vigente (conforme Vite/admin.html dos guias) – uso temporário de URL do backend fixa para evitar 405 em staging
- [x] Deploy para staging
- [x] Validar no Admin/Debug UI (desktop e iPhone PWA via gesto)
- [!] Aceite F1-Front: botão funciona, lista e totais atualizam; nenhuma outra mudança visual

---

## F2 – Backend: HLS VOD (m3u8 + segmentos) – Opt-in

- [ ] [STOP] Aprovação: adicionar `ffmpeg-static` e `fluent-ffmpeg` (backend)
- [ ] Implementar `POST /api/generate-hls` (assíncrono): `{ shuffle, limit, bitrate, segment }`
- [ ] Gerar VOD longo em `/tmp` com re-encode único (AAC 128k, 44.1k, segmentos 6s)
- [ ] Upload para `generated/hls/latest/` (MIME: `.m3u8`→`application/vnd.apple.mpegurl`, `.ts`→`video/MP2T` ou `.m4s`→`video/iso.segment`)
- [ ] Salvar `generated/hls/latest/manifest.json` e `generated/status/hls-status.json`
- [ ] Implementar `GET /api/hls-status` (ler status JSON)
- [ ] Adicionar proxy/redirect `GET /hls/latest/index.m3u8`
- [ ] Deploy staging
- [ ] Teste background iPhone PWA: `<audio src="/hls/latest/index.m3u8">` deve continuar no lockscreen
- [!] Aceite F2: HLS VOD disponível e reproduz no iPhone (background). Sem impactar MP3 contínuo

---

## F2 – Frontend (Admin): Botão opcional "Gerar HLS (VOD)"

- [ ] Adicionar botão (opcional) que chama `POST /api/generate-hls` com presets simples
- [ ] Mostrar feedback rápido (iniciado) e link para status
- [ ] Não alterar outras partes da UI
- [ ] Deploy staging e validar
- [!] Aceite F2-Front: botão dispara job; status acessível; sem efeitos colaterais

---

## F3 – Backend: HLS Rotativo (publicação atômica) – Opt-in

- [ ] Estender `POST /api/generate-hls` para `mode:"rolling"` (VOD longo)
- [ ] Gerar em `generated/hls/tmp/<jobId>/...` e, ao finalizar, publicar em `generated/hls/rolling/` (cópia/movimentação)
- [ ] Salvar `generated/hls/rolling/manifest.json` e `generated/status/hls-rolling-status.json`
- [ ] Implementar `GET /api/hls-rolling-status` e proxy `GET /hls/rolling/index.m3u8`
- [ ] Deploy staging
- [ ] Teste iPhone PWA: reprodução estável via `/hls/rolling/index.m3u8`
- [!] Aceite F3: publicação atômica; HLS rotativo disponível; sem afetar `latest/`

---

## F3 – Frontend (Admin): Botão opcional "Gerar/Atualizar HLS Rotativo"

- [ ] Adicionar botão (opcional) que chama `POST /api/generate-hls` com `{ mode:"rolling" }`
- [ ] Feedback: iniciou job + link de status
- [ ] Deploy staging e validar execução
- [!] Aceite F3-Front: botão opera job rotativo sem mudar outras áreas

---

## F4 – Frontend (Player): Switch automático em segundo plano (opt-in)

- [ ] Adicionar preferência: “Usar HLS em segundo plano (iPhone)” (OFF por padrão)
- [ ] Implementar listener `visibilitychange`/`pagehide`
- [ ] Ao entrar em segundo plano: tentar HLS rotativo (`/hls/rolling/index.m3u8`) → se falhar, usar estratégia IOSPWAStrategy EXISTENTE → se falhar, manter por faixas
- [ ] Ao voltar ao primeiro plano: restaurar modo por faixas
- [ ] Usar `hls.js` somente quando necessário (navegadores sem HLS nativo)
- [ ] Não alterar NADA na estratégia IOSPWAStrategy; apenas usar como fallback
- [ ] Logs de switch (HLS, MP3, por faixas) para diagnóstico
- [ ] Deploy staging e validar no iPhone PWA (lockscreen)
- [!] Aceite F4: troca estável, sem regressões no player e respeitando opt-in

---

## F5 – Alternativa cliente (NO-OP)

- [ ] Confirmar que não há tasks para geração de MP3 no cliente (lamejs/ffmpeg.wasm)
- [ ] Confirmar que não será usado Web Audio em lockscreen
- [!] Aceite F5: Escopo cliente excluído e alinhado com o plano

---

## Observabilidade e Segurança

- [ ] Prefixos de log: SYNC, META, HLS
- [ ] Status JSONs atualizados: `hls-status.json`, `hls-rolling-status.json`, `sync-status.json`
- [ ] CORS e Content-Type corretos no Spaces
- [ ] Nenhum segredo exposto em logs
- [ ] Métricas de player (mínimo): switches e falhas

---

## Validação dos Critérios de Aceite (Consolidação)

- [x] Sync básico e `full=true` enriquecendo dur/ID3
- [x] Botão Admin “Sincronizar” atualiza lista e totais
- [ ] HLS VOD disponível em `generated/hls/latest/` e tocando no iPhone
- [ ] HLS Rotativo publicado em `generated/hls/rolling/` e tocando no iPhone
- [ ] Fallback funcionando: HLS → estratégia IOSPWAStrategy existente → por faixas

---

## Rollback Simples

- [ ] Desabilitar opt-ins de HLS (frontend)
- [ ] Usar `full=false` no sync para voltar ao comportamento atual
- [ ] Player segue com estratégia IOSPWAStrategy existente e reprodução por faixas

---

## Checkpoints de Aprovação (não implementar sem validar antes)

- [x] [STOP] Adicionar/instalar `music-metadata` (F1)
- [ ] [STOP] Adicionar/instalar `ffmpeg-static` e `fluent-ffmpeg` (F2/F3)
- [ ] [STOP] Ajustes em CORS/Headers no Spaces (se necessário para `.m3u8`, `.ts/.m4s`)

---

## Encerramento

- [ ] Validar critérios de aceite consolidados (ver `PLANO-SINCRONIZAR-COM-SPACES.md`)
- [ ] Atualizar documentação (`PLANO_EXECUCAO.md` e `GUIA_TECNICO_DETALHADO.md`) com datas/links de staging
- [ ] Abrir PR da branch de feature para staging quando todos os checkpoints da fase estiverem marcados
