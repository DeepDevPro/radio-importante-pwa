/* eslint-env node */
/* eslint-disable no-undef */
// VOD Latest HLS Generation Module
// R4-4: FFmpeg pipeline using fluent-ffmpeg with codec detection and transcoding

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { uploadHlsFiles } = require('./uploadHlsFiles');

/*
 * PATCH A (Live-lite enablement):
 * - Remove '-hls_playlist_type vod' to avoid Safari treating playlist as finite when we plan to evolve to rolling/live.
 * - Relax validation: no longer require #EXT-X-PLAYLIST-TYPE:VOD nor #EXT-X-ENDLIST.
 * - This creates a "live-like" static snapshot (player will not stop early due to VOD termination markers).
 * - Future improvement (Phase 2): replace concat VOD with continuous segmenter.
 */

/**
 * Generates HLS VOD playlist from downloaded MP3 tracks
 * @param {string} workspaceDir - Directory containing downloaded tracks
 * @param {Array} downloadedTracks - Array of track metadata from download
 * @param {Object} options - Generation options
 * @param {boolean} options.forceTranscode - Force AAC transcoding instead of trying copy
 * @param {boolean} options.uploadToSpaces - Upload files to Spaces after generation (R4-7)
 * @param {string} options.ffmpegPath - Path to ffmpeg binary
 * @returns {Promise<{success: boolean, segmentCount: number, playlistPath: string, totalDurationApprox: number, ffmpegDurationMs: number, uploadDurationMs?: number, transcodeFallback: boolean, error?: string}>}
 */
async function generateVodLatest(workspaceDir, downloadedTracks, options = {}) {
  const startTime = Date.now();
  const result = {
    success: false,
    segmentCount: 0,
    playlistPath: null,
    totalDurationApprox: 0,
    ffmpegDurationMs: 0,
    transcodeFallback: false,
    error: null
  };

  try {
    const { forceTranscode = false, ffmpegPath } = options;
    
    if (!downloadedTracks || downloadedTracks.length === 0) {
      throw new Error('No downloaded tracks provided');
    }

    // Set ffmpeg path if provided
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }

    console.log(`[GenerateVOD] Starting HLS generation for ${downloadedTracks.length} tracks, forceTranscode: ${forceTranscode}`);

    // Create file list for concat
    const concatListPath = path.join(workspaceDir, 'concat_list.txt');
    const concatContent = downloadedTracks
      .map(track => `file '${track.filename}'`)
      .join('\n');
    
    await fs.promises.writeFile(concatListPath, concatContent, 'utf8');
    console.log(`[GenerateVOD] Created concat list: ${downloadedTracks.length} files`);

    // Output paths
    const playlistPath = path.join(workspaceDir, 'index.m3u8');
    const segmentPattern = path.join(workspaceDir, 'segment_%03d.ts');

    // Try generation with strategy
    let generationSuccess = false;
    
    if (!forceTranscode) {
      // First attempt: try copy codec (faster)
      console.log('[GenerateVOD] Attempting copy codec generation...');
      generationSuccess = await attemptGeneration(concatListPath, playlistPath, segmentPattern, false);
      
      if (!generationSuccess) {
        console.log('[GenerateVOD] Copy codec failed, falling back to transcode...');
        result.transcodeFallback = true;
      }
    }

    if (!generationSuccess) {
      // Second attempt: force transcode to AAC
      console.log('[GenerateVOD] Starting AAC transcode generation...');
      generationSuccess = await attemptGeneration(concatListPath, playlistPath, segmentPattern, true);
    }

    if (!generationSuccess) {
      throw new Error('Both copy and transcode strategies failed');
    }

    // Validate and parse results
    const validation = await validateHlsOutput(workspaceDir);
    if (!validation.success) {
      throw new Error(`HLS validation failed: ${validation.error}`);
    }

    await postProcessLiveLite(path.join(workspaceDir, 'index.m3u8'));
    await rebuildLiveLikePlaylist(path.join(workspaceDir, 'index.m3u8'));

    // Re-check markers and force rewrite if still present
    try {
      const p = path.join(workspaceDir, 'index.m3u8');
      let c = await fs.promises.readFile(p, 'utf8');
      if (/#EXT-X-PLAYLIST-TYPE:VOD/.test(c) || /#EXT-X-ENDLIST/.test(c)) {
        const filtered = c.split('\n').filter(l => !l.startsWith('#EXT-X-PLAYLIST-TYPE:') && l.trim() !== '#EXT-X-ENDLIST').join('\n');
        if (filtered !== c) {
          await fs.promises.writeFile(p, filtered, 'utf8');
          console.log('[GenerateVOD] Forced rewrite removing residual VOD markers');
        }
      }
    } catch (e) {
      console.log('[GenerateVOD] Marker recheck failed:', e.message);
    }

    result.success = true;
    result.playlistPath = playlistPath;
    result.segmentCount = validation.segmentCount;
    result.totalDurationApprox = validation.totalDuration;
    result.ffmpegDurationMs = Date.now() - startTime;

    console.log(`[GenerateVOD] Success: ${result.segmentCount} segments, ${result.totalDurationApprox}s duration in ${result.ffmpegDurationMs}ms`);

    // R4-7: Upload to Spaces if requested
    if (options.uploadToSpaces) {
      console.log('[GenerateVOD] Starting upload to Spaces...');
      const uploadResult = await uploadHlsFiles(workspaceDir, 'generated/hls/latest/');
      
      if (uploadResult.success) {
        result.uploadDurationMs = uploadResult.uploadDurationMs;
        console.log(`[GenerateVOD] Upload complete: ${uploadResult.segmentCount} segments in ${uploadResult.uploadDurationMs}ms`);
      } else {
        // Upload failure doesn't fail the generation - files are still valid locally
        result.uploadError = uploadResult.error;
        result.uploadDurationMs = uploadResult.uploadDurationMs;
        console.log(`[GenerateVOD] Upload failed: ${uploadResult.error}`);
      }
    }

  } catch (error) {
    result.error = error.message;
    result.ffmpegDurationMs = Date.now() - startTime;
    console.log('[GenerateVOD] Generation failed:', error.message);
  }

  return result;
}

