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
- [x] (R3-1) Adicionar dependências no backend: `ffmpeg-static`, `fluent-ffmpeg` (import dinâmico para evitar crash se faltar binário).
- [x] (R3-2) Implementar módulo util `backend/hls/ffmpegCapability.js` que retorna `{ hasFfmpegStatic, ffmpegPath, canSpawn }` (tenta require de `ffmpeg-static` e simples spawn `-version` com timeout 1500ms).
- [x] (R3-3) Criar `GET /api/hls/capabilities` retornando `{ success:true, capability }` e log `HLS_GEN` tipo `capability`.
- [x] (R3-4) Refatorar rota POST `/api/generate-hls`: aceitar body `{ mode, simulate }`; default `mode=latest`, `simulate` automático: `true` se `!canSpawn`.
- [x] (R3-5) Extrair função scanner rápida do Spaces (HEAD index.m3u8 + HEAD segment_000.ts) → retorna `{ playlistExists, firstSegmentExists }`.
- [x] (R3-6) Lógica de decisão:
  - se `simulate` → ações: `reused|synthetic|empty` (mantendo conceito anterior) sem erro.
  - se `!simulate` e capacidade OK → retornar `action: ready_for_real_generation` (não gera ainda) preparando R4.
- [x] (R3-7) JSON final: `{ success:true, mode, simulate, capability, action, detected: { playlistExists, firstSegmentExists }, durationMs }`.
- [x] (R3-8) Logging `HLS_GEN` consolidado com campos acima.
- [x] (R3-9) Atualizar RUN-LOG com 3 cenários simulate + 1 capability real.
- [x] (R3-10) Gate: Nenhuma resposta 500; Admin botão interpreta `success:true` como OK.
**Gate p/ R4:** UI do Admin confirma sucesso e playlists continuam acessíveis via proxy.

**⚠️ NOTAS R4 (Baseado em aprendizados R3):**
- **Dependency Safety:** ffmpeg-static está disponível no package.json mas precisa spawn test real
- **Logging Fix:** Usar `saveAutoLog(message, type)` não `saveAutoLog(type, object)` - já corrigido
- **Performance:** Container DigitalOcean tem CPU limitada - monitorar tempo pipeline (threshold: <90s)
- **Storage:** Reutilizar storage-config.js existente (já funciona com DigitalOcean Spaces)
- **Fallback:** Manter generate endpoint sempre disponível (nunca 500) mesmo se FFmpeg falhar

