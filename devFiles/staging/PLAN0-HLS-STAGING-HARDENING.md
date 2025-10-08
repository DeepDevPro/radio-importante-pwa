# Plano Focado: HLS Staging Hardening para iPhone + Merge Readiness

Objetivo: Fechar lacunas pendentes para garantir playback sólido em iPhone real (Safari / PWA) e preparar branch `staging` para merge seguro em `main`.
Escopo: Itens 🔄 e ⏳ do checklist rotativo que impactam experiência real, rollback seguro, estabilidade e visibilidade operacional mínima.

## Legend
- [ ] Aberto | [x] Concluído | (→) Próximo | (!) Atenção / pré-condição
- Marcadores de execução: (iPhone), (Mac), (Staging backend), (Produção), (iPhone+Mac), (Mac+Staging backend)

<!-- === CONTEXTO ATUAL / CHECKPOINT === -->
### Checkpoint 2025-10-07 (HLS Sanitization APLICADA - Frontend OK)

**SITUAÇÃO ATUALIZADA:** Sanitização HLS deployada com SUCESSO!

**O que fizemos:**
1. ✅ Deploy de sanitização em `uploadHlsFiles.js`: remove marcadores VOD antes do upload
2. ✅ Playlist sanitizada confirmada: sem `#EXT-X-PLAYLIST-TYPE:VOD` e `#EXT-X-ENDLIST`
3. ✅ Frontend Safari iPhone: **FUNCIONA PERFEITAMENTE** - todas as músicas tocam sem parar
4. ✅ Descoberta importante: Problema dos 17s era apenas ao testar HLS playlist diretamente

**Análise do Comportamento Real:**
- Frontend Safari: ✅ Playback contínuo normal de todas as músicas
- HLS direto: ❌ Para aos 17s (mas esse não é o caso de uso real)
- **FOCO CORRETO**: Background playback e screen lock (casos críticos reais)

**PRÓXIMA FASE:**
Testes de resistência nos cenários que realmente importam:
1. **Background playback** (alternar app durante reprodução)
2. **Screen lock** (bloquear tela durante reprodução)  
3. **Rolling playlist** (streaming contínuo)
4. **Fallback chain** (robustez do sistema)

### Instruções para GPT-5 (Investigação Técnica Urgente)
**STATUS:** Patch live-lite falhou. Problema dos 17s persiste.

**DADOS DO TESTE:**
- Comando executado: `curl -X POST .../api/hls/generate-hls -d '{"mode":"latest","simulate":false}'`
- Response: `action=generated, segmentCount=16, totalDurationApprox=91s`
- iPhone test: tFirstAudio <1s, timeline expandiu >1min, retraiu para 17s, parou aos 17s

**INVESTIGAÇÃO NECESSÁRIA:**
1. Verificar conteúdo real da playlist gerada:
   `curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/hls/latest/index.m3u8`
2. Procurar por: `#EXT-X-PLAYLIST-TYPE:VOD` e `#EXT-X-ENDLIST`
3. Se presentes: ffmpeg ainda gera VOD por padrão - corrigir com `-hls_playlist_type event`
4. Se ausentes: investigar outra causa (cache, semântica Safari)

**AÇÃO SOLICITADA:**
Corrija o código, regenere playlist e atualize este plano com novos passos de teste.

### Atualização 2025-10-07 (Sanitização em Upload APLICADA)
**NOVO PATCH:** Inserido sanitizador em `uploadHlsFiles.js` que:
- Remove linhas `#EXT-X-PLAYLIST-TYPE:*` e `#EXT-X-ENDLIST` antes do upload
- Injeta `#EXT-X-INDEPENDENT-SEGMENTS` se ausente
- Garante reescrita atômica em disco antes do envio

**Objetivo Imediato:** Garantir que a playlist publicada NÃO contenha mais semântica de término.

