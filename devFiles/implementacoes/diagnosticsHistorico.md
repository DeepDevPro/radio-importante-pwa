# Histórico de Diagnostics HLS – Plano de Implementação (Micropassos)

> Objetivo: Persistir histórico leve das execuções de diagnostics (latest & rolling) para análise longitudinal + base para alertas.
> Alinhado com: `PLANO_EXECUCAO.md` (visão macro) e `GUIA_TECNICO_DETALHADO.md` (padrões técnicos R6).

---
## 1. Escopo e Princípios
- Persistência local simples (arquivo JSON append) – sem DB externo.
- Leitura barata: carregamento incremental ou streaming parcial se crescer.
- Não bloquear resposta do endpoint `/api/hls/:mode/diagnostics` (persistência assíncrona best‑effort).
- Respeitar freeze R6: apenas adição não invasiva.
- Facilitar futura migração para storage remoto (nome neutro, formato estável).

## 2. Artefatos Propostos
| Artefato | Caminho | Função |
|---------|---------|--------|
| Arquivo histórico | `devFiles/metrics/diagnostics-history.jsonl` | Log linha‑a‑linha (NDJSON) para append seguro |
| Módulo util | `backend/hls/diagnosticsHistory.js` | Append + leitura filtrada |
| Script resumo | `scripts/diag-history-summary.cjs` | Agrega métricas (p95, counts) |
| Script alerta | `scripts/diag-alert.cjs` | Gera sinal (exit code + log) para cron |
| Config env | `HLS_DIAG_HISTORY_MAX_LINES` | Limite linhas (ex: 5000) antes de compactar |
| Arquivo compactado | `devFiles/metrics/diagnostics-history-archive.jsonl` | Rotação manual / automática |

Formato NDJSON (cada linha JSON isolada) facilita append atômico e parsing streaming.

## 3. Estrutura de Registro (Linha JSON)
```json
{
  "ts": "2025-10-07T12:34:56.123Z",
  "mode": "latest",           // latest | rolling
  "status": "ok",             // ok | missing | partial | stalled
  "declaredCount": 16,
  "headOkCount": 3,
  "averageExtinf": 5.71,
  "totalDurationApprox": 91.437,
  "durationMs": 41,            // tempo execução diagnostics
  "warnings": 0,               // length array warnings
  "p95Sample": null,           // reservado (futuro)
  "source": "endpoint"        // endpoint | smoke | automation
}
```
Campos adicionais devem ser adicionados apenas no final para manter retrocompatibilidade.

## 4. Micropassos de Implementação
### 4.1 Util de Persistência
1. Criar arquivo `backend/hls/diagnosticsHistory.js` com funções:
   - `append(entry)` → escreve linha JSON (stringify + "\n").
   - `readLast(n)` → lê do fim (seek) – fallback: carregar tudo se pequeno.
   - `countLines()` → rápido (stream + contador) usado para rotação.
   - `rotateIfNeeded()` → se linhas > `HLS_DIAG_HISTORY_MAX_LINES`: mover atual para `*-archive.jsonl` (append) e truncar principal.
2. Garantir diretório `devFiles/metrics/` criado se ausente (fs.mkdir recursive).
3. Usar lock leve em memória (`isWriting` flag + fila simples) para evitar race.
4. Tolerância a erro: falha de escrita só loga (`HLS_DIAG_HISTORY_WRITE_FAIL`), nunca quebra fluxo.

### 4.2 Hook no Endpoint Diagnostics
1. Localizar resposta final do handler `/api/hls/:mode/diagnostics`.
2. Construir objeto `entry` com campos do JSON final.
3. Chamar `diagnosticsHistory.append(entry)` após `res.json(...)` (não antes).
4. Incluir campo `source: "endpoint"`.
5. Adicionar chamada opcional no smoke script (source: "smoke").

### 4.3 Script de Resumo
Arquivo: `scripts/diag-history-summary.cjs`:
1. Ler N (default 500) últimas linhas.
2. Calcular: total, por status, p95 de `durationMs`, média `declaredCount`, média `totalDurationApprox`.
3. Output JSON + modo tabela compacta.
4. Flags CLI:
   - `--last=300`
   - `--mode=rolling|latest|all`
   - `--format=json|table`

