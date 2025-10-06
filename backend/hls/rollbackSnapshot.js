// Rollback Snapshot System for HLS Playlists
// R6-4: Before publishing new latest/index.m3u8, save index.prev.m3u8

const storageConfig = require('../storage-config');
const { saveAutoLog } = require('../utils/autoLog');

/**
 * Creates a snapshot of current playlist before publishing new version
 * @param {string} mode - 'latest' or 'rolling'
 * @returns {Promise<{success: boolean, snapshotCreated?: boolean, error?: string, previousExists?: boolean}>}
 */
async function createPlaylistSnapshot(mode = 'latest') {
  const result = {
    success: false,
    snapshotCreated: false,
    error: null,
    previousExists: false
  };

  try {
    const sourceKey = `generated/hls/${mode}/index.m3u8`;
    const snapshotKey = `generated/hls/${mode}/index.prev.m3u8`;
    
    // Check if current playlist exists
    let currentPlaylist = null;
    try {
      currentPlaylist = await storageConfig.download(sourceKey);
      result.previousExists = true;
    } catch (downloadError) {
      // No current playlist exists - this is OK for first generation
      saveAutoLog(`[Rollback] No existing playlist to snapshot: ${sourceKey}`, 'HLS_GEN');
      result.success = true;
      return result;
    }

    // Create snapshot by copying current playlist to .prev
    try {
      await storageConfig.upload(snapshotKey, currentPlaylist, {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/vnd.apple.mpegurl'
      });
      
      result.snapshotCreated = true;
      result.success = true;
      
      saveAutoLog(`[Rollback] Snapshot created: ${mode} playlist backed up to ${snapshotKey}`, 'HLS_GEN');
      
    } catch (uploadError) {
      result.error = `Failed to create snapshot: ${uploadError.message}`;
      saveAutoLog(`[Rollback] Snapshot failed: ${result.error}`, 'HLS_GEN');
    }

  } catch (error) {
    result.error = error.message;
    saveAutoLog(`[Rollback] Snapshot error: ${result.error}`, 'HLS_GEN');
  }

  return result;
}

/**
 * Restores playlist from snapshot (.prev -> current)
 * @param {string} mode - 'latest' or 'rolling'  
 * @returns {Promise<{success: boolean, restored?: boolean, error?: string, snapshotExists?: boolean}>}
 */
async function restoreFromSnapshot(mode = 'latest') {
  const result = {
    success: false,
    restored: false,
    error: null,
    snapshotExists: false
  };

  try {
    const sourceKey = `generated/hls/${mode}/index.prev.m3u8`;
    const targetKey = `generated/hls/${mode}/index.m3u8`;
    
    // Check if snapshot exists
    let snapshotContent = null;
    try {
      snapshotContent = await storageConfig.download(sourceKey);
      result.snapshotExists = true;
    } catch (downloadError) {
      result.error = `No snapshot found: ${sourceKey}`;
      saveAutoLog(`[Rollback] Restore failed: ${result.error}`, 'HLS_GEN');
      return result;
    }

    // Restore snapshot to current playlist
    try {
      await storageConfig.upload(targetKey, snapshotContent, {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/vnd.apple.mpegurl'
      });
      
      result.restored = true;
      result.success = true;
      
      saveAutoLog(`[Rollback] Restored: ${mode} playlist restored from ${sourceKey}`, 'HLS_GEN');
      
    } catch (uploadError) {
      result.error = `Failed to restore snapshot: ${uploadError.message}`;
      saveAutoLog(`[Rollback] Restore upload failed: ${result.error}`, 'HLS_GEN');
    }

  } catch (error) {
    result.error = error.message;
    saveAutoLog(`[Rollback] Restore error: ${result.error}`, 'HLS_GEN');
  }

  return result;
}

/**
 * Gets information about available snapshots
 * @param {string} mode - 'latest' or 'rolling'
 * @returns {Promise<{success: boolean, snapshots: Array, error?: string}>}
 */
async function getSnapshotInfo(mode = 'latest') {
  const result = {
    success: false,
    snapshots: [],
    error: null
  };

  try {
    const snapshotKey = `generated/hls/${mode}/index.prev.m3u8`;
    const currentKey = `generated/hls/${mode}/index.m3u8`;
    
    // Check current playlist
    const currentInfo = { type: 'current', key: currentKey, exists: false, size: 0 };
    try {
      const currentContent = await storageConfig.download(currentKey);
      currentInfo.exists = true;
      currentInfo.size = Buffer.byteLength(currentContent, 'utf8');
    } catch (error) {
      // Current doesn't exist
    }
    
    // Check snapshot
    const snapshotInfo = { type: 'snapshot', key: snapshotKey, exists: false, size: 0 };
    try {
      const snapshotContent = await storageConfig.download(snapshotKey);
      snapshotInfo.exists = true;
      snapshotInfo.size = Buffer.byteLength(snapshotContent, 'utf8');
    } catch (error) {
      // Snapshot doesn't exist
    }
    
    result.snapshots = [currentInfo, snapshotInfo];
    result.success = true;

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

module.exports = {
  createPlaylistSnapshot,
  restoreFromSnapshot,
  getSnapshotInfo
};