/**
 * Attempts HLS generation with specified codec strategy
 * @param {string} concatListPath - Path to concat list file
 * @param {string} playlistPath - Output playlist path
 * @param {string} segmentPattern - Segment filename pattern
 * @param {boolean} transcode - Whether to transcode to AAC
 * @returns {Promise<boolean>} Success status
 */
async function attemptGeneration(concatListPath, playlistPath, segmentPattern, transcode) {
  return new Promise((resolve) => {
    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-hide_banner',
        '-nostdin',
        '-f', 'hls',
        '-hls_time', '6',
        '-hls_playlist_type', 'event',  // EVENT type: no ENDLIST, allows continuation
        '-hls_segment_filename', segmentPattern,
        '-start_number', '0'
      ]);

    // Add codec options
    if (transcode) {
      command.outputOptions(['-vn', '-c:a', 'aac', '-b:a', '128k']);
    } else {
      command.outputOptions(['-c', 'copy']);
    }

    command
      .output(playlistPath)
      .on('start', (commandLine) => {
        console.log(`[FFmpeg] ${transcode ? 'Transcode' : 'Copy'} command: ${commandLine}`);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`[FFmpeg] Progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('stderr', (stderrLine) => {
        if (stderrLine.includes('error') || stderrLine.includes('Error') || stderrLine.includes('failed')) {
          console.log(`[FFmpeg] Error: ${stderrLine}`);
        }
      })
      .on('error', (error) => {
        console.log(`[FFmpeg] ${transcode ? 'Transcode' : 'Copy'} failed:`, error.message);
        resolve(false);
      })
      .on('end', () => {
        console.log(`[FFmpeg] ${transcode ? 'Transcode' : 'Copy'} completed successfully`);
        resolve(true);
      })
      .run();

    if (!transcode) {
      setTimeout(() => {
        console.log('[FFmpeg] Copy attempt timeout, assuming failure');
        command.kill('SIGKILL');
        resolve(false);
      }, 10000);
    }
  });
}

/**
 * Validates HLS output and extracts metadata
 * @param {string} workspaceDir - Directory containing HLS files
 * @returns {Promise<{success: boolean, segmentCount: number, totalDuration: number, error?: string}>}
 */
async function validateHlsOutput(workspaceDir) {
  const result = {
    success: false,
    segmentCount: 0,
    totalDuration: 0,
    error: null
  };

  try {
    const playlistPath = path.join(workspaceDir, 'index.m3u8');
    if (!fs.existsSync(playlistPath)) {
      throw new Error('Playlist file index.m3u8 not found');
    }

    const playlistContent = await fs.promises.readFile(playlistPath, 'utf8');

    // Relaxed: no mandatory VOD markers / ENDLIST (live-like patch)
    // We only require at least one EXTINF and first segment existence.

    const extinf = playlistContent.match(/#EXTINF:([0-9.]+),/g);
    if (!extinf || extinf.length === 0) {
      throw new Error('No segments found in playlist');
    }

    result.segmentCount = extinf.length;
    result.totalDuration = extinf.reduce((total, line) => {
      const duration = parseFloat(line.match(/([0-9.]+)/)[1]);
      return total + duration;
    }, 0);

    const firstSegmentMatch = playlistContent.match(/segment_\d+\.ts/);
    if (!firstSegmentMatch) {
      throw new Error('No segment files referenced in playlist');
    }
    const firstSegmentPath = path.join(workspaceDir, firstSegmentMatch[0]);
    if (!fs.existsSync(firstSegmentPath)) {
      throw new Error(`First segment file ${firstSegmentMatch[0]} not found`);
    }

    result.success = true;
    console.log(`[ValidateHLS] Success (live-lite): ${result.segmentCount} segments, ${Math.round(result.totalDuration)}s total`);

  } catch (error) {
    result.error = error.message;
    console.log('[ValidateHLS] Validation failed:', error.message);
  }

  return result;
}

/**
 * Post-processes HLS playlist to strip VOD/Event markers
 * @param {string} playlistPath - Path to the playlist file
 * @returns {Promise<void>}
 */
async function postProcessLiveLite(playlistPath) {
  try {
    let content = await fs.promises.readFile(playlistPath, 'utf8');
    const original = content;
    const beforeLines = content.split('\n').length;
    // Remove PLAYLIST-TYPE and ENDLIST lines
    content = content
      .split('\n')
      .filter(l => !(l.startsWith('#EXT-X-PLAYLIST-TYPE:')) && l.trim() !== '#EXT-X-ENDLIST')
      .join('\n');
    if (content !== original) {
      await fs.promises.writeFile(playlistPath, content, 'utf8');
      console.log(`[GenerateVOD] Post-process: stripped markers (lines ${beforeLines} -> ${content.split('\n').length})`);
    } else {
      console.log('[GenerateVOD] Post-process: no markers to strip');
    }
  } catch (e) {
    console.log('[GenerateVOD] Post-process failed:', e.message);
  }
}

/**
 * Rebuilds the HLS playlist to a live-like state by stripping PLAYLIST-TYPE and ENDLIST
 * @param {string} playlistPath - Path to the playlist file
 * @returns {Promise<void>}
 */
async function rebuildLiveLikePlaylist(playlistPath) {
  try {
    const raw = await fs.promises.readFile(playlistPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length);
    const segments = [];
    let currentDur = null;
    for (const line of lines) {
      if (line.startsWith('#EXTINF:')) {
        const m = line.match(/#EXTINF:([0-9.]+)/);
        currentDur = m ? parseFloat(m[1]) : null;
      } else if (!line.startsWith('#') && currentDur !== null) {
        segments.push({ name: line.trim(), duration: currentDur });
        currentDur = null;
      }
    }
    if (segments.length === 0) {
      console.log('[GenerateVOD] Rebuild skipped: no segments parsed');
      return;
    }
    const target = Math.ceil(Math.max(...segments.map(s => s.duration || 6)) + 0.5);
    const rebuilt = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${target}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-INDEPENDENT-SEGMENTS'
    ];
    segments.forEach(s => {
      rebuilt.push(`#EXTINF:${s.duration.toFixed(6)},`);
      rebuilt.push(s.name);
    });
    rebuilt.push('');
    await fs.promises.writeFile(playlistPath, rebuilt.join('\n'), 'utf8');
    console.log('[GenerateVOD] Playlist rebuilt live-like (removed PLAYLIST-TYPE/ENDLIST)');
  } catch (e) {
    console.log('[GenerateVOD] Rebuild failed:', e.message);
  }
}

module.exports = { generateVodLatest };
