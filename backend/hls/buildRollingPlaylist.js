/* eslint-env node */
/* eslint-disable no-undef */
const { saveAutoLog } = require('../state/hlsState');

/**
 * R5-1: Rolling Playlist Builder
 * 
 * Constrói uma playlist HLS rolling (sem #EXT-X-ENDLIST) a partir de segmentos fornecidos.
 * Rolling = janela deslizante dos últimos N segmentos, mantendo player ativo.
 * 
 * @param {Object} options - Opções de construção
 * @param {Array} options.segments - Array de segmentos: [{ name: string, duration: number }]
 * @param {number} options.windowSize - Tamanho da janela (default: 10)
 * @param {number} options.mediaSequence - Número inicial da sequência (default: auto-calculado)
 * @param {number} options.targetDuration - Duração máxima dos segmentos (default: auto-detectado)
 * @returns {string} Playlist M3U8 rolling válida
 */
function buildRollingPlaylist(options = {}) {
  const startTime = Date.now();
  
  try {
    const {
      segments = [],
      windowSize = 10,
      mediaSequence = null,
      targetDuration = null
    } = options;

    // Validação básica
    if (!Array.isArray(segments)) {
      throw new Error('segments deve ser um array');
    }

    if (segments.length === 0) {
      saveAutoLog('buildRollingPlaylist: segments vazios, retornando playlist vazia', 'warn');
      return buildEmptyRollingPlaylist();
    }

    // Aplicar janela deslizante (últimos N segmentos)
    const windowSegments = segments.slice(-windowSize);
    
    // Auto-detectar targetDuration (maior duração + margem de segurança)
    const maxDuration = Math.max(...windowSegments.map(s => s.duration || 6));
    const calculatedTargetDuration = targetDuration || Math.ceil(maxDuration + 1);
    
    // Auto-calcular mediaSequence baseado na posição do primeiro segmento na janela
    const totalSegments = segments.length;
    const windowStart = Math.max(0, totalSegments - windowSize);
    const calculatedMediaSequence = mediaSequence !== null ? mediaSequence : windowStart;

    // Construir playlist
    const playlistLines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${calculatedTargetDuration}`,
      `#EXT-X-MEDIA-SEQUENCE:${calculatedMediaSequence}`
    ];

    // Adicionar segmentos
    windowSegments.forEach(segment => {
      const duration = segment.duration || 6.0;
      playlistLines.push(`#EXTINF:${duration.toFixed(6)},`);
      playlistLines.push(segment.name);
    });

    // NÃO adicionar #EXT-X-ENDLIST (característica do rolling)
    
    const playlist = playlistLines.join('\n') + '\n';
    
    saveAutoLog(`buildRollingPlaylist: sucesso - ${windowSegments.length} segmentos, janela=${windowSize}, sequence=${calculatedMediaSequence}, targetDuration=${calculatedTargetDuration}`, 'info');
    
    return playlist;
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    saveAutoLog(`buildRollingPlaylist: erro - ${error.message} (${durationMs}ms)`, 'error');
    
    // Fallback: playlist vazia válida
    return buildEmptyRollingPlaylist();
  }
}

/**
 * Constrói playlist rolling vazia (para casos de erro ou ausência de segmentos)
 */
function buildEmptyRollingPlaylist() {
  return [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:6',
    '#EXT-X-MEDIA-SEQUENCE:0'
  ].join('\n') + '\n';
}

/**
 * Valida se uma playlist rolling está bem formada
 * 
 * @param {string} playlist - String da playlist
 * @returns {Object} { valid: boolean, errors: string[], info: Object }
 */
function validateRollingPlaylist(playlist) {
  const errors = [];
  const info = {};
  
  try {
    const lines = playlist.split('\n').filter(line => line.trim());
    
    // Verificações básicas
    if (!lines.includes('#EXTM3U')) {
      errors.push('Missing #EXTM3U header');
    }
    
    if (lines.includes('#EXT-X-ENDLIST')) {
      errors.push('Rolling playlist should not contain #EXT-X-ENDLIST');
    }
    
    const mediaSequenceLine = lines.find(line => line.startsWith('#EXT-X-MEDIA-SEQUENCE:'));
    if (!mediaSequenceLine) {
      errors.push('Missing #EXT-X-MEDIA-SEQUENCE');
    } else {
      info.mediaSequence = parseInt(mediaSequenceLine.split(':')[1]);
    }
    
    const targetDurationLine = lines.find(line => line.startsWith('#EXT-X-TARGETDURATION:'));
    if (!targetDurationLine) {
      errors.push('Missing #EXT-X-TARGETDURATION');
    } else {
      info.targetDuration = parseInt(targetDurationLine.split(':')[1]);
    }
    
    // Contar segmentos
    const extinfLines = lines.filter(line => line.startsWith('#EXTINF:'));
    info.segmentCount = extinfLines.length;
    
    // Calcular duração total aproximada
    let totalDuration = 0;
    extinfLines.forEach(line => {
      const match = line.match(/#EXTINF:([\d.]+),/);
      if (match) {
        totalDuration += parseFloat(match[1]);
      }
    });
    info.totalDurationApprox = totalDuration;
    
    return {
      valid: errors.length === 0,
      errors,
      info
    };
    
  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
    return { valid: false, errors, info };
  }
}

module.exports = {
  buildRollingPlaylist,
  buildEmptyRollingPlaylist,
  validateRollingPlaylist
};
