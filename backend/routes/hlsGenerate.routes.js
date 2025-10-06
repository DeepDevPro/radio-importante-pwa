// HLS Capabilities and Generation Routes
// R3: Bootstrap FFmpeg + Endpoint Unificado (Versão Simplificada)

const express = require('express');
const router = express.Router();
const { saveAutoLog } = require('../state/hlsState');
const https = require('https');

/**
 * Simple HEAD check for URL existence
 */
function headCheck(url) {
  return new Promise((resolve) => {
    const request = https.request(url, { method: 'HEAD' }, (response) => {
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
    request.setTimeout(3000, () => {
      request.destroy();
      resolve(false);
    });
    request.end();
  });
}

/**
 * GET /capabilities
 * Reports current FFmpeg capability status
 */
router.get('/capabilities', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Very basic capability detection without any external requires
    const capability = {
      hasFfmpegStatic: false,
      ffmpegPath: null,
      canSpawn: false,
      error: 'Capability detection not implemented yet'
    };
    
    const durationMs = Date.now() - startTime;

    // Log capability check
    await saveAutoLog(`Capability check: ${JSON.stringify(capability)}`, 'HLS_GEN');

    res.json({
      success: true,
      capability,
      durationMs
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    await saveAutoLog(`Capability error: ${error.message}`, 'HLS_GEN');

    res.status(500).json({
      success: false,
      error: error.message,
      durationMs
    });
  }
});

/**
 * POST /generate-hls
 * Unified generation endpoint with capability detection and simulate fallback
 */
router.post('/generate-hls', async (req, res) => {
  const startTime = Date.now();
  const { mode = 'latest', simulate } = req.body;

  try {
    // Validate mode
    if (!['latest', 'rolling'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be "latest" or "rolling"',
        durationMs: Date.now() - startTime
      });
    }

    // Simple capability check
    let hasFfmpeg = false;
    try {
      require('ffmpeg-static');
      hasFfmpeg = true;
    } catch (e) {
      // Not available
    }
    
    const capability = {
      hasFfmpegStatic: hasFfmpeg,
      canSpawn: false, // Conservative for now
      ffmpegPath: hasFfmpeg ? 'available' : null
    };
    
    // Auto-determine simulate mode if not specified
    const shouldSimulate = simulate !== undefined ? simulate : !capability.canSpawn;

    // Quick scan of Spaces
    const bucketUrl = `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT}`;
    const playlistUrl = `${bucketUrl}/generated/hls/${mode}/index.m3u8`;
    const segmentUrl = `${bucketUrl}/generated/hls/${mode}/segment_000.ts`;
    
    const [playlistExists, firstSegmentExists] = await Promise.all([
      headCheck(playlistUrl),
      headCheck(segmentUrl)
    ]);
    
    const detected = { playlistExists, firstSegmentExists };

    let action;
    if (shouldSimulate) {
      // Simulate mode logic
      if (detected.playlistExists) {
        action = 'reused';
      } else if (detected.firstSegmentExists) {
        action = 'synthetic';
      } else {
        action = 'empty';
      }
    } else {
      // Real generation capability available
      action = 'ready_for_real_generation';
    }

    const durationMs = Date.now() - startTime;

    // Log generation attempt
    await saveAutoLog(`Generate ${mode}: ${action} (simulate:${shouldSimulate})`, 'HLS_GEN');

    res.json({
      success: true,
      mode,
      simulate: shouldSimulate,
      capability,
      action,
      detected,
      durationMs
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    await saveAutoLog(`Generate error ${mode}: ${error.message}`, 'HLS_GEN');

    res.status(500).json({
      success: false,
      mode,
      error: error.message,
      durationMs
    });
  }
});

module.exports = router;
