// HLS Capabilities and Generation Routes
// R4-3: Track download integration

const express = require('express');
const router = express.Router();
const { saveAutoLog } = require('../state/hlsState');
const { detectCapability } = require('../hls/ffmpegCapability');
const { createTempWorkspace, cleanupTempWorkspace } = require('../hls/tempWorkspace');
const { downloadTrackList } = require('../hls/downloadTrackList');
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
 * Reports current FFmpeg capability status with real spawn test
 */
router.get('/capabilities', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Real capability detection with spawn test
    const capability = await detectCapability();
    
    const durationMs = Date.now() - startTime;

    // Log capability check with detailed info
    await saveAutoLog(`Capability check: canSpawn=${capability.canSpawn}, version=${capability.ffmpegVersion}, latency=${capability.spawnLatencyMs}ms`, 'HLS_GEN');

    res.json({
      success: true,
      capability,
      durationMs
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    await saveAutoLog(`Capability error: ${error.message}`, 'HLS_GEN');

    res.json({
      success: true,
      capability: {
        hasFfmpegStatic: false,
        ffmpegPath: null,
        canSpawn: false,
        ffmpegVersion: null,
        spawnLatencyMs: null,
        error: error.message
      },
      durationMs
    });
  }
});

/**
 * GET /workspace-test
 * Tests temporary workspace creation and cleanup (R4-2)
 */
router.get('/workspace-test', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Test workspace creation
    const createResult = await createTempWorkspace();
    
    if (!createResult.success) {
      await saveAutoLog(`Workspace creation failed: ${createResult.error}`, 'HLS_GEN');
      return res.json({
        success: false,
        phase: 'creation',
        error: createResult.error,
        durationMs: Date.now() - startTime
      });
    }
    
    const workspaceDir = createResult.workspaceDir;
    await saveAutoLog(`Workspace created: ${workspaceDir}, free space: ${createResult.freeSpaceBytes ? Math.round(createResult.freeSpaceBytes / 1024 / 1024) + 'MB' : 'unknown'}`, 'HLS_GEN');
    
    // Test cleanup
    const cleanupResult = await cleanupTempWorkspace(workspaceDir);
    
    if (!cleanupResult.success) {
      await saveAutoLog(`Workspace cleanup failed: ${cleanupResult.error}`, 'HLS_GEN');
      return res.json({
        success: false,
        phase: 'cleanup',
        workspaceDir,
        error: cleanupResult.error,
        durationMs: Date.now() - startTime
      });
    }
    
    const durationMs = Date.now() - startTime;
    await saveAutoLog(`Workspace test successful: ${workspaceDir} (${durationMs}ms)`, 'HLS_GEN');
    
    res.json({
      success: true,
      workspaceDir,
      freeSpaceBytes: createResult.freeSpaceBytes,
      freeSpaceMB: createResult.freeSpaceBytes ? Math.round(createResult.freeSpaceBytes / 1024 / 1024) : null,
      durationMs
    });
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    await saveAutoLog(`Workspace test error: ${error.message}`, 'HLS_GEN');
    
    res.json({
      success: false,
      phase: 'unknown',
      error: error.message,
      durationMs
    });
  }
});

/**
 * GET /download-test
 * Tests track download functionality (R4-3)
 */
router.get('/download-test', async (req, res) => {
  const startTime = Date.now();
  let workspaceDir = null;
  
  try {
    const maxTracks = parseInt(req.query.tracks) || 3; // Default 3 tracks for testing
    
    // Create workspace for download test
    const workspaceResult = await createTempWorkspace();
    if (!workspaceResult.success) {
      return res.json({
        success: false,
        phase: 'workspace',
        error: workspaceResult.error,
        durationMs: Date.now() - startTime
      });
    }
    
    workspaceDir = workspaceResult.workspaceDir;
    await saveAutoLog(`Download test workspace: ${workspaceDir}`, 'HLS_GEN');
    
    // Test track download
    const downloadResult = await downloadTrackList(workspaceDir, maxTracks);
    
    if (!downloadResult.success) {
      await saveAutoLog(`Download test failed: ${downloadResult.error}`, 'HLS_GEN');
      return res.json({
        success: false,
        phase: 'download',
        error: downloadResult.error,
        durationMs: Date.now() - startTime
      });
    }
    
    const durationMs = Date.now() - startTime;
    await saveAutoLog(`Download test successful: ${downloadResult.downloadedTracks.length} tracks, ${Math.round(downloadResult.totalBytes / 1024 / 1024)}MB in ${downloadResult.downloadDurationMs}ms`, 'HLS_GEN');
    
    // Clean up after successful test
    await cleanupTempWorkspace(workspaceDir);
    workspaceDir = null; // Prevent cleanup in catch block
    
    res.json({
      success: true,
      downloadedCount: downloadResult.downloadedTracks.length,
      totalBytes: downloadResult.totalBytes,
      totalMB: Math.round(downloadResult.totalBytes / 1024 / 1024),
      downloadDurationMs: downloadResult.downloadDurationMs,
      tracks: downloadResult.downloadedTracks.map(t => ({
        filename: t.filename,
        bytes: t.bytes,
        durationMs: t.durationMs,
        md5: t.md5,
        title: t.originalTrack?.title
      })),
      durationMs
    });
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    await saveAutoLog(`Download test error: ${error.message}`, 'HLS_GEN');
    
    // Clean up workspace on error
    if (workspaceDir) {
      try {
        await cleanupTempWorkspace(workspaceDir);
      } catch (cleanupError) {
        // Best effort cleanup
      }
    }
    
    res.json({
      success: false,
      phase: 'unknown',
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
