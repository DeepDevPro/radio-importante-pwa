// Track Download Module for HLS Generation
// R4-3: Download N tracks from catalog with streaming and metrics

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Downloads first N tracks from catalog to local workspace
 * @param {string} workspaceDir - Local workspace directory
 * @param {number} maxTracks - Maximum number of tracks to download (default: 5)
 * @returns {Promise<{success: boolean, downloadedTracks: Array, downloadDurationMs: number, totalBytes: number, error?: string}>}
 */
async function downloadTrackList(workspaceDir, maxTracks = 5) {
  const startTime = Date.now();
  const result = {
    success: false,
    downloadedTracks: [],
    downloadDurationMs: 0,
    totalBytes: 0,
    error: null
  };

  try {
    // Fetch catalog from API
    const catalog = await fetchCatalog();
    if (!catalog || !catalog.tracks || catalog.tracks.length === 0) {
      throw new Error('No tracks found in catalog');
    }

    // Limit to first N tracks
    const tracksToDownload = catalog.tracks.slice(0, maxTracks);
    console.log(`[DownloadTracks] Starting download of ${tracksToDownload.length} tracks`);

    // Download each track
    for (let i = 0; i < tracksToDownload.length; i++) {
      const track = tracksToDownload[i];
      const downloadResult = await downloadSingleTrack(track, workspaceDir, i);
      
      if (downloadResult.success) {
        result.downloadedTracks.push(downloadResult);
        result.totalBytes += downloadResult.bytes;
        console.log(`[DownloadTracks] Downloaded ${track.filename} (${Math.round(downloadResult.bytes / 1024)}KB in ${downloadResult.durationMs}ms)`);
      } else {
        console.log(`[DownloadTracks] Failed to download ${track.filename}: ${downloadResult.error}`);
        // Continue with other tracks instead of failing completely
      }
    }

    if (result.downloadedTracks.length === 0) {
      throw new Error('No tracks were successfully downloaded');
    }

    result.success = true;
    result.downloadDurationMs = Date.now() - startTime;
    
    console.log(`[DownloadTracks] Completed: ${result.downloadedTracks.length}/${tracksToDownload.length} tracks, ${Math.round(result.totalBytes / 1024 / 1024)}MB in ${result.downloadDurationMs}ms`);

  } catch (error) {
    result.error = error.message;
    result.downloadDurationMs = Date.now() - startTime;
    console.log('[DownloadTracks] Download failed:', error.message);
  }

  return result;
}

/**
 * Fetches catalog from API
 * @returns {Promise<{tracks: Array}>}
 */
async function fetchCatalog() {
  return new Promise((resolve, reject) => {
    const apiUrl = `https://${process.env.DO_APP_BACKEND_URL || 'radio-importante-pwa-backend-skg2w.ondigitalocean.app'}/api/catalog`;
    
    https.get(apiUrl, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const catalog = JSON.parse(data);
          resolve(catalog);
        } catch (parseError) {
          reject(new Error(`Failed to parse catalog: ${parseError.message}`));
        }
      });
      
    }).on('error', (error) => {
      reject(new Error(`Failed to fetch catalog: ${error.message}`));
    });
  });
}

/**
 * Downloads single track file
 * @param {Object} track - Track metadata with url field
 * @param {string} workspaceDir - Target directory
 * @param {number} index - Track index for filename
 * @returns {Promise<{success: boolean, localPath: string, filename: string, bytes: number, md5?: string, durationMs: number, error?: string}>}
 */
async function downloadSingleTrack(track, workspaceDir, index) {
  const startTime = Date.now();
  const result = {
    success: false,
    localPath: null,
    filename: null,
    bytes: 0,
    md5: null,
    durationMs: 0,
    error: null,
    originalTrack: track
  };

  try {
    // Generate local filename (simple numbered format for ffmpeg concat)
    const extension = path.extname(track.filename) || '.mp3';
    const localFilename = `track_${String(index).padStart(3, '0')}${extension}`;
    const localPath = path.join(workspaceDir, localFilename);

    // Download with streaming
    const downloadResult = await streamDownload(track.url, localPath);
    
    result.success = downloadResult.success;
    result.localPath = localPath;
    result.filename = localFilename;
    result.bytes = downloadResult.bytes;
    result.md5 = downloadResult.md5;
    result.durationMs = Date.now() - startTime;
    
    if (!downloadResult.success) {
      result.error = downloadResult.error;
    }

  } catch (error) {
    result.error = error.message;
    result.durationMs = Date.now() - startTime;
  }

  return result;
}

/**
 * Streams download with optional MD5 checksum
 * @param {string} url - Source URL
 * @param {string} localPath - Destination file path
 * @returns {Promise<{success: boolean, bytes: number, md5?: string, error?: string}>}
 */
async function streamDownload(url, localPath) {
  return new Promise((resolve) => {
    const result = {
      success: false,
      bytes: 0,
      md5: null,
      error: null
    };

    try {
      const file = fs.createWriteStream(localPath);
      const hash = crypto.createHash('md5');

      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          result.error = `HTTP ${response.statusCode}`;
          file.close();
          return resolve(result);
        }

        response.on('data', (chunk) => {
          result.bytes += chunk.length;
          hash.update(chunk);
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          result.success = true;
          result.md5 = hash.digest('hex');
          resolve(result);
        });

        file.on('error', (error) => {
          result.error = error.message;
          file.close();
          // Clean up partial file
          try {
            fs.unlinkSync(localPath);
          } catch (unlinkError) {
            // Best effort cleanup
          }
          resolve(result);
        });

      }).on('error', (error) => {
        result.error = error.message;
        resolve(result);
      });

    } catch (error) {
      result.error = error.message;
      resolve(result);
    }
  });
}

module.exports = {
  downloadTrackList,
  downloadSingleTrack
};
