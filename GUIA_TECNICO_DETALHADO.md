# 🔧 Guia Técnico - Radio Importante PWA

> Complemento: `PLANO_EXECUCAO.md`  
> Foco: Referência técnica consolidada (HLS + Operação)  
> Última Atualização: 08/10/2025 (MVP / Scheduler iOS Background 300s)  
> Público: Desenvolvedor júnior / manutenção

---
## 1. Changelog Conciso
| Data | Fase | Resumo | Detalhes |
|------|------|--------|----------|
| 08/10/2025 | MVP Scheduler Phase0 | iOS PWA background ≥300s estável (Boundary Scheduler + instrumentação) | Apêndice F |
| 06/10/2025 | R6 Hardening | Gate Final aprovado (0 falhas smoke últimas 10, p95 diag 44ms, rollback & janitor ok) | Ver seções 3–7 |
| 02/10/2025 | F1 Sync+Metadados | Enriquecimento metadata via streaming + `music-metadata` ESM | Apêndice A |
| 29/09/2025 | Debug UI + Gestos iPhone | Botões Debug/Admin + gesto secreto (3 taps=Admin / 5=Debug) | Apêndice B |
| 28/09/2025 | Duration Fix | Cálculo duração pré-upload (HTML5 Audio API) | Apêndice C |

---
## 2. Visão Geral HLS (Baseline Pós-R6)
Pipeline HLS oferece: geração VOD (`latest`), derivação `rolling` (janela textual), diagnósticos estruturados, rollback rápido, limpeza automática (janitor) e cache de debug (TTL) para UI/Admin.

Componentes-Chave:
- Geração: `backend/routes/hlsGenerate.routes.js`
- Rolling derivado: util interno (extração + reconstrução playlist)
- Diagnósticos: mesma rota base (`/api/hls/:mode/diagnostics`)
- Cache Debug TTL: `backend/hls/debugDataCache.js`
- Rotas Debug: `backend/routes/hlsDebug.routes.js`
- Snapshot Rollback: `index.prev.m3u8`
- Janitor: limpeza pós-sucesso + órfãos >24h (`/api/hls/janitor/status`)
- Automação: `scripts/hls-smoke.cjs`, `scripts/r6-7-24h-automation.sh`, `scripts/r6-10-gate-final.cjs`

Fluxo Simplificado (latest):
1. Chamada `POST /api/hls/generate-hls` (decide simulate vs real).  
2. Download faixas → ffmpeg segmenta → upload segments → upload playlist (atômico).  
3. Salva snapshot anterior (rollback).  
4. Deriva rolling (texto) se requisitado.  
5. Executa diagnostics (HEAD sample segments) → atualiza cache debug.  
6. Janitor remove diretórios temporários concluídos.  

---
## 3. Endpoints Principais HLS
| Endpoint | Método | Função |
|----------|--------|--------|
| `/api/hls/capabilities` | GET | Verifica ffmpeg (spawn, version, latência) |
| `/api/hls/generate-hls` | POST | Gera `latest` ou `rolling` (simulate fallback) |
| `/api/hls/:mode/diagnostics` | GET | Métricas playlist + probes segments |
| `/api/hls/rollback-info/:mode` | GET | Metadados de snapshot anterior |
| `/api/hls/janitor/status` | GET | Estado/última execução janitor |
| `/api/hls/debug-status` | GET | Estatísticas cache debug |
| `/api/hls/last-diagnostics` | GET | Último diagnostics (snapshot) |
| `/api/hls/last-hypothesis` | GET | Última hipótese Safari/HLS |
| `/api/hls/debug-refresh` | POST | Placeholder refresh manual |
| `/api/hls/debug-cache` | DELETE | Limpa cache debug |

Status Classificação Diagnostics: `ok | missing | partial | stalled (placeholder)`.

---
## 4. Operação & Runbooks
### 4.1 Smoke Test Manual
```bash
node scripts/hls-smoke.cjs
# Saída: 6 estágios (capabilities, latest, rolling, diag latest, diag rolling, safari-hypothesis)
# Exit ≠0 indica falha
```

### 4.2 Automação 24h
`scripts/r6-7-24h-automation.sh` executa smoke em intervalo (ex: 30m) acumulando: totalRuns, passes, fails500, p95Diagnostics.