### R4 – Geração VOD Real (latest) (F2-Parte 2)
**Objetivo:** Implementar geração HLS VOD real (apenas `latest`) a partir de MP3 remotos no Spaces usando pipeline ffmpeg local (transcoding ou transmux se possível). Publicar em `generated/hls/latest/` preservando compatibilidade com proxies.
**Premissas:** MP3 no Spaces podem ser baixados via stream; container tem CPU limitada → usar taxa/segmento moderados.
**Parâmetros Iniciais (ajustáveis):** segment length 6s, tentativa `codec copy` APENAS se já estiver em AAC (ou outro compatível) caso contrário transcodificar para AAC (`-c:a aac -b:a 128k`) para máxima compatibilidade iOS/Safari; playlist `#EXT-X-PLAYLIST-TYPE:VOD`; manter nomes `segment_%03d.ts`.
**Notas Técnicas Adicionais:**
- MP3 em TS pode não ser suportado universalmente em Safari iOS → fallback automático para transcode AAC se probe inicial indicar codec inesperado.
- Se tentativa `copy` falhar rapidamente (exit code != 0 em < 2s) refazer pipeline em modo transcode e registrar no log `transcodeFallback:true`.
- Threshold de performance: geração total alvo < 90s; warn se >= 90s; hard fail (fallback simulate) se >= 150s.
- Manter diretório temporário NÃO excluído em caso de falha para análise; remover somente em sucesso (limpeza adicional reforçada em R6).
**Tarefas:**
- [x] (R4-1) **PRÉ-REQUISITO:** Melhorar detecção real de capability em `/api/hls/capabilities` (spawn test com timeout e log detalhado) incluindo campo `ffmpegVersion` e `spawnLatencyMs`.
- [x] (R4-2) Criar diretório interno temporário `/tmp/hls-work/latest-<timestamp>/` (validar permissões & existência de espaço livre via `statfs` simples se disponível ou checar falha de escrita inicial).
- [x] (R4-3) Implementar util `downloadTrackList.js` que baixa N primeiras faixas do catálogo (escopo inicial: 3–5) com: streaming para arquivo local, checksum rápido (md5) opcional e métricas `downloadDurationMs` acumuladas.
- [x] (R4-4) Implementar `generateVodLatest.js` usando `fluent-ffmpeg` com `ffmpegPath` de `ffmpeg-static`; aceitar opção `{ forceTranscode:boolean }`.
- [x] (R4-5) Pipeline FFmpeg: concat (arquivos) → saída segmentada (`-hide_banner -nostdin -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename segment_%03d.ts -start_number 0 index.m3u8`) adicionando: se `forceTranscode` → `-vn -c:a aac -b:a 128k`; else tentar `-c:a copy` e capturar stderr inicial para detectar incompatibilidade.
- [x] (R4-6) Validar artefatos locais: existência `index.m3u8`, >=1 `.ts`, presença de `#EXT-X-ENDLIST`, e parsing de EXTINF somando duração aproximada.
- [x] (R4-7) Upload sequencial para `generated/hls/latest/` reutilizando storage util existente com headers (playlist no-cache, segments long cache). Registrar métricas `uploadDurationMs` e `segmentCount`.
- [x] (R4-8) **ATOMICIDADE:** Upload segments primeiro, playlist por último; se upload parcial falhar → NÃO sobrescrever playlist antiga. Se falhar depois de alguns segments, tentar deletar segmentos novos (best-effort) e logar `partialUpload:true`.
- [x] (R4-9) **INTEGRAÇÃO:** Atualizar `/api/generate-hls` quando `simulate:false` & `capability.canSpawn:true` para executar pipeline real e retornar `action: generated` + `segmentCount`, `transcodeFallback`, `downloadCount`.
- [x] (R4-10) Logging `HLS_GEN` com métricas `{ segmentCount, totalDurationApprox, ffmpegDurationMs, uploadDurationMs, downloadDurationMs, transcodeFallback, partialUpload }`.
- [x] (R4-11) **FALLBACK:** Se geração real falhar → não retornar 500; fallback simulate com `action: generation_failed` + `errorSummary` (primeira linha stderr ou mensagem sanitizada).
- [x] (R4-12) Gate técnico principal: GET `/hls/latest/index.m3u8` via proxy retorna nova playlist válida com `#EXT-X-ENDLIST` e segmentação funcionando.
- [x] (R4-13) **CRITÉRIOS DE ACEITE COMPLETOS:**
  - Nenhuma resposta 500 nos endpoints `/api/generate-hls` e `/api/hls/capabilities` durante testes.
  - `capability.canSpawn:true` refletindo detecção real + `ffmpegVersion` presente.
  - Execução real: `action: generated`, `segmentCount >= 3`, `totalDurationApprox >= 12s`.
  - Logs contêm métricas (download, ffmpeg, upload) e flags de fallback (quando aplicável).
  - Tempo total (download + ffmpeg + upload) < 90s (warn se >=90s & <150s; simulate fallback se >=150s).
  - Fallback testado: forçar falha (ex: `forceTranscode:false` com codec incompatível) produz `generation_failed` simulate sem quebrar playlist antiga.
  - Playlist antiga preservada em cenário de falha (comparar hash antes/depois).  
**Saída R4 Esperada:** Playlist `latest` gerada real + métricas registradas + rota estável sem regressão do fallback MP3.

### R5 – Rolling + Diagnóstico + Safari Timeout
**Objetivo:** Estender geração para `rolling` (janela limitada de segmentos) reutilizando os MESMOS segments do `latest` (sem copiar / retranscodificar) + fornecer diagnóstico estruturado e analisar freeze Safari (~17s).

