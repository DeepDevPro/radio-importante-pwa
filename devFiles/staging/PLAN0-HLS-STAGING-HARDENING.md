# Plano Focado: HLS Staging Hardening para iPhone + Merge Readiness

Objetivo: Fechar lacunas pendentes para garantir playback sólido em iPhone real (Safari / PWA) e preparar branch `staging` para merge seguro em `main`.
Escopo: Itens 🔄 e ⏳ do checklist rotativo que impactam experiência real, rollback seguro, estabilidade e visibilidade operacional mínima.

## Legend
- [ ] Aberto | [x] Concluído | (→) Próximo | (!) Atenção / pré-condição
- Marcadores de execução: (iPhone), (Mac), (Staging backend), (Produção), (iPhone+Mac), (Mac+Staging backend)

**⚠️ REGRA IMPORTANTE: TODOS OS TESTES DEVEM SER EXECUTADOS NO AMBIENTE STAGING EM PRODUÇÃO, NÃO LOCAL**

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
- HLS direto: ❌ Para aos 17s (diagnóstico apenas, não caso de uso real)
- **FOCO CORRETO**: Background playback e screen lock (casos críticos reais)

**Estado Pós-Sanitização (Consolidado):**
- Playlist live-like confirmada (sem `PLAYLIST-TYPE` / `ENDLIST`).
- Caso real foreground (Safari / PWA): estável.
- Problema remanescente (antes do scheduler): avanço de faixa falhava somente em background / screen lock.

**Causa Raiz (identificada para falha de transição em background):**
- Supressão total de `timeupdate` em background (nenhum sinal de fim iminente).
- Ausência de scheduler / boundary detection → dependência exclusiva de `onEnded` natural (tardiamente ou sob throttling).
- Sem pré-aviso (pré-fim) nem disparo antecipado controlado.

**Mitigação Aplicada (Scheduler):**
- Timeupdate degradado permitido (≈ cada 2s) em background.
- Boundary detection (restam ≤3s) dispara `onPreEnd` e agenda `onEnded` antecipado (~300ms antes do fim real).
- Objetivo: reduzir gap entre término percebido e início da próxima faixa a < 2s continuamente.

**Próximo Objetivo Imediato:**
- Validar 3+ transições consecutivas em background (e lock) com gap ≤ 2000ms.

**Gate Atual Único:**
- (OBSOLETO - SUBSTITUÍDO) Só avançar para Rolling + análises formais (Seções 2–4) após validação acima ou documentação de exceção.

### Checkpoint 2025-10-07 (Background 300s Gate ATINGIDO)
**NOVO ESTADO:** Playback PWA em background validado ≥300s contínuos com ≥3 transições consecutivas sem stall.

**Evidências Rápidas:**
- transitionSuccessCount ≥ 3 (sem falhas)
- maxGapMs < 1500ms (todas transições suaves)
- stallCountLatest (background) = 0
- Nenhum log BG_STALL_DETECT
- Screen lock continua estável (sem regressão)

**Decisão:** Gate liberado para:
- Reteste Rolling playlist (5 min)
- Iniciar Seção 2 (Hipótese Safari) formal
- Planejar Fallback Chain (Seção 3)

**Risco Residual:** Rolling ainda não validado (falhou antes). Necessário confirmar inicialização agora com baseline estável.

**Próximos Objetivos Imediatos (Atualizados):**
1. (iPhone) Retestar Rolling playlist (≥5 min) – se falhar, coletar causa (status, erros console, cabeçalhos)
2. (Mac) Preencher Seção 2 "Hipótese Safari" (formalizar riscos remanescentes)
3. (Mac) Planejar teste Fallback Chain (Seção 3)
4. (Mac) Preparar Rollback Snapshot Ciclo 2 (Seção 4)

### Relatório de Teste Atual - DIAGNÓSTICO PRECISO ATUALIZADO
```
SAFARI BROWSER (Não-PWA):
- ✅ Primeiro plano: TODAS as músicas tocam completamente
- ✅ Screen lock: Continua tocando todas as músicas normalmente  
- ✅ Background: Continua tocando >5min sem problemas
- ✅ tFirstAudio: <1s (excelente)
- ✅ CONCLUSÃO: Safari browser PERFEITO em todos os cenários

PWA INSTALADO (Estado Atual Estável):
- ✅ Primeiro plano: TODAS as músicas tocam sem interrupção
- ✅ Screen lock: FUNCIONOU! >5min, sem gaps, troca faixas corretamente  
- ✅ Background/segundo plano: Agora ESTÁVEL ≥300s com múltiplas transições
- 🟡 Rolling playlist: A VALIDAR (falhou em tentativa anterior)
- 🔍 FOCO ATUAL: Rolling + formalização de hipótese / fallback / rollback

ROOT CAUSE (ANTIGA) REFINADA (RESOLVIDA NO CENÁRIO LATEST):
- Suspend context após 60–120s: não mais reproduzido no teste prolongado atual
- Scheduler + condições atuais suficientes para manter continuidade
- Próximos refinamentos (se necessários) só após Rolling e fallback pipeline
```