### 4.3 Rollback
1. Verificar existência `index.prev.m3u8` em `generated/hls/latest/`.  
2. Se playlist nova corrompida: substituir `index.m3u8` atual pelo conteúdo de `index.prev.m3u8`.  
3. (Futuro) Automatizar via endpoint dedicado.

### 4.4 Janitor
- Executa após geração bem-sucedida.  
- Remove diretórios de trabalho concluidos + órfãos >24h.  
- Métricas logadas: `{ freedBytes, removedCount, durationMs }` (tipo `janitor`).

### 4.5 Cache Debug TTL
- TTL padrão 5m (env configurável).  
- Limpeza: lazy ou `DELETE /api/hls/debug-cache`.

### 4.6 Operação Diária Rápida
```bash
curl -s /api/hls/latest/diagnostics | jq '.status,.playlist.declaredCount'
node scripts/hls-smoke.cjs
curl -s /api/hls/debug-status | jq '.'
curl -X POST /api/hls/generate-hls -H 'Content-Type: application/json' \
  -d '{"mode":"latest","simulate":false}'
curl -X DELETE /api/hls/debug-cache
```

---
## 5. Métricas & Baselines (R6)
| Métrica | Valor | Observação |
|---------|-------|------------|
| Geração VOD (16 seg) | ~4.2s | Download + ffmpeg + upload |
| Rolling derivação | ~260ms | Apenas reconstrução textual |
| Diagnostics avg | ~38ms | Amostragem 3 segments HEAD |
| Diagnostics P95 | 44ms | Muito abaixo do limite (3000ms) |
| Smoke ciclo | 3.9s–6.3s | 6 estágios |
| Stalls iOS Playback (Latest) | 0 | Foreground / lockscreen / background (≥300s) |
| Rolling Status | PENDENTE reteste | Falhou inicialização anterior; revalidar pós-stabilização |

Estrutura JSON (exemplo resumido):
```json
{ "mode":"latest", "status":"ok", "playlist": {"declaredCount":16}, "segments": {"headOkCount":3}, "durationMs":41 }
```

---
## 6. Troubleshooting Consolidado
| Sintoma | Causa Provável | Ação |
|---------|----------------|------|
| Diagnostics >3000ms | Latência Spaces / rede | Reexecutar; inspecionar `timings[]` |
| Rolling vazio | Playlist latest inválida | Regenerar latest real (simulate:false) |
| Freeze iOS ~17s | Duração total baixa | Garantir >= ~18s playlist inicial |
| Cache debug vazio | Diagnostics ainda não rodou | Chamar `/api/hls/latest/diagnostics` |
| Força simulate inesperado | ffmpeg spawn falhou | Checar `/api/hls/capabilities` |
| Lixo em /tmp | Janitor não executou | Ver `/api/hls/janitor/status` |
| Partial diagnostics | HEAD falhou em segmento | Verificar segment no Spaces (existência / ACL) |

---
## 7. Decisões & Lições (R6)
Decisões:
- Cache in-memory suficiente (volume baixo) → evitar Redis prematuro.
- Probes amostrais (3) balanceiam custo/visibilidade.
- Rolling textual (sem duplicar segments) reduz IO e custo.
- Snapshot único (`index.prev.m3u8`) simplifica rollback inicial.

Lições:
- Ordem de rotas Express afeta endpoints específicos (debug 404 resolvido reordenando/módulo isolado).
- Simulate protege UX durante instabilidade inicial.
- Métricas objetivas (p95, headOkCount) agilizam Gate Final.
- Scripts separados = menor risco regressão e execução auditável.

---
## 8. Roadmap Próximo (Pós-R6)
1. Validar Rolling playlist (reteste após estabilização scheduler).  
2. Histórico persistente de diagnostics (arquivo JSON) → baseline longitudinal.  
3. Visual Debug UI (gráficos p95, headOkCount, rolling growth).  
4. Publish atômico (swap diretórios) caso detecte race/inconsistência.  
5. Incremental segments (gerar só novos) se performance total > alvo futuro.  
6. Alertas proativos (cron + webhook) quando `status != ok`.  
7. (Opcional) Guard de instrumentação para produção (silenciar logs ruidosos se houver).  

