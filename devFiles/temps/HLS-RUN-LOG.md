# HLS Run Log - Plano Incremental de Restauração

Data de início: 06/10/2025  
Branch: refactor/appjs-step1  
Objetivo: Restaurar funcionalidades HLS removidas na refatoração

---

## R0 - Auditoria (Somente Leitura)
**Início:** 06/10/2025

### R0-1: Verificar playlist latest ✅
**URL testada:** https://radio-importante-audio.atl1.digitaloceanspaces.com/generated/hls/latest/index.m3u8
**Resultado:** HTTP/2 200 - Content-Length: 946 bytes
**Content-Type:** application/vnd.apple.mpegurl
**Last-Modified:** Thu, 02 Oct 2025 23:37:02 GMT

### R0-2: Verificar playlist rolling ✅
**URL testada:** https://radio-importante-audio.atl1.digitaloceanspaces.com/generated/hls/rolling/index.m3u8
**Resultado:** HTTP/2 200 - Content-Length: 2893 bytes
**Content-Type:** application/vnd.apple.mpegurl
**Last-Modified:** Fri, 03 Oct 2025 19:30:36 GMT

### R0-3: Registrar conteúdos encontrados ✅
**Playlist latest:** 26 segmentos (segment_000.ts até segment_025.ts) + EXT-X-ENDLIST
**Playlist rolling:** 85 segmentos (segment_000.ts até segment_084.ts) + EXT-X-ENDLIST
**Duração aproximada latest:** ~150s (26 × 6s)
**Duração aproximada rolling:** ~510s (85 × 6s)

### R0-4: Testar segmentos prováveis ✅
**latest/segment_000.ts:** HTTP/2 200 - 109,792 bytes - video/MP2T
**rolling/segment_000.ts:** HTTP/2 200 - 106,972 bytes - video/MP2T
**rolling/segment_003.ts:** HTTP/2 200 - 105,844 bytes - video/MP2T (o que causava timeout)

### R0-5: Headers e Content-Type ✅
- Playlists: `application/vnd.apple.mpegurl` ✅
- Segmentos: `video/MP2T` ✅ 
- Accept-Ranges: bytes ✅
- CORS headers presentes ✅

### R0-6: Tabela consolidada ✅
| Recurso | Status | Content-Type | Content-Length | Observação |
|---------|--------|--------------|----------------|------------|
| latest/index.m3u8 | 200 | application/vnd.apple.mpegurl | 946 | 26 segmentos |
| rolling/index.m3u8 | 200 | application/vnd.apple.mpegurl | 2893 | 85 segmentos |
| latest/segment_000.ts | 200 | video/MP2T | 109,792 | OK |
| rolling/segment_000.ts | 200 | video/MP2T | 106,972 | OK |
| rolling/segment_003.ts | 200 | video/MP2T | 105,844 | OK (era problemático) |

---

## R1 - Proxy Routes Test (06/10/2025)

### R1-10: Smoke Test das Rotas Proxy ⚠️
**Commit:** 16bfd3b - feat(hls): add proxy routes for /hls/latest and /hls/rolling (R1)

**Status Spaces atualizado (06/10/2025 12:04):**
- latest/index.m3u8: 404 Not Found (arquivo removido desde R0)
- rolling/index.m3u8: 404 Not Found (arquivo removido desde R0)

**Arquivos criados:**
- ✅ backend/routes/hlsProxy.routes.js (115 linhas)
- ✅ backend/app.js (adicionada linha de montagem)

**Observação:** Arquivos HLS foram removidos do Spaces entre R0 e R1. 
**Próximo passo:** R3 para regenerar conteúdo HLS antes de testar proxies.

---

## R3 - Reexposição da Geração HLS (06/10/2025)

### R3-8: Teste geração latest ⚠️
**Commit:** 3dd91f7 - feat(hls): add /api/generate-hls endpoint using existing script (R3)

**Resultado POST /api/generate-hls:**
- Status: 500 - Script terminou com código 1
- Erro: "Nenhum arquivo de áudio válido encontrado"
- Duração: ~24s
- Causa: Script busca arquivos MP3 locais, mas temos apenas URLs do Spaces

**Arquivos criados:**
- ✅ backend/routes/hlsGenerate.routes.js 
- ✅ backend/app.js (rota montada)
- ✅ Integração com saveAutoLog corrigida

