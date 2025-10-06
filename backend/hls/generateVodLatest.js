// VOD Latest HLS Generation Module
// R4-4: FFmpeg pipeline using fluent-ffmpeg with codec detection and transcoding

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

/**
 * Generates HLS VOD playlist from downloaded MP3 tracks
 * @param {string} workspaceDir - Directory containing downloaded tracks
 * @param {Array} downloadedTracks - Array of track metadata from download
 * @param {Object} options - Generation options
 * @param {boolean} options.forceTranscode - Force AAC transcoding instead of trying copy
 * @param {string} options.ffmpegPath - Path to ffmpeg binary
 * @returns {Promise<{success: boolean, segmentCount: number, playlistPath: string, totalDurationApprox: number, ffmpegDurationMs: number, transcodeFallback: boolean, error?: string}>}
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

    result.success = true;
    result.playlistPath = playlistPath;
    result.segmentCount = validation.segmentCount;
    result.totalDurationApprox = validation.totalDuration;
    result.ffmpegDurationMs = Date.now() - startTime;

    console.log(`[GenerateVOD] Success: ${result.segmentCount} segments, ${result.totalDurationApprox}s duration in ${result.ffmpegDurationMs}ms`);

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
        '-hls_playlist_type', 'vod',
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
        // Log important stderr lines (errors, warnings)
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

    // Timeout for copy attempts (should fail quickly if incompatible)
    if (!transcode) {
      setTimeout(() => {
        console.log('[FFmpeg] Copy attempt timeout, assuming failure');
        command.kill('SIGKILL');
        resolve(false);
      }, 10000); // 10 seconds for copy attempts
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
    
    // Check if playlist exists
    if (!fs.existsSync(playlistPath)) {
      throw new Error('Playlist file index.m3u8 not found');
    }

    // Read and parse playlist
    const playlistContent = await fs.promises.readFile(playlistPath, 'utf8');
    
    // Check for VOD marker
    if (!playlistContent.includes('#EXT-X-PLAYLIST-TYPE:VOD')) {
      throw new Error('Missing VOD playlist type marker');
    }

    // Check for end marker
    if (!playlistContent.includes('#EXT-X-ENDLIST')) {
      throw new Error('Missing playlist end marker');
    }

    // Count segments and calculate duration
    const extinf = playlistContent.match(/#EXTINF:([0-9.]+),/g);
    if (!extinf || extinf.length === 0) {
      throw new Error('No segments found in playlist');
    }

    result.segmentCount = extinf.length;
    result.totalDuration = extinf.reduce((total, line) => {
      const duration = parseFloat(line.match(/([0-9.]+)/)[1]);
      return total + duration;
    }, 0);

    // Verify at least first segment exists
    const firstSegmentMatch = playlistContent.match(/segment_\d+\.ts/);
    if (!firstSegmentMatch) {
      throw new Error('No segment files referenced in playlist');
    }

    const firstSegmentPath = path.join(workspaceDir, firstSegmentMatch[0]);
    if (!fs.existsSync(firstSegmentPath)) {
      throw new Error(`First segment file ${firstSegmentMatch[0]} not found`);
    }

    result.success = true;
    console.log(`[ValidateHLS] Success: ${result.segmentCount} segments, ${Math.round(result.totalDuration)}s total`);

  } catch (error) {
    result.error = error.message;
    console.log('[ValidateHLS] Validation failed:', error.message);
  }

  return result;
}

module.exports = {
  generateVodLatest
};
