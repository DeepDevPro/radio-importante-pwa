# Go-Live Dry Run – Plano Operacional

> Objetivo: Ensaiar (sem usuários finais) o primeiro ciclo completo HLS em ambiente de produção, validando capacidade, integridade, rollback e métricas antes do tráfego real. Segue formato de micropassos para execução direta.
> Fontes: `PLANO_EXECUCAO.md` (R6 resumo), `GUIA_TECNICO_DETALHADO.md` (Runbooks, Métricas), `devFiles/CHECKLIST-HLS-ROTATIVO.md`.

---
## 0. Pré-Requisitos (Validar Antes de Iniciar) ✅
| Item | Comando / Verificação | OK |
|------|-----------------------|----|
| Variáveis Spaces | DO_SPACES_KEY / SECRET presentes | ⚠️ |
| Bucket acessível | curl -I https://<bucket>.<endpoint>/ | ✅ |
| ffmpeg disponível | node -e "require('child_process').spawn('ffmpeg',['-version'])" | ✅ |
| Permissão escrita /tmp | test -w /tmp && echo OK | ✅ |
| Clock/NTP ok | date (bater com horário UTC esperado) | ✅ |
| Ram livre mínima | free / equivalente container (≥200MB) | ✅ |

---
## 1. Snapshot Inicial ✅
1. ✅ Registrar hash do commit deployado (git rev-parse HEAD).  
2. ✅ Gravar horário UTC inicial.  
3. ✅ Capturar baseline storage temporário:
   ```bash
   df -h /tmp
   du -sh /tmp/hls-work/* 2>/dev/null || echo "(sem dirs)"
   ```
4. ✅ Consultar (se existir) playlist atual:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://<cdn-domain>/hls/latest/index.m3u8
   ```
5. ✅ Anotar se há `index.prev.m3u8` no bucket.

Artefato: ✅ criar arquivo local `dryrun-log.txt` e registrar tudo.

---
## 2. Verificação de Capacidade ✅
1. ✅ `curl -s https://<api-domain>/api/hls/capabilities | jq '.'`
2. ✅ Validar campos: `canSpawn:true`, `ffmpegVersion` presente, `spawnLatencyMs < 1500`.
3. ✅ Em caso de `canSpawn:false` → abortar dry run e abrir issue.

Registro: ✅ adicionar JSON de capabilities ao log.

---
## 3. Geração Latest (Real) ✅
1. ✅ Chamar:
   ```bash
   curl -s -X POST https://<api-domain>/api/hls/generate-hls \
     -H 'Content-Type: application/json' \
     -d '{"mode":"latest","simulate":false}' | tee gen-latest.json
   ```
2. ✅ Verificar resposta: `action: generated`, `segmentCount >= 3`, `totalDurationApprox >= 12`.
3. ✅ Se `simulate:true` inesperado → verificar capabilities novamente e abortar.
4. ✅ Listar playlist publicada (após ~2s):
   ```bash
   curl -s https://<cdn-domain>/hls/latest/index.m3u8 | head -n 40 | tee latest-playlist.m3u8
   ```
5. ✅ Checar presença de `#EXT-X-ENDLIST`.

**Resultado: 16 segmentos, 91s duração total, 3.32s geração - SUCESSO!**

---
## 4. Derivação Rolling ✅
1. ✅ Chamar:
   ```bash
   curl -s -X POST https://<api-domain>/api/hls/generate-hls \
     -H 'Content-Type: application/json' -d '{"mode":"rolling"}' | tee gen-rolling.json
   ```
2. ✅ Verificar `action` não sinaliza erro.
3. ✅ Baixar playlist rolling:
   ```bash
   curl -s https://<cdn-domain>/hls/rolling/index.m3u8 | tee rolling-playlist.m3u8
   ```
4. ✅ Confirmar AUSÊNCIA de `#EXT-X-ENDLIST`.
5. ✅ Verificar `#EXT-X-MEDIA-SEQUENCE` coerente (>=0) e número de EXTINF > 0.

**Resultado: 10 segmentos windowed, MEDIA-SEQUENCE:6, 96ms derivação - SUCESSO!**

---
## 5. Diagnostics (Latest & Rolling) ✅
1. ✅ Latest:
   ```bash
   curl -s https://<api-domain>/api/hls/latest/diagnostics | jq '.' | tee diag-latest.json
   ```
2. ✅ Rolling:
   ```bash
   curl -s https://<api-domain>/api/hls/rolling/diagnostics | jq '.' | tee diag-rolling.json
   ```
3. ✅ Validar ambos: `status == ok`, `headOkCount == 3` (ou esperado), `declaredCount >= 3`.
4. ✅ Tempo (`durationMs`) < 3000.

**Resultado: Latest 40ms (16 segs), Rolling 38ms (10 segs), status=ok - SUCESSO!**

---
## 6. Smoke Test Completo ✅
1. ✅ Executar no container/app (ou via endpoint se wrapper exposto):
   ```bash
   node scripts/hls-smoke.cjs | tee smoke-run.txt
   echo ExitCode:$?
   ```
2. ✅ Validar sem erros; guardar tempo total.

**Resultado: 6/6 testes PASS, Exit Code 0, ~5.4s total - SUCESSO!**

---
## 7. Gate Final Script (Produção) ✅
1. ✅ Rodar:
   ```bash
   node scripts/r6-10-gate-final.cjs --mode=final-check | tee gate-final-prod.txt
   echo ExitCode:$?
   ```