---
## 9. Referências Rápidas de Arquivos
| Área | Arquivo / Script | Propósito |
|------|------------------|-----------|
| Geração | `backend/routes/hlsGenerate.routes.js` | Orquestra geração + diagnostics + rolling |
| Cache Debug | `backend/hls/debugDataCache.js` | TTL snapshots |
| Rotas Debug | `backend/routes/hlsDebug.routes.js` | Endpoints de status/cache/hypothesis |
| Smoke | `scripts/hls-smoke.cjs` | Verificação 6 estágios |
| Automação 24h | `scripts/r6-7-24h-automation.sh` | Execuções periódicas + agregação |
| Gate Final | `scripts/r6-10-gate-final.cjs` | Critérios agregados R6 |
| iOS Playback | `scripts/ios-playback-test.cjs` | Métricas lockscreen/background |
| Checklist | `devFiles/CHECKLIST-HLS-ROTATIVO.md` | Operacionalização R6 |

---
## 10. Apêndices
### Apêndice A – F1 Sync + Metadados (Resumo)
- Endpoint: `POST /api/sync-catalog?full=true` preenche `duration|title|artist` faltantes.  
- Usa `music-metadata` (ESM import dinâmico).  
- Limite lote: 20 faixas; logs `SYNC`, `META`.

### Apêndice B – Debug/Admin UI & Gestos iPhone
- Botões condicionais (staging/local) + gesto secreto (3 taps=Admin, 5=Debug) para PWA iOS.  
- Correção CSS: remoção de `!important` bloqueador; fallback via `style.setProperty(...,'important')` controlado.  
- Gesto protege acesso quando UI oculta / cache.

### Apêndice C – Duration Calculation Fix
- Problema: upload enviava `duration_*` indefinido → catálogo com 0.  
- Solução: pré-cálculo HTML5 Audio (`onloadedmetadata`) antes de montar `FormData`.  
- Parsing exibido e enviado como segundos; backend salva valor correto.

### Apêndice D – Estrutura Completa Diagnostics (Exemplo)
```json
{
  "success": true,
  "mode": "latest",
  "status": "ok",
  "playlist": {"declaredCount":16,"hasEndlist":true,"totalDurationApprox":91.437,"averageExtinf":5.71},
  "segments": {"headOkCount":3,"totalProbes":3,"timings":[16,14,19]},
  "durationMs":41,
  "thresholds":{"warnings":[],"hasWarnings":false}
}
```

### Apêndice E – Critérios Gate Final (Validados)
- 100% tasks R6 concluídas.  
- 0 falhas nas últimas 10 execuções smoke.  
- p95 diagnostics < 3000ms (44ms).  
- Nenhum 500 endpoints críticos.  
- Rollback testado + Janitor baseline registrado.  

### Apêndice F – Boundary Scheduler & Instrumentação iOS (Phase0)
- Objetivo: Garantir avanço de faixa confiável em background / screen lock no PWA iOS onde `timeupdate` é severamente reduzido.
- Estratégia: Timeupdate degradado (~2s); detecção boundary (remaining ≤3s) → dispara `onPreEnd` + agenda `onEnded` antecipado (~300ms antes fim real).
- Campos de instrumentação (audio.ts): `lastTimeUpdateTs`, `backgroundMaxGapMs`, `backgroundSuspensionDetections`, `recoveryAttemptCount`, `recoverySuccessCount`.
- Métricas Resultado (08/10): ≥300s contínuos, transitionSuccessCount ≥3, maxGapMs <1500ms, stallCount=0, nenhum `BG_STALL_DETECT`.
- Risco Residual: Rolling ainda não verificado; jitter extremo > lead window pode introduzir gap >2s (não observado). 
- Próximos Passos: Retestar Rolling; avaliar se instrumentação mantém-se ativa em produção ou sob flag.

---
## 11. Glossário Rápido
| Termo | Definição |
|-------|-----------|
| simulate | Modo seguro que evita geração real quando ffmpeg indisponível |
| rolling | Playlist janela derivada sem `#EXT-X-ENDLIST` |
| diagnostics | Análise rápida de playlist + HEAD sample segment |
| snapshot rollback | Cópia da playlist anterior para restauração |
| janitor | Módulo que remove diretórios temporários antigos/concluídos |

---
Documento reorganizado para eliminar duplicações e servir como referência objetiva pós-R6.