**Observação:** R3 requer adaptação do script para trabalhar com Spaces URLs.
**Próximo:** Pular para R2 (aliases) e postergar adaptação do script.

---

## R1+R2 Staging Test (06/10/2025)

### Deploy para Staging ✅
**Branch:** staging (merged from refactor/appjs-step1)
**Commits:** 16bfd3b (R1) + 6dc5c85 (R2+R3)
**URL Backend:** https://radio-importante-pwa-backend-skg2w.ondigitalocean.app

**Alterações deployadas:**
- ✅ backend/routes/hlsProxy.routes.js (rotas /hls/*)
- ✅ backend/routes/hlsGenerate.routes.js (POST /api/generate-hls)
- ✅ backend/app.js (mounting routes)

**Teste pós-deploy (06/10/2025 12:16):**
- ✅ /hls/latest/index.m3u8: HTTP/2 200 - 946 bytes (application/vnd.apple.mpegurl)
- ✅ /api/hls/latest/index.m3u8: HTTP/2 200 - 946 bytes (alias funcionando)
- ✅ /hls/rolling/index.m3u8: HTTP/2 200 - 2893 bytes (85 segmentos)
- ✅ /hls/latest/segment_000.ts: HTTP/2 200 - 109,792 bytes (video/MP2T)

**Headers confirmados:**
- Playlists: `cache-control: no-cache, no-store, must-revalidate` ✅
- Segmentos: `cache-control: public, max-age=86400` ✅
- CORS: `access-control-allow-origin: *` ✅

**Resultado:** R1 e R2 CONCLUÍDOS COM SUCESSO! 🎉

**Próximos passos:** Testar POST /api/generate-hls e prosseguir R3.

---

## R3 - Generate HLS Test (06/10/2025)

### R3 Teste de Geração ⚠️
**URL:** POST /api/generate-hls
**Payload:** {"mode": "latest"}

**Resultado:**
- ❌ Script não encontrado: `/usr/src/scripts/generate-hls.js`
- Error: Cannot find module '/usr/src/scripts/generate-hls.js'
- Duration: 188ms

**Análise:**
- Rota POST /api/generate-hls está funcionando ✅
- Error handling funcionando ✅ 
- Problema: script generate-hls.js não está no container de produção
- Causa: Pasta scripts/ pode não estar sendo copiada no deploy

**Soluções possíveis:**
1. Mover script para backend/scripts/ 
2. Incluir scripts/ no Dockerfile/deploy
3. Implementar geração inline no backend

**Status R3:** Parcialmente implementado - rota OK, script missing

---

## R3 - Bootstrap FFmpeg + Endpoint Unificado
**Início:** 06/10/2025

### R3-1 a R3-10: Implementação módulos e endpoints ⚠️
**Branch:** feature/hls-r3-bootstrap  
**Commits:** 5e1632f, 70c94e4, 7b38a56

### Tentativas realizadas:
1. **Módulos criados:**
   - backend/hls/ffmpegCapability.js ✅ (detectCapability function)
   - backend/hls/spacesScanner.js ✅ (scanSpaces function)
   - backend/routes/hlsGenerate.routes.js ✅ (capabilities + generate endpoints)

2. **Endpoints planejados:**
   - GET /api/hls/capabilities ❌ (503 upstream error)
   - POST /api/hls/generate-hls ❌ (503 upstream error)

3. **Diagnóstico do problema:**
   - Servidor básico funciona: GET /api/catalog → HTTP 200 ✅
   - Rotas HLS antigas funcionam: GET /hls/latest/index.m3u8 → HTTP 200 ✅
   - Apenas rotas /api/hls/* falham com 503 ❌

### Estado atual:
- **Problema:** Servidor retorna 503 para qualquer rota sob /api/hls/*
- **Hipótese:** Possível erro no import de dependências ffmpeg/scanner modules
- **Ação:** Reversão para implementação incremental sem dependências complexas

### Cenários R3 simulados (não testados devido a 503):
- [ ] R3-9a: capabilities → simulate:true, canSpawn:false
- [ ] R3-9b: generate latest → action:reused (playlist existe)
- [ ] R3-9c: generate rolling → action:reused (playlist existe)

### Próximas ações:
1. Implementar versão mínima sem imports ffmpeg externos
2. Testar endpoints básicos primeiro
3. Adicionar capability detection progressivamente

---