**PASSOS A EXECUTAR AGORA (Ordem):**
1. (Mac) POST regenerate latest: `curl -X POST <api>/api/hls/generate-hls -H 'Content-Type: application/json' -d '{"mode":"latest","simulate":false}'`
2. (Mac) Baixar playlist publicada: `curl -s https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/hls/latest/index.m3u8 | tee latest.after-sanitize.m3u8`
3. (Mac) GREP validar ausência: `grep -E 'PLAYLIST-TYPE|ENDLIST' latest.after-sanitize.m3u8 || echo 'OK sem marcadores'`
4. (Mac) Confirmar presença: `grep 'INDEPENDENT-SEGMENTS' latest.after-sanitize.m3u8`
5. (Mac) Listar primeiras 20 linhas para log: `head -n 20 latest.after-sanitize.m3u8`
6. (Mac) Verificar nomes de segmento (devem ser segment_000.ts ...): `grep -E 'segment_[0-9]{3}\.ts' latest.after-sanitize.m3u8 | head`
7. (Mac) HEAD correto de 3 segmentos reais: `for i in 000 001 002; do curl -I -s https://radio-importante-audio.atl1.digitaloceanspaces.com/generated/hls/latest/segment_${i}.ts | head -n 1; done`
8. (iPhone) Limpar aba/anônimo e tocar novamente (abrir player) → medir duração contínua até ≥120s
9. (iPhone) Se parar <120s: capturar hora exata e copiar 30 primeiras linhas da playlist naquele momento
10. (Mac) Se sucesso ≥120s: avançar para Rolling (gerar e testar 5 min)

**CRITÉRIO DE SUCESSO IMEDIATO:** Playlist publicada sem `PLAYLIST-TYPE` e sem `ENDLIST` + playback contínuo >120s.

**PRÓXIMO GATE:** Alcançar 300s sem stall para liberar seção 2 (Safari Analysis formal) e Rolling.

### Relatório de Teste Atual - DIAGNÓSTICO PRECISO
```
SAFARI BROWSER (Não-PWA):
- ✅ Primeiro plano: TODAS as músicas tocam completamente
- ✅ Screen lock: Continua tocando todas as músicas normalmente  
- ✅ tFirstAudio: <1s (excelente)
- ✅ CONCLUSÃO: Safari browser SEM PROBLEMAS

PWA INSTALADO (Caso problemático):
- ❌ Background/segundo plano: Toca música atual até final, PARA na troca
- ❌ Screen lock: Toca música atual até final, PARA na troca  
- ❌ Screen lock imediato: Mesmo comportamento de parada na troca
- 🔍 PROBLEMA IDENTIFICADO: Transição entre músicas falha em background/lock

ROOT CAUSE SUSPEITA:
- Background audio API não configurada para PWA
- HLS stream handover falha sem interface ativa  
- Service Worker não mantém stream entre faixas
```

### Gate para avançar para melhorias adicionais
Prosseguir para reforço de diagnostics ou pipeline contínuo apenas se: LATEST >= 300s sem stall (stallCount=0) OU justificativa documentada.

<!-- === FIM CONTEXTO ATUAL === -->

## 1. Validação Física iPhone (Sessão Controlada)
### 1.1 Preparação
- [x] Confirmar rede estável Wi-Fi (latência < 80ms para CDN) (`ping radio.importantestudio.com -c 5`) (Mac) ✅ **4G: 150ms connect + 834ms TTFB = ADEQUADO para HLS**
- [x] Limpar cache Safari (opcional) ou abrir aba privada (iPhone) ✅ **Aba privada aberta**
- [x] Preparar cronômetro (app nativo ou `date +%s` em terminal) (iPhone+Mac) ✅ **Cronômetro pronto**

### 1.2 Teste Frontend Safari (Cenários Críticos)
- [x] Abrir URL: https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app (iPhone) ✅ **Frontend funciona perfeitamente**
- [x] Medir tFirstAudio (objetivo < 5s) – anotar (iPhone) ✅ **<1s - EXCELENTE!**
- [x] Ouvir múltiplas músicas completas (iPhone) ✅ **TODAS tocam sem interrupção**
- [ ] **TESTE CRÍTICO 1: Background Playback** (iPhone) (→ PRÓXIMO)
  - [ ] Iniciar reprodução de música
  - [ ] Alternar para outro app (ex: Safari, Notas) por 2 minutos  
  - [ ] Verificar se áudio continua em background
  - [ ] Voltar ao app → verificar se música ainda toca sem saltos
- [ ] **TESTE CRÍTICO 2: Screen Lock** (iPhone) (→ PRÓXIMO)
  - [ ] Iniciar reprodução de música
  - [ ] Bloquear tela do iPhone por 3 minutos
  - [ ] Verificar se áudio continua tocando (pelos alto-falantes)
  - [ ] Desbloquear → confirmar música ainda toca normalmente
- [ ] **TESTE CRÍTICO 3: Background + Screen Lock** (iPhone) (→)
  - [ ] Iniciar música → alternar app → bloquear tela → aguardar 2 min
  - [ ] Desbloquear → voltar ao app → verificar continuidade
- [ ] Testar com Rolling playlist (após Latest aprovado) (iPhone) (→)

