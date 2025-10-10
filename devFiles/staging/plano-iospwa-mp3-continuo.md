# Plano de Migração: iOS PWA → MP3- [ ] Ordem segura das etapas:
  - [x] Etapa 1 (Design) – sem código ✅
  - [x] Etapa 2 (Scripts locais) ✅
  - [x] Etapa 3 (Upload/CORS no Micropassos:
- [x] Em `src/player/audio.ts`, substituir `tryEnableHLSForIPhone/loadHLSForIOSPWA` por lógica "contínuo apenas":
  - Fetch de `${BACKEND_STAGING}/audio/continuous/track-cues.json`.
  - `audio.src = ${BACKEND_STAGING}/audio/continuous/radio-importante-continuous.mp3`.
  - Em produção, usar os equivalentes `${BACKEND_PROD}`.
  - Preservar otimizações já usadas no iOS (preload, crossOrigin=null, etc.).
- [x] Adicionar kill switch de runtime (para desligar rapidamente):
  - Query param `?mp3c=off` OU `localStorage.setItem('iospwaContinuous','off')` para forçar fallback ao comportamento anterior.
  - Logar no console quando o kill switch estiver ativo.
- [x] Manter `seekToTrackInContinuous(trackId)` sem alterações funcionais.
- [x] Garantir que Android/desktop e Safari em aba normal continuam usando o comportamento atual (faixas individuais / fallback existente). - [x] Etapa 4 (Backend – staging): mudanças podem ser aditivas ou substitutivas; alterar rotas existentes em staging é permitido; produção só após Gate 4.1 ✅
  - ⚠️ Etapa 5 (Frontend) – mudança apenas para iOS PWA instalado (EM ANDAMENTO)

> Escopo: Ao detectar PWA instalado em iPhone, tocar um único arquivo MP3 contínuo, dirigindo UI/metadata/controles via track cues. Não alterar o comportamento atual em Android, Desktop ou Safari em aba normal. Alinhar com padrões de `PLANO_EXECUCAO.md` e `GUIA_TECNICO_DETALHADO.md`.
>
> Execução: Sonnet 4 (agente) fará cada micropasso e atualizará os checkboxes. Testes somente no staging. Deploys seguirão `DEPLOY-GUIDE-UNIFIED.md`.

---
## 0) Referências e Pré-requisitos
- URLs (de `devFiles/secrets/urlsImportantes.md`):
  - Backend Staging: https://rd-importante-backend-staging-cudbw.ondigitalocean.app/
  - Backend Produção: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/
  - Frontend Produção: https://radio.importantestudio.com/
  - Frontend Staging: https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app/
- Placeholders (variáveis para este plano):
  - `BACKEND_STAGING` = https://rd-importante-backend-staging-cudbw.ondigitalocean.app/
  - `BACKEND_PROD` = https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/
  - Observação: Nos exemplos, use `${BACKEND_STAGING}` no staging e `${BACKEND_PROD}` na produção.
- Confirmado: URL base do Spaces (Origin Endpoint) para o prefixo `continuous/`:
  - Base: https://radio-importante-audio.atl1.digitaloceanspaces.com/continuous/
  - MP3 contínuo (URL absoluta): https://radio-importante-audio.atl1.digitaloceanspaces.com/continuous/radio-importante-continuous.mp3
  - Cues (URL absoluta): https://radio-importante-audio.atl1.digitaloceanspaces.com/continuous/track-cues.json

Observações:
- HLS permanecerá inalterado para outras plataformas até a conclusão da migração iOS PWA. Não remover nada antes dos testes finais.
- Os cues continuarão sendo a “fonte de verdade” para: Agora Tocando, Media Session, Next/Prev/Shuffle e Seek.
- Fonte de verdade: apenas Spaces; não manter cópias locais permanentes em `public/continuous/`.

### 0.1) Estratégia de Proteção (backends separados)
Objetivo: Minimizar risco em produção aplicando e testando mudanças no backend de staging; produção permanece intocada até promoção explícita.

Micropassos:
- [x] Backup prévio do estado atual (seguir seção "Rollback de Experimentos" no `DEPLOY-GUIDE-UNIFIED.md`).
  - ✅ Backup main: `backup-main-pre-ios-mp3-continuo` 
  - ✅ Backup staging: `backup-staging-pre-ios-mp3-continuo`
- [ ] Ordem segura das etapas:
  - ✅ Etapa 1 (Design) – sem código
  - ✅ Etapa 2 (Scripts locais)
  - ✅ Etapa 3 (Upload/CORS no Spaces)
  - ⚠️ Etapa 4 (Backend – staging): mudanças podem ser aditivas ou substitutivas; alterar rotas existentes em staging é permitido; produção só após Gate 4.1
  - ✅ Etapa 5 (Frontend) – mudança apenas para iOS PWA instalado
- [ ] Política de backend nesta migração:
  - Staging: pode criar/adaptar rotas existentes para simplificar a implementação iOS PWA.
  - Produção: preferir promover rotas como aditivas; alterar rotas existentes apenas após Gate 4.1 e com plano de rollback.
  - Manter kill switch no frontend para desligar rapidamente o contínuo se necessário.
- [ ] Rollback rápido:
  - Reverter commit do backend (ver guia) e redeploy.
  - Staging: revert do commit restaura o comportamento anterior. Produção: preparar rollback equivalente antes da promoção.

---
## 1) Design e Alinhamento (sem código)
Objetivo: Congelar decisões e pontos de integração antes da implementação.

Micropassos:
- [x] Documentar o alvo de artefatos:
  - MP3 contínuo em Spaces: `continuous/radio-importante-continuous.mp3`
  - Cues em Spaces: `continuous/track-cues.json` (ou caminho acordado)
  - MP3 contínuo (URL absoluta): https://radio-importante-audio.atl1.digitaloceanspaces.com/continuous/radio-importante-continuous.mp3
  - Cues (URL absoluta): https://radio-importante-audio.atl1.digitaloceanspaces.com/continuous/track-cues.json
- [x] Definir caminho público consumido pelo app (via backend proxy — rotas aditivas):
  - MP3 (staging): `${BACKEND_STAGING}/audio/continuous/radio-importante-continuous.mp3`
  - Cues (staging): `${BACKEND_STAGING}/audio/continuous/track-cues.json`
  - MP3 (produção): `${BACKEND_PROD}/audio/continuous/radio-importante-continuous.mp3`
  - Cues (produção): `${BACKEND_PROD}/audio/continuous/track-cues.json`
  - Alias futuro (opcional, pós Gate 4.1): `${BACKEND_STAGING}/audio/radio-importante-continuous.mp3` → apontar para `continuous/`
- [x] Confirmar que NÃO haverá uso de HLS no iOS PWA instalado.
- [x] Registrar que Android/desktop permanecem com fluxo atual (sem contínuo obrigatório).

Testes desta etapa: nenhum. Commit/deploy: não, é etapa de alinhamento.

---
## 2) Unificar geração de Cues com duração real (ffprobe) no `generate-audio.js`
Objetivo: Ter um único gerador de cues precisos, alinhados ao arquivo contínuo.

Micropassos:
- [x] Adicionar (ou validar) uso de ffprobe para medir duração real de cada faixa (catálogo atual).
- [x] Gerar `track-cues.json` com campos: `{ id, title, artist, startTime, endTime, duration, filename }`.
- [x] Aplicar guard band/offset (±20–40ms) opcional documentado; manter coerência ao seek.
- [x] Gerar localmente e fazer upload para Spaces; não manter cópia permanente em `public/continuous/`.
- [x] Preparar rotina de upload para Spaces (via Admin/rotina existente) para `continuous/track-cues.json`.
- [x] Validar diretamente no Spaces (Origin Endpoint): `https://radio-importante-audio.atl1.digitaloceanspaces.com/continuous/track-cues.json` (200 OK, CORS ok). A validação via backend ocorrerá na Etapa 4.

Testes práticos (staging):
- [x] Abrir a URL de cues (Spaces) no navegador do iPhone e verificar JSON e CORS.

Commit/deploy: sim, após ajustes no script. Seguir `DEPLOY-GUIDE-UNIFIED.md`.

---
## 3) Gerar MP3 Contínuo (CBR 96k, 44.1kHz, 2 canais, Joint Stereo)
Objetivo: Produzir e publicar o arquivo contínuo com parâmetros simples e estáveis.

Micropassos:
- [x] Atualizar `scripts/generate-audio.js` para gerar MP3 contínuo (concat das faixas do catálogo) com:
  - Bitrate CBR 96k, 44.1kHz, 2 canais, joint stereo.
  - Sem VBR, sem filtros adicionais.
- [x] Gerar localmente e publicar no Spaces; não manter cópia permanente em `public/continuous/`.
- [x] Publicar no Spaces em `continuous/radio-importante-continuous.mp3` (mesmo nome).
- [x] Verificar no Spaces headers padrão: `Content-Type: audio/mpeg`, `Accept-Ranges: bytes`, CORS para Range.
- [x] Executar HEAD e Range (parcial) diretamente no Spaces (Origin Endpoint) para confirmar 206 e bytes corretos. A validação via backend ocorrerá na Etapa 4.

Testes práticos (staging):
- [x] HEAD `https://radio-importante-audio.atl1.digitaloceanspaces.com/continuous/radio-importante-continuous.mp3` → 200 + `Accept-Ranges: bytes`.
- [x] GET parcial com Range (ex.: bytes=0-1023) → 206.

Commit/deploy: sim (se houve mudança no script). Seguir `DEPLOY-GUIDE-UNIFIED.md`.

### 3.1) Configurar CORS e Metadata no DigitalOcean Spaces (continuous/)
Objetivo: Garantir que o navegador e o backend possam acessar os artefatos com cabeçalhos corretos.

Micropassos (UI do Spaces):
- [x] Abrir o Space `radio-importante-audio` → Settings → CORS Configuration → Edit JSON
- [x] Aplicar a política CORS (ajuste origens se necessário):
  ```json
  [
    {
      "AllowedHeaders": ["Range", "Origin", "Referer", "Accept", "User-Agent"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedOrigins": [
        "https://radio.importantestudio.com",
        "https://radio-importante-frontend-stagin-6rjzv.ondigitalocean.app",
        "https://radio-importante-pwa-backend-skg2w.ondigitalocean.app"
      ],
      "ExposeHeaders": ["Accept-Ranges", "Content-Length", "Content-Range", "ETag"],
      "MaxAgeSeconds": 300
    }
  ]
  ```
- [x] Verificar objetos em `continuous/`:
  - `radio-importante-continuous.mp3`: `Content-Type = audio/mpeg`, `Cache-Control = public, max-age=3600`
  - `track-cues.json`: `Content-Type = application/json`, `Cache-Control = public, max-age=60`
  - Observação: `Accept-Ranges: bytes` é provido automaticamente pelo Spaces; não requer configuração manual.
- [x] Se necessário, ajustar headers via: Files → selecionar objeto → More → Edit Headers.

Validações (staging, via backend proxy):
- [x] HEAD `${BACKEND_STAGING}/audio/radio-importante-continuous.mp3` contém `Accept-Ranges: bytes`, `Content-Type: audio/mpeg` e `Content-Length`.
- [x] HEAD `${BACKEND_STAGING}/audio/continuous/track-cues.json` contém `Content-Type: application/json` e `Cache-Control` leve.
- [x] GET parcial com `Range: bytes=0-1023` no MP3 via backend retorna `206 Partial Content`.

Notas:
- O app consumirá via backend proxy; ainda assim, manter CORS correto no Spaces facilita debug e futuros acessos diretos controlados.
- Restringir `AllowedOrigins` às três URLs indicadas reduz exposição desnecessária.

---
## 4) Backend: Proxy contínuo e paths (Mudanças em Staging)
Objetivo: Garantir que o backend sirva os novos caminhos sob `/audio/continuous/*` e permitir ajustes necessários em staging sem impactar produção.

Micropassos:
- [x] Criar (ou adaptar) rota: `GET /audio/continuous/radio-importante-continuous.mp3` (proxy → Spaces `continuous/radio-importante-continuous.mp3`).
- [x] Adicionar rota: `GET /audio/continuous/track-cues.json` (proxy → Spaces `continuous/track-cues.json`).
- [x] Assegurar headers: `Content-Type` adequado, `Accept-Ranges: bytes`, `Cache-Control` não agressivo (ex.: `max-age=3600`).
- [x] Testar no staging as novas URLs (200 OK, CORS e Range conforme esperado) e validar que endpoints antigos continuam íntegros.

Testes práticos (staging):
- [x] Abrir no iPhone as duas URLs novas (MP3 e cues) e checar acesso e cabeçalhos via DevTools.
- [x] Validar que `/api` e demais rotas existentes continuam respondendo como antes.

Commit/deploy: sim. Seguir `DEPLOY-GUIDE-UNIFIED.md` (workflows separados: staging e produção).

### 4.1) Gate de Promoção/Switch (decisão: canonicalizar em `continuous/`)
- [ ] Política acordada: tornar `/audio/continuous/*` os caminhos canônicos em produção para estes artefatos.
- [ ] Manter o alias legado `/audio/radio-importante-continuous.mp3` apenas como fallback temporário (janela de depreciação: 4 semanas) e removê-lo após o período.
- [ ] Confirmar que produção não quebrou (smoke tests + validação de headers + logs do backend).
- [ ] Rollback: revert do commit do backend que alterou/retirou o alias restaura comportamento anterior.

---
## 5) Frontend: iOS PWA “contínuo apenas” (com kill switch)
Objetivo: Redirecionar apenas o iOS PWA instalado para usar MP3 contínuo + cues pelas novas rotas aditivas, mantendo os demais fluxos intactos.

Micropassos:
- [ ] Em `src/player/audio.ts`, substituir `tryEnableHLSForIPhone/loadHLSForIOSPWA` por lógica “contínuo apenas”:
  - Fetch de `${BACKEND_STAGING}/audio/continuous/track-cues.json`.
  - `audio.src = ${BACKEND_STAGING}/audio/continuous/radio-importante-continuous.mp3`.
  - Em produção, usar os equivalentes `${BACKEND_PROD}`.
  - Preservar otimizações já usadas no iOS (preload, crossOrigin=null, etc.).
- [ ] Adicionar kill switch de runtime (para desligar rapidamente):
  - Query param `?mp3c=off` OU `localStorage.setItem('iospwaContinuous','off')` para forçar fallback ao comportamento anterior.
  - Logar no console quando o kill switch estiver ativo.
- [ ] Manter `seekToTrackInContinuous(trackId)` sem alterações funcionais.
- [ ] Garantir que Android/desktop e Safari em aba normal continuam usando o comportamento atual (faixas individuais / fallback existente).

Testes práticos (staging, iPhone PWA instalado):
- [ ] Reproduzir ≥5 minutos com tela bloqueada; confirmar continuidade sem quedas. (AGUARDANDO DEVICE)
- [ ] Verificar updates de Media Session (título/artista/capa) a cada boundary de cue. (AGUARDANDO DEVICE)
- [ ] Usar botão Next e controles do sistema (nexttrack) → validar seek para início da próxima faixa. (AGUARDANDO DEVICE)
- [ ] Ativar kill switch e confirmar que retorna ao comportamento antigo imediatamente. (AGUARDANDO DEVICE)

Commit/deploy: sim. Seguir `DEPLOY-GUIDE-UNIFIED.md` (frontend staging).
✅ Implementado em commit d1671cc: "feat: implementar Etapa 5 - iOS PWA contínuo apenas com kill switch"
✅ Backend staging validado e respondendo às rotas /audio/continuous/*
✅ Frontend staging deployed com novas configurações

Status: Implementação técnica concluída. Necessário teste em iPhone físico para validação completa.

---
## 6) Shuffle e Precisão de Seek
Objetivo: Validar lógica de shuffle baseada em cues e calibrar precisão de início.

Micropassos:
- [ ] Implementar/validar shuffle: escolher próximo índice via Fisher–Yates sobre a lista de cues.
- [ ] Mapear Next/Prev/NextTrack (Media Session) para seek por `cue.startTime`.
- [ ] Afinar precisão: se necessário, aplicar pequeno offset/guard band (±20–40ms) e micro fade-in para evitar cliques.

Testes práticos (staging):
- [ ] Executar sequência de 10 avanços (next) em shuffle e inspecionar se inícios soam “no ponto”.
- [ ] Alternar foreground/background/lock e repetir 3 transições sem perda de continuidade.

Commit/deploy: sim, se houver ajustes. Seguir `DEPLOY-GUIDE-UNIFIED.md`.

---
## 7) Limpeza HLS (apenas após validação estável no iOS PWA)
Objetivo: Remover o que não é mais necessário para o iOS PWA, sem afetar outras plataformas.

Micropassos:
- [ ] Remover `scripts/generate-hls.js` e `scripts/generate-smart-hls.js` (após backup).
- [ ] Remover scripts do `package.json` relacionados a HLS (ex.: `hls:generate`, `hls:clean`).
- [ ] Atualizar `public/debug.html` para indicar que HLS não é caminho de produção no iOS PWA; manter como página de diagnóstico somente.
- [ ] Revisar documentação: `PLANO_EXECUCAO.md` e `GUIA_TECNICO_DETALHADO.md` (seções HLS) — anotar depreciação para iOS PWA e novo caminho MP3 contínuo.

Testes: 
- [ ] Build staging OK; comandos de automação não quebram; diagnósticos HLS podem permanecer só para backend/tests.

Commit/deploy: sim. Seguir `DEPLOY-GUIDE-UNIFIED.md`.

---
## 8) Observabilidade mínima e Checklist de Encerramento
Objetivo: Garantir visibilidade básica e encerrar migração.

Micropassos:
- [ ] Manter logs moderados no iOS PWA: mudança de faixa (cue index), seek, erros de rede no MP3/cues, eventos de kill switch.
- [ ] Adicionar teste funcional rápido de sanidade (staging): abrir app, tocar 6+ minutos, verificar 3 trocas de faixas e lock screen atualizado.
- [ ] Atualizar `README-GITHUB.md` e anotar criticidade dos arquivos: MP3 contínuo, cues, e rotas de proxy.

Encerramento:
- [ ] Consolidar evidências (vídeo curto do iPhone, screenshots de lock screen, headers das URLs proxy).
- [ ] Checklist final ok ⇒ Merge de staging → main.

---
## Anexos e Notas
- Flag/terminologia: a flag `hlsMode` hoje serve como “modo contínuo/HLS”. Para evitar regressão, manter a flag e apenas documentar seu uso no iOS PWA como “contínuo”. Renomear em uma refatoração futura opcional.
- Cuidado com cache/CDN: evitar `max-age` agressivo no MP3 contínuo e nos cues; invalidações só se necessário.
- Backends separados: em staging mudanças podem ser não aditivas; em produção preferir aditivas e reversíveis; validação via smoke tests após cada deploy.
- Kill switch: manter documentado o parâmetro/flag e o comportamento esperado em caso de desligamento.
- Pedidos pendentes ao usuário:
  - [x] Confirmado: URL base do Spaces para o prefixo `continuous/` → https://radio-importante-audio.atl1.digitaloceanspaces.com/continuous/
  - [x] Decisão: usar apenas Spaces como fonte de verdade; não manter cópia local permanente em `public/continuous/`.

> Sonnet: após concluir cada micropasso, marque-o como concluído no arquivo e prossiga. Para cada deploy de staging, siga o `DEPLOY-GUIDE-UNIFIED.md`.
