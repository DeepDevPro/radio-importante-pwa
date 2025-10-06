# Plano de Refatoração Segura do backend/app.js

Objetivo: reduzir o tamanho e a complexidade de `backend/app.js` preservando comportamento e endpoints atuais. Priorizar simplicidade, baixo risco e passos pequenos com capacidade de rollback.

Observação Importante: Cada etapa que altera código deve ser seguida de (1) commit, (2) deploy para staging, (3) teste rápido em staging (curl ou acesso via browser / debug page). Não faremos testes locais.

Legenda de Checkboxes:
- [ ] Tarefa pendente
- [x] Concluída (marcar manualmente após execução)

## Visão Geral de Destino
Estrutura proposta mínima:
```
backend/
  app.js (bootstrap)
  routes/
    debugLogs.routes.js
    catalog.routes.js
    upload.routes.js
    continuous.routes.js
    hlsVod.routes.js
    hlsRolling.routes.js
    hlsLogs.routes.js
  services/
    catalog.service.js
    upload.service.js
    continuous.service.js
    hlsVod.service.js
    hlsRolling.service.js
    hlsStatus.service.js
    spaces.service.js
    logging.service.js (ou embutido em state se preferir)
  utils/
    ffmpeg.js
    paths.js
    spacesClient.js
    fileIO.js
  state/
    catalogState.js
    hlsState.js
  middleware/
    cors.js
    errorHandler.js
    notFound.js
    requestLogger.js (opcional futuro)
```

## Ordem Cronológica das Etapas

### ETAPA 0 – Preparação e Segurança ✅
- [x] Confirmar branch ativa: `safepoint/pre-refactor-f3`
- [x] Criar branch de trabalho: `refactor/appjs-step1` (a partir de `safepoint/pre-refactor-f3`)
- [x] Verificar último commit hash de referência: `36d5b51`
- [x] Deploy staging (baseline) e validar endpoints principais:
  - [x] `/health` → 200 OK
  - [x] `/api/hls-rolling-status` → 200 OK
  - [x] `/hls/rolling/index.m3u8` → 200 OK (playlist exists)
  - [x] `/api/debug-logs` → 200 OK
- [x] Registrar baseline de tamanho atual de `app.js`: **2386 linhas**

Commit sugerido (após criação da branch):
`chore(refactor): start app.js refactor plan baseline`

### ETAPA 1 – Scaffold de Diretórios e README ✅
- [x] Criar diretórios: `routes/`, `services/`, `utils/`, `state/`, `middleware/`
- [x] Criar arquivo `backend/REFATORACAO_README.md` explicando a estrutura (curto)
- [x] Garantir que `app.js` permanece inalterado (apenas novos diretórios)
- [x] Deploy staging (sem mudanças funcionais) para confirmar integridade

Commit sugerido:
`refactor(step1): scaffold backend modular folders (no functional changes)`

### ETAPA 2 – Middlewares Básicos ✅
- [x] Extrair CORS inline para `middleware/cors.js`
- [x] Criar `middleware/errorHandler.js` (copiar lógica atual) e `middleware/notFound.js`
- [x] Ajustar `app.js` para usar `require('./middleware/cors')` etc.
- [x] Remover blocos originais do `app.js`
- [x] Deploy staging
- [x] Testar `/health` e rota inexistente para validar 404 + error handler
- [x] Redução: 2386 → 2365 linhas (-21 linhas)

Commit sugerido:
`refactor(step2): extract cors, notFound and error handlers from app.js`

### ETAPA 3 – Estado e Logging Centralizados
- [ ] Criar `state/catalogState.js` contendo:
  - Objeto `catalog`
  - Funções: `initializeCatalog`, `saveCatalog`, `saveCatalogToSpaces`, `loadCatalogFromSpaces`
- [ ] Criar `state/hlsState.js` contendo:
  - `hlsLogs`, `autoLogs`, `addHLSLog`, `saveAutoLog`
- [ ] Substituir referências em `app.js` por imports destes módulos
- [ ] Validar que inicialização do catálogo ainda ocorre antes do `listen`
- [ ] Deploy staging
- [ ] Testar `/api/catalog` e `/api/hls-logs`

