// FFmpeg Capability Detection Module
// Detects if ffmpeg-static is available and can spawn

const { spawn } = require('child_process');

/**
 * Detects FFmpeg capability in the current environment
 * @returns {Promise<{hasFfmpegStatic: boolean, ffmpegPath: string|null, canSpawn: boolean, ffmpegVersion?: string, spawnLatencyMs?: number, error?: string}>}
 */
async function detectCapability() {
  const result = {
    hasFfmpegStatic: false,
    ffmpegPath: null,
    canSpawn: false,
    ffmpegVersion: null,
    spawnLatencyMs: null,
    error: null
  };

  try {
    // Try to require ffmpeg-static (dynamic import to avoid crash)
    const ffmpegStatic = require('ffmpeg-static');
    result.hasFfmpegStatic = true;
    result.ffmpegPath = ffmpegStatic;
    
    // Try to spawn ffmpeg -version with timeout and measure latency
    const spawnResult = await testSpawn(ffmpegStatic);
    result.canSpawn = spawnResult.success;
    result.spawnLatencyMs = spawnResult.latencyMs;
    result.ffmpegVersion = spawnResult.version;
    
  } catch (error) {
    result.error = error.message;
    console.log('[FFmpeg Capability] ffmpeg-static not available:', error.message);
  }

  return result;
}

/**
 * Test if we can spawn ffmpeg binary and extract version info
 * @param {string} ffmpegPath 
 * @returns {Promise<{success: boolean, latencyMs: number, version?: string}>}
 */
function testSpawn(ffmpegPath) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        latencyMs: Date.now() - startTime,
        version: null
      });
    }, 1500);

    try {
      const child = spawn(ffmpegPath, ['-version'], { 
        stdio: 'pipe',
        timeout: 1000 
      });

      // Capture output to extract version
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;
        
        // Extract version from output (usually first line)
        let version = null;
        const output = stdout || stderr;
        const versionMatch = output.match(/ffmpeg version ([^\s]+)/i);
        if (versionMatch) {
          version = versionMatch[1];
        }
        
        resolve({
          success: code === 0,
          latencyMs,
          version
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        console.log('[FFmpeg Capability] Spawn error:', error.message);
        resolve({
          success: false,
          latencyMs: Date.now() - startTime,
          version: null
        });
      });

    } catch (error) {
      clearTimeout(timeout);
      console.log('[FFmpeg Capability] Exception during spawn:', error.message);
      resolve({
        success: false,
        latencyMs: Date.now() - startTime,
        version: null
      });
    }
  });
}

module.exports = {
  detectCapability
};