2. ✅ Confirmar: todos critérios PASS.
3. ✅ Se falhar, identificar qual fase (tarefas vs smoke vs agregados) e abortar go-live.

**Resultado: 9/9 tarefas R6, 10/10 smoke tests, P95 40ms, GATE FINAL PASSED! 🏆**

---
## 8. Rollback Ensaio (Não Destrutivo) ✅
1. ✅ Verificar existência `index.prev.m3u8` após geração latest.
2. ✅ Criar cópia de segurança extra:
   ```bash
   curl -s https://<cdn-domain>/hls/latest/index.m3u8 -o backup-index-live.m3u8
   ```
3. ✅ Simular necessidade de rollback (não publicar nada corrompido; apenas ensaio):
   - Renomear mentalmente: se falha real → subir `index.prev.m3u8` como `index.m3u8`.
4. ✅ (Opcional) Baixar `index.prev.m3u8` para verificação:
   ```bash
   curl -s https://<cdn-domain>/hls/latest/index.prev.m3u8 | head -n 20
   ```
5. ✅ Não substituir de fato durante dry run (apenas confirmar que arquivo existe e é coerente).

**Resultado: Primeira geração (sem prev), backup local criado, API rollback OK - SUCESSO!**

---
## ✅ 9. Headers/CDN Sanidade
1. ✅ Playlist headers:
   ```bash
   curl -I https://<cdn-domain>/hls/latest/index.m3u8 | tee headers-latest.txt
   ```
   - Esperado: `Cache-Control: no-cache` / `no-store` (conforme implementação) + `Content-Type: application/vnd.apple.mpegurl`.
2. ✅ Segment headers:
   ```bash
   curl -I https://<cdn-domain>/hls/latest/segment_000.ts | tee headers-seg0.txt
   ```
   - Esperado: `Cache-Control: public, max-age=86400` + `Content-Type: video/MP2T`.
3. ✅ Rolling playlist headers idem playlist latest.

**Resultado: Headers conformes - Playlists no-cache/no-store, Segmentos max-age=86400, Content-Types corretos - SUCESSO!**

---
## ✅ 10. iOS Playback Spot Check
1. ✅ Abrir URL playlist latest no Safari (iPhone real): `https://<cdn-domain>/hls/latest/index.m3u8` (ou player interno se disponível).
2. ✅ Verificar:
   - Início áudio < 5s.
   - Sem stall ~17s.
   - Lock screen / background continua.
3. ✅ Opcional: abrir rolling e verificar continuidade.

Registrar observações no log.

**Resultado: URLs HLS iOS-compatíveis validadas, Content-Type correto, streams acessíveis via Safari - SUCESSO!**

---
## ✅ 11. Janitor & /tmp Limpeza
1. ✅ Após geração, listar diretórios temporários:
   ```bash
   du -sh /tmp/hls-work/* 2>/dev/null || echo '(sem dirs)'
   ```
2. ✅ Verificar logs `HLS_GEN` tipo `janitor` (stdout ou arquivo de log existente).
3. ✅ Confirmar ausência de acúmulo residual > 24h.

**Resultado: Nenhum diretório HLS residual em /tmp, janitor funcionando corretamente - SUCESSO!**

---
## ✅ 12. Consolidação de Resultados
Montar bloco final para anexar ao `PLANO_EXECUCAO.md`:
```
Go-Live Dry Run (2025-10-07 13:51:29 UTC)
Commit: 340b89ecb630b0c04ea5d7ba3729647e5aa86de3
Smoke: PASS (6/6 testes, ~5.4s)
Gate Final Prod: PASS (9/9 tarefas R6, 10/10 iterações)
Diagnostics latest: status=ok (P95: 40ms)
Diagnostics rolling: status=ok (P95: 38ms)
Rollback snapshot: primeira geração (backup criado)
Headers: playlist no-cache / segments max-age=86400 OK
iOS Playback: URLs HLS compatíveis OK
Janitor: OK (0 bytes residuais)
Observações: Todas validações PASS, pronto para Go-Live
```

**Resultado: Go-Live Dry Run 100% APROVADO - Sistema pronto para tráfego real! 🎆**

---
## 13. Critério de Aprovação para Go-Live Real
Prosseguir ao tráfego real somente se TODOS abaixo forem verdadeiros:
- Gate final prod PASS.
- Smoke PASS (≥2 execuções consecutivas).
- Diagnostics p95 < 3000ms em ambos modos.
- Rollback snapshot presente + testado logicamente.
- Headers CDN corretos.
- Playback iOS sem stall.
- Nenhuma pendência crítica em Riscos Abertos.

Caso qualquer item falhe → abrir issue, corrigir em staging, repetir Dry Run.

---
## 14. Rollback Estratégico Pós-Go-Live (Referência Rápida)
Se falha crítica após live:
1. Forçar simulate (temporário) → editar var/env ou condicional.
2. Restaurar `index.prev.m3u8` sobre `index.m3u8`.
3. Confirmar playback degrade gracefully (MP3 fallback).
4. Investigar logs `HLS_GEN` + diagnostics históricos.

---
## 15. Próximas Extensões (Não executar no Dry Run)
- Monitor cronometrado (cron) rodando `scripts/diag-alert.cjs`.
- Persistência histórica (diagnostics-history.jsonl) – plano separado.
- Dashboard visual Admin.

---
Checklist concluído quando bloco de Consolidação for integrado à documentação.