Micropassos ETAPA 3:
#### 3.1 Limpeza inicial e estabilização
- [x] Verificar `state/catalogState.js` e `state/hlsState.js` (contêm todas as funções necessárias)
- [x] Remover bloco duplicado de catálogo e fragmento órfão de `generateContinuousFile` (código solto ~linhas 930–1060) em `backend/app.js`
- [x] Garantir que apenas estes imports de estado existam no topo do `app.js`:
  - `const { catalog, initializeCatalog, saveCatalog } = require('./state/catalogState');`
  - `const { autoLogs, saveAutoLog, hlsLogs, addHLSLog } = require('./state/hlsState');`
- [x] Rodar `node backend/app.js` (compilar sem SyntaxError)
- [x] Testar rapidamente: `/health` (200), `/api/catalog` (200), `/api/hls-logs` (200)
- [x] Commit: `refactor(step3a): cleanup duplicates & wire state modules`

> Nota 3.1: Servidor subiu sem erros. Endpoints retornaram 200. Catálogo carregado com 15 tracks. Logs HLS vazios (esperado).

#### 3.2 Inicialização e consistência
- [x] Confirmar `initializeCatalog()` chamado antes de `app.listen()` (ou adicionar)
- [x] Remover qualquer resquício de funções duplicadas (`saveCatalogToSpaces`, `loadCatalogFromSpaces`, `generateContinuousFile`) ainda presentes em `app.js`
- [x] Verificar que chamadas a `saveCatalog()` agora usam a versão importada
- [x] Commit: `refactor(step3b): ensure catalog init sequence`

> Nota 3.2: `initializeCatalog()` executa antes do listen (ver logs). Funções duplicadas removidas. Chamadas a `saveCatalog()` apontam para módulo de estado. generateContinuousFile marcado com TODO para Etapa 5.

#### 3.3 Deploy e validação
- [ ] Deploy para staging
- [ ] Smoke test: `/api/catalog`, `/api/hls-logs`, `/api/debug-logs`
- [ ] Atualizar este plano marcando ETAPA 3 concluída
- [ ] Commit: `chore(refactor): stage validation step3`

Nota: Extração e reorganização de `generateContinuousFile` ficará para a ETAPA 5 (não refatorar agora para reduzir risco).

Commit sugerido:
`refactor(step3): move catalog & HLS in-memory state + logging helpers to state modules`

### ETAPA 4 – Rotas de Debug e Catálogo
- [ ] Criar `routes/debugLogs.routes.js` com endpoints:
  - `POST /api/debug-logs`
  - `GET /api/debug-logs`
  - `GET /debug-logs/:filename`
- [ ] Criar `routes/catalog.routes.js` com endpoints:
  - `GET /api/catalog`
  - `POST /api/regenerate-catalog`
  - `POST /api/sync-catalog`
  - `POST /api/clear-catalog`
  - `PUT /api/tracks/:id/metadata`
  - `DELETE /api/delete/:id`
- [ ] Em `app.js`, montar routers (`app.use`) e remover blocos originais
- [ ] Deploy staging
- [ ] Testar endpoints de catálogo e debug logs

Commit sugerido:
`refactor(step4): extract debug log and catalog routes from app.js`

### ETAPA 5 – Upload e Continuous File
- [ ] Criar `services/upload.service.js` (separar lógica de processamento de arquivos / metadados)
- [ ] Criar `services/continuous.service.js` para `generateContinuousFile` e reutilizar upload para Spaces
- [ ] Criar `routes/upload.routes.js` com `/api/upload`
- [ ] Criar `routes/continuous.routes.js` com:
  - `POST /api/generate-continuous`
  - GETs de arquivos contínuos (`/audio/radio-importante-continuous.mp3`, aac e `/audio/hls/track-cues.json`)
- [ ] Substituir chamadas diretas em `app.js`
- [ ] Deploy staging
- [ ] Testar geração contínua e servir MP3/track-cues

Commit sugerido:
`refactor(step5): extract upload and continuous generation routes/services`

