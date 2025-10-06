/* eslint-env node */
/* eslint-disable no-undef */
const https = require('https');
const { saveAutoLog } = require('../state/hlsState');

/**
 * R5-2: Latest Segments Extractor
 * 
 * Baixa playlist latest/index.m3u8 do DigitalOcean Spaces, faz parse dos segmentos
 * e retorna lista ordenada com nomes e durações.
 * Usado pelo sistema rolling para reutilizar segmentos sem retranscodificação.
 */

/**
 * Extrai informações de segmentos da playlist latest do Spaces
 * 
 * @param {Object} options - Opções de extração
 * @param {string} options.spacesUrl - URL base do DigitalOcean Spaces (ex: https://bucket.endpoint)
 * @param {number} options.timeout - Timeout em ms (default: 3000)
 * @param {boolean} options.cacheBust - Adicionar cache-bust timestamp (default: true)
 * @returns {Promise<Object>} { success: boolean, segments: [{ name, duration }], info: Object, error?: string }
 */
async function extractLatestSegments(options = {}) {
  const startTime = Date.now();
  
  try {
    const {
      spacesUrl,
      timeout = 3000,
      cacheBust = true
    } = options;

    if (!spacesUrl) {
      throw new Error('spacesUrl é obrigatório');
    }

    // Construir URL da playlist latest com cache-bust opcional
    let playlistUrl = `${spacesUrl}/generated/hls/latest/index.m3u8`;
    if (cacheBust) {
      playlistUrl += `?t=${Date.now()}`;
    }

    saveAutoLog(`extractLatestSegments: baixando ${playlistUrl}`, 'info');

    // Baixar playlist latest
    const playlistContent = await downloadPlaylist(playlistUrl, timeout);
    
    // Parse dos segmentos
    const parseResult = parsePlaylistSegments(playlistContent);
    
    const durationMs = Date.now() - startTime;
    
    const result = {
      success: true,
      segments: parseResult.segments,
      info: {
        ...parseResult.info,
        downloadDurationMs: durationMs,
        playlistUrl,
        cacheBust
      }
    };

    saveAutoLog(`extractLatestSegments: sucesso - ${parseResult.segments.length} segmentos extraídos (${durationMs}ms)`, 'info');
    
    return result;
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    saveAutoLog(`extractLatestSegments: erro - ${error.message} (${durationMs}ms)`, 'error');
    
    return {
      success: false,
      segments: [],
      info: {
        downloadDurationMs: durationMs,
        error: error.message
      },
      error: error.message
    };
  }
}

/**
 * Baixa conteúdo de uma playlist via HTTPS
 * 
 * @param {string} url - URL da playlist
 * @param {number} timeout - Timeout em ms
 * @returns {Promise<string>} Conteúdo da playlist
 */
function downloadPlaylist(url, timeout) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
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
 * Faz parse de uma playlist HLS extraindo informações dos segmentos
 * 
 * @param {string} playlistContent - Conteúdo da playlist M3U8
 * @returns {Object} { segments: [{ name, duration }], info: Object }
 */
function parsePlaylistSegments(playlistContent) {
  const lines = playlistContent.split('\n').map(line => line.trim()).filter(line => line);
  
  const segments = [];
  const info = {
    hasExtM3u: false,
    hasEndlist: false,
    version: null,
    targetDuration: null,
    mediaSequence: null,
    playlistType: null,
    totalSegments: 0,
    totalDurationApprox: 0
  };

  // Parse headers da playlist
  for (const line of lines) {
    if (line === '#EXTM3U') {
      info.hasExtM3u = true;
    } else if (line === '#EXT-X-ENDLIST') {
      info.hasEndlist = true;
    } else if (line.startsWith('#EXT-X-VERSION:')) {
      info.version = parseInt(line.split(':')[1]);
    } else if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      info.targetDuration = parseInt(line.split(':')[1]);
    } else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      info.mediaSequence = parseInt(line.split(':')[1]);
    } else if (line.startsWith('#EXT-X-PLAYLIST-TYPE:')) {
      info.playlistType = line.split(':')[1];
    }
  }

  // Parse segmentos (EXTINF + nome do arquivo)
  let currentDuration = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detectar linha EXTINF
    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/#EXTINF:([\d.]+),/);
      if (match) {
        currentDuration = parseFloat(match[1]);
      }
    } 
    // Próxima linha não-comentário após EXTINF é o nome do segmento
    else if (currentDuration !== null && !line.startsWith('#')) {
      segments.push({
        name: line,
        duration: currentDuration
      });
      
      info.totalDurationApprox += currentDuration;
      currentDuration = null; // Reset para próximo segmento
    }
  }

  info.totalSegments = segments.length;

  // Validações básicas
  if (!info.hasExtM3u) {
    throw new Error('Playlist inválida: falta #EXTM3U');
  }

  if (segments.length === 0) {
    throw new Error('Nenhum segmento encontrado na playlist');
  }

  return { segments, info };
}

/**
 * Valida se uma lista de segmentos extraídos está bem formada
 * 
 * @param {Array} segments - Array de segmentos [{ name, duration }]
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateExtractedSegments(segments) {
  const errors = [];
  const warnings = [];
  
  if (!Array.isArray(segments)) {
    errors.push('segments deve ser um array');
    return { valid: false, errors, warnings };
  }

  if (segments.length === 0) {
    errors.push('Array de segmentos está vazio');
    return { valid: false, errors, warnings };
  }

  // Validar cada segmento
  segments.forEach((segment, index) => {
    if (!segment.name || typeof segment.name !== 'string') {
      errors.push(`Segmento ${index}: nome inválido ou ausente`);
    }
    
    if (typeof segment.duration !== 'number' || segment.duration <= 0) {
      errors.push(`Segmento ${index}: duração inválida (${segment.duration})`);
    }
    
    // Avisos para durações muito fora do padrão
    if (segment.duration < 2 || segment.duration > 15) {
      warnings.push(`Segmento ${index}: duração atípica (${segment.duration}s)`);
    }
  });

  // Verificar sequência de nomes (opcional - detectar gaps)
  const segmentNumbers = segments
    .map(s => {
      const match = s.name.match(/segment_(\d+)\.ts/);
      return match ? parseInt(match[1]) : null;
    })
    .filter(n => n !== null);

  if (segmentNumbers.length > 0) {
    const minNum = Math.min(...segmentNumbers);
    const maxNum = Math.max(...segmentNumbers);
    const expectedCount = maxNum - minNum + 1;
    
    if (segmentNumbers.length !== expectedCount) {
      warnings.push(`Possível gap na sequência: ${segmentNumbers.length} segmentos, esperados ${expectedCount}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  extractLatestSegments,
  parsePlaylistSegments,
  validateExtractedSegments
};
