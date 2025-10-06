// HLS Capabilities and Generation Routes
// R4-4: FFmpeg pipeline integration
/* eslint-env node */
/* eslint-disable no-undef */

const express = require('express');
const router = express.Router();
const { saveAutoLog } = require('../state/hlsState');
const { detectCapability } = require('../hls/ffmpegCapability');
const { createTempWorkspace, cleanupTempWorkspace } = require('../hls/tempWorkspace');
const { downloadTrackList } = require('../hls/downloadTrackList');
const { generateVodLatest } = require('../hls/generateVodLatest');
const { publishRollingPlaylist } = require('../hls/publishRollingPlaylist');
const { diagnoseHlsPlaylist } = require('../hls/hlsDiagnostics');
const { handleSafariAnalysisRequest } = require('../hls/safariAnalysis');
const https = require('https');
const AWS = require('aws-sdk');

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

    // Simple capability check with real detection
    const capability = await detectCapability();
    
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
    let segmentCount = 0;
    let transcodeFallback = false;
    let downloadCount = 0;
    let errorSummary = null;
    let downloadDurationMs = 0;
    let ffmpegDurationMs = 0;
    let uploadDurationMs = 0;
    let totalDurationApprox = 0;

    if (shouldSimulate) {
      // Simulate mode logic (R4-11 fallback)
      if (detected.playlistExists) {
        action = 'reused';
      } else if (detected.firstSegmentExists) {
        action = 'synthetic';
      } else {
        action = 'empty';
      }
    } else if (capability.canSpawn && mode === 'latest') {
      // R4-9: Execute real pipeline
      let workspaceDir = null;
      try {
        await saveAutoLog(`Starting real HLS generation for ${mode}`, 'HLS_GEN');

        // Phase 1: Create workspace
        const workspaceResult = await createTempWorkspace();
        if (!workspaceResult.success) {
          throw new Error(`Workspace creation failed: ${workspaceResult.error}`);
        }
        workspaceDir = workspaceResult.workspaceDir;

        // Phase 2: Download tracks (default 3 tracks for main endpoint)
        const downloadResult = await downloadTrackList(workspaceDir, 3);
        if (!downloadResult.success) {
          throw new Error(`Download failed: ${downloadResult.error}`);
        }
        downloadCount = downloadResult.downloadedTracks.length;
        downloadDurationMs = downloadResult.downloadDurationMs;

        // Phase 3: Generate HLS VOD with upload
        const vodResult = await generateVodLatest(workspaceDir, downloadResult.downloadedTracks, {
          forceTranscode: true, // Default to transcode for compatibility
          uploadToSpaces: true, // Always upload in production
          ffmpegPath: capability.ffmpegPath
        });

        if (!vodResult.success) {
          throw new Error(`VOD generation failed: ${vodResult.error}`);
        }

        action = 'generated';
        segmentCount = vodResult.segmentCount;
        totalDurationApprox = vodResult.totalDurationApprox;
        transcodeFallback = vodResult.transcodeFallback;
        ffmpegDurationMs = vodResult.ffmpegDurationMs;
        uploadDurationMs = vodResult.uploadDurationMs || 0;

        // Cleanup workspace on success
        await cleanupTempWorkspace(workspaceDir);
        workspaceDir = null;

        await saveAutoLog(`Real HLS generation successful: ${segmentCount} segments, ${Math.round(totalDurationApprox)}s`, 'HLS_GEN');

      } catch (error) {
        // R4-11: Fallback to simulate on error (no 500)
        action = 'generation_failed';
        errorSummary = error.message.split('\n')[0]; // First line only
        
        // Cleanup workspace on failure
        if (workspaceDir) {
          try {
            await cleanupTempWorkspace(workspaceDir);
          } catch (cleanupError) {
            // Log but don't fail
            await saveAutoLog(`Workspace cleanup failed: ${cleanupError.message}`, 'HLS_GEN');
          }
        }

        await saveAutoLog(`Real HLS generation failed, falling back to simulate: ${errorSummary}`, 'HLS_GEN');
      }
    } else if (mode === 'rolling') {
      // R5-4: Rolling playlist generation (reuses latest segments)
      try {
        await saveAutoLog(`Starting rolling playlist generation`, 'HLS_GEN');

        // Configure S3 client for rolling publish
        const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
        const s3Client = new AWS.S3({
          endpoint: spacesEndpoint,
          accessKeyId: process.env.DO_SPACES_KEY,
          secretAccessKey: process.env.DO_SPACES_SECRET,
          region: process.env.DO_SPACES_REGION || 'nyc3'
        });

        const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
        const spacesUrl = `https://${bucket}.${spacesEndpoint.hostname}`;

        // Publish rolling playlist (integrates R5-1+R5-2+R5-3)
        const rollingResult = await publishRollingPlaylist({
          s3Client,
          bucket,
          spacesUrl,
          windowSize: 10, // Default rolling window size
          simulate: shouldSimulate
        });

        if (rollingResult.success) {
          action = rollingResult.action;
          
          // Extract metrics when available
          if (rollingResult.info) {
            segmentCount = rollingResult.info.windowSegments || 0;
            totalDurationApprox = rollingResult.info.totalLatestSegments || 0; // Use total from latest
            uploadDurationMs = rollingResult.info.uploadDurationMs || 0;
          }

          await saveAutoLog(`Rolling generation ${action}: ${segmentCount} window segments`, 'HLS_GEN');
        } else {
          throw new Error(`Rolling generation failed: ${rollingResult.error}`);
        }

      } catch (error) {
        // Fallback to simulate_missing_latest on rolling error
        action = 'simulate_missing_latest';
        errorSummary = error.message.split('\n')[0];
        
        await saveAutoLog(`Rolling generation failed, falling back: ${errorSummary}`, 'HLS_GEN');
      }
    } else {
      // Real generation not available or mode not supported
      action = 'ready_for_real_generation';
    }

    const durationMs = Date.now() - startTime;

    // R4-10: Log generation with metrics
    const logMetrics = {
      segmentCount,
      totalDurationApprox: Math.round(totalDurationApprox),
      ffmpegDurationMs,
      uploadDurationMs,
      downloadDurationMs,
      transcodeFallback,
      downloadCount
    };
    
    if (action === 'generated') {
      await saveAutoLog(`Generate ${mode}: ${action} - ${logMetrics.segmentCount} segments, ${logMetrics.totalDurationApprox}s in ${durationMs}ms`, 'HLS_GEN');
    } else {
      await saveAutoLog(`Generate ${mode}: ${action} (simulate:${shouldSimulate})`, 'HLS_GEN');
    }

    // Build response with all available metrics
    const response = {
      success: true,
      mode,
      simulate: shouldSimulate,
      capability,
      action,
      detected,
      durationMs
    };

    // Add metrics for real generation
    if (action === 'generated') {
      response.segmentCount = segmentCount;
      response.totalDurationApprox = Math.round(totalDurationApprox);
      response.downloadCount = downloadCount;
      response.transcodeFallback = transcodeFallback;
      response.downloadDurationMs = downloadDurationMs;
      response.ffmpegDurationMs = ffmpegDurationMs;
      response.uploadDurationMs = uploadDurationMs;
    }

    // Add metrics for rolling generation (R5-4)
    if (mode === 'rolling' && ['rolling_published', 'simulate_missing_latest'].includes(action)) {
      response.windowSegments = segmentCount;
      if (uploadDurationMs > 0) {
        response.uploadDurationMs = uploadDurationMs;
      }
    }

    // Add error summary for failed generation
    if (action === 'generation_failed') {
      response.errorSummary = errorSummary;
    }

    res.json(response);

  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    await saveAutoLog(`Generate error ${mode}: ${error.message}`, 'HLS_GEN');

    // R4-11: Never return 500, always fallback gracefully
    res.json({
      success: true, // Keep success true for UI compatibility
      mode,
      simulate: true, // Force simulate on error
      capability: { canSpawn: false, error: error.message },
      action: 'generation_failed',
      detected: { playlistExists: false, firstSegmentExists: false },
      errorSummary: error.message.split('\n')[0],
      durationMs
    });
  }
});

