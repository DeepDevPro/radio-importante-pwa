// HLS Capabilities and Generation Routes
// R3: Bootstrap FFmpeg + Endpoint Unificado (Capacidade + Simulate)

const express = require('express');
const router = express.Router();
const { saveAutoLog } = require('../state/hlsState');

/**
 * GET /capabilities
 * Reports current FFmpeg capability status
 */
router.get('/capabilities', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Basic capability detection without external modules for now
    const capability = {
      hasFfmpegStatic: false,
      ffmpegPath: null,
      canSpawn: false,
      error: 'ffmpeg-static not yet integrated'
    };
    
    const durationMs = Date.now() - startTime;

    // Log capability check
    await saveAutoLog('HLS_GEN', {
      type: 'capability',
      capability,
      durationMs
    });

    res.json({
      success: true,
      capability,
      durationMs
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    await saveAutoLog('HLS_GEN', {
      type: 'capability',
      error: error.message,
      durationMs
    });

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

    // Basic capability (hardcoded for now)
    const capability = {
      hasFfmpegStatic: false,
      ffmpegPath: null,
      canSpawn: false,
      error: 'ffmpeg-static not yet integrated'
    };
    
    // Auto-determine simulate mode if not specified
    const shouldSimulate = simulate !== undefined ? simulate : !capability.canSpawn;

    // Basic scan (hardcoded for now)
    const detected = {
      playlistExists: true, // assume exists from previous generation
      firstSegmentExists: true
    };

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
    await saveAutoLog('HLS_GEN', {
      type: 'generate',
      mode,
      simulate: shouldSimulate,
      capability,
      action,
      detected,
      durationMs
    });

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
    
    await saveAutoLog('HLS_GEN', {
      type: 'generate',
      mode,
      error: error.message,
      durationMs
    });

    res.status(500).json({
      success: false,
      mode,
      error: error.message,
      durationMs
    });
  }
});

module.exports = router;
