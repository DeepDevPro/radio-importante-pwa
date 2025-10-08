# HLS Rotativo - Checklist Operacional

## Contexto
Sistema HLS VOD + Rolling implementado com capacidade de geração real usando FFmpeg. Este checklist valida funcionalidade completa através do pipeline de geração, proxy, diagnóstico e fallback.

## Legend / Status
✅ Concluído no Dry Run  |  🔄 Parcial (falta validação estendida / longitudinal)  |  ⏳ Pendente (executar pós-go-live)

## Checklist Pré-Deploy (Agora: Pós-Go-Live Hardening)

### 1. Capacidades e Ambiente
- [ ] `GET /api/hls/capabilities` retorna `canSpawn: true` + `ffmpegVersion` ✅
- [ ] Container tem binário ffmpeg funcional (spawn test < 1500ms) ✅
- [ ] Espaço disponível em `/tmp` (verificar com `df -h /tmp`) ✅
- [ ] Permissões de escrita em `/tmp/hls-work/` ✅ (implícito via geração bem-sucedida)

### 2. Geração VOD (Latest)
- [ ] `POST /api/hls/generate-hls` (mode: latest, simulate: false) retorna `action: generated` ✅
- [ ] `segmentCount >= 3` e `totalDurationApprox >= 12s` ✅ (16 seg / 91s)
- [ ] Upload atomico: segments primeiro, playlist por último ✅ (confirmado via comportamento final consistente)
- [ ] Tempo total < 90s (warn se >= 90s) ✅ (~3.32s)
- [ ] Fallback graceful: se geração falhar → simulate mode sem 500 🔄 (não forçado erro real)

### 3. Rolling Publication
- [ ] `POST /api/hls/generate-hls` (mode: rolling) deriva de latest existente ✅
- [ ] Rolling playlist SEM `#EXT-X-ENDLIST` ✅
- [ ] `MEDIA-SEQUENCE` correto baseado na janela ✅ (MEDIA-SEQUENCE:6 observado)
- [ ] Nenhuma cópia física de segments (apenas nova playlist) 🔄 (inferido, não auditado no bucket)

### 4. Proxy e Acesso
- [ ] `GET /hls/latest/index.m3u8` retorna playlist válida ✅
- [ ] `GET /hls/latest/segment_000.ts` retorna TS válido ✅
- [ ] `GET /hls/rolling/index.m3u8` retorna rolling playlist ✅
- [ ] Headers corretos: playlist no-cache, segments long-cache ✅
- [ ] Aliases `/api/hls/*` funcionando identicamente 🔄 (não testado explicitamente)

### 5. Diagnostics Real
- [ ] `GET /api/hls/latest/diagnostics` < 3000ms (p95) ✅ (40ms)
- [ ] Parse completo: EXTINF count, duração, primeiros/últimos segments ✅
- [ ] Probe amostral: HEAD requests em segments (1º, meio, último) ✅ (headOkCount esperado)
- [ ] Status classification: ok/missing/partial/stalled ✅
- [ ] Métricas: `headOkCount`, `averageExtinf`, `totalDurationApprox` ✅

### 6. Rolling Playback
- [ ] Rolling playlist carrega em iOS Safari 🔄 (carregamento logical OK; falta teste físico)
- [ ] Playback contínuo sem freeze (~17s problema resolvido) 🔄 (não observado sessão longa ainda)
- [ ] Background/lockscreen funcional ⏳ (aguarda teste dispositivo)
- [ ] Transition smooth entre segments 🔄 (inferido pelos EXTINF, falta sessão monitorada)

### 7. Safari Analysis + Hypothesis
- [ ] Correlação dados diagnostics com comportamento Safari ⏳
- [ ] Hipótese documentada: timeout, gaps, headers, strategy ⏳
- [ ] Métricas iOS: `tFirstAudio`, `stallCount`, `longestGap` ⏳

### 8. Fallback Chain
- [ ] MP3 contínuo permanece intacto durante toda operação HLS 🔄 (assumido, não validado simultâneo)
- [ ] IOSPWAStrategy não afetada por implementação HLS 🔄 (falta double-check em runtime real)
- [ ] Fallback automático: HLS fail → MP3 seamless ⏳ (não provocada falha)
- [ ] Zero interferência entre HLS e MP3 pipelines ⏳ (medição concorrente não feita)

### 9. Rollback & Snapshot
- [ ] Snapshot `index.prev.m3u8` salvo antes de nova publicação ⏳ (primeira geração sem prev; validar próxima)
- [ ] `GET /api/hls/rollback-info/:mode` disponível ⏳ (não consultado)
- [ ] Rollback testado: restaura playlist anterior funcional ⏳ (ensaio lógico apenas)
- [ ] Preservação de playlist working durante falhas ⏳ (não induzida falha real)

### 10. Janitor & Cleanup
- [ ] Baseline storage registrado antes cleanup ✅
- [ ] Limpeza automática: diretórios concluídos removidos após sucesso ✅ (sem resíduos)
- [ ] Varredura órfãos: >24h deletados automaticamente ⏳ (janela temporal não transcorrida)
- [ ] Métricas janitor: bytes freed, count removed ⏳ (não havia resíduos)
- [ ] Log `HLS_GEN` tipo `janitor` funcionando 🔄 (indícios indiretos; log detalhado a capturar)

### 11. Smoke & Stability
- [ ] Smoke test 6-stage funcionando ✅ (1 execução PASS)
- [ ] Sequência: capabilities → generate → diagnostics → safari 🔄 (parte Safari físico pendente)
- [ ] <5% falhas em conjunto de execuções ⏳ (precisa série)
- [ ] Automação 24h: relatório consolidado disponível ⏳
- [ ] P95 diagnostics consistente < 3000ms 🔄 (amostra única OK; precisa tracking)

### 12. Debug UI Integration
- [ ] `GET /api/hls/debug-status` operacional ⏳
- [ ] Cache TTL funcionando (evita locks) ⏳
- [ ] `GET /api/hls/last-diagnostics` + `last-hypothesis` disponíveis ⏳
- [ ] JSON estruturado para consumo frontend ⏳
- [ ] Performance: endpoints < 300ms ⏳

## Gate Criteria (R6-10)
- [ ] 100% checklist items acima validados 🔄 (itens pendentes pós-go-live)
- [ ] 0 falhas smoke em últimas 10 execuções ⏳
- [ ] P95 diagnostics < 3000ms ✅ (amostra atual)
- [ ] Nenhum endpoint retorna 500 ✅ (nas execuções observadas)
- [ ] Rollback testado e funcional 🔄 (testar próxima geração com prev)
- [ ] Janitor baseline registrado ✅

## Emergency Procedures
- **HLS Down**: MP3 fallback continua - zero downtime
- **Geração Failed**: Simulate mode ativo - UI permanece funcional  
- **Rollback**: `POST /api/hls/rollback-latest` restaura snapshot anterior (validar ao ter prev)  🔄
- **Debug**: `GET /api/hls/debug-status` + logs para troubleshooting ⏳

---
Atualizado: 07/10/2025 - Pós Dry Run (anotações de estado)
