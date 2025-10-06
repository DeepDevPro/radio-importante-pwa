// FFmpeg Capability Detection Module
// Detects if ffmpeg-static is available and can spawn

const { spawn } = require('child_process');

/**
 * Detects FFmpeg capability in the current environment
 * @returns {Promise<{hasFfmpegStatic: boolean, ffmpegPath: string|null, canSpawn: boolean, error?: string}>}
 */
async function detectCapability() {
  const result = {
    hasFfmpegStatic: false,
    ffmpegPath: null,
    canSpawn: false,
    error: null
  };

  try {
    // Try to require ffmpeg-static (dynamic import to avoid crash)
    const ffmpegStatic = require('ffmpeg-static');
    result.hasFfmpegStatic = true;
    result.ffmpegPath = ffmpegStatic;
    
    // Try to spawn ffmpeg -version with timeout
    const canSpawn = await testSpawn(ffmpegStatic);
    result.canSpawn = canSpawn;
    
  } catch (error) {
    result.error = error.message;
    console.log('[FFmpeg Capability] ffmpeg-static not available:', error.message);
  }

  return result;
}

/**
 * Test if we can spawn ffmpeg binary
 * @param {string} ffmpegPath 
 * @returns {Promise<boolean>}
 */
function testSpawn(ffmpegPath) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 1500);

    try {
      const child = spawn(ffmpegPath, ['-version'], { 
        stdio: 'pipe',
        timeout: 1000 
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code === 0);
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        console.log('[FFmpeg Capability] Spawn error:', error.message);
        resolve(false);
      });

    } catch (error) {
      clearTimeout(timeout);
      console.log('[FFmpeg Capability] Exception during spawn:', error.message);
      resolve(false);
    }
  });
}

module.exports = {
  detectCapability
};