### 4.4 Script de Alerta
Arquivo: `scripts/diag-alert.cjs`:
1. Executar `node scripts/hls-smoke.cjs --diagnostics-only` OU chamar endpoint directly.
2. Regra de alerta (exit code != 0):
   - Últimos 5 registros: algum `status != ok` OU p95 `durationMs` > 2000ms.
3. Emitir saída:
   ```
   ALERT: diagnostics degradation (p95=2150ms, partial=1)
   ```
4. Em sucesso:
   ```
   OK: diagnostics stable (p95=44ms, all ok)
   ```
5. (Futuro) Placeholder para integração e-mail/webhook.

### 4.5 Rotação Manual (Opcional)
Script util inline dentro do módulo: `rotateIfNeeded()` chamado a cada 20 appends (contador interno modulo 20 para reduzir overhead de contagem).

## 5. Variáveis de Ambiente (Novas)
| Variável | Default | Descrição |
|----------|---------|-----------|
| `HLS_DIAG_HISTORY_MAX_LINES` | 5000 | Limite antes de rotação |
| `HLS_DIAG_HISTORY_DIR` | `devFiles/metrics` | Diretório base |

## 6. Test Plan (Sequencial)
1. Limpar diretório `devFiles/metrics` (estado base).
2. Rodar 3 chamadas a `/api/hls/latest/diagnostics` → verificar 3 linhas gravadas.
3. Introduzir 2 chamadas a `/api/hls/rolling/diagnostics` → total 5 linhas, modos distintos.
4. Rodar `node scripts/diag-history-summary.cjs --last=5 --format=table` → conferir agregados.
5. Simular status `partial` (forçar HEAD falha) e validar contagem.
6. Ajustar `HLS_DIAG_HISTORY_MAX_LINES=5`, gerar 2 execuções extras → validar rotação (arquivo principal reseta, archive cresce).
7. Rodar `node scripts/diag-alert.cjs` com todos `ok` → exit 0.
8. Forçar degradação (latência artificial >2000ms) → exit != 0.

## 7. Critérios de Aceite
- Nenhum impacto no tempo de resposta do endpoint (append assíncrono < 5ms médio).
- Arquivo cresce linha‑a‑linha sem corrupção (cada linha JSON válida).
- Rotação preserva histórico em `*-archive.jsonl`.
- Summary script gera p95 coerente com dataset manual.
- Alert script retorna exit code ≠ 0 quando regras acionadas.

## 8. Futuras Extensões (Não implementar agora)
- Compressão gzip para arquivos arquivados.
- Export semanal automático em Markdown.
- Dashboard gráfico (p95 / status breakdown) no Debug UI.
- Envio de alerta via webhook Slack / Email.

## 9. Micropassos Checklist (Execução)
| Ordem | Item | Status |
|-------|------|--------|
| 1 | Criar diretório `devFiles/metrics` | ☐ |
| 2 | Implementar `diagnosticsHistory.js` (append + rotate) | ☐ |
| 3 | Integrar append pós-resposta diagnostics endpoint | ☐ |
| 4 | Adicionar source no smoke script | ☐ |
| 5 | Criar `diag-history-summary.cjs` | ☐ |
| 6 | Criar `diag-alert.cjs` | ☐ |
| 7 | Testes manuais (casos ok/partial) | ☐ |
| 8 | Teste rotação (max=5) | ☐ |
| 9 | Documentar variáveis .env | ☐ |
| 10 | Atualizar Guia Técnico (referência nova seção) | ☐ |

## 10. Rollback Simples
- Remover integração (linha única import + chamada append).
- Apagar arquivos de histórico (sem side effects).
- Nenhum dado crítico perdido (apenas série temporal opcional).

---
Pronto para execução. Manter commits granulares: `feat(hls): add diagnostics history util`, `feat(hls): append diagnostics history`, etc.