### ETAPA 6 – HLS VOD
- [ ] Criar `services/hlsStatus.service.js` (funções: `saveHLSStatus`, `getHLSStatus`)
- [ ] Criar `services/hlsVod.service.js` para `generateHLSJob`, `generateHLSFromFiles`, `uploadHLSToSpaces`, `saveManifestToSpaces`
- [ ] Criar `routes/hlsVod.routes.js` contendo:
  - `POST /api/generate-hls` (filtrando quando não for modo rolling)
  - `GET /api/hls-status`
  - `GET /hls/latest/index.m3u8`
  - `GET /hls/latest/:segment`
- [ ] Ajustar `app.js` para usar router
- [ ] Deploy staging
- [ ] Testar geração VOD + playlist + segmento

Commit sugerido:
`refactor(step6): extract HLS VOD routes and services`

### ETAPA 7 – HLS Rolling
- [ ] Criar `services/hlsRolling.service.js` (inclui `publishRollingHLS` e lógica específica rolling)
- [ ] Criar `routes/hlsRolling.routes.js` com:
  - `GET /hls/rolling/index.m3u8`
  - `GET /hls/rolling/:segment`
  - Aliases `/api/hls/rolling/index.m3u8` e `/api/hls/rolling/:segment`
  - `GET /api/hls-rolling-status`
  - `GET /api/hls-rolling-debug`
- [ ] Criar `routes/hlsLogs.routes.js` para `/api/hls-logs`, `/api/hls-logs/clear`
- [ ] Remover blocos correspondentes de `app.js`
- [ ] Deploy staging
- [ ] Testar Safari (simulateSafariHLS) e verificação de logs

Commit sugerido:
`refactor(step7): extract HLS Rolling routes and rolling publishing service`

### ETAPA 8 – Utils e Limpeza Final
- [ ] Extrair helpers FFmpeg para `utils/ffmpeg.js` (detecção e comandos padrões)
- [ ] Extrair `uploadToSpaces` + repetidos S3 para `services/spaces.service.js` ou `utils/spacesClient.js`
- [ ] Criar `utils/fileIO.js` (limpeza temp, escrita segura, gerar filelist)
- [ ] Criar `utils/paths.js` (centralizar construção de chaves Spaces HLS)
- [ ] Repassar serviços substituindo duplicações
- [ ] Deploy staging
- [ ] Verificar que `app.js` <= ~400 linhas

Commit sugerido:
`refactor(step8): consolidate shared helpers into utils and spaces service`

### ETAPA 9 – Revisão e Hardening
- [ ] Listar endpoints expostos (diff antes/depois → devem ser iguais)
- [ ] Checar logs de inicialização (sem erros novos)
- [ ] Verificar memória/estado não recriado indevidamente
- [ ] Ver teste Safari novamente para confirmar ausência de regressões de timing

Commit sugerido:
`chore(refactor): finalize app.js modularization review`

## Smoke Test Padrão Pós-Deploy (para cada etapa funcional)
- [ ] `curl -I https://<staging>/health`
- [ ] `curl -I https://<staging>/api/catalog`
- [ ] `curl -I https://<staging>/api/debug-logs`
- [ ] `curl -I https://<staging>/api/hls-rolling-status`
- [ ] (Se aplicável) `curl -I https://<staging>/hls/latest/index.m3u8`
- [ ] (Se aplicável) `curl -I https://<staging>/hls/rolling/index.m3u8`

## Riscos e Mitigação
| Risco | Mitigação |
|-------|-----------|
| Perda de estado (arrays recriados) | Centralizar em `state/` e exportar referências únicas |
| Erro de path em require | Commits pequenos + deploy imediato |
| Ordem de inicialização quebrada | Manter `initializeCatalog()` em `app.js` antes de `listen()` |
| Rotas acidentalmente renomeadas | Copiar exatamente as definições originais |
| Duplicação de função em services | Consolidar na etapa 8 |

## Critérios de Sucesso
- `app.js` reduzido em ≥70%
- Nenhuma alteração de rota pública
- Geração HLS (VOD e Rolling) funcional em staging
- Continuous MP3 acessível
- simulateSafariHLS executa sem regressões novas

## Próximo Passo Imediato
Executar ETAPA 0 e depois ETAPA 1.

(Documento a ser atualizado manualmente conforme avanço.)