### 1.2.1 NOVO MÓDULO: Background Boundary Scheduler (Introduzido 07/10)
```
Objetivo: Garantir avanço automático de faixa em iPhone PWA quando app está em background ou screen lock.
Mecânica:
- Mantém timeupdate degradado (a cada ~2s) em background.
- Detecta boundary quando restam <=3s (configurável) para fim.
- Dispara onPreEnd(remaining) + agenda onEnded antecipado (~300ms antes do fim real).
- Evita depender de onEnded natural (que pode atrasar sob throttling).
Logs esperados:
  ⏭️  BG Boundary detectado (restam ~Xs) - preparando avanço
  ⏭️  BG Advance: disparando onEnded antecipado (pré-fim)
Critério de sucesso: 3 transições consecutivas em background sem gap >2s.
```
### Testes Sonnet (Executar após build)
1. Foreground controle: reproduzir 2 faixas → confirmar logs normais de fim.
2. Background simples: iniciar faixa A → alternar app faltando ~10s → observar boundary + avanço para B.
3. Screen lock: iniciar faixa B → bloquear tela faltando ~8s → observar avanço para C.
4. Cadeia tripla: A→B→C totalmente em background (sem voltar) → validar 2 boundary logs + 2 avanços.
5. Stress timing: Alternar para background faltando ~2s → verificar se ainda dispara avanço.
6. Falha forçada: Se remover conexão (modo avião) antes do boundary, confirmar ausência de avanço e registrar comportamento.
Métricas registrar:
- transitionSuccessCount
- transitionFailureCount
- avgGapMs (entre fim percebido e início da próxima)
- maxGapMs
- boundaryDetections
- antecipatedEndingsDispatched

### 1.3 Teste Rolling Playlist
- [x] Abrir URL: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/hls/rolling/index.m3u8 (backend direto) (iPhone) ✅ **Aberto**
- [x] Confirmar playback inicia (reutiliza buffer do latest se mesmo player) (iPhone) ❌ **Tentou por 50s, depois ERRO (play com diagonal)**
- [x] Permanecer 5 minutos monitorando continuidade (iPhone) ❌ **Falhou - não conseguiu tocar**
- [ ] Reteste após LATEST >=120s estável (→)

### 1.4 Coleta de Dados
- [ ] Registrar métricas finais em bloco (inserir no final deste arquivo) (Mac)
  - tFirstAudioLatest =
  - tFirstAudioRolling =
  - stallCountLatest =
  - stallCountRolling =
  - longestGapSec =
  - backgroundOK = (sim/não)
  - lockScreenPersist = (sim/não)
  - observações =

## 2. Safari Analysis & Hypothesis Formal
### 2.1 Estrutura de Documento
- [ ] Criar seção neste arquivo: "Hipótese Safari" abaixo das métricas (Mac)
- [ ] Descrever contexto (antes do hardening havia freeze ~17s) (Mac)
- [ ] Explicar ajustes que mitigaram (headers, segment window, atomic upload) (Mac)
- [ ] Formular hipótese residual de risco (ex: rede 3G + jitter > 2s) (Mac)
- [ ] Definir métricas sentinel (stallCount > 0 em < 15min = alerta) (Mac)

