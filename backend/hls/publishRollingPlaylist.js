/* eslint-env node */
/* eslint-disable no-undef */
const { saveAutoLog } = require('../state/hlsState');
const { extractLatestSegments } = require('./extractLatestSegments');
const { buildRollingPlaylist } = require('./buildRollingPlaylist');

/**
 * R5-3: Rolling Playlist Publisher
 * 
 * Publica playlist rolling em generated/hls/rolling/index.m3u8 reutilizando
 * segmentos do latest (sem upload de .ts). Integra R5-1 e R5-2.
 */

/**
 * Publica playlist rolling no DigitalOcean Spaces
 * 
 * @param {Object} options - Opções de publicação
 * @param {Object} options.s3Client - Cliente S3 configurado
 * @param {string} options.bucket - Nome do bucket
 * @param {string} options.spacesUrl - URL base do Spaces
 * @param {number} options.windowSize - Tamanho da janela rolling (default: 10)
 * @param {boolean} options.simulate - Modo simulação (default: false)
 * @returns {Promise<Object>} { success: boolean, action: string, info: Object, error?: string }
 */
async function publishRollingPlaylist(options = {}) {
  const startTime = Date.now();
  
  try {
    const {
      s3Client,
      bucket,
      spacesUrl,
      windowSize = 10,
      simulate = false
    } = options;

    if (!s3Client || !bucket || !spacesUrl) {
      throw new Error('s3Client, bucket e spacesUrl são obrigatórios');
    }

    saveAutoLog(`publishRollingPlaylist: iniciando (windowSize=${windowSize}, simulate=${simulate})`, 'info');

    // 1. Extrair segmentos do latest
    const extractResult = await extractLatestSegments({
      spacesUrl,
      timeout: 3000,
      cacheBust: true
    });

    if (!extractResult.success) {
      // Se latest não existe ou é inválido → modo simulate
      const result = {
        success: true,
        action: 'simulate_missing_latest',
        info: {
          reason: 'Latest playlist não encontrada ou inválida',
          latestError: extractResult.error,
          durationMs: Date.now() - startTime
        }
      };

      saveAutoLog(`publishRollingPlaylist: ${result.action} - ${result.info.reason}`, 'warn');
      return result;
    }

    const latestSegments = extractResult.segments;
    saveAutoLog(`publishRollingPlaylist: extraído ${latestSegments.length} segmentos do latest`, 'info');

    if (latestSegments.length === 0) {
      const result = {
        success: true,
        action: 'simulate_empty_latest',
        info: {
          reason: 'Latest playlist existe mas não tem segmentos',
          durationMs: Date.now() - startTime
        }
      };

      saveAutoLog(`publishRollingPlaylist: ${result.action} - ${result.info.reason}`, 'warn');
      return result;
    }

    // 2. Construir playlist rolling
    const rollingPlaylist = buildRollingPlaylist({
      segments: latestSegments,
      windowSize
    });

    // 3. Upload da playlist (sem upload de .ts - reutiliza os do latest)
    if (simulate) {
      const result = {
        success: true,
        action: 'simulate_rolling_built',
        info: {
          windowSegments: Math.min(latestSegments.length, windowSize),
          totalLatestSegments: latestSegments.length,
          playlistLength: rollingPlaylist.length,
          durationMs: Date.now() - startTime
        }
      };

      saveAutoLog(`publishRollingPlaylist: ${result.action} - ${result.info.windowSegments} segmentos na janela`, 'info');
      return result;
    }

    // Upload real da playlist rolling
    const uploadResult = await uploadRollingPlaylist(s3Client, bucket, rollingPlaylist);

    const result = {
      success: true,
      action: 'rolling_published',
      info: {
        windowSegments: Math.min(latestSegments.length, windowSize),
        totalLatestSegments: latestSegments.length,
        playlistLength: rollingPlaylist.length,
        uploadDurationMs: uploadResult.durationMs,
        durationMs: Date.now() - startTime,
        rollingUrl: `${spacesUrl}/generated/hls/rolling/index.m3u8`
      }
    };

    saveAutoLog(`publishRollingPlaylist: ${result.action} - ${result.info.windowSegments} segmentos publicados`, 'info');
    return result;

  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    saveAutoLog(`publishRollingPlaylist: erro - ${error.message} (${durationMs}ms)`, 'error');
    
    return {
      success: false,
      action: 'rolling_failed',
      info: {
        durationMs,
        error: error.message
      },
      error: error.message
    };
  }
}

/**
 * Faz upload da playlist rolling para o Spaces
 * 
 * @param {Object} s3Client - Cliente S3
 * @param {string} bucket - Nome do bucket
 * @param {string} playlistContent - Conteúdo da playlist
 * @returns {Promise<Object>} { success: boolean, durationMs: number }
 */
async function uploadRollingPlaylist(s3Client, bucket, playlistContent) {
  const startTime = Date.now();
  
  try {
    const uploadParams = {
      Bucket: bucket,
      Key: 'generated/hls/rolling/index.m3u8',
      Body: playlistContent,
      ContentType: 'application/vnd.apple.mpegurl',
      CacheControl: 'no-cache, no-store, must-revalidate', // Headers iguais ao latest
      ACL: 'public-read'
    };

    await s3Client.upload(uploadParams).promise();
    
    const durationMs = Date.now() - startTime;
    
    saveAutoLog(`uploadRollingPlaylist: sucesso (${durationMs}ms)`, 'info');
    
    return {
      success: true,
      durationMs
    };
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    saveAutoLog(`uploadRollingPlaylist: erro - ${error.message} (${durationMs}ms)`, 'error');
    
    throw new Error(`Upload failed: ${error.message}`);
  }
}

/**
 * Valida se uma configuração de publicação rolling está correta
 * 
 * @param {Object} options - Opções a validar
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateRollingPublishOptions(options) {
  const errors = [];
  
  if (!options.s3Client) {
    errors.push('s3Client é obrigatório');
  }
  
  if (!options.bucket || typeof options.bucket !== 'string') {
    errors.push('bucket deve ser uma string não-vazia');
  }
  
  if (!options.spacesUrl || typeof options.spacesUrl !== 'string') {
    errors.push('spacesUrl deve ser uma string não-vazia');
  }
  
  if (options.windowSize !== undefined) {
    if (typeof options.windowSize !== 'number' || options.windowSize < 1 || options.windowSize > 50) {
      errors.push('windowSize deve ser um número entre 1 e 50');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Gera URL de diagnóstico para verificar playlist rolling publicada
 * 
 * @param {string} spacesUrl - URL base do Spaces
 * @param {boolean} cacheBust - Adicionar cache-bust (default: true)
 * @returns {string} URL completa para diagnóstico
 */
function getRollingDiagnosticUrl(spacesUrl, cacheBust = true) {
  let url = `${spacesUrl}/generated/hls/rolling/index.m3u8`;
  if (cacheBust) {
    url += `?t=${Date.now()}`;
  }
  return url;
}

module.exports = {
  publishRollingPlaylist,
  validateRollingPublishOptions,
  getRollingDiagnosticUrl
};
