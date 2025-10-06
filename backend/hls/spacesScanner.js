// HLS Spaces Scanner Module
// Quick scanner to check existing playlists and segments in DigitalOcean Spaces

const https = require('https');

/**
 * Quick scan of HLS artifacts in Spaces
 * @param {string} mode - 'latest' or 'rolling'
 * @returns {Promise<{playlistExists: boolean, firstSegmentExists: boolean, error?: string}>}
 */
async function scanSpaces(mode) {
  const result = {
    playlistExists: false,
    firstSegmentExists: false,
    error: null
  };

  try {
    const bucketUrl = `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT}`;
    const playlistUrl = `${bucketUrl}/generated/hls/${mode}/index.m3u8`;
    const segmentUrl = `${bucketUrl}/generated/hls/${mode}/segment_000.ts`;

    // Check playlist existence (HEAD request)
    result.playlistExists = await headCheck(playlistUrl);
    
    // Check first segment existence (HEAD request)
    result.firstSegmentExists = await headCheck(segmentUrl);

  } catch (error) {
    result.error = error.message;
    console.log(`[HLS Scanner] Error scanning ${mode}:`, error.message);
  }

  return result;
}

/**
 * Perform HEAD request to check if resource exists
 * @param {string} url 
 * @returns {Promise<boolean>}
 */
function headCheck(url) {
  return new Promise((resolve) => {
    const request = https.request(url, { method: 'HEAD' }, (response) => {
      resolve(response.statusCode === 200);
    });

    request.on('error', (error) => {
      console.log('[HLS Scanner] HEAD error:', error.message);
      resolve(false);
    });

    request.setTimeout(3000, () => {
      request.destroy();
      resolve(false);
    });

    request.end();
  });
}

module.exports = {
  scanSpaces
};
