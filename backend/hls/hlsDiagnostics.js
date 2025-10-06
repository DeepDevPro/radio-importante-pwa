/* eslint-env node */
/* eslint-disable no-undef */
const https = require('https');
const { saveAutoLog } = require('../state/hlsState');

/**
 * R5-5: HLS Diagnostics Utility
 * 
 * Diagnóstica health de playlists HLS (latest/rolling) incluindo:
 * - Parse de playlist (EXTINF count, hasEndlist, segmentos)
 * - Probe de segmentos amostrados via HEAD
 * - Classificação de status (ok/missing/partial/stalled)
 * - Métricas de timing e duração
 */

/**
 * Executa diagnóstico completo de uma playlist HLS
 * 
 * @param {Object} options - Opções de diagnóstico
 * @param {string} options.mode - Modo da playlist ('latest' ou 'rolling')
 * @param {string} options.spacesUrl - URL base do Spaces
 * @param {number} options.timeout - Timeout para requests (default: 3000ms)
 * @param {boolean} options.cacheBust - Usar cache-bust (default: true)
 * @param {boolean} options.probeSegments - Fazer probe nos segmentos (default: true)
 * @returns {Promise<Object>} Resultado do diagnóstico
 */
async function diagnoseHlsPlaylist(options = {}) {
  const startTime = Date.now();
  
  try {
    const {
      mode,
      spacesUrl,
      timeout = 3000,
      cacheBust = true,
      probeSegments = true
    } = options;

    if (!mode || !['latest', 'rolling'].includes(mode)) {
      throw new Error('mode deve ser "latest" ou "rolling"');
    }

    if (!spacesUrl) {
      throw new Error('spacesUrl é obrigatório');
    }

    saveAutoLog(`HLS diagnostics iniciado: mode=${mode}`, 'HLS_DIAG');

    // 1. Download e parse da playlist
    const playlistResult = await downloadAndParsePlaylist(spacesUrl, mode, timeout, cacheBust);
    
    if (!playlistResult.success) {
      const result = {
        success: true,
        mode,
        status: 'missing',
        playlist: playlistResult,
        segments: null,
        durationMs: Date.now() - startTime
      };

      saveAutoLog(`HLS diagnostics ${mode}: status=missing - ${playlistResult.error}`, 'HLS_DIAG');
      return result;
    }

    // 2. Probe de segmentos (se habilitado e há segmentos)
    let segmentProbes = null;
    if (probeSegments && playlistResult.segments.length > 0) {
      segmentProbes = await probeSegmentsSample(spacesUrl, mode, playlistResult.segments, timeout);
    }

    // 3. Classificação de status
    const status = classifyPlaylistStatus(playlistResult, segmentProbes);

    // 4. Métricas finais
    const result = {
      success: true,
      mode,
      status,
      playlist: {
        declaredCount: playlistResult.segments.length,
        hasEndlist: playlistResult.hasEndlist,
        totalDurationApprox: playlistResult.totalDurationApprox,
        averageExtinf: playlistResult.averageExtinf,
        firstSegments: playlistResult.segments.slice(0, 3).map(s => s.name),
        lastSegments: playlistResult.segments.slice(-3).map(s => s.name)
      },
      segments: segmentProbes,
      durationMs: Date.now() - startTime
    };

    // R5-9: Log compacto
    const logData = {
      mode,
      status,
      declaredCount: playlistResult.segments.length,
      headOkCount: segmentProbes?.headOkCount || 0,
      totalDurationApprox: Math.round(playlistResult.totalDurationApprox),
      averageExtinf: playlistResult.averageExtinf
    };

    saveAutoLog(`HLS diagnostics ${mode}: ${JSON.stringify(logData)}`, 'HLS_DIAG');

    return result;

  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    saveAutoLog(`HLS diagnostics error ${mode}: ${error.message} (${durationMs}ms)`, 'HLS_DIAG');
    
    return {
      success: false,
      mode: options.mode || 'unknown',
      status: 'error',
      error: error.message,
      durationMs
    };
  }
}

/**
 * Baixa e faz parse de uma playlist HLS
 */
