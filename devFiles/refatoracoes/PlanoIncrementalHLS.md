# Plano Incremental HLS (VOD + Rolling) – Micropassos Executáveis

Data: 06/10/2025  
Responsável (origem): Refatoração pós extração `app.js`  
Objetivo imediato: Restaurar funcionalidades HLS removidas na refatoração (sem reinvenção), diagnosticar 404 e timeout Safari (~17s), manter MP3 contínuo intacto como fallback.

---
## 1. Princípios
- Preserve comportamento já validado ("não quebrar o que funciona").
- Alterações mínimas por commit (1 micropasso = 1 commit quando possível).
- Somente adicionar/refatorar onde há lacuna funcional (evitar mexer em blocos estáveis).
- (Cumprido) Sem novas dependências até HLS básico voltar a servir playlist e segmentos → A PARTIR DE R3 permitido introduzir `ffmpeg-static` + `fluent-ffmpeg` conforme F2 do plano global.
- Logging padronizado com prefixos: `HLS_PROXY`, `HLS_GEN`, `HLS_DIAG`.
- Sempre validar em staging (produção somente após ciclo completo & smoke).
- Fallback MP3 contínuo permanece operacional durante todo o ciclo.

---
## 2. Visão Geral das Fases
| Fase | Código | Foco | Resultado Final |
|------|--------|------|-----------------|
| R0 | Auditoria | Confirmar o que existe no Spaces | Lista real de arquivos HLS |
| R1 | Proxies | Restaurar rotas /hls/* e aliases /api/hls/* | 404 só se faltar arquivo no Spaces |
| R2 | Logging & Alias | Garantir captura de logs de playlist/segment | Logs visíveis no debug UI |
| R3 | Bootstrap FFmpeg (F2-Parte 1) | Introduzir deps + detecção de capacidade + fallback simulate | Ambiente apto + endpoint estável |
| R4 | Geração VOD Real (F2-Parte 2) | Gerar pacote HLS VOD (latest) a partir de MP3 no Spaces | Playlist + segments válidos publicados |
| R5 | Rolling & Diagnóstico | Rolling incremental + endpoint diagnostics + Safari freeze análise | Rolling estável + relatório confiável |
| R6 | Hardening / Smoke | Checklists, monitoração mínima, rollback rápido | Confiabilidade + prevenção regressão |

MP3 contínuo: IMUTÁVEL (apenas fallback).  
Publish atômico avançado: adiado para pós-R6 se ainda necessário.

---
## 3. Convenções
- Branch por fase: `feature/hls-r3-bootstrap`, `feature/hls-r4-vod`, etc.
- Commits: `feat(hls):`, `fix(hls):`, `chore(hls):`, `docs(hls):`.
- Log operacional incremental: `devFiles/temps/HLS-RUN-LOG.md`.
- Não alterar: `IOSPWAStrategy`, rotas catálogo, upload já estáveis.

---
## 4. Micropassos Detalhados

### R0 – Auditoria (Somente Leitura)
**Objetivo:** Saber exatamente o que existe hoje em `generated/hls/` (latest / rolling) no Spaces.  
**Alterações de código:** NENHUMA.  
**Ações:**
- [x] (R0-1) Acessar playlist latest: `https://<bucket>.<endpoint>/generated/hls/latest/index.m3u8`
- [x] (R0-2) Acessar playlist rolling: `https://<bucket>.<endpoint>/generated/hls/rolling/index.m3u8`
- [x] (R0-3) Registrar conteúdo (se 200) no `HLS-RUN-LOG.md`
- [x] (R0-4) Testar segmentos prováveis: `segment_000.ts`, `segment_001.ts`
- [x] (R0-5) Anotar Content-Length e Content-Type de cada resposta
- [x] (R0-6) Consolidar tabela 200/404 no log
**Teste de Aceite:** Log contém tabelas listando quais responderam 200 / 404.  
**Gate p/ R1:** Pelo menos um alvo confirmado (ou ausência documentada).

### R1 – Restaurar Proxies HLS
**Objetivo:** Reexpor rotas HTTP removidas.  
**Arquivos a criar:** `backend/routes/hlsProxy.routes.js`.  
**Tarefas:**
- [x] (R1-1) Criar arquivo de rota com dependências mínimas (express, https, saveAutoLog)
- [x] (R1-2) Implementar GET `/hls/latest/index.m3u8`
- [x] (R1-3) Implementar GET `/hls/latest/:segment`
- [x] (R1-4) Implementar GET `/hls/rolling/index.m3u8`
- [x] (R1-5) Implementar GET `/hls/rolling/:segment`
- [x] (R1-6) Headers playlist: `no-cache, no-store, must-revalidate`
- [x] (R1-7) Headers segments: `public, max-age=86400`
- [x] (R1-8) Logs via `saveAutoLog` com prefixo `HLS_PROXY`
- [x] (R1-9) Montar rota no `app.js`
- [x] (R1-10) Smoke: curl playlists + segmentos (anotar no RUN-LOG)
**Gate p/ R2:** Rotas respondem sem erro de implementação.

### R2 – Aliases + Consolidação de Logs
**Objetivo:** Compatibilidade `/api/hls/*` + visibilidade.  
**Tarefas:**
- [x] (R2-1) Adicionar handlers `/api/hls/latest/index.m3u8` e `/:segment`
- [x] (R2-2) Adicionar handlers `/api/hls/rolling/index.m3u8` e `/:segment`
- [x] (R2-3) Reutilizar mesma função interna dos proxies (sem duplicar código)
- [x] (R2-4) Validar limite de logs (autoLogs não estoura)
- [x] (R2-5) Testar ambos caminhos (direto e alias)
- [x] (R2-6) Registrar exemplos de logs no RUN-LOG
**Gate p/ R3:** Logs visíveis + compatibilidade confirmada.

### R3 – Bootstrap FFmpeg + Endpoint Unificado (Capacidade + Simulate)
**Objetivo:** Preparar ambiente para geração real (F2) sem quebrar UI. Fornecer endpoint `/api/generate-hls` que: (a) detecta capacidade real de geração; (b) executa modo `simulate` se faltarem binários; (c) expõe metadados de capability.
**Saída Final:** `POST /api/generate-hls` responde 200 sempre com JSON estruturado, e `GET /api/hls/capabilities` reporta estado.
**Tarefas:**
- [ ] (R3-1) Adicionar dependências no backend: `ffmpeg-static`, `fluent-ffmpeg` (import dinâmico para evitar crash se faltar binário).
- [ ] (R3-2) Implementar módulo util `backend/hls/ffmpegCapability.js` que retorna `{ hasFfmpegStatic, ffmpegPath, canSpawn }` (tenta require de `ffmpeg-static` e simples spawn `-version` com timeout 1500ms).
- [ ] (R3-3) Criar `GET /api/hls/capabilities` retornando `{ success:true, capability }` e log `HLS_GEN` tipo `capability`.
- [ ] (R3-4) Refatorar rota POST `/api/generate-hls`: aceitar body `{ mode, simulate }`; default `mode=latest`, `simulate` automático: `true` se `!canSpawn`.
- [ ] (R3-5) Extrair função scanner rápida do Spaces (HEAD index.m3u8 + HEAD segment_000.ts) → retorna `{ playlistExists, firstSegmentExists }`.
- [ ] (R3-6) Lógica de decisão:
  - se `simulate` → ações: `reused|synthetic|empty` (mantendo conceito anterior) sem erro.
  - se `!simulate` e capacidade OK → retornar `action: ready_for_real_generation` (não gera ainda) preparando R4.
- [ ] (R3-7) JSON final: `{ success:true, mode, simulate, capability, action, detected: { playlistExists, firstSegmentExists }, durationMs }`.
- [ ] (R3-8) Logging `HLS_GEN` consolidado com campos acima.
- [ ] (R3-9) Atualizar RUN-LOG com 3 cenários simulate + 1 capability real.
- [ ] (R3-10) Gate: Nenhuma resposta 500; Admin botão interpreta `success:true` como OK.

### R4 – Geração VOD Real (latest) (F2-Parte 2)
**Objetivo:** Implementar geração HLS VOD real (apenas `latest`) a partir de MP3 remotos no Spaces usando pipeline ffmpeg local (transcoding ou transmux se possível). Publicar em `generated/hls/latest/` preservando compatibilidade com proxies.
**Premissas:** MP3 no Spaces podem ser baixados via stream; container tem CPU limitada → usar taxa/segmento moderados.
**Parâmetros Iniciais (ajustáveis):** segment length 6s, codec copy se possível (`-c copy` para acelerar), playlist `#EXT-X-PLAYLIST-TYPE:VOD`.
**Tarefas:**
- [ ] (R4-1) Criar diretório interno temporário `/tmp/hls-work/latest-<timestamp>/`.
- [ ] (R4-2) Implementar util `downloadTrackList.js` que baixa N primeiras faixas (escopo mínimo: 2–3 faixas) para teste; depois expandir para catálogo completo.
- [ ] (R4-3) Implementar `generateVodLatest.js` usando `fluent-ffmpeg` com `ffmpegPath` de `ffmpeg-static` (definir via `setFfmpegPath`).
- [ ] (R4-4) Pipeline: concat (arquivos) → saída segmentada (`-f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename segment_%03d.ts index.m3u8`).
- [ ] (R4-5) Validar artefatos locais: existência `index.m3u8`, pelo menos 1 `.ts`.
- [ ] (R4-6) Upload sequencial (ou limitado em paralelo) para `generated/hls/latest/` com headers adequados (playlist no-cache, segments long cache) utilizando storage util já existente.
- [ ] (R4-7) Se upload parcial falhar → abortar e não sobrescrever playlist antiga (garantir atomicidade simples: upload segments primeiro, playlist por último).
- [ ] (R4-8) Atualizar `/api/generate-hls` quando `simulate:false` & capability OK para executar pipeline e retornar `action: generated` + `segmentCount`.
- [ ] (R4-9) Logging `HLS_GEN` com métricas `{ segmentCount, totalDurationApprox }` (somar EXTINF parse).
- [ ] (R4-10) Gate: GET `/hls/latest/index.m3u8` via proxy exibe playlist nova com `#EXT-X-ENDLIST` e segmentação válida.

### R5 – Rolling + Diagnóstico + Safari Timeout
**Objetivo:** Estender geração para `rolling` (janela limitada de segmentos) + fornecer diagnóstico estruturado e analisar freeze Safari (~17s).
**Rolling Simplificado:** Reusar segmentos já gerados (ou regenerar) e publicar janela com últimos N (ex: 10) sem `#EXT-X-ENDLIST`.
**Tarefas Rolling:**
- [ ] (R5-1) Implementar util `buildRollingPlaylist.js` que recebe lista ordenada de segments (nome + duração) e gera `index.m3u8` sem `#EXT-X-ENDLIST` e limita N.
- [ ] (R5-2) Estratégia inicial: usar mesmos segments do VOD (sem nova transcodificação) → copiar/repontar.
- [ ] (R5-3) Publicar em `generated/hls/rolling/` playlist adaptada + subset de segments (se necessário copiar) mantendo nomes consistentes.
- [ ] (R5-4) Atualizar endpoint `/api/generate-hls` para aceitar `mode=rolling` e acionar construção rolling (dependendo de latest gerado, senão fallback simulate).

**Diagnóstico (substitui antigo R4 isolado):**
- [ ] (R5-5) Endpoint `GET /api/hls/rolling/diagnostics` (ou `/api/hls/:mode/diagnostics`) reutilizando fetch único.
- [ ] (R5-6) Parser playlist: contar EXTINF, detectar `#EXT-X-ENDLIST`, listar primeiros/últimos 3 segments.
- [ ] (R5-7) HEAD/Range parallel nos segments amostrados (timeout 1500ms) → métricas `{ headOkCount, averageExtinf, totalDurationApprox }`.
- [ ] (R5-8) JSON: `{ status: ok|missing|partial, declaredCount, timing, probed, flags }` (mesmo design anterior).
- [ ] (R5-9) Log `HLS_DIAG` condensado.

**Análise Safari Timeout:**
- [ ] (R5-10) Reproduzir freeze e correlacionar com `diagnostics` (comparar `totalDurationApprox` vs tempo até travar).
- [ ] (R5-11) Identificar hipótese: `MISSING_SEGMENTS`, `PLAYLIST_STALLED`, `HEADER_CACHING`, ou `PLAYER_STRATEGY_MISMATCH`.
- [ ] (R5-12) Registrar hipótese única no RUN-LOG com evidências (códigos/extinf, timestamps network).
- [ ] (R5-13) Gate: Rolling playlist servida (sem 500) + diagnóstico < 2s + hipótese documentada.

### R6 – Hardening / Smoke & Operacionalização
**Objetivo:** Consolidar confiabilidade e preparar próxima fase (publish atômico avançado se necessário).
**Tarefas:**
- [ ] (R6-1) Criar `CHECKLIST-HLS-ROTATIVO.md` com seções: Proxies, Capabilities, VOD Generation, Rolling, Diagnostics, Safari Smoke.
- [ ] (R6-2) Script opcional `scripts/hls-smoke.js` executando: capabilities → generate latest simulate:false → generate rolling → diagnostics.
- [ ] (R6-3) Adicionar métricas básicas no log (tempo geração, segmentCount) com thresholds (ex: warn se > 90s ou segmentCount < 3).
- [ ] (R6-4) Documentar rollback: restaurar playlist anterior (manter cópia `index.prev.m3u8`).
- [ ] (R6-5) Validar que MP3 fallback continua funcionando após geração real.
- [ ] (R6-6) Limpeza: remover diretórios temporários em `/tmp` após sucesso; log warning se leftover > 24h.
- [ ] (R6-7) Gate final: Checklist 100% + zero 500 em endpoints HLS core por 24h em staging.

---
## 5. Restrições (Atualizado)
- Não migrar para fMP4 nesta etapa.
- Não introduzir filas/bull/redis antes de comprovar necessidade (volume/latência).
- Não remover script legado ainda (guardar para comparação até R6).
- Não alterar fallback MP3.
- Evitar publish atômico complexo (diretórios tmp → swap) até confirmar necessidade pós-R5.

---
## 6. (REMOVIDO) Quadro de Progresso
(Substituído por checkboxes inline nas tarefas.)

---
## 7. Exemplo de Commit Messages
- `feat(hls): add proxy routes for /hls/latest and /hls/rolling (R1)`
- `feat(hls): add /api/hls/* alias routes (R2)`
- `feat(hls): bootstrap ffmpeg capability + simulate fallback (R3)`
- `feat(hls): implement real VOD generation latest (R4)`
- `feat(hls): add rolling builder + diagnostics endpoint (R5)`
- `chore(hls): add smoke checklist and cleanup tasks (R6)`

---
## 8. Checklist de Aceite Final
✅ Rotas /hls/latest e /hls/rolling respondem (proxy).  
✅ Rotas /api/hls/* aliases funcionando (compatibilidade).  
⏳ Capabilities endpoint e simulate fallback (R3).  
⏳ VOD latest gerado real (R4).  
⏳ Rolling playlist + diagnostics + hipótese Safari (R5).  
✅ MP3 contínuo intacto e funcional.  
⏳ Smoke checklist + rollback documentado (R6).  

---
## 9. Próximos Passos (Após Encerrar R6)
- Avaliar publish atômico (swap) se inconsistências detectadas.
- Considerar pipeline incremental (gerar só novos segments) para reduzir tempo.
- Visualizar diagnostics no Debug UI.
- (Opcional) Evoluir para fMP4 se suporte Safari / seeking justificar.

---
## 10. Registro Rápido (preencher durante execução)
| Data/Hora | Passo | Ação | Resultado | Observação |
|-----------|-------|------|-----------|-----------|
|           | R0    | curl playlist rolling | 404 | playlist ausente |
|           | R1    | deploy proxies | 200 /hls/latest/index.m3u8 | ok |

(Continuar...)

---
Fim do Plano Incremental HLS.