/**
 * GET /vod-test
 * Tests complete VOD generation pipeline (R4-4 + R4-5 + R4-7)
 * Query params: ?tracks=3&forceTranscode=true&upload=true
 */
router.get('/vod-test', async (req, res) => {
  const startTime = Date.now();
  let workspaceDir = null;
  
  try {
    const maxTracks = parseInt(req.query.tracks) || 3;
    const forceTranscode = req.query.forceTranscode === 'true';
    const uploadToSpaces = req.query.upload === 'true';
    
    // Get FFmpeg capability
    const capability = await detectCapability();
    if (!capability.canSpawn) {
      return res.json({
        success: false,
        phase: 'capability',
        error: 'FFmpeg not available for VOD generation',
        capability,
        durationMs: Date.now() - startTime
      });
    }
    
    await saveAutoLog(`VOD test starting: ${maxTracks} tracks, forceTranscode: ${forceTranscode}, upload: ${uploadToSpaces}, ffmpeg: ${capability.ffmpegVersion}`, 'HLS_GEN');
    
    // Phase 1: Create workspace
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
    
    // Phase 2: Download tracks
    const downloadResult = await downloadTrackList(workspaceDir, maxTracks);
    if (!downloadResult.success) {
      return res.json({
        success: false,
        phase: 'download',
        error: downloadResult.error,
        downloadDurationMs: downloadResult.downloadDurationMs,
        durationMs: Date.now() - startTime
      });
    }
    
    // Phase 3: Generate HLS VOD
    const vodResult = await generateVodLatest(workspaceDir, downloadResult.downloadedTracks, {
      forceTranscode,
      uploadToSpaces,
      ffmpegPath: capability.ffmpegPath
    });
    
    if (!vodResult.success) {
      return res.json({
        success: false,
        phase: 'vod_generation',
        error: vodResult.error,
        downloadDurationMs: downloadResult.downloadDurationMs,
        ffmpegDurationMs: vodResult.ffmpegDurationMs,
        transcodeFallback: vodResult.transcodeFallback,
        durationMs: Date.now() - startTime
      });
    }
    
    const durationMs = Date.now() - startTime;
    await saveAutoLog(`VOD test successful: ${vodResult.segmentCount} segments, ${Math.round(vodResult.totalDurationApprox)}s, ${downloadResult.downloadedTracks.length} tracks in ${durationMs}ms`, 'HLS_GEN');
    
    // Clean up after successful test
    await cleanupTempWorkspace(workspaceDir);
    workspaceDir = null;
    
    res.json({
      success: true,
      segmentCount: vodResult.segmentCount,
      totalDurationApprox: Math.round(vodResult.totalDurationApprox),
      downloadedCount: downloadResult.downloadedTracks.length,
      downloadDurationMs: downloadResult.downloadDurationMs,
      ffmpegDurationMs: vodResult.ffmpegDurationMs,
      uploadDurationMs: vodResult.uploadDurationMs,
      uploadError: vodResult.uploadError,
      transcodeFallback: vodResult.transcodeFallback,
      uploaded: uploadToSpaces,
      totalBytes: downloadResult.totalBytes,
      capability: {
        ffmpegVersion: capability.ffmpegVersion,
        spawnLatencyMs: capability.spawnLatencyMs
      },
      durationMs
    });
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    await saveAutoLog(`VOD test error: ${error.message}`, 'HLS_GEN');
    
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
 * GET /upload-test  
 * Tests HLS upload functionality (R4-7) using mock files
 */
router.get('/upload-test', async (req, res) => {
  const startTime = Date.now();
  const { uploadHlsFiles } = require('../hls/uploadHlsFiles');
  
  try {
    // Create a mock HLS workspace to test upload
    const mockWorkspace = '/tmp/mock-hls-test';
    const fs = require('fs');
    
    // Create mock files
    if (!fs.existsSync(mockWorkspace)) {
      fs.mkdirSync(mockWorkspace, { recursive: true });
    }
    
    // Create mock playlist
    const mockPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:7
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:6.000000,
segment_000.ts
#EXTINF:6.000000,
segment_001.ts
#EXT-X-ENDLIST`;
    
    fs.writeFileSync(`${mockWorkspace}/index.m3u8`, mockPlaylist);
    
    // Create mock segments (small dummy files)
    fs.writeFileSync(`${mockWorkspace}/segment_000.ts`, Buffer.alloc(1024, 0));
    fs.writeFileSync(`${mockWorkspace}/segment_001.ts`, Buffer.alloc(1024, 0));
    
    // Test upload
    const uploadResult = await uploadHlsFiles(mockWorkspace, 'generated/hls/test/');
    
    // Cleanup
    fs.rmSync(mockWorkspace, { recursive: true, force: true });
    
    const durationMs = Date.now() - startTime;
    await saveAutoLog(`Upload test: ${uploadResult.success ? 'success' : 'failed'} - ${uploadResult.segmentCount} segments in ${uploadResult.uploadDurationMs}ms`, 'HLS_GEN');
    
    res.json({
      success: uploadResult.success,
      segmentCount: uploadResult.segmentCount,
      uploadDurationMs: uploadResult.uploadDurationMs,
      error: uploadResult.error,
      durationMs
    });
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    await saveAutoLog(`Upload test error: ${error.message}`, 'HLS_GEN');
    
    res.json({
      success: false,
      error: error.message,
      durationMs
    });
  }
});

/**
 * GET /:mode/diagnostics
 * R5-5: HLS Playlist Diagnostics (supports 'latest' and 'rolling')
 * 
 * Diagnoses playlist health including:
 * - Playlist parsing (EXTINF count, hasEndlist)
 * - Segment probing (1st, middle, last via HEAD)
 * - Status classification (ok/missing/partial/stalled)
 * - Timing metrics and duration analysis
 */
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

    // Configuration from query params
    const {
      timeout = '3000',
      cacheBust = 'true',
      probeSegments = 'true'
    } = req.query;

    // Build Spaces URL
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
    const spacesUrl = `https://${bucket}.${endpoint}`;

    // Execute diagnostics
    const diagnosticsResult = await diagnoseHlsPlaylist({
      mode,
      spacesUrl,
      timeout: parseInt(timeout),
      cacheBust: cacheBust === 'true',
      probeSegments: probeSegments === 'true'
    });

    // R5-5: Always return 200 with structured response
    res.json({
      success: true,
      ...diagnosticsResult,
      spacesUrl,
      query: {
        timeout: parseInt(timeout),
        cacheBust: cacheBust === 'true',
        probeSegments: probeSegments === 'true'
      }
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    await saveAutoLog(`Diagnostics error ${mode}: ${error.message}`, 'HLS_DIAG');

    // Never return 500, always structured response
    res.json({
      success: false,
      mode,
      status: 'error',
      error: error.message,
      durationMs
    });
  }
});

// R5-10: Safari Analysis Endpoint
router.post('/safari-analysis', handleSafariAnalysisRequest);

module.exports = router;