### Gate para avançar para melhorias adicionais
- (ATUALIZAÇÃO) Gate 300s cumprido. Próximo gate: Rolling playlist estável 5 min (sem erro de inicialização) OU diagnóstico formal documentado.

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
- [x] **TESTE CRÍTICO 1: Background Playback** (iPhone) ✅🔴 **PARCIAL**
  - [x] Safari: ✅ **PERFEITO** - continua >2min sem problemas
  - [x] PWA: 🔴 **PROBLEMA** - toca até fim da música atual + próxima, depois PARA
- [x] **TESTE CRÍTICO 2: Screen Lock** (iPhone) ✅ **SUCESSO TOTAL**
  - [x] Safari: ✅ **PERFEITO** - >3min, troca faixas normalmente  
  - [x] PWA: ✅ **FUNCIONOU!** - >3min, sem gaps, troca faixas corretamente
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

### 1.4 Coleta de Dados - MÉTRICAS COLETADAS
**Registrar métricas finais em bloco (Atualizado):**
- **tFirstAudioLatest** = <1s
- **tFirstAudioRolling** = (reteste pendente)
- **stallCountLatest** = 0 (foreground), 0 (screen lock), 0 (background ≥300s)
- **stallCountRolling** = pendente
- **longestGapSec** = ~0s (todas transições suaves)
- **backgroundOK** = Safari: SIM, PWA: SIM
- **lockScreenPersist** = Safari: SIM, PWA: SIM ✅
- **observações** = Background estabilizado; Rolling ainda precisa reteste

**TRANSIÇÕES BACKGROUND PWA (Sessão Estável):**
- transitionSuccessCount = ≥3
- transitionFailureCount = 0
- avgGapMs ≈ <600ms
- maxGapMs < 1500ms
- boundaryDetections = consistente (cada faixa)
- antecipatedEndingsDispatched = 1 por faixa (esperado)

**GATE STATUS:** Screen lock ✅ / Background ✅ / Rolling ⏳

## 2. Safari Analysis & Hypothesis Formal
### 2.1 Estrutura de Documento
- [ ] Criar seção neste arquivo: "Hipótese Safari" abaixo das métricas (Mac)
- [ ] Descrever contexto (antes do hardening havia freeze ~17s) (Mac)
- [ ] Explicar ajustes que mitigaram (headers, segment window, atomic upload) (Mac)
- [ ] Formular hipótese residual de risco (ex: rede 3G + jitter > 2s) (Mac)
- [ ] Definir métricas sentinel (stallCount > 0 em < 15min = alerta) (Mac)

### Hipótese Safari (INICIAL - RASCUNHO)
Contexto: Antes da sanitização HLS ocorria parada ~17s ao usar playlist direta (VOD semantics). Após remoção de marcadores VOD + ENDLIST e injeção INDEPENDENT-SEGMENTS, comportamento em Safari/PWA normalizou.

Ajustes mitigadores já aplicados:
- Remoção marcadores VOD (#EXT-X-PLAYLIST-TYPE, #EXT-X-ENDLIST)
- Upload atômico + janela consistente de segmentos
- Boundary Scheduler (antecipação de onEnded)

Hipótese Residual de Risco:
- Rede degradada (jitter > 2500ms) pode atrasar carregamento do próximo segmento e ultrapassar lead do scheduler.
- Rolling playlist pode introduzir latência extra se indices ou nomes divergirem na troca de contexto.

Sentinelas Propostas:
- stallCountLatest > 0 em < 15min ⇒ ALERTA
- avgGapMs > 2000ms em ≥2 transições ⇒ INVESTIGAR
- transitionFailureCount > 0 após estabilização inicial ⇒ INVESTIGAR

Ações se Sentinela Dispara:
1. Capturar playlist atual + timestamps EXTINF.
2. Registrar latência rede (ping + curl -w time_total em 2 segmentos).
3. Verificar logs de scheduler (faltou boundary?).
4. Se AudioContext suspenso: tentar resume() e log.

Próximo Passo: Validar Rolling antes de concluir seção final.

---
Atualizado: 07/10/2025