**Notas R5 (Aprendizados R4):**
- Logging ainda frágil (caso `saveAutoLog` ordem de parâmetros) → inserir passo de saneamento ANTES de qualquer nova feature (R5-0).
- Evitar cópia física de arquivos dos segments: playlist rolling apenas referencia segmentos já publicados em `generated/hls/latest/`.
- Não regenerar/transcodificar no rolling (custo desnecessário). Rolling = derivado textual da VOD.
- Se playlist `latest` ausente ou inválida → rolling entra em modo simulate (não 500).
- Timeout de diagnósticos ampliado: 1500ms → 3000ms (latência rede + Spaces).
- Usar cache-bust (`?t=<timestamp>`) ao baixar playlist para diagnóstico para evitar CDN stale.
- Aguardar ~30s pós deploy antes de primeiro diagnóstico para evitar race de cache.
- Base para Safari freeze: correlacionar congelamento com `totalDurationApprox`, gaps ou stalls (ausência de segmentos iniciais ou variação irregular de EXTINF).

**Rolling Simplificado (Janela):** Últimos N (default 10) EXTINF do `latest/index.m3u8` sem `#EXT-X-ENDLIST`, mantendo `#EXTM3U`, `#EXT-X-VERSION`, `#EXT-X-TARGETDURATION`, `#EXT-X-MEDIA-SEQUENCE` recalculado com base no primeiro segmento da janela.

**Tarefas Rolling:**
- [x] (R5-0) Saneamento logging: testar `saveAutoLog` com chamadas (`msg, tipo`) e (`tipo invertido`) garantindo não quebra; adicionar guard/normalização definitiva.
- [x] (R5-1) Criar util `buildRollingPlaylist.js` recebendo: `{ segments: [{ name, duration }], windowSize }` → retorna string playlist SEM `#EXT-X-ENDLIST` e com `MEDIA-SEQUENCE` correto.
- [x] (R5-2) Criar util `extractLatestSegments.js` que: baixa `latest/index.m3u8` do Spaces, faz parse de EXTINF + nomes; retorna ordenado.
- [x] (R5-3) Publicar playlist rolling em `generated/hls/rolling/index.m3u8` referenciando os MESMOS nomes (sem upload de .ts). Headers iguais aos de playlist latest (`no-cache`).
- [ ] (R5-4) Atualizar `/api/generate-hls` para aceitar `mode=rolling`: se `latest` válido → gerar rolling; senão `action: simulate_missing_latest` (sem erro).

**Diagnóstico (Rolling / Latest Genérico):**
- [ ] (R5-5) Endpoint `GET /api/hls/:mode/diagnostics` (suporta `latest` e `rolling`).
- [ ] (R5-6) Parser playlist: contar EXTINF, detectar `hasEndlist`, listar primeiros e últimos 3 segmentos.
- [ ] (R5-7) Probe segmentos amostrados (1º, meio, último) via HEAD (e opcional Range 0-255) com timeout 3000ms → métricas `{ headOkCount, timings[], averageExtinf, totalDurationApprox }`.
- [ ] (R5-8) Classificação `status`: `ok` (>=1 seg & todos probes 200), `missing` (playlist 404 ou zero EXTINF), `partial` (algum HEAD falhou), `stalled` (sem crescimento previsto — placeholder futuro).
- [ ] (R5-9) Log `HLS_DIAG` compacto: `{ mode, status, declaredCount, headOkCount, totalDurationApprox, averageExtinf }`.

**Análise Safari Timeout:**
- [ ] (R5-10) Reproduzir freeze e capturar timestamps network (HAR ou logs manual) + tempo até travar.
- [ ] (R5-11) Correlacionar com `diagnostics` (ex: `totalDurationApprox < 18s` ou lacunas EXTINF).
- [ ] (R5-12) Registrar hipótese única no RUN-LOG (`MISSING_SEGMENTS | PLAYLIST_STALLED | HEADER_CACHING | PLAYER_STRATEGY_MISMATCH`).
- [ ] (R5-13) Gate: Rolling playlist 200 (sem `#EXT-X-ENDLIST`) + diagnostics < 3000ms + hipótese documentada.

**Critérios de Aceite R5 (Atualizados):**
- Rolling publicado sem copiar segments (somente nova playlist).
- Playlist rolling sem `#EXT-X-ENDLIST`, `MEDIA-SEQUENCE` coerente.
- Endpoint diagnostics não retorna 500 e classifica corretamente casos simulados.
- Tempo diagnostics < 3000ms (p95) em staging.
- Nenhum 500 novo introduzido nos endpoints existentes.
- Hipótese Safari registrada e plausível com dados.

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
✅ Capabilities endpoint e simulate fallback (R3).  
✅ VOD latest gerado real (R4).  
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