async function downloadAndParsePlaylist(spacesUrl, mode, timeout, cacheBust) {
  try {
    let playlistUrl = `${spacesUrl}/generated/hls/${mode}/index.m3u8`;
    if (cacheBust) {
      playlistUrl += `?t=${Date.now()}`;
    }

    const content = await downloadContent(playlistUrl, timeout);
    const parseResult = parseHlsPlaylist(content);

    return {
      success: true,
      url: playlistUrl,
      ...parseResult
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Baixa conteúdo via HTTPS
 */
function downloadContent(url, timeout) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout após ${timeout}ms`));
    });

    req.on('error', (error) => {
      reject(new Error(`Erro de rede: ${error.message}`));
    });
  });
}

/**
 * Faz parse de playlist HLS extraindo segmentos e metadados
 */
function parseHlsPlaylist(content) {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  const segments = [];
  let hasEndlist = false;
  let totalDurationApprox = 0;
  
  // Parse segmentos
  let currentDuration = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line === '#EXT-X-ENDLIST') {
      hasEndlist = true;
    } else if (line.startsWith('#EXTINF:')) {
      const match = line.match(/#EXTINF:([\d.]+),/);
      if (match) {
        currentDuration = parseFloat(match[1]);
      }
    } else if (currentDuration !== null && !line.startsWith('#')) {
      segments.push({
        name: line,
        duration: currentDuration
      });
      totalDurationApprox += currentDuration;
      currentDuration = null;
    }
  }

  const averageExtinf = segments.length > 0 ? totalDurationApprox / segments.length : 0;

  return {
    segments,
    hasEndlist,
    totalDurationApprox,
    averageExtinf
  };
}

/**
 * Faz probe de amostra de segmentos (1º, meio, último)
 */
async function probeSegmentsSample(spacesUrl, mode, segments, timeout) {
  if (segments.length === 0) {
    return {
      headOkCount: 0,
      totalProbes: 0,
      timings: [],
      sampleSegments: []
    };
  }

  // Selecionar amostra: primeiro, meio, último
  const sampleIndices = [];
  sampleIndices.push(0); // Primeiro
  
  if (segments.length > 2) {
    const middleIndex = Math.floor(segments.length / 2);
    sampleIndices.push(middleIndex); // Meio
  }
  
  if (segments.length > 1) {
    sampleIndices.push(segments.length - 1); // Último
  }

  // Remover duplicatas
  const uniqueIndices = [...new Set(sampleIndices)];
  
  const probePromises = uniqueIndices.map(index => {
    const segment = segments[index];
    const segmentUrl = `${spacesUrl}/generated/hls/${mode}/${segment.name}`;
    return probeSegmentHead(segmentUrl, timeout, index);
  });

  const probeResults = await Promise.all(probePromises);
  
  const headOkCount = probeResults.filter(r => r.success).length;
  const timings = probeResults.map(r => r.durationMs);
  
  return {
    headOkCount,
    totalProbes: probeResults.length,
    timings,
    sampleSegments: probeResults.map(r => ({
      index: r.index,
      name: segments[r.index].name,
      success: r.success,
      durationMs: r.durationMs
    }))
  };
}

/**
 * Faz HEAD request em um segmento específico
 */
function probeSegmentHead(url, timeout, index) {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout }, (res) => {
      resolve({
        success: res.statusCode === 200,
        statusCode: res.statusCode,
        durationMs: Date.now() - startTime,
        index
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        statusCode: 0,
        durationMs: Date.now() - startTime,
        index
      });
    });

    req.on('error', () => {
      resolve({
        success: false,
        statusCode: 0,
        durationMs: Date.now() - startTime,
        index
      });
    });

    req.end();
  });
}

/**
 * Classifica status da playlist baseado em parse e probes
 */
function classifyPlaylistStatus(playlistResult, segmentProbes) {
  // R5-8: Classificação de status
  
  if (playlistResult.segments.length === 0) {
    return 'missing'; // Zero EXTINF
  }

  if (!segmentProbes) {
    return 'ok'; // Parse OK, sem probe de segmentos
  }

  if (segmentProbes.headOkCount === segmentProbes.totalProbes && segmentProbes.headOkCount >= 1) {
    return 'ok'; // Todos os probes passaram
  }

  if (segmentProbes.headOkCount === 0) {
    return 'missing'; // Nenhum segmento acessível
  }

  return 'partial'; // Alguns segmentos falharam
}

module.exports = {
  diagnoseHlsPlaylist,
  parseHlsPlaylist,
  classifyPlaylistStatus
};
