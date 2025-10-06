# HLS Rotativo - Checklist Operacional

## Contexto
Sistema HLS VOD + Rolling implementado com capacidade de geração real usando FFmpeg. Este checklist valida funcionalidade completa através do pipeline de geração, proxy, diagnóstico e fallback.

## Checklist Pré-Deploy

### 1. Capacidades e Ambiente
- [ ] `GET /api/hls/capabilities` retorna `canSpawn: true` + `ffmpegVersion`
- [ ] Container tem binário ffmpeg funcional (spawn test < 1500ms)
- [ ] Espaço disponível em `/tmp` (verificar com `df -h /tmp`)
- [ ] Permissões de escrita em `/tmp/hls-work/`

### 2. Geração VOD (Latest)
- [ ] `POST /api/hls/generate-hls` (mode: latest, simulate: false) retorna `action: generated`
- [ ] `segmentCount >= 3` e `totalDurationApprox >= 12s`
- [ ] Upload atomico: segments primeiro, playlist por último
- [ ] Tempo total < 90s (warn se >= 90s)
- [ ] Fallback graceful: se geração falhar → simulate mode sem 500

### 3. Rolling Publication
- [ ] `POST /api/hls/generate-hls` (mode: rolling) deriva de latest existente
- [ ] Rolling playlist SEM `#EXT-X-ENDLIST`
- [ ] `MEDIA-SEQUENCE` correto baseado na janela
- [ ] Nenhuma cópia física de segments (apenas nova playlist)

### 4. Proxy e Acesso
- [ ] `GET /hls/latest/index.m3u8` retorna playlist válida
- [ ] `GET /hls/latest/segment_000.ts` retorna TS válido
- [ ] `GET /hls/rolling/index.m3u8` retorna rolling playlist
- [ ] Headers corretos: playlist no-cache, segments long-cache
- [ ] Aliases `/api/hls/*` funcionando identicamente

### 5. Diagnostics Real
- [ ] `GET /api/hls/latest/diagnostics` < 3000ms (p95)
- [ ] Parse completo: EXTINF count, duração, primeiros/últimos segments
- [ ] Probe amostral: HEAD requests em segments (1º, meio, último)
- [ ] Status classification: ok/missing/partial/stalled
- [ ] Métricas: `headOkCount`, `averageExtinf`, `totalDurationApprox`

### 6. Rolling Playback
- [ ] Rolling playlist carrega em iOS Safari
- [ ] Playback contínuo sem freeze (~17s problema resolvido)
- [ ] Background/lockscreen funcional
- [ ] Transition smooth entre segments

### 7. Safari Analysis + Hypothesis
- [ ] Correlação dados diagnostics com comportamento Safari
- [ ] Hipótese documentada: timeout, gaps, headers, strategy
- [ ] Métricas iOS: `tFirstAudio`, `stallCount`, `longestGap`

### 8. Fallback Chain
- [ ] MP3 contínuo permanece intacto durante toda operação HLS
- [ ] IOSPWAStrategy não afetada por implementação HLS
- [ ] Fallback automático: HLS fail → MP3 seamless
- [ ] Zero interferência entre HLS e MP3 pipelines

### 9. Rollback & Snapshot
- [ ] Snapshot `index.prev.m3u8` salvo antes de nova publicação
- [ ] `GET /api/hls/rollback-info/:mode` disponível
- [ ] Rollback testado: restaura playlist anterior funcional
- [ ] Preservação de playlist working durante falhas

### 10. Janitor & Cleanup
- [ ] Baseline storage registrado antes cleanup
- [ ] Limpeza automática: diretórios concluídos removidos após sucesso
- [ ] Varredura órfãos: >24h deletados automaticamente
- [ ] Métricas janitor: bytes freed, count removed
- [ ] Log `HLS_GEN` tipo `janitor` funcionando

### 11. Smoke & Stability
- [ ] Smoke test 6-stage funcionando
- [ ] Sequência: capabilities → generate → diagnostics → safari
- [ ] <5% falhas em conjunto de execuções
- [ ] Automação 24h: relatório consolidado disponível
- [ ] P95 diagnostics consistente < 3000ms

### 12. Debug UI Integration
- [ ] `GET /api/hls/debug-status` operacional
- [ ] Cache TTL funcionando (evita locks)
- [ ] `GET /api/hls/last-diagnostics` + `last-hypothesis` disponíveis
- [ ] JSON estruturado para consumo frontend
- [ ] Performance: endpoints < 300ms

## Gate Criteria (R6-10)
- [ ] 100% checklist items acima validados
- [ ] 0 falhas smoke em últimas 10 execuções
- [ ] P95 diagnostics < 3000ms
- [ ] Nenhum endpoint retorna 500
- [ ] Rollback testado e funcional
- [ ] Janitor baseline registrado

## Emergency Procedures
- **HLS Down**: MP3 fallback continua - zero downtime
- **Geração Failed**: Simulate mode ativo - UI permanece funcional  
- **Rollback**: `POST /api/hls/rollback-latest` restaura snapshot anterior
- **Debug**: `GET /api/hls/debug-status` + logs para troubleshooting

---
Atualizado: 06/10/2025 - R6 HLS Hardening Phase Complete
