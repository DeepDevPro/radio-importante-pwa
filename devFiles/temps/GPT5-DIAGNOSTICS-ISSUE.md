# 🔍 DIAGNÓSTICO COMPLEXO PARA GPT-5: HLS Diagnostics Endpoint Issue

**Data:** 06 de Outubro de 2025  
**Contexto:** Projeto HLS VOD/Rolling - Fase R6 (Hardening/Smoke)  
**Issue:** Endpoint `/api/hls/:mode/diagnostics` retorna XML do Spaces ao invés de JSON esperado  

---

## 🎯 PROBLEMA PRINCIPAL

O endpoint `GET /api/hls/:mode/diagnostics` (latest/rolling) está retornando XML de erro do DigitalOcean Spaces ao invés do JSON estruturado esperado, mesmo tendo try/catch robusto na implementação.

### ❌ Comportamento Atual
```bash
curl https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/hls/latest/diagnostics
# Retorna:
<?xml version="1.0" encoding="UTF-8"?>
<Error>
<Code>NoSuchKey</Code>
<BucketName>radio-importante-audio</BucketName>
<HostId>173a85f-atl1a-atl1-zg01</HostId>
</Error>
```

### ✅ Comportamento Esperado
```json
{
  "success": false,
  "error": "Playlist não encontrada ou inacessível",
  "status": "missing",
  "durationMs": 123
}
```

---

## 🔧 CORREÇÕES JÁ APLICADAS

### 1. Endpoint Spaces Corrigido
- **Problema:** URL incorreta `nyc3.digitaloceanspaces.com`
- **Solução:** Corrigido para `atl1.digitaloceanspaces.com` (confirmado via painel DO)
- **Status:** ✅ Aplicado e deployed (commits fb4d1e3, 65f4fd3)

### 2. Validações Realizadas
- ✅ Playlist existe: `https://radio-importante-audio.atl1.digitaloceanspaces.com/generated/hls/latest/index.m3u8` → 200 OK
- ✅ Outras rotas HLS funcionam: `/api/hls/capabilities`, `/api/hls/generate-hls` → JSON OK
- ✅ HostId confirma correção: logs mostram `atl1a-atl1-zg01` (endpoint correto)

---

## 📂 ARQUIVOS RELEVANTES

### A. Rota Implementação (`backend/routes/hlsGenerate.routes.js` linhas ~665-700)
```javascript
router.get('/:mode/diagnostics', async (req, res) => {
  const startTime = Date.now();
  const { mode } = req.params;
  
  try {
    // Validate mode parameter
    if (!['latest', 'rolling'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be "latest" or "rolling"',
        durationMs: Date.now() - startTime
      });
    }

    // Build Spaces URL - JÁ CORRIGIDO
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'atl1.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}`;

    // Call diagnostic function
    const diagnostics = await diagnoseHlsPlaylist({
      mode,
      spacesUrl,
      timeout: parseInt(timeout),
      cacheBust: cacheBust === 'true',
      probeSegments: probeSegments === 'true'
    });

    res.json({
      success: true,
      mode,
      ...diagnostics,
      durationMs: Date.now() - startTime
    });

  } catch (error) {
    // ESTE CATCH DEVERIA CAPTURAR O ERRO E RETORNAR JSON
    res.status(500).json({
      success: false,
      error: error.message,
      durationMs: Date.now() - startTime
    });
  }
});
```

### B. Função Diagnóstico (`backend/hls/hlsDiagnostics.js`)
```javascript
async function diagnoseHlsPlaylist(options = {}) {
  const startTime = Date.now();
  
  try {
    const { mode, spacesUrl, timeout = 3000, cacheBust = true, probeSegments = true } = options;

    // 1. Download e parse da playlist
    const playlistResult = await downloadAndParsePlaylist(spacesUrl, mode, timeout, cacheBust);
    
    if (!playlistResult.success) {
      // RETORNA ERRO ESTRUTURADO
      return {
        status: 'missing',
        error: playlistResult.error,
        // ... outros campos
      };
    }

    // ... resto da lógica

  } catch (error) {
    // CAPTURA QUALQUER ERRO INESPERADO
    return {
      status: 'error',
      error: error.message,
      durationMs: Date.now() - startTime
    };
  }
}

// Função que faz o download
function downloadContent(url, timeout) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      // ... resto da implementação
    });
    
    req.on('error', (error) => {
      reject(new Error(`Erro de rede: ${error.message}`));
    });
  });
}
```

---

## 🤔 ANÁLISE DO MISTÉRIO

### Evidências Conflitantes
1. **✅ Try/Catch Robusto:** Rota tem try/catch que deveria capturar qualquer erro
2. **✅ Função Defensive:** `diagnoseHlsPlaylist` tem try/catch interno e retorna objetos estruturados
3. **✅ Outras Rotas OK:** `/api/hls/capabilities` e `/api/hls/generate-hls` funcionam perfeitamente
4. **❌ XML Response:** Mas o endpoint retorna XML do Spaces, indicando que o erro não está sendo capturado

### Hipóteses Técnicas
1. **Middleware Proxy:** Algum middleware está interceptando e fazendo proxy direto para Spaces?
2. **Express Router Issue:** Conflito de rotas que está desviando o request?
3. **AWS SDK Behavior:** O SDK está fazendo request direto e bypassando o try/catch?
4. **Error Propagation:** Erro está sendo re-thrown em algum lugar inesperado?

---

## 📊 CONTEXTO DO PROJETO

### Smoke Test Status (3/6 Passing)
- ✅ CAPABILITIES: OK
- ✅ GENERATE_LATEST: OK 
- ✅ GENERATE_ROLLING: OK
- ❌ DIAGNOSTICS_LATEST: Retorna XML
- ❌ DIAGNOSTICS_ROLLING: Retorna XML  
- ❌ SAFARI_HYPOTHESIS: Payload issue (menor)

### Arquitetura
- **Backend:** Node.js + Express + AWS SDK
- **Storage:** DigitalOcean Spaces (S3-compatible)
- **Deploy:** DigitalOcean App Platform (auto-deploy via GitHub)

---

## 🎯 PERGUNTA PARA GPT-5

**Considerando que:**
1. A rota tem try/catch robusto e sempre deveria retornar JSON
2. Outras rotas HLS funcionam perfeitamente 
3. O arquivo existe no Spaces e é acessível diretamente
4. O endpoint correto está sendo usado (atl1 confirmado)
5. Mesmo assim o response é XML do Spaces (NoSuchKey)

**Como você diagnosticaria e resolveria esse comportamento anômalo onde um endpoint Express com try/catch está retornando XML de erro do storage backend ao invés de JSON estruturado?**

**Especificamente:**
- Que ferramentas/logs você usaria para rastrear o flow de execução?
- Quais são as possíveis causas para esse bypass do error handling?
- Qual seria sua estratégia de debug passo-a-passo?
- Como você implementaria uma solução robusta?

**Objetivo:** Fazer os testes de smoke passar de 3/6 para 6/6, resolvendo o diagnostics endpoint que está impedindo a conclusão da fase R6 (Hardening/Smoke).

---

## 📎 ARQUIVOS ANEXOS DISPONÍVEIS
- `backend/routes/hlsGenerate.routes.js` (rota principal)
- `backend/hls/hlsDiagnostics.js` (função diagnóstico)
- `scripts/hls-smoke.cjs` (script de teste)
- Logs de deploy e execução disponíveis

**Formato de resposta esperado:** Plano de investigação + soluções implementáveis + priorização por eficiência de debug.