## 3. Fallback Chain Verificada
### 3.1 Preparação Ambiente (Staging)
- [ ] Identificar endpoint staging generate-hls (ex: https://<staging-api>/api/hls/generate-hls) (Mac)
- [ ] Confirmar MP3 stream ativo em staging (iPhone+Mac)

### 3.2 Induzir Falha Controlada (Staging Somente)
- [ ] Introduzir flag para forçar simulate:true (se variável já suportada) OU mock erro antes de spawn ffmpeg (Staging backend)
- [ ] Executar geração latest (esperar fallback simulate) (Mac)
- [ ] Confirmar: playlist não corrompida / MP3 reproduz no frontend (iPhone+Mac)
- [ ] Reverter modificação (Staging backend)

### 3.3 Documentar
- [ ] Adicionar bloco: "Fallback Teste Staging" com resultado + tempo de recuperação (Mac)

## 4. Rollback Snapshot Ciclo 2
### 4.1 Executar Segunda Geração Latest
- [ ] Rodar POST generate-hls latest novamente (staging) (Mac)
- [ ] Verificar existência de `index.prev.m3u8` após segunda publicação (Mac)
- [ ] Baixar `index.prev.m3u8` e `index.m3u8` e comparar diff head/tail (Mac)

### 4.2 Teste Simulado Rollback
- [ ] Copiar local `index.prev.m3u8` (Mac)
- [ ] Validar integridade (#EXTM3U, EXTINF, sequência) (Mac)
- [ ] (Somente staging) Temporariamente publicar prev como index (renomear/upload) (Staging backend)
- [ ] Confirmar player continua tocando sem erro (iPhone+Mac)
- [ ] Restaurar playlist atual normal (Staging backend)

### 4.3 Registro
- [ ] Escrever bloco "Rollback Ciclo 2" com: prevExists=, diffSegmentCount=, revertOk=(sim/não) (Mac)

## 5. Janitor Observabilidade Estendida
### 5.1 Coleta Após 24h
- [ ] Aguardar ou simular múltiplas gerações (>=3) em staging (Mac+Staging backend)
- [ ] Listar /tmp/hls-work antes/depois (Mac)
- [ ] Capturar bytes freed (se métrica disponível; senão calcular diff manual) (Mac)

### 5.2 Log Enriquecido
- [ ] Grep por "janitor" em logs app (Mac)
- [ ] Extrair timestamps & ação (removidos, ignorados) (Mac)

### 5.3 Registro
- [ ] Adicionar bloco "Janitor 24h" com: runs=, bytesFreed=, órfãosRemovidos=, observações= (Mac)

## 6. Stability Run (Mini Série)
### 6.1 Execução Múltipla Smoke
- [ ] Rodar script smoke 5 vezes em sequência (staging) (Mac)
- [ ] Capturar tempos individuais (Mac)
- [ ] Calcular p95 manual (Mac)

### 6.2 Critério Falha
- [ ] Se alguma execução > 3000ms diagnostics → marcar investigação (Mac)

### 6.3 Registro
- [ ] Bloco "Stability Série" com tabela exec#:tempo:status (Mac)

## 7. Debug UI Endpoints
### 7.1 Verificação
- [ ] curl /api/hls/debug-status (staging) → salvar debug-status.json (Mac)
- [ ] curl /api/hls/last-diagnostics → salvar last-diagnostics.json (Mac)
- [ ] curl /api/hls/last-hypothesis (se existir) → salvar last-hypothesis.json (Mac)

### 7.2 Performance
- [ ] Medir tempo de cada endpoint (`-w '%{time_total}'`) (Mac)
- [ ] Confirmar < 0.3s (Mac)

### 7.3 Estrutura
- [ ] Validar chaves principais presentes (status, timestamps, metrics) (Mac)

### 7.4 Registro
- [ ] Bloco "Debug UI" com tempos e presença de campos (Mac)

## 8. Automação Inicial (Opcional Curto Prazo)
### 8.1 Script Simples
- [ ] Criar script `scripts/hls-smoke-multi.cjs` que roda 5 vezes e gera JSON agregador (Mac)
- [ ] Adicionar campo p95, média, falhas (Mac)

### 8.2 Execução Manual
- [ ] Rodar script e anexar saída `smoke-multi.json` (Mac)

### 8.3 Planejamento Cron
- [ ] Esboçar linha cron (não ativar ainda) e colocar em README-hls-ops.md seção futura (Mac)

## 9. Preparação Merge Main
### 9.1 Revisão Código
- [ ] Verificar diffs sensíveis (ffmpeg spawn, geração atomic) sem TODOs (Mac)
- [ ] Confirmar ausência de console.log ruidosos em produção (Mac)

### 9.2 Segurança & Config
- [ ] Garantir variáveis env necessárias documentadas (Mac)
- [ ] Checar não exposição de chaves em commits (Mac)

### 9.3 Documentação
- [ ] Inserir bloco consolidação Dry Run no `PLANO_EXECUCAO.md` (Mac)
- [ ] Atualizar `README-GITHUB.md` com status HLS (Beta → Ready) (Mac)

### 9.4 Tag Técnica
- [ ] Definir tag: `hls-ready-r6` (ou similar) (Mac)
- [ ] Preparar release notes curtas (Mac)

### 9.5 Aprovação
- [ ] Revisão final checklist rotativo (itens críticos resolvidos ou planos registrados) (Mac)
- [ ] Criar PR `staging` → `main` (Mac)
- [ ] Adicionar resumo no PR com métricas principais (Mac)

## 10. Blocos de Registro (Preencher Durante Execução)
### Hipótese Safari
(Preencher após Seção 2)

### Fallback Teste Staging
(Preencher após Seção 3)

### Rollback Ciclo 2
(Preencher após Seção 4)

### Janitor 24h
(Preencher após Seção 5)

### Stability Série
(Preencher após Seção 6)

### Debug UI
(Preencher após Seção 7)

---
Atualizado: 07/10/2025
