const express = require('express');
const https = require('https');
const { saveAutoLog } = require('../state/hlsState');

const router = express.Router();

// Configuração do DigitalOcean Spaces
const BUCKET = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
const ENDPOINT = process.env.DO_SPACES_ENDPOINT || 'atl1.digitaloceanspaces.com';

/**
 * Função genérica para proxy de arquivos HLS do Spaces
 * @param {string} spacesPath - Caminho no Spaces (ex: 'generated/hls/latest/index.m3u8')
 * @param {boolean} isPlaylist - Se é playlist (cache diferente)
 */
function proxyHLSFile(spacesPath, isPlaylist = false) {
  return (req, res) => {
    const startTime = Date.now();
    const spacesUrl = `https://${BUCKET}.${ENDPOINT}/${spacesPath}`;
    
    console.log(`[HLS_PROXY] Request: ${req.originalUrl} -> ${spacesUrl}`);
    saveAutoLog(`[HLS_PROXY] === REQUEST START ===`);
    saveAutoLog(`[HLS_PROXY] Client: ${req.ip}`);
    saveAutoLog(`[HLS_PROXY] User-Agent: ${req.get('User-Agent') || 'Unknown'}`);
    saveAutoLog(`[HLS_PROXY] Timestamp: ${new Date().toISOString()}`);
    saveAutoLog(`[HLS_PROXY] Fetching from: ${spacesUrl}`);

    const request = https.get(spacesUrl, (spacesRes) => {
      const duration = Date.now() - startTime;
      
      saveAutoLog(`[HLS_PROXY] Spaces response status: ${spacesRes.statusCode} (${duration}ms)`);
      saveAutoLog(`[HLS_PROXY] Spaces headers: ${JSON.stringify(spacesRes.headers)}`);

      // Headers para playlist (sem cache)
      if (isPlaylist) {
        res.set({
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Content-Length': spacesRes.headers['content-length'],
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Range',
          'Accept-Ranges': 'bytes'
        });
      } else {
        // Headers para segmentos (cache longo)
        res.set({
          'Content-Type': 'video/MP2T',
          'Content-Length': spacesRes.headers['content-length'],
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Range',
          'Accept-Ranges': 'bytes'
        });
      }

      saveAutoLog(`[HLS_PROXY] Response headers: ${JSON.stringify({
        'Content-Type': res.get('Content-Type'),
        'Content-Length': res.get('Content-Length'),
        'Cache-Control': res.get('Cache-Control'),
        'Pragma': res.get('Pragma'),
        'Expires': res.get('Expires'),
        'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Headers': res.get('Access-Control-Allow-Headers'),
        'Accept-Ranges': res.get('Accept-Ranges')
      })}`);

      res.status(spacesRes.statusCode);
      spacesRes.pipe(res);

      spacesRes.on('end', () => {
        const totalDuration = Date.now() - startTime;
        const contentLength = spacesRes.headers['content-length'] || 0;
        saveAutoLog(`[HLS_PROXY] Transfer complete: ${contentLength} bytes in ${totalDuration}ms`);
        saveAutoLog(`[HLS_PROXY] === REQUEST END ===`);
      });
    });

    request.on('error', (error) => {
      const duration = Date.now() - startTime;
      console.error(`[HLS_PROXY] Erro ao acessar Spaces (${duration}ms):`, error.message);
      saveAutoLog(`[HLS_PROXY] === REQUEST ERROR ===`);
      saveAutoLog(`[HLS_PROXY] Error: ${error.message} (${duration}ms)`);
      res.status(404).json({ error: 'Arquivo HLS não encontrado' });
    });

    request.setTimeout(30000, () => {
      saveAutoLog(`[HLS_PROXY] === REQUEST TIMEOUT ===`);
      saveAutoLog(`[HLS_PROXY] Timeout after 30s`);
      request.abort();
      res.status(504).json({ error: 'Timeout ao acessar arquivo HLS' });
    });
  };
}

// Rotas para HLS Latest
router.get('/hls/latest/index.m3u8', proxyHLSFile('generated/hls/latest/index.m3u8', true));
router.get('/hls/latest/:segment', (req, res) => {
  const segment = req.params.segment;
  proxyHLSFile(`generated/hls/latest/${segment}`, false)(req, res);
});

// Rotas para HLS Rolling
router.get('/hls/rolling/index.m3u8', proxyHLSFile('generated/hls/rolling/index.m3u8', true));
router.get('/hls/rolling/:segment', (req, res) => {
  const segment = req.params.segment;
  proxyHLSFile(`generated/hls/rolling/${segment}`, false)(req, res);
});

// ========== R2: ALIASES /api/hls/* ==========
// Rotas alias para compatibilidade com versões anteriores

// Aliases para HLS Latest
router.get('/api/hls/latest/index.m3u8', proxyHLSFile('generated/hls/latest/index.m3u8', true));
router.get('/api/hls/latest/:segment', (req, res) => {
  const segment = req.params.segment;
  proxyHLSFile(`generated/hls/latest/${segment}`, false)(req, res);
});

// Aliases para HLS Rolling
router.get('/api/hls/rolling/index.m3u8', proxyHLSFile('generated/hls/rolling/index.m3u8', true));
router.get('/api/hls/rolling/:segment', (req, res) => {
  const segment = req.params.segment;
  proxyHLSFile(`generated/hls/rolling/${segment}`, false)(req, res);
});

module.exports = router;